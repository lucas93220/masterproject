"""Compare garment identity and pair features offline, without loading or saving Joblib."""

import argparse
import json
import math
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from itertools import combinations
from pathlib import Path

import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, average_precision_score,
                             balanced_accuracy_score, brier_score_loss,
                             f1_score, log_loss, roc_auc_score)


SEED = 42
BASE_FEATURES = ('temperature', 'nb_vetements', 'nb_favoris', 'ratio_favoris')
METADATA = {'id_tenue', 'is_liked', 'garment_ids', 'garment_ids_source', 'reviewed_at'}
MIN_ROWS = 50
MIN_CLASS = 20
MIN_TRAIN = 40
MIN_TRAIN_CLASS = 10
MIN_TEST = 15
MIN_TEST_CLASS = 5


def _validated(payload):
    if not isinstance(payload, dict) or payload.get('format') != 'fits-interactions-v1':
        raise ValueError('Export interactions FITS attendu')
    if type(payload.get('user_id')) is not int or not 0 < payload['user_id'] <= 2147483647:
        raise ValueError('Identifiant du compte invalide')
    if not isinstance(payload.get('feature_version'), str) or not payload['feature_version'].startswith('outfit-v2-'):
        raise ValueError('Version de features invalide')
    rows = payload.get('data')
    if not isinstance(rows, list):
        raise ValueError('Liste d’avis invalide')
    v2_count = payload.get('n_v2_rows', len(rows))
    excluded = payload.get('n_excluded_for_interactions', 0)
    if (type(v2_count) is not int or type(excluded) is not int or excluded < 0 or
            v2_count != len(rows) + excluded):
        raise ValueError('Effectifs d’export incohérents')
    if not rows:
        return [], []

    columns = set(rows[0]) if isinstance(rows[0], dict) else set()
    features = columns - METADATA
    if not METADATA <= columns or not set(BASE_FEATURES) <= features or any(
        not name.startswith(('zone_', 'couleur_', 'categorie_', 'sous_categorie_', 'association_'))
        for name in features - set(BASE_FEATURES)
    ):
        raise ValueError('Colonnes de features invalides')
    feature_names = list(BASE_FEATURES) + sorted(features - set(BASE_FEATURES))
    validated = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != columns:
            raise ValueError('Lignes de schémas différents')
        if type(row['id_tenue']) is not int or row['id_tenue'] <= 0:
            raise ValueError('Identifiant de tenue invalide')
        if type(row['is_liked']) is not int or row['is_liked'] not in (0, 1):
            raise ValueError('Like/dislike invalide')
        ids = row['garment_ids']
        if (not isinstance(ids, list) or not ids or
                any(type(item) is not int or not 0 < item <= 2147483647 for item in ids) or
                len(ids) != len(set(ids))):
            raise ValueError('Identifiants de vêtements invalides')
        if row['garment_ids_source'] not in ('snapshot', 'composer_current'):
            raise ValueError('Provenance des identifiants inconnue')
        if any(type(row[name]) not in (int, float) or not math.isfinite(row[name])
               for name in feature_names):
            raise ValueError('Features non numériques')
        try:
            date = datetime.fromisoformat(row['reviewed_at'].replace('Z', '+00:00'))
        except (AttributeError, ValueError) as error:
            raise ValueError('Date d’avis invalide') from error
        if date.tzinfo is None:
            raise ValueError('Date d’avis sans fuseau horaire')
        validated.append({**row, 'garment_ids': tuple(sorted(ids)),
                          '_reviewed_at': date.astimezone(timezone.utc)})
    return validated, feature_names


def _pair_keys(ids):
    return combinations(ids, 2)


def _interaction_features(row, feature_names, include_pairs=True):
    features = {name: row[name] for name in feature_names}
    # Échelles fixées avant le test ; les indicateurs binaires restent à 0/1.
    features['temperature'] /= 40
    features['nb_vetements'] /= 10
    features['nb_favoris'] /= 10
    for item in row['garment_ids']:
        features[f'item:{item}'] = 1
    if include_pairs:
        for first, second in _pair_keys(row['garment_ids']):
            features[f'pair:{first}:{second}'] = 1
    return features


