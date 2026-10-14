"""Checks for the offline item/pair comparison; all examples are fictional."""

import math
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sklearn.feature_extraction import DictVectorizer

from evaluate_interactions import (_interaction_features, _validated, evaluate,
                                   format_report, synthetic_dataset)


class InteractionEvaluationTests(unittest.TestCase):
    def test_synthetic_comparison_is_reproducible_and_keeps_joblib_untouched(self):
        payload = synthetic_dataset()
        with tempfile.TemporaryDirectory() as directory:
            sentinel = Path(directory) / 'user_1.joblib'
            sentinel.write_bytes(b'untouched')
            with patch.dict(os.environ, {'ML_MODELS_DIR': directory}):
                first = evaluate(payload)
                second = evaluate(payload)
            self.assertEqual(sentinel.read_bytes(), b'untouched')
            self.assertEqual(list(Path(directory).iterdir()), [sentinel])

        self.assertEqual(first, second)
        self.assertEqual(first['status'], 'evaluated')
        self.assertEqual(first['n_base_features'], 85)
        self.assertGreater(first['purged_from_train'], 0)
        self.assertEqual(set(first['metrics']), {
            'majority', 'rf_v2', 'rf_items_only', 'rf_items_pairs', 'logistic_items_pairs'
        })
        for model_metrics in first['metrics'].values():
            self.assertTrue(all(math.isfinite(value) for value in model_metrics.values()))
        first['synthetic'] = True
        report = format_report(first)
        self.assertIn('SYNTHÉTIQUE — AUCUNE PERFORMANCE RÉELLE DE FITS', report)
        self.assertIn('Paires du test déjà vues', report)

    def test_specific_pairs_are_distinguishable_even_with_same_general_features(self):
        payload = synthetic_dataset()
        rows, names = _validated(payload)
        first = {**rows[0], 'garment_ids': (1, 2, 3, 4)}
        second = {**rows[0], 'garment_ids': (1, 3, 4, 5)}
        vectorizer = DictVectorizer()
        vectors = vectorizer.fit_transform([
            _interaction_features(first, names), _interaction_features(second, names)
        ])
        self.assertNotEqual(vectors[0].toarray().tolist(), vectors[1].toarray().tolist())
        self.assertIn('pair:1:2', vectorizer.feature_names_)
        self.assertNotIn('pair:1:2', _interaction_features(second, names))

    def test_unknown_future_garment_does_not_enter_training_vocabulary(self):
        payload = synthetic_dataset()
        for row in payload['data'][-40:]:
            row['garment_ids'][-1] = 999
        report = evaluate(payload)
        self.assertEqual(report['status'], 'evaluated')
        self.assertEqual(report['unknown_test_items'], 1)

    def test_insufficient_or_single_class_data_has_no_metrics(self):
        payload = synthetic_dataset()
        payload['data'] = payload['data'][:10]
        payload['n_v2_rows'] = 10
        report = evaluate(payload)
        self.assertEqual(report['status'], 'insufficient_data')
        self.assertNotIn('metrics', report)
        payload = synthetic_dataset()
        for row in payload['data']:
            row['is_liked'] = 1
        report = evaluate(payload)
        self.assertEqual(report['status'], 'insufficient_data')
        self.assertNotIn('metrics', report)

    def test_rejects_mixed_user_marker_and_invalid_garment_or_date(self):
        payload = synthetic_dataset()
        payload['data'][0]['id_utilisateur'] = 2
        with self.assertRaisesRegex(ValueError, 'schémas différents|features invalides'):
            evaluate(payload)

        payload = synthetic_dataset()
        payload['data'][0]['garment_ids'] = [1, 1, 2]
        with self.assertRaisesRegex(ValueError, 'vêtements invalides'):
            evaluate(payload)

        payload = synthetic_dataset()
        payload['data'][0]['reviewed_at'] = '2026-01-01T10:00:00'
        with self.assertRaisesRegex(ValueError, 'fuseau horaire'):
            evaluate(payload)

    def test_rejects_incomplete_contract(self):
        payload = synthetic_dataset()
        del payload['data'][0]['garment_ids_source']
        with self.assertRaises(ValueError):
            evaluate(payload)
        payload = synthetic_dataset()
        payload['user_id'] = None
        with self.assertRaisesRegex(ValueError, 'compte invalide'):
            evaluate(payload)


if __name__ == '__main__':
    unittest.main()
