"""Experimental representation shared by offline evaluation and serving.

No storage, database access or environment configuration in this module.
"""

import math
import warnings
from itertools import combinations

from sklearn.exceptions import ConvergenceWarning
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

REPRESENTATION_VERSION = 'items-pairs-v1'
BASE_FEATURES = ('temperature', 'nb_vetements', 'nb_favoris', 'ratio_favoris')
MAX_GARMENTS = 40


def interaction_features(row, feature_names, include_pairs=True):
    features = {name: row[name] for name in feature_names}
    # Fixed scales, independent of the test set. Preserve the offline protocol.
    features['temperature'] /= 40
    features['nb_vetements'] /= 10
    features['nb_favoris'] /= 10
    ids = sorted(row['garment_ids'])
    for item in ids:
        features[f'item:{item}'] = 1
    if include_pairs:
        for first, second in combinations(ids, 2):
            features[f'pair:{first}:{second}'] = 1
    return features


def validate_observation(row, feature_names=None, training=False):
    if not isinstance(row, dict):
        raise ValueError('Observation invalide')
    metadata = {'garment_ids', 'is_liked'} if training else {'garment_ids'}
    names = set(row) - metadata
    if (not set(BASE_FEATURES) <= names or len(names) > 512 or
            any(not name.startswith(('zone_', 'couleur_', 'categorie_',
                                     'sous_categorie_', 'association_'))
                for name in names - set(BASE_FEATURES))):
        raise ValueError('Schéma de features invalide')
    if feature_names is not None and names != set(feature_names):
        raise ValueError('Features incompatibles')
    if any(type(row[name]) not in (int, float) or not math.isfinite(row[name]) for name in names):
        raise ValueError('Features non numériques')
    ids = row.get('garment_ids')
    if (not isinstance(ids, list) or not 1 <= len(ids) <= MAX_GARMENTS or
            any(type(item) is not int or not 0 < item <= 2147483647 for item in ids) or
            len(set(ids)) != len(ids) or row['nb_vetements'] != len(ids)):
        raise ValueError('Identités des vêtements invalides')
    if (not 0 <= row['ratio_favoris'] <= 1 or
            not 0 <= row['nb_favoris'] <= row['nb_vetements']):
        raise ValueError('Favoris invalides')
    if training and (type(row.get('is_liked')) is not int or row['is_liked'] not in (0, 1)):
        raise ValueError('Label invalide')
    return list(BASE_FEATURES) + sorted(names - set(BASE_FEATURES))


def fit_candidate(rows, feature_names):
    # Fixed before prospective testing; no parameter search or class balancing.
    model = make_pipeline(DictVectorizer(sparse=True),
                          LogisticRegression(C=0.1, max_iter=3000, random_state=42))
    with warnings.catch_warnings():
        warnings.simplefilter('error', ConvergenceWarning)
        model.fit([interaction_features(row, feature_names) for row in rows],
                  [row['is_liked'] for row in rows])
    return model


def predict_candidates(model, rows, feature_names):
    index = list(model.classes_).index(1)
    probabilities = model.predict_proba([
        interaction_features(row, feature_names) for row in rows])[:, index]
    if any(not math.isfinite(float(value)) or not 0 <= value <= 1 for value in probabilities):
        raise ValueError('Probabilité invalide')
    return [float(value) for value in probabilities]