def _metrics(model, x_test, y_test):
    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, list(model.classes_).index(1)]
    return {
        'accuracy': float(accuracy_score(y_test, predictions)),
        'balanced_accuracy': float(balanced_accuracy_score(y_test, predictions)),
        'f1_like': float(f1_score(y_test, predictions, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, probabilities)),
        'average_precision': float(average_precision_score(y_test, probabilities)),
        'log_loss': float(log_loss(y_test, probabilities, labels=[0, 1])),
        'brier': float(brier_score_loss(y_test, probabilities)),
    }


def evaluate(payload):
    rows, feature_names = _validated(payload)
    counts = Counter(row['is_liked'] for row in rows)
    sources = Counter(row['garment_ids_source'] for row in rows)
    pair_counts = Counter(pair for row in rows for pair in _pair_keys(row['garment_ids']))
    report = {
        'status': 'insufficient_data',
        'source': payload.get('source', 'origine non vérifiée'),
        'user_id': payload['user_id'],
        'feature_version': payload['feature_version'],
        'n_rows': len(rows), 'n_likes': counts[1], 'n_dislikes': counts[0],
        'n_v2_rows': payload.get('n_v2_rows', len(rows)),
        'n_excluded_for_interactions': payload.get('n_excluded_for_interactions', 0),
        'temperatures': dict(sorted(Counter(row['temperature'] for row in rows).items())),
        'n_base_features': len(feature_names),
        'identity_sources': dict(sources),
        'distinct_garments': len({item for row in rows for item in row['garment_ids']}),
        'distinct_pairs': len(pair_counts),
        'pairs_seen_twice': sum(count >= 2 for count in pair_counts.values()),
        'pairs_seen_three_times': sum(count >= 3 for count in pair_counts.values()),
        'method': ('Découpage chronologique 75/25, graine 42 ; retrait de l’entraînement '
                   'des tenues, compositions et vecteurs v2 identiques au test. '
                   'Vocabulaire des articles/paires appris sur l’entraînement seulement.'),
    }
    if len(rows) < MIN_ROWS or min(counts[0], counts[1]) < MIN_CLASS:
        report['reason'] = (f'Il faut au moins {MIN_ROWS} avis et {MIN_CLASS} avis '
                            'de chaque classe avant le découpage')
        return report

    ordered = sorted(rows, key=lambda row: (row['_reviewed_at'], row['id_tenue']))
    cutoff = math.floor(0.75 * len(ordered))
    test = ordered[cutoff:]
    test_outfits = {row['id_tenue'] for row in test}
    test_compositions = {row['garment_ids'] for row in test}
    test_vectors = {tuple(row[name] for name in feature_names) for row in test}
    train = [row for row in ordered[:cutoff]
             if row['id_tenue'] not in test_outfits
             and row['garment_ids'] not in test_compositions
             and tuple(row[name] for name in feature_names) not in test_vectors]
    train_counts = Counter(row['is_liked'] for row in train)
    test_counts = Counter(row['is_liked'] for row in test)
    report.update({
        'n_train': len(train), 'n_test': len(test),
        'purged_from_train': cutoff - len(train),
        'train_likes': train_counts[1], 'train_dislikes': train_counts[0],
        'test_likes': test_counts[1], 'test_dislikes': test_counts[0],
        'test_start': test[0]['_reviewed_at'].isoformat(),
        'train_temperatures': dict(sorted(Counter(row['temperature'] for row in train).items())),
        'test_temperatures': dict(sorted(Counter(row['temperature'] for row in test).items())),
    })
    if (len(train) < MIN_TRAIN or min(train_counts[0], train_counts[1]) < MIN_TRAIN_CLASS or
            len(test) < MIN_TEST or min(test_counts[0], test_counts[1]) < MIN_TEST_CLASS):
        report['reason'] = ('Découpage insuffisant après exclusion des doublons : '
                            f'entraînement ≥{MIN_TRAIN} dont ≥{MIN_TRAIN_CLASS} par classe ; '
                            f'test ≥{MIN_TEST} dont ≥{MIN_TEST_CLASS} par classe')
        return report

    if (max(row['_reviewed_at'] for row in train) > min(row['_reviewed_at'] for row in test) or
            {row['id_tenue'] for row in train} & test_outfits or
            {row['garment_ids'] for row in train} & test_compositions or
            {tuple(row[name] for name in feature_names) for row in train} & test_vectors):
        raise AssertionError('Fuite entre entraînement et test')

    base_train = pd.DataFrame([{name: row[name] for name in feature_names} for row in train],
                              columns=feature_names)
    base_test = pd.DataFrame([{name: row[name] for name in feature_names} for row in test],
                             columns=feature_names)
    item_vectorizer = DictVectorizer(sparse=True)
    item_train = item_vectorizer.fit_transform(
        [_interaction_features(row, feature_names, include_pairs=False) for row in train])
    item_test = item_vectorizer.transform(
        [_interaction_features(row, feature_names, include_pairs=False) for row in test])
    pair_vectorizer = DictVectorizer(sparse=True)
    enhanced_train = pair_vectorizer.fit_transform(
        [_interaction_features(row, feature_names) for row in train])
    enhanced_test = pair_vectorizer.transform(
        [_interaction_features(row, feature_names) for row in test])
    y_train = [row['is_liked'] for row in train]
    y_test = [row['is_liked'] for row in test]
    models = {
        'majority': (DummyClassifier(strategy='prior'), base_train, base_test),
        'rf_v2': (RandomForestClassifier(random_state=SEED), base_train, base_test),
        'rf_items_only': (RandomForestClassifier(random_state=SEED), item_train, item_test),
        'rf_items_pairs': (RandomForestClassifier(random_state=SEED),
                           enhanced_train, enhanced_test),
        'logistic_items_pairs': (LogisticRegression(C=0.1, max_iter=3000,
                                                    random_state=SEED),
                                 enhanced_train, enhanced_test),
    }
    metrics = {}
    for name, (model, x_train, x_test) in models.items():
        model.fit(x_train, y_train)
        metrics[name] = _metrics(model, x_test, y_test)

    train_pairs = {pair for row in train for pair in _pair_keys(row['garment_ids'])}
    test_pairs = {pair for row in test for pair in _pair_keys(row['garment_ids'])}
    train_items = {item for row in train for item in row['garment_ids']}
    test_items = {item for row in test for item in row['garment_ids']}
    report.update({
        'status': 'evaluated',
        'n_item_features': len(item_vectorizer.feature_names_),
        'n_enhanced_features': len(pair_vectorizer.feature_names_),
        'known_test_pairs': len(train_pairs & test_pairs),
        'distinct_test_pairs': len(test_pairs),
        'unknown_test_items': len(test_items - train_items),
        'metrics': metrics,
    })
    return report


