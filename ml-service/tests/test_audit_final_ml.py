import unittest

from audit_final_ml import audit


def fictitious_dataset():
    rows = []
    for index in range(64):
        liked = int(index % 3 != 0)
        rows.append({
            'temperature': 10 + index % 12,
            'nb_vetements': 2,
            'nb_favoris': index % 2,
            'ratio_favoris': (index % 2) / 2,
            'zone_torse': 1,
            'couleur_bleu': int(index % 5 == 0),
            'is_liked': liked,
            'id_tenue': index + 1,
        })
    return {'source': 'SYNTHÉTIQUE — test uniquement',
            'feature_version': 'outfit-v2-test', 'data': rows}


class FinalMlAuditTests(unittest.TestCase):
    def test_grouped_ablation_and_ranking_are_reproducible(self):
        payload = fictitious_dataset()
        first = audit(payload)
        self.assertEqual(first, audit(payload))
        self.assertEqual(first['status'], 'evaluated')
        self.assertEqual(len(first['folds']), 4)
        self.assertEqual(sum(fold['n_test'] for fold in first['folds']), 64)
        self.assertTrue(all(fold['overlapping_groups'] == 0 for fold in first['folds']))
        self.assertEqual(first['ranking_folds'], 4)
        for model in ('random_forest', 'global_only', 'prior'):
            self.assertIn('roc_auc', first['metrics'][model])
            self.assertIn('average_precision', first['metrics'][model])
            self.assertIn('brier', first['metrics'][model])
        self.assertEqual(first['n_constant_features'], 2)
        self.assertNotIn('id_tenue', first['variable_features'])
        self.assertNotIn('is_liked', first['variable_features'])

    def test_identical_vectors_and_outfits_are_grouped(self):
        payload = fictitious_dataset()
        original_groups = audit(payload)['n_groups']
        rows = payload['data']
        rows.append({**rows[0], 'id_tenue': 1000, 'is_liked': 1 - rows[0]['is_liked']})
        rows.append({**rows[1], 'id_tenue': rows[0]['id_tenue']})
        report = audit(payload)
        self.assertEqual(report['n_groups'], original_groups - 1)
        self.assertGreaterEqual(report['conflicting_vectors'], 1)
        self.assertGreaterEqual(report['minimum_errors_for_identical_vectors'], 1)
        if 'folds' in report:
            self.assertTrue(all(fold['overlapping_groups'] == 0 for fold in report['folds']))

    def test_insufficient_data_has_no_metrics(self):
        payload = fictitious_dataset()
        payload['data'] = payload['data'][:12]
        report = audit(payload)
        self.assertEqual(report['status'], 'insufficient_data')
        self.assertNotIn('metrics', report)


if __name__ == '__main__':
    unittest.main()
