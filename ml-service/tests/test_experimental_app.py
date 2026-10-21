"""Fictional preferences only. No application databases or artifacts accessed."""

import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import joblib
from fastapi.testclient import TestClient

from experimental_app import app
from interaction_model import REPRESENTATION_VERSION


def fixture_rows(reverse=False):
    # Balanced marginals: neither item alone explains the preference; their pair does.
    return [dict(temperature=18, nb_vetements=4, nb_favoris=2, ratio_favoris=0.5,
                 zone_torse=1, couleur_noir=1, garment_ids=[jean, coat, 5, 6],
                 is_liked=int(((jean == 1) != (coat == 3)) != reverse))
            for _ in range(20) for jean in (1, 2) for coat in (3, 4)]


class ExperimentalAppTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='fits-experimental-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.directory = self.root / 'experiment'
        self.reference = self.root / 'reference'
        self.reference.mkdir()
        self.sentinel = self.reference / 'user_1.joblib'
        self.sentinel.write_bytes(b'reference-must-not-change')
        env = patch.dict(os.environ, {
            'ML_SERVICE_SECRET': 'fictional-secret',
            'ML_MODELS_DIR': str(self.reference),
            'ML_EXPERIMENTAL_MODELS_DIR': str(self.directory),
            'ML_MIN_TRAIN_SAMPLES': '20', 'ML_MIN_SAMPLES_PER_CLASS': '5',
        })
        env.start()
        self.addCleanup(env.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.version = 'outfit-v2-fictional'

    def tearDown(self):
        self.assertEqual(self.sentinel.read_bytes(), b'reference-must-not-change')
        self.assertEqual(list(self.reference.iterdir()), [self.sentinel])

    def post(self, endpoint, body, user=1):
        return self.client.post(endpoint, json=body, headers={
            'X-FITS-USER-ID': str(user), 'X-FITS-ML-SECRET': 'fictional-secret'})

    def train(self, rows=None, user=1):
        return self.post('/train', {'data': fixture_rows() if rows is None else rows,
                                   'feature_version': self.version,
                                   'representation_version': REPRESENTATION_VERSION}, user)

    def batch(self, rows=None, user=1):
        candidates = [{key: value for key, value in row.items() if key != 'is_liked'}
                      for row in (rows if rows is not None else fixture_rows()[:4])]
        return self.post('/predict-batch', {'candidates': candidates,
                         'feature_version': self.version,
                         'representation_version': REPRESENTATION_VERSION}, user)

    def test_learns_pairs_and_opposite_users_despite_identical_general_features(self):
        self.assertEqual(self.train().json()['status'], 'model trained')
        self.assertEqual(self.train(fixture_rows(reverse=True), user=2).status_code, 200)
        first = self.batch().json()['predictions']
        second = self.batch(user=2).json()['predictions']
        self.assertLess(first[0]['probability_like'], first[1]['probability_like'])
        self.assertGreater(second[0]['probability_like'], second[1]['probability_like'])
        self.assertTrue(all(row['model_used'] == 'personalized' for row in first + second))
        self.assertEqual(len({row['model_revision'] for row in first}), 1)

    def test_unknown_user_falls_back_without_reusing_other_model(self):
        self.train()
        predictions = self.batch(user=2).json()['predictions']
        self.assertTrue(all(row == {'probability_like': 0.5, 'model_used': 'fallback',
                                   'reason': 'no_model'} for row in predictions))

    def test_reordering_ids_and_feature_keys_preserves_prediction(self):
        self.train()
        expected = self.batch().json()
        rows = [dict(reversed(list(row.items()))) for row in fixture_rows()[:4]]
        for row in rows:
            row['garment_ids'].reverse()
        self.assertEqual(self.batch(rows).json(), expected)

    def test_new_garments_do_not_expand_frozen_vocabulary(self):
        self.train()
        path = self.directory / 'user_1.joblib'
        saved = path.read_bytes()
        rows = fixture_rows()[:1]
        rows[0]['garment_ids'][-1] = 999
        result = self.batch(rows).json()['predictions'][0]
        self.assertEqual(result['unknown_garments'], 1)
        self.assertEqual(result['model_used'], 'personalized')
        self.assertEqual(path.read_bytes(), saved)

    def test_empty_single_class_and_small_datasets_preserve_existing_model(self):
        self.train()
        path = self.directory / 'user_1.joblib'
        before = path.read_bytes()
        for rows, reason in (([], 'empty_dataset'),
                             ([{**row, 'is_liked': 1} for row in fixture_rows()], 'single_class'),
                             (fixture_rows()[:4], 'too_few_samples')):
            with self.subTest(reason=reason):
                self.assertEqual(self.train(rows).json()['reason'], reason)
                self.assertEqual(path.read_bytes(), before)

    def test_failed_training_or_save_preserves_previous_revision_and_cleans_temp(self):
        self.train()
        path = self.directory / 'user_1.joblib'
        before = path.read_bytes()
        for target in ('experimental_app.fit_candidate', 'experimental_app.joblib.dump',
                       'experimental_app.os.replace'):
            with self.subTest(target=target), patch(target, side_effect=OSError('test failure')):
                self.assertEqual(self.train().status_code, 503)
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(list(self.directory.glob('.candidate-*')), [])
        self.assertEqual(self.batch().json()['predictions'][0]['model_used'], 'personalized')

    def test_concurrent_training_and_prediction_leave_complete_artifact(self):
        self.train()
        with ThreadPoolExecutor(max_workers=4) as executor:
            calls = [executor.submit(self.train, fixture_rows(reverse=bool(i % 2)))
                     if i % 2 else executor.submit(self.batch) for i in range(8)]
            for result in [future.result() for future in calls]:
                self.assertEqual(result.status_code, 200)
                if 'predictions' in result.json():
                    self.assertEqual(len({row['model_revision'] for row in result.json()['predictions']}), 1)
        self.assertEqual(self.batch().json()['predictions'][0]['model_used'], 'personalized')

    def test_changed_labels_can_reverse_preference_without_a_ban(self):
        self.train()
        previous = self.batch().json()['predictions'][0]['probability_like']
        self.train(fixture_rows(reverse=True))
        current = self.batch().json()['predictions'][0]['probability_like']
        self.assertGreater(current, previous)
        self.assertTrue(0 < previous < current < 1)

    def test_authentication_and_identity_are_required(self):
        self.assertEqual(self.client.post('/train', json={}).status_code, 401)
        for user in ('../2', '1.0', '0', '2147483648'):
            self.assertEqual(self.train(user=user).status_code, 400)
        self.assertFalse(self.directory.exists())

    def test_rejects_invalid_metadata_labels_ids_and_count(self):
        self.assertEqual(self.post('/predict', {'feature_version': 123}).status_code, 422)
        for update in ({'user_id': 2}, {'is_liked': True}, {'reviewed_at': 'yesterday'},
                       {'garment_ids': [1, 1, 3, 4]}, {'garment_ids': [1, 2]},
                       {'garment_ids': [1, 2, 3, True]}, {'nb_vetements': 5}):
            with self.subTest(update=update):
                rows = fixture_rows()
                rows[0].update(update)
                self.assertEqual(self.train(rows).status_code, 422)

    def test_reference_or_unmarked_storage_is_rejected(self):
        for directory in (self.reference, self.root, self.reference / 'nested',
                          Path(__file__).resolve().parents[1] / 'models'):
            with self.subTest(directory=directory), patch.dict(os.environ, {
                    'ML_EXPERIMENTAL_MODELS_DIR': str(directory)}):
                self.assertEqual(self.train().status_code, 503)
        self.directory.mkdir()
        (self.directory / 'existing.txt').write_text('must stay')
        self.assertEqual(self.train().status_code, 503)
        self.assertEqual((self.directory / 'existing.txt').read_text(), 'must stay')

    def test_invalid_or_foreign_artifact_never_served(self):
        self.train()
        path = self.directory / 'user_1.joblib'
        artifact = joblib.load(path)
        artifact['user_id'] = 2
        joblib.dump(artifact, path)
        self.assertEqual(self.batch().json()['predictions'][0]['reason'], 'incompatible_model')
        path.unlink()
        path.symlink_to(self.sentinel)
        self.assertEqual(self.batch().json()['predictions'][0]['reason'], 'invalid_model')

    def test_feature_version_and_schema_must_match(self):
        self.train()
        self.version = 'outfit-v2-other'
        self.assertEqual(self.batch().json()['predictions'][0]['reason'], 'incompatible_model')
        self.version = 'outfit-v2-fictional'
        rows = fixture_rows()[:1]
        rows[0]['zone_other'] = 1
        self.assertEqual(self.batch(rows).json()['predictions'][0]['reason'], 'incompatible_features')

    def test_deletion_is_idempotent_and_prevents_late_training(self):
        self.train()
        self.assertEqual(self.post('/delete-model', {}).status_code, 200)
        self.assertEqual(self.post('/delete-model', {}).status_code, 200)
        self.assertEqual(self.train().status_code, 410)
        self.assertEqual(self.batch().status_code, 410)
        self.assertFalse((self.directory / 'user_1.joblib').exists())


if __name__ == '__main__':
    unittest.main()
