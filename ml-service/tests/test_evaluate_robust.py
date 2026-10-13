import unittest

from evaluate_robust import _groups, evaluate_repeated, format_report


def fictitious_dataset(likes=42, dislikes=22):
    rows = []
    for index in range(likes + dislikes):
        label = int(index < likes)
        rows.append({
            'temperature': index + 1,
            'nb_vetements': 2,
            'nb_favoris': index % 2,
            'ratio_favoris': (index % 2) / 2,
            'zone_torse': 1,
            'couleur_bleu': int(index % 3 == 0),
            'categorie_00': 1,
            'sous_categorie_00': 1,
            'association_torse_jambes_meme_couleur': 0,
            'is_liked': label,
            'id_tenue': index + 1,
        })
    return {'source': 'SYNTHÉTIQUE — test uniquement',
            'feature_version': 'outfit-v2-test', 'data': rows}


class RepeatedEvaluationTests(unittest.TestCase):
    def test_repeated_comparison_is_deterministic_and_has_ranking_proxies(self):
        payload = fictitious_dataset()
        first = evaluate_repeated(payload, n_splits=4)
        second = evaluate_repeated(payload, n_splits=4)
        self.assertEqual(first, second)
        self.assertEqual(first['status'], 'evaluated')
        self.assertEqual(first['splits_used'], 4)
        self.assertEqual(first['n_rows'], 64)
        self.assertEqual(first['train_size_range'], [48, 48])
        self.assertEqual(first['test_size_range'], [16, 16])
        self.assertEqual(first['metrics']['majority']['roc_auc']['mean'], 0.5)
        for model in ('random_forest', 'majority', 'logistic_regression'):
            self.assertIn('average_precision', first['metrics'][model])
        self.assertLessEqual(len(first['top_indicator_differences']), 8)
        self.assertTrue(all(item['feature'] not in ('is_liked', 'id_tenue')
                            for item in first['top_indicator_differences']))
        self.assertIn('ne mesurent pas le classement réel', format_report(first))

    def test_same_outfit_or_exact_feature_vector_remains_one_group(self):
        payload = fictitious_dataset()
        rows = payload['data']
        repeated_vector = {**rows[0], 'id_tenue': 1000}
        repeated_outfit = {**rows[1], 'temperature': 99}
        rows.extend([repeated_vector, repeated_outfit])
        feature_names = [name for name in rows[0] if name not in ('id_tenue', 'is_liked')]
        groups, _ = _groups(rows, feature_names)
        self.assertEqual(groups[0], groups[-2])
        self.assertEqual(groups[1], groups[-1])
        report = evaluate_repeated(payload, n_splits=4)
        self.assertEqual(report['status'], 'evaluated')
        self.assertEqual(report['n_independent_groups'], 64)
        self.assertIn('StratifiedGroupKFold', report['method'])

    def test_insufficient_data_does_not_produce_metrics(self):
        for payload in (fictitious_dataset(10, 10), fictitious_dataset(60, 0)):
            with self.subTest(n=len(payload['data'])):
                result = evaluate_repeated(payload)
                self.assertEqual(result['status'], 'insufficient_data')
                self.assertNotIn('metrics', result)
                self.assertIn('Métriques non calculées', format_report(result))

    def test_refuses_invalid_split_count(self):
        for count in (0, 201, True):
            with self.subTest(count=count), self.assertRaises(ValueError):
                evaluate_repeated(fictitious_dataset(), n_splits=count)


if __name__ == '__main__':
    unittest.main()
