"""Évaluation exploratoire répétée, hors ligne, sans accès aux modèles de production."""

import argparse
import json
from collections import Counter
from pathlib import Path
from statistics import mean, pstdev

import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, average_precision_score, balanced_accuracy_score,
                             f1_score, precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import StratifiedGroupKFold, StratifiedShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from evaluate import _validated_rows, synthetic_dataset


SEED = 42
MIN_ROWS = 50
MIN_PER_CLASS = 20
MIN_TEST_PER_CLASS = 5
METRICS = ('accuracy', 'balanced_accuracy', 'precision', 'recall', 'f1',
           'roc_auc', 'average_precision')


def _groups(rows, feature_names):
    """Groupe les mêmes tenues et les vecteurs de features strictement identiques."""
    parents = list(range(len(rows)))

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    outfit_owner = {}
    feature_owner = {}
    for index, row in enumerate(rows):
        vector = tuple(row[name] for name in feature_names)
        for owners, key in ((outfit_owner, row['id_tenue']), (feature_owner, vector)):
            if key in owners:
                parents[root(index)] = root(owners[key])
            else:
                owners[key] = index
    return [root(index) for index in range(len(rows))], feature_owner


def _scores(y_test, predictions, probabilities):
    return {
        'accuracy': accuracy_score(y_test, predictions),
        'balanced_accuracy': balanced_accuracy_score(y_test, predictions),
        'precision': precision_score(y_test, predictions, pos_label=1, zero_division=0),
        'recall': recall_score(y_test, predictions, pos_label=1, zero_division=0),
        'f1': f1_score(y_test, predictions, pos_label=1, zero_division=0),
        'roc_auc': roc_auc_score(y_test, probabilities),
        'average_precision': average_precision_score(y_test, probabilities),
    }


