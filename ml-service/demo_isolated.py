"""Démonstration synthétique /train → /predict, modèles dans un dossier temporaire."""

import json
import os
import tempfile
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app


def main():
    with tempfile.TemporaryDirectory(prefix='fits-ml-demo-') as directory:
        with patch.dict(os.environ, {
            'ML_MODELS_DIR': directory,
            'ML_SERVICE_SECRET': 'secret-fictif-demo-isole',
            'ML_MIN_TRAIN_SAMPLES': '20',
            'ML_MIN_SAMPLES_PER_CLASS': '5',
        }):
            client = TestClient(app)
            headers = {'X-FITS-ML-SECRET': 'secret-fictif-demo-isole',
                       'X-FITS-USER-ID': '1'}
            rows = [
                {'temperature': 10 + index % 10, 'nb_vetements': 2,
                 'nb_favoris': index % 2, 'ratio_favoris': (index % 2) / 2,
                 'zone_torse': 1, 'is_liked': index % 2}
                for index in range(30)
            ]
            version = 'outfit-v2-demo-synthetique'
            trained = client.post('/train', headers=headers,
                                  json={'feature_version': version, 'data': rows})
            features = {key: value for key, value in rows[0].items() if key != 'is_liked'}
            features['feature_version'] = version
            personalized = client.post('/predict', headers=headers, json=features)
            fallback = client.post('/predict', headers={**headers, 'X-FITS-USER-ID': '2'},
                                   json=features)
            assert trained.status_code == personalized.status_code == fallback.status_code == 200
            assert trained.json()['status'] == 'model trained'
            assert personalized.json()['model_used'] == 'personalized'
            assert fallback.json()['model_used'] == 'fallback'
            assert fallback.json()['reason'] == 'no_model'
            print(json.dumps({
                'source': 'SYNTHÉTIQUE — fonctionnement uniquement, aucune performance réelle',
                'train_status': trained.json()['status'],
                'meme_utilisateur': personalized.json()['model_used'],
                'autre_utilisateur': fallback.json()['model_used'],
                'raison_fallback': fallback.json()['reason'],
                'stockage': 'répertoire temporaire supprimé à la fin'
            }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