def format_report(report):
    synthetic = 'SYNTHÉTIQUE — AUCUNE PERFORMANCE RÉELLE DE FITS' if report.get('synthetic') else \
        'Export local privé — provenance des votes à vérifier avant toute conclusion'
    lines = [f'# Interactions vêtement–vêtement — {synthetic}', '',
             f"- Source : {report['source']}",
             '- Compte : un seul utilisateur ; identifiant non publié',
             f"- Avis : {report['n_rows']} ; likes : {report['n_likes']} ; dislikes : {report['n_dislikes']}",
             f"- Températures (°C → avis) : {report['temperatures']}",
             f"- Lignes v2 exploitables : {report['n_v2_rows']} ; exclues de cette analyse "
             f"faute d’identité/date fiable : {report['n_excluded_for_interactions']}",
             f"- Identifiants : {report['identity_sources']}",
             f"- Articles/paires distincts : {report['distinct_garments']}/{report['distinct_pairs']}",
             f"- Paires observées ≥2/≥3 fois : {report['pairs_seen_twice']}/{report['pairs_seen_three_times']}",
             f"- Méthode : {report['method']}", '']
    if report['status'] != 'evaluated':
        lines += [f"**Métriques non calculées :** {report['reason']}", '']
        return '\n'.join(lines)
    lines += [f"- Découpage : {report['n_train']} avis entraînement, "
              f"{report['n_test']} test ; {report['purged_from_train']} doublons retirés",
              f"- Classes entraînement : {report['train_likes']} likes/"
              f"{report['train_dislikes']} dislikes ; test : {report['test_likes']}/"
              f"{report['test_dislikes']}",
              f"- Températures entraînement/test : {report['train_temperatures']} / "
              f"{report['test_temperatures']}",
              f"- Début du test : {report['test_start']}",
              f"- Paires du test déjà vues en entraînement : "
              f"{report['known_test_pairs']}/{report['distinct_test_pairs']}",
              f"- Nouveaux articles présents seulement dans le test : "
              f"{report['unknown_test_items']}",
              f"- Colonnes entraînées : {report['n_base_features']} de base, "
              f"{report['n_item_features']} avec articles, "
              f"{report['n_enhanced_features']} avec articles/paires", '',
              '| Modèle | Accuracy | Balanced accuracy | F1 like | ROC AUC | AP | Log loss ↓ | Brier ↓ |',
              '|---|---:|---:|---:|---:|---:|---:|---:|']
    for name, label in (('majority', 'Majorité'), ('rf_v2', 'RF actuel, features v2'),
                        ('rf_items_only', 'RF + articles seuls'),
                        ('rf_items_pairs', 'RF + articles/paires'),
                        ('logistic_items_pairs', 'Logistique L2 + articles/paires')):
        values = report['metrics'][name]
        lines.append('| ' + label + ' | ' + ' | '.join(
            f"{values[metric]:.3f}" for metric in
            ('accuracy', 'balanced_accuracy', 'f1_like', 'roc_auc',
             'average_precision', 'log_loss', 'brier')) + ' |')
    lines += ['', 'Un seul test temporel : aucune recherche de découpage favorable ni réglage de '
              'paramètres. Les scores concernent les tenues étiquetées dans cet export ; '
              'ils ne mesurent pas le classement des cinq candidats non jugés. Le partage '
              'd’articles entre entraînement et test est voulu pour tester les préférences '
              'apprises ; une corrélation de paire ne prouve pas la cause du vote. '
              'Aucun modèle Joblib applicatif n’est chargé ou modifié.', '']
    return '\n'.join(lines)