def evaluate_repeated(payload, n_splits=30):
    if type(n_splits) is not int or not 1 <= n_splits <= 200:
        raise ValueError('n_splits doit être compris entre 1 et 200')
    rows, feature_names = _validated_rows(payload)
    labels = [row['is_liked'] for row in rows]
    counts = Counter(labels)
    report = {
        'status': 'insufficient_data',
        'source': payload.get('source', 'origine non vérifiée'),
        'feature_version': payload['feature_version'],
        'n_rows': len(rows),
        'n_outfits': len({row['id_tenue'] for row in rows}),
        'n_likes': counts[1],
        'n_dislikes': counts[0],
        'n_features': len(feature_names),
        'splits_requested': n_splits,
        'seed': SEED,
    }
    if len(rows) < MIN_ROWS or min(counts[0], counts[1]) < MIN_PER_CLASS:
        report['reason'] = (f'Au moins {MIN_ROWS} avis et {MIN_PER_CLASS} avis de chaque '
                            'classe sont requis pour cette analyse exploratoire')
        return report

    features = pd.DataFrame([{name: row[name] for name in feature_names} for row in rows],
                            columns=feature_names)
    groups, feature_owner = _groups(rows, feature_names)
    vector_labels = {}
    for row in rows:
        vector = tuple(row[name] for name in feature_names)
        vector_labels.setdefault(vector, set()).add(row['is_liked'])
    like_mask = [label == 1 for label in labels]
    dislike_mask = [label == 0 for label in labels]
    variable_indicators = []
    for name in feature_names:
        if name in ('temperature', 'nb_vetements', 'nb_favoris', 'ratio_favoris'):
            continue
        if features[name].nunique() <= 1 or not set(features[name].unique()) <= {0, 1}:
            continue
        like_rate = float(features.loc[like_mask, name].mean())
        dislike_rate = float(features.loc[dislike_mask, name].mean())
        variable_indicators.append({'feature': name, 'like_rate': like_rate,
                                    'dislike_rate': dislike_rate})
    variable_indicators.sort(key=lambda item: (-abs(item['like_rate'] - item['dislike_rate']),
                                               item['feature']))
    report.update({
        'n_independent_groups': len(set(groups)),
        'duplicate_feature_rows': len(rows) - len(feature_owner),
        'conflicting_feature_patterns': sum(len(values) > 1 for values in vector_labels.values()),
        'constant_features': [name for name in feature_names if features[name].nunique() == 1],
        'top_indicator_differences': variable_indicators[:8],
        'base_feature_means': {
            name: {'like': float(features.loc[like_mask, name].mean()),
                   'dislike': float(features.loc[dislike_mask, name].mean())}
            for name in ('temperature', 'nb_vetements', 'nb_favoris', 'ratio_favoris')
        },
    })

    if len(set(groups)) == len(rows):
        splitter = StratifiedShuffleSplit(n_splits=n_splits, test_size=0.25,
                                          random_state=SEED)
        splits = splitter.split(features, labels)
        report['method'] = 'StratifiedShuffleSplit répété 75/25 ; une tenue et un vecteur par groupe'
    else:
        group_counts = {label: len({groups[index] for index, value in enumerate(labels)
                                    if value == label}) for label in (0, 1)}
        if min(group_counts.values()) < 4:
            report['reason'] = 'Moins de quatre groupes indépendants dans une classe'
            return report
        def grouped_splits():
            for repetition in range(n_splits):
                candidate_splits = StratifiedGroupKFold(
                    n_splits=4, shuffle=True, random_state=SEED + repetition
                ).split(features, labels, groups)
                for train, test in candidate_splits:
                    train_counts = Counter(labels[index] for index in train)
                    test_counts = Counter(labels[index] for index in test)
                    if (min(train_counts[0], train_counts[1]) >= 5 and
                            min(test_counts[0], test_counts[1]) >= MIN_TEST_PER_CLASS):
                        yield train, test
                        break
        splits = grouped_splits()
        report['method'] = ('StratifiedGroupKFold répété ; groupes reliés par tenue ou '
                            'vecteur identique, premier pli admissible de chaque graine')

    scores = {name: {metric: [] for metric in METRICS}
              for name in ('random_forest', 'majority', 'logistic_regression')}
    train_sizes, test_sizes = [], []
    for train, test in splits:
        train_labels = [labels[index] for index in train]
        test_labels = [labels[index] for index in test]
        train_counts = Counter(train_labels)
        test_counts = Counter(test_labels)
        if (min(train_counts[0], train_counts[1]) < 5 or
                min(test_counts[0], test_counts[1]) < MIN_TEST_PER_CLASS):
            continue
        if {groups[index] for index in train} & {groups[index] for index in test}:
            raise AssertionError('Fuite de groupe entre entraînement et test')
        x_train, x_test = features.iloc[train], features.iloc[test]
        models = {
            'random_forest': RandomForestClassifier(random_state=SEED),
            'majority': DummyClassifier(strategy='most_frequent'),
            'logistic_regression': make_pipeline(
                StandardScaler(), LogisticRegression(max_iter=3000, random_state=SEED))
        }
        for name, model in models.items():
            model.fit(x_train, train_labels)
            probabilities = model.predict_proba(x_test)[:, list(model.classes_).index(1)]
            result = _scores(test_labels, model.predict(x_test), probabilities)
            for metric, value in result.items():
                scores[name][metric].append(float(value))
        train_sizes.append(len(train))
        test_sizes.append(len(test))

    if not train_sizes:
        report['reason'] = ('Aucune séparation admissible avec au moins cinq avis '
                            'de chaque classe en test')
        return report
    report.update({
        'status': 'evaluated',
        'splits_used': len(train_sizes),
        'train_size_range': [min(train_sizes), max(train_sizes)],
        'test_size_range': [min(test_sizes), max(test_sizes)],
        'metrics': {
            name: {metric: {'mean': mean(values), 'std': pstdev(values),
                            'min': min(values), 'max': max(values)}
                   for metric, values in metric_values.items()}
            for name, metric_values in scores.items()
        },
        'paired_accuracy_wins': {
            name: sum(a > b for a, b in zip(scores[name]['accuracy'],
                                            scores['majority']['accuracy']))
            for name in ('random_forest', 'logistic_regression')
        },
    })
    return report


