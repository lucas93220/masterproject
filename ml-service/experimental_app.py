"""Default articles/pairs service. Separate artifacts from the reference RF."""

import fcntl
import os
import warnings
from collections import Counter
from contextlib import contextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

import joblib
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ValidationError
from sklearn.exceptions import InconsistentVersionWarning

from app import _authenticated_user, _fallback, _lock_for, _setting
from interaction_model import (REPRESENTATION_VERSION, fit_candidate,
                               predict_candidates, validate_observation)

app = FastAPI(title='FITS — recommandation articles et paires')


class TrainingRequest(BaseModel):
    data: list[dict]
    feature_version: str
    representation_version: str


class PredictionRequest(BaseModel):
    candidates: list[dict]
    feature_version: str
    representation_version: str


def _directory():
    configured = os.getenv('ML_EXPERIMENTAL_MODELS_DIR')
    if not configured or not Path(configured).is_absolute():
        raise HTTPException(503, 'Répertoire des modèles articles/paires absolu requis')
    directory = Path(configured).resolve()
    repo = Path(__file__).resolve().parent.parent
    reference = Path(os.getenv('ML_MODELS_DIR', repo / 'ml-service' / 'models')).resolve()
    if (directory == reference or directory in reference.parents or reference in directory.parents
            or directory == repo or repo in directory.parents or directory in repo.parents):
        raise HTTPException(503, 'Le stockage articles/paires doit être séparé du dépôt et des modèles de référence')
    # Provision only a new or empty private directory; never adopt an existing model store.
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    marker = directory / '.fits-items-pairs-v1'
    with _lock_for('experiment-directory'):
        if marker.is_symlink():
            raise HTTPException(503, 'Marqueur de modèle invalide')
        if not marker.exists():
            if any(directory.iterdir()):
                raise HTTPException(503, 'Répertoire de modèles non vide et non initialisé')
            try:
                with marker.open('x') as stream:
                    stream.write(REPRESENTATION_VERSION)
            except FileExistsError:
                pass
        if marker.read_text() != REPRESENTATION_VERSION:
            raise HTTPException(503, 'Marqueur de modèle incompatible')
    return directory


@contextmanager
def _locked_user(user_id):
    directory = _directory()
    # File lock also serializes concurrent processes (macOS/Linux).
    with _lock_for(f'experiment-{user_id}'):
        descriptor = os.open(directory / f'user_{user_id}.lock',
                             os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, 'a') as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            try:
                yield directory / f'user_{user_id}.joblib'
            finally:
                fcntl.flock(stream, fcntl.LOCK_UN)


def _check_request(feature_version, representation_version):
    if not feature_version.startswith('outfit-v2-') or representation_version != REPRESENTATION_VERSION:
        raise HTTPException(422, 'Version de représentation invalide')


def _check_deleted(path):
    if path.with_suffix('.deleted').exists():
        raise HTTPException(410, 'Compte ML supprimé')


@app.post('/train')
def train(request: TrainingRequest, user_id: int = Depends(_authenticated_user)):
    _check_request(request.feature_version, request.representation_version)
    rows = request.data
    if len(rows) > 50000:
        raise HTTPException(422, 'Dataset trop volumineux')
    try:
        names = validate_observation(rows[0], training=True) if rows else []
        for row in rows:
            validate_observation(row, names, training=True)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    counts = Counter(row['is_liked'] for row in rows)
    summary = {'n_samples': len(rows), 'n_positive': counts[1], 'n_negative': counts[0]}
    reason = ('empty_dataset' if not rows else 'single_class' if not counts[0] or not counts[1]
              else 'too_few_samples' if len(rows) < _setting('ML_MIN_TRAIN_SAMPLES', 20) or
              min(counts.values()) < _setting('ML_MIN_SAMPLES_PER_CLASS', 5) else None)
    with _locked_user(user_id) as path:
        _check_deleted(path)
        if reason:
            return {'status': 'insufficient_data', 'reason': reason, **summary}
        try:
            model = fit_candidate(rows, names)
            revision = uuid4().hex
            artifact = {'representation_version': REPRESENTATION_VERSION,
                        'feature_version': request.feature_version, 'user_id': user_id,
                        'feature_names': names, 'model': model, 'revision': revision,
                        'summary': summary}
            with NamedTemporaryFile(dir=path.parent, prefix='.candidate-', delete=False) as stream:
                temporary = Path(stream.name)
            try:
                joblib.dump(artifact, temporary)
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
        except Exception as error:
            # Never expose dataset contents or serializer details to the client.
            raise HTTPException(503, 'Entraînement indisponible ; modèle précédent conservé') from error
    return {'status': 'model trained', 'model_variant': REPRESENTATION_VERSION,
            'model_revision': revision, **summary}


@app.post('/predict-batch')
def predict_batch(request: PredictionRequest, user_id: int = Depends(_authenticated_user)):
    _check_request(request.feature_version, request.representation_version)
    if not 1 <= len(request.candidates) <= 5:
        raise HTTPException(422, 'Entre une et cinq tenues sont requises')
    try:
        for row in request.candidates:
            validate_observation(row)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error

    def fallback(reason):
        return {'predictions': [_fallback(row, reason) for row in request.candidates]}

    with _locked_user(user_id) as path:
        _check_deleted(path)
        if path.is_symlink():
            return fallback('invalid_model')
        if not path.is_file():
            return fallback('no_model')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', InconsistentVersionWarning)
                artifact = joblib.load(path)
            if (artifact['user_id'] != user_id or
                    artifact['representation_version'] != REPRESENTATION_VERSION or
                    artifact['feature_version'] != request.feature_version):
                return fallback('incompatible_model')
            names = artifact['feature_names']
            try:
                for row in request.candidates:
                    validate_observation(row, names)
            except ValueError:
                return fallback('incompatible_features')
            probabilities = predict_candidates(artifact['model'], request.candidates, names)
            vocabulary = artifact['model'].steps[0][1].vocabulary_
            return {'predictions': [
                {'probability_like': probability, 'model_used': 'personalized',
                 'model_variant': REPRESENTATION_VERSION, 'model_revision': artifact['revision'],
                 'unknown_garments': sum(f'item:{item}' not in vocabulary for item in row['garment_ids'])}
                for row, probability in zip(request.candidates, probabilities)]}
        except Exception:
            return fallback('invalid_model')


@app.post('/predict')
def predict(data: dict, user_id: int = Depends(_authenticated_user)):
    feature_version = data.get('feature_version', '')
    representation = data.get('representation_version', '')
    row = {key: value for key, value in data.items()
           if key not in ('feature_version', 'representation_version')}
    try:
        request = PredictionRequest(candidates=[row], feature_version=feature_version,
                                    representation_version=representation)
    except ValidationError as error:
        raise HTTPException(422, 'Requête de prédiction invalide') from error
    return predict_batch(request, user_id)['predictions'][0]


@app.post('/delete-model')
def delete(user_id: int = Depends(_authenticated_user)):
    with _locked_user(user_id) as path:
        descriptor = os.open(path.with_suffix('.deleted'), os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
        path.unlink(missing_ok=True)
    return {'status': 'deleted'}
