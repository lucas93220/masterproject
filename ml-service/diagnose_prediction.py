"""Chronomètre l'inférence locale en lecture seule, sans appel HTTP ni réentraînement."""

import argparse
import json
import time
from pathlib import Path
from statistics import median

from app import predict
from evaluate import _validated_rows


REPETITIONS = 5


def measure(payload, inference=predict):
    rows, names = _validated_rows(payload)
    user_id = payload.get('user_id')
    if type(user_id) is not int or not 0 < user_id <= 2147483647:
        raise ValueError('Export avec user_id entier positif requis')
    result = {'source': payload.get('source', 'origine non vérifiée'),
              'scope': 'Fonction FastAPI predict : lecture Joblib, validation et predict_proba ; sans HTTP, Node ni génération'}
    if not rows:
        return {**result, 'status': 'not_measured', 'reason': 'dataset_empty'}
    features = {name: rows[0][name] for name in names}
    features['feature_version'] = payload['feature_version']
    durations = []
    for _ in range(REPETITIONS):
        start = time.perf_counter_ns()
        response = inference(features, user_id=user_id)
        durations.append((time.perf_counter_ns() - start) / 1e6)
        if response.get('model_used') != 'personalized':
            return {**result, 'status': 'not_measured',
                    'reason': response.get('reason', 'model_unavailable')}
    return {**result, 'status': 'measured', 'repetitions': REPETITIONS,
            'inference_ms': {'min': min(durations), 'median': median(durations),
                             'max': max(durations)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True, help='Export JSON privé d’un utilisateur')
    args = parser.parse_args()
    try:
        result = measure(json.loads(args.input.read_text(encoding='utf-8')))
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