def synthetic_dataset():
    """Fixture déterministe pour vérifier le protocole, jamais une mesure FITS."""
    rng = random.Random(SEED)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = []
    for index in range(160):
        ids = sorted(rng.sample(range(1, 9), 4))
        favorites = rng.randrange(5)
        label_probability = 0.12 if 1 in ids and 2 in ids else 0.75
        row = {
            'id_tenue': index + 1, 'is_liked': int(rng.random() < label_probability),
            'garment_ids': ids, 'garment_ids_source': 'snapshot',
            'reviewed_at': (start + timedelta(minutes=index)).isoformat(),
            'temperature': 5 + index % 25, 'nb_vetements': 4,
            'nb_favoris': favorites, 'ratio_favoris': favorites / 4,
            'zone_torse': 1, 'zone_jambes': 1, 'zone_pieds': 1,
            'couleur_noir': rng.randrange(2), 'couleur_bleu': rng.randrange(2),
            'couleur_rouge': rng.randrange(2),
        }
        row.update({f'zone_synthetique_{slot}': 0 for slot in range(6)})
        row.update({f'couleur_synthetique_{slot}': 0 for slot in range(39)})
        row.update({f'categorie_{slot:02d}': 0 for slot in range(10)})
        row.update({f'sous_categorie_{slot:02d}': 0 for slot in range(18)})
        row.update({f'association_synthetique_{slot}': 0 for slot in range(2)})
        rows.append(row)
    return {'format': 'fits-interactions-v1', 'user_id': 999,
            'feature_version': 'outfit-v2-synthetic-only',
            'source': 'DONNÉES SYNTHÉTIQUES générées par evaluate_interactions.py',
            'n_v2_rows': len(rows), 'n_excluded_for_interactions': 0,
            'data': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--input', type=Path, help='Export privé --interactions')
    source.add_argument('--synthetic', action='store_true', help='Fixture fictive uniquement')
    args = parser.parse_args()
    payload = synthetic_dataset() if args.synthetic else json.loads(args.input.read_text())
    report = evaluate(payload)
    report['synthetic'] = args.synthetic
    print(format_report(report))


if __name__ == '__main__':
    main()
