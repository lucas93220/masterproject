import hmac
import math
import os
import threading
import warnings
from collections import Counter
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from sklearn.ensemble import RandomForestClassifier
from sklearn.exceptions import InconsistentVersionWarning

app = FastAPI()

_locks = {}
_locks_guard = threading.Lock()
_base_features = {"temperature", "nb_vetements", "nb_favoris", "ratio_favoris"}


class Dataset(BaseModel):
    data: list[dict]
    feature_version: str
    feature_catalog: Optional[dict] = None


def _setting(name, default):
    value = int(os.getenv(name, default))
    if value < 1:
        raise ValueError(f"{name} doit être un entier positif")
    return value


def _model_path(user_id):
    directory = Path(os.getenv("ML_MODELS_DIR", Path(__file__).parent / "models")).resolve()
    return directory / f"user_{user_id}.joblib"


def _deletion_path(user_id):
    return _model_path(user_id).with_suffix('.deleted')


def _lock_for(user_id):
    with _locks_guard:
        return _locks.setdefault(user_id, threading.Lock())


def _authenticated_user(
    user_id: Optional[str] = Header(default=None, alias="X-FITS-USER-ID"),
    provided_secret: Optional[str] = Header(default=None, alias="X-FITS-ML-SECRET"),
):
    secret = os.getenv("ML_SERVICE_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Service ML non configuré")
    if not provided_secret or not hmac.compare_digest(provided_secret, secret):
        raise HTTPException(status_code=401, detail="Accès ML refusé")
    if (not user_id or not user_id.isascii() or not user_id.isdecimal()
            or len(user_id) > 10 or not 0 < int(user_id) <= 2147483647):
        raise HTTPException(status_code=400, detail="Identifiant utilisateur invalide")
    return int(user_id)


def _validate_rows(rows):
    columns = set(rows[0])
    features = columns - {"is_liked"}
    if not _base_features <= features or any(
        not name.startswith(("zone_", "couleur_", "categorie_", "sous_categorie_", "association_"))
        for name in features - _base_features
    ):
        raise HTTPException(status_code=422, detail="Schéma de features invalide")

    for row in rows:
        if set(row) != columns or type(row.get("is_liked")) is not int or row["is_liked"] not in (0, 1):
            raise HTTPException(status_code=422, detail="Lignes ou labels invalides")
        if any(
            type(row[name]) not in (int, float) or not math.isfinite(row[name])
            for name in features
        ):
            raise HTTPException(status_code=422, detail="Features non numériques")


@app.post("/train")
def train_model(dataset: Dataset, user_id: int = Depends(_authenticated_user)):
    if not dataset.feature_version.startswith("outfit-v2-"):
        raise HTTPException(status_code=422, detail="Version de features invalide")
    rows = dataset.data
    minimum = _setting("ML_MIN_TRAIN_SAMPLES", 20)
    minimum_per_class = _setting("ML_MIN_SAMPLES_PER_CLASS", 5)

    if not rows:
        return {"status": "insufficient_data", "reason": "empty_dataset", "n_samples": 0,
                "n_positive": 0, "n_negative": 0}

    _validate_rows(rows)
    counts = Counter(row["is_liked"] for row in rows)
    summary = {"n_samples": len(rows), "n_positive": counts[1], "n_negative": counts[0]}
    if not counts[0] or not counts[1]:
        return {"status": "insufficient_data", "reason": "single_class", **summary}
    if len(rows) < minimum or min(counts.values()) < minimum_per_class:
        return {"status": "insufficient_data", "reason": "too_few_samples", **summary}

    df = pd.DataFrame(rows)
    X = df.drop("is_liked", axis=1)
    y = df["is_liked"]
    path = _model_path(user_id)

    with _lock_for(user_id):
        if _deletion_path(user_id).exists():
            raise HTTPException(status_code=410, detail="Compte ML supprimé")
        candidate = RandomForestClassifier(random_state=42)
        candidate.fit(X, y)

        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with NamedTemporaryFile(dir=path.parent, prefix=f".user_{user_id}.",
                                suffix=".joblib.tmp", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            joblib.dump({"feature_version": dataset.feature_version,
                         "feature_catalog": dataset.feature_catalog,
                         "model": candidate},
                        temporary_path)
            os.replace(temporary_path, path)
        finally:
            temporary_path.unlink(missing_ok=True)

    return {"status": "model trained", **summary}


def _fallback(data, reason):
    ratio = data.get("ratio_favoris", 0)
    if type(ratio) not in (int, float) or not math.isfinite(ratio) or not 0 <= ratio <= 1:
        raise HTTPException(status_code=422, detail="ratio_favoris invalide")
    return {"probability_like": float(ratio), "model_used": "fallback", "reason": reason}


@app.post("/predict")
def predict(data: dict, user_id: int = Depends(_authenticated_user)):
    if _deletion_path(user_id).exists():
        raise HTTPException(status_code=410, detail="Compte ML supprimé")
    path = _model_path(user_id)
    if not path.is_file() and not path.is_symlink():
        return _fallback(data, "no_model")
    if path.is_symlink():
        return _fallback(data, "invalid_model")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", InconsistentVersionWarning)
            artifact = joblib.load(path)
        if not isinstance(artifact, dict) or artifact.get("feature_version") != data.get("feature_version"):
            return _fallback(data, "incompatible_model")
        model = artifact.get("model")
        if set(model.classes_) != {0, 1} or not hasattr(model, "feature_names_in_"):
            return _fallback(data, "invalid_model")

        features = {key: value for key, value in data.items() if key != "feature_version"}
        if list(features) != list(model.feature_names_in_):
            return _fallback(data, "incompatible_features")
        df = pd.DataFrame([features])
        index = list(model.classes_).index(1)
        probability = float(model.predict_proba(df)[0][index])
        if not math.isfinite(probability):
            return _fallback(data, "invalid_model")
    except Exception:
        return _fallback(data, "invalid_model")

    return {"probability_like": probability, "model_used": "personalized"}


@app.post("/delete-model")
def delete_model(user_id: int = Depends(_authenticated_user)):
    """Idempotent cleanup for an authenticated account deletion."""
    path = _model_path(user_id)
    with _lock_for(user_id):
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Empêche un réentraînement déjà en vol de recréer le modèle après effacement.
        marker = _deletion_path(user_id)
        descriptor = os.open(marker, os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
        path.unlink(missing_ok=True)
    return {"status": "deleted"}
