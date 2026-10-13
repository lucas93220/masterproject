"""Audit hors ligne ciblé : features et score de classement, sans toucher aux Joblib."""

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean

import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, average_precision_score, balanced_accuracy_score,
                             brier_score_loss, roc_auc_score)
from sklearn.model_selection import StratifiedGroupKFold

from evaluate import _validated_rows
from evaluate_robust import _groups


SEED = 42
FOLDS = 4
BASE_FEATURES = ('temperature', 'nb_vetements', 'nb_favoris', 'ratio_favoris')


def _family(name):
    if name in BASE_FEATURES:
        return 'globales'
    if name.startswith('sous_categorie_'):
        return 'sous_categorie'
    return name.split('_', 1)[0]


def _summary(values):
    return {'mean': float(mean(values)), 'min': float(min(values)), 'max': float(max(values))}


def audit(payload):
    rows, names = _validated_rows(payload)
    labels = [row['is_liked'] for row in rows]
    counts = Counter(labels)
    report = {
        'source': payload.get('source', 'origine non vérifiée'),
        'feature_version': payload['feature_version'],
        'seed': SEED,
        'n_folds': FOLDS,
        'n_rows': len(rows),
        'n_likes': counts[1],
        'n_dislikes': counts[0],
        'n_features': len(names),
        'status': 'insufficient_data',
    }
    if not rows:
        report['reason'] = 'Dataset vide'
        return report

    features = pd.DataFrame([{name: row[name] for name in names} for row in rows], columns=names)
    variable = [name for name in names if features[name].nunique() > 1]
    signature_names = defaultdict(list)
    for name in variable:
        signature_names[tuple(features[name])].append(name)
    groups, feature_owner = _groups(rows, names)
    group_members = defaultdict(list)
    vector_labels = defaultdict(Counter)
    for index, row in enumerate(rows):
        group_members[groups[index]].append(index)
        vector_labels[tuple(row[name] for name in names)][row['is_liked']] += 1

    family_counts = Counter(_family(name) for name in names)
    family_variable = Counter(_family(name) for name in variable)
    report.update({
        'n_outfits': len({row['id_tenue'] for row in rows}),
        'n_groups': len(group_members),
        'group_sizes': dict(sorted(Counter(map(len, group_members.values())).items())),
        'groups_with_both_labels': sum(
            len({labels[index] for index in members}) == 2
            for members in group_members.values()),
        'n_distinct_vectors': len(feature_owner),
        'conflicting_vectors': sum(len(value) == 2 for value in vector_labels.values()),
        'minimum_errors_for_identical_vectors': sum(min(value[0], value[1])
                                                     for value in vector_labels.values()),
        'n_constant_features': len(names) - len(variable),
        'variable_features': variable,
        'distinct_variable_column_patterns': len(signature_names),
        'identical_variable_columns': [names for names in signature_names.values()
                                       if len(names) > 1],
        'feature_families': {family: {'total': family_counts[family],
                                       'variable': family_variable[family]}
                             for family in sorted(family_counts)},
    })

    if len(rows) < 50 or min(counts[0], counts[1]) < 20:
        report['reason'] = 'Moins de 50 avis ou moins de 20 avis par classe'
        return report
    if len(group_members) < FOLDS or min(
            len({groups[index] for index, label in enumerate(labels) if label == value})
            for value in (0, 1)) < FOLDS:
        report['reason'] = 'Moins de quatre groupes distincts dans une classe'
        return report

    splitter = StratifiedGroupKFold(n_splits=FOLDS, shuffle=True, random_state=SEED)
    fold_details = []
    scores = {model: defaultdict(list) for model in ('random_forest', 'global_only', 'prior')}
    pair_weighted_auc = defaultdict(float)
    total_pairs = 0
    for fold_index, (train, test) in enumerate(splitter.split(features, labels, groups), start=1):
        train_labels = [labels[index] for index in train]
        test_labels = [labels[index] for index in test]
        if {groups[index] for index in train} & {groups[index] for index in test}:
            raise AssertionError('Fuite entre groupes entraînement et test')
        if len(set(train_labels)) != 2:
            report['reason'] = f'Une seule classe à l’entraînement au pli {fold_index}'
            return report

        test_counts = Counter(test_labels)
        pair_count = test_counts[1] * test_counts[0]
        total_pairs += pair_count

        models = {
            'random_forest': (RandomForestClassifier(random_state=SEED), names),
            'global_only': (RandomForestClassifier(random_state=SEED), list(BASE_FEATURES)),
            'prior': (DummyClassifier(strategy='prior'), names),
        }
        for model_name, (model, columns) in models.items():
            model.fit(features.iloc[train][columns], train_labels)
            x_test = features.iloc[test][columns]
            probability = model.predict_proba(x_test)[:, list(model.classes_).index(1)]
            prediction = model.predict(x_test)
            scores[model_name]['accuracy'].append(float(accuracy_score(test_labels, prediction)))
            scores[model_name]['balanced_accuracy'].append(float(
                balanced_accuracy_score(test_labels, prediction)))
            scores[model_name]['brier'].append(float(brier_score_loss(test_labels, probability)))
            if len(set(test_labels)) == 2:
                auc = float(roc_auc_score(test_labels, probability))
                scores[model_name]['roc_auc'].append(auc)
                pair_weighted_auc[model_name] += auc * pair_count
                scores[model_name]['average_precision'].append(float(
                    average_precision_score(test_labels, probability)))

        fold_details.append({
            'fold': fold_index,
            'n_train': len(train),
            'n_test': len(test),
            'train_likes': Counter(train_labels)[1],
            'train_dislikes': Counter(train_labels)[0],
            'test_likes': test_counts[1],
            'test_dislikes': test_counts[0],
            'like_dislike_pairs': pair_count,
            'train_groups': len({groups[index] for index in train}),
            'test_groups': len({groups[index] for index in test}),
            'overlapping_groups': 0,
        })

    report.update({
        'status': 'evaluated' if all(item['test_likes'] and item['test_dislikes']
                                     for item in fold_details) else 'partial',
        'method': 'StratifiedGroupKFold fixe à quatre plis ; groupes = même tenue ou vecteur identique',
        'folds': fold_details,
        'metrics': {model: {metric: _summary(values) for metric, values in model_scores.items()}
                    for model, model_scores in scores.items()},
        'ranking_folds': len(scores['random_forest']['roc_auc']),
        'within_fold_like_dislike_pairs': total_pairs,
        'pair_weighted_roc_auc': {model: value / total_pairs for model, value in
                                  pair_weighted_auc.items()} if total_pairs else {},
    })
    if report['status'] == 'partial':
        report['reason'] = 'Au moins un pli de test ne contient qu’une classe ; classement incomplet'
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True,
                        help='Export JSON privé d’un seul utilisateur')
    args = parser.parse_args()
    try:
        report = audit(json.loads(args.input.read_text(encoding='utf-8')))
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
