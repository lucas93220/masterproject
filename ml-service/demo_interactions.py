"""Temporary synthetic demonstration, or JSON bridge for isolated Node tests."""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from experimental_app import app
from interaction_model import REPRESENTATION_VERSION


def fictional_payload():
    rows = [dict(temperature=18, nb_vetements=4, nb_favoris=2, ratio_favoris=0.5,
                 zone_torse=1, garment_ids=[jean, coat, 5, 6],
                 is_liked=int((jean == 1) != (coat == 3)))
            for _ in range(20) for jean in (1, 2) for coat in (3, 4)]
    contract = {'feature_version': 'outfit-v2-synthetic-demo',
                'representation_version': REPRESENTATION_VERSION}
    return {'train_one': {**contract, 'data': rows},
            'train_two': {**contract, 'data': [{**row, 'is_liked': 1 - row['is_liked']} for row in rows]},
            'batch': {**contract, 'candidates': [{key: value for key, value in row.items()
                                                if key != 'is_liked'} for row in rows[:4]]}}


def run_demo(payload):
    with tempfile.TemporaryDirectory(prefix='fits-interactions-demo-') as directory:
        root = Path(directory)
        reference = root / 'reference'
        reference.mkdir()
        sentinel = reference / 'user_1.joblib'
        sentinel.write_bytes(b'reference-untouched')
        with patch.dict(os.environ, {
            'ML_SERVICE_SECRET': 'fictional-isolated-demo-secret',
            'ML_MODELS_DIR': str(reference),
            'ML_EXPERIMENTAL_MODELS_DIR': str(root / 'experiment'),
            'ML_MIN_TRAIN_SAMPLES': '20', 'ML_MIN_SAMPLES_PER_CLASS': '5',
        }), TestClient(app) as client:
            def post(endpoint, user_id, body):
                response = client.post(endpoint, json=body, headers={
                    'X-FITS-USER-ID': str(user_id),
                    'X-FITS-ML-SECRET': 'fictional-isolated-demo-secret'})
                response.raise_for_status()
                return response.json()

            first = post('/train', 1, payload['train_one'])
            second = post('/train', 2, payload['train_two'])
            one = post('/predict-batch', 1, payload['batch'])
            two = post('/predict-batch', 2, payload['batch'])
            unseen = post('/predict-batch', 3, payload['batch'])
            assert sentinel.read_bytes() == b'reference-untouched'
            assert first['status'] == second['status'] == 'model trained'
            assert all(row['model_used'] == 'personalized' for row in one['predictions'])
            assert all(row['reason'] == 'no_model' for row in unseen['predictions'])
            return {'train_one': first, 'train_two': second,
                    'predict_one': one, 'predict_two': two, 'no_model': unseen,
                    'reference_unchanged': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--test-bridge', action='store_true',
                        help='Read fictional test payloads from stdin, temporary storage only')
    args = parser.parse_args()
    result = run_demo(json.load(sys.stdin) if args.test_bridge else fictional_payload())
    if args.test_bridge:
        print(json.dumps(result))
        return
    first = result['predict_one']['predictions']
    second = result['predict_two']['predictions']
    assert first[0]['probability_like'] < first[1]['probability_like']
    assert second[0]['probability_like'] > second[1]['probability_like']
    print(json.dumps({
        'source': 'SYNTHÉTIQUE — preuve de fonctionnement, aucune performance réelle',
        'caracteristiques_generales_identiques': True,
        'association_distinguee': True, 'preferences_opposees_par_utilisateur': True,
        'utilisateur_sans_modele': 'fallback/no_model',
        'reference_inchangee': result['reference_unchanged'],
        'stockage': 'temporaire, supprimé en fin de démonstration',
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