def format_report(report):
    lines = [
        '# Évaluation répétée hors ligne — FITS', '',
        f"- Source : {report['source']}",
        f"- Version des features : {report['feature_version']}",
        f"- Avis : {report['n_rows']} ({report['n_likes']} likes, {report['n_dislikes']} dislikes)",
        f"- Tenues distinctes : {report['n_outfits']}",
        f"- Features : {report['n_features']}",
        f"- Graine initiale : {report['seed']}", '',
    ]
    if report['status'] != 'evaluated':
        lines += ['Métriques non calculées : ' + report['reason'], '']
        return '\n'.join(lines)
    lines += [
        f"- Groupes indépendants : {report['n_independent_groups']}",
        f"- Lignes à vecteur de features répété : {report['duplicate_feature_rows']}",
        f"- Vecteurs identiques avec avis contradictoires : {report['conflicting_feature_patterns']}",
        f"- Features constantes : {len(report['constant_features'])}",
        f"- Méthode : {report['method']}",
        f"- Séparations admissibles : {report['splits_used']}/{report['splits_requested']}",
        f"- Tailles entraînement/test : {report['train_size_range']} / {report['test_size_range']}",
        '', '| Feature de base | Moyenne likes | Moyenne dislikes |',
        '|---|---:|---:|',
    ]
    for name, values in report['base_feature_means'].items():
        lines.append(f"| `{name}` | {values['like']:.3f} | {values['dislike']:.3f} |")
    lines += ['', '| Indicateur variable (écart descriptif) | Part des likes | Part des dislikes |',
              '|---|---:|---:|']
    for item in report['top_indicator_differences']:
        lines.append(f"| `{item['feature']}` | {item['like_rate']:.3f} | "
                     f"{item['dislike_rate']:.3f} |")
    lines += [
        '', '| Modèle | Accuracy | Balanced accuracy | Précision | Rappel | F1 | ROC AUC | AP |',
        '|---|---:|---:|---:|---:|---:|---:|---:|',
    ]
    for name, label in (('random_forest', 'Random Forest'), ('majority', 'Majoritaire'),
                        ('logistic_regression', 'Régression logistique')):
        values = report['metrics'][name]
        cells = [f"{values[metric]['mean']:.3f} ± {values[metric]['std']:.3f} "
                 f"[{values[metric]['min']:.3f}; {values[metric]['max']:.3f}]"
                 for metric in METRICS]
        lines.append('| ' + label + ' | ' + ' | '.join(cells) + ' |')
    wins = report['paired_accuracy_wins']
    lines += ['', f"Random Forest au-dessus de la baseline en accuracy : "
              f"{wins['random_forest']}/{report['splits_used']} séparations ; régression "
              f"logistique : {wins['logistic_regression']}/{report['splits_used']}.", '',
              'Les séparations se recouvrent : écart-type et min/max décrivent une variabilité '
              'exploratoire, pas un intervalle de confiance indépendant. ROC AUC et AP classent '
              'les avis observés ; sans identifiant de lot de génération ni avis sur tous les '
              'candidats, elles ne mesurent pas le classement réel des cinq tenues proposées.',
              'Les avis historiques sans snapshot peuvent contenir des favoris/catégories '
              'modifiés après le vote. Les écarts par indicateur sont descriptifs, calculés '
              'sur tous les avis, et ne servent pas à sélectionner les features du modèle. '
              'Aucun score ne justifie à lui seul le déploiement.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--input', type=Path, help='Export privé JSON d’un seul utilisateur')
    source.add_argument('--synthetic', action='store_true', help='Démonstration fictive uniquement')
    parser.add_argument('--splits', type=int, default=30)
    args = parser.parse_args()
    payload = synthetic_dataset() if args.synthetic else json.loads(args.input.read_text())
    print(format_report(evaluate_repeated(payload, args.splits)))


if __name__ == '__main__':
    main()
