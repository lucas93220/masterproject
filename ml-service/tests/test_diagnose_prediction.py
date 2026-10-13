import unittest

from diagnose_prediction import measure


def payload():
    return {'source': 'SYNTHÉTIQUE — test', 'feature_version': 'outfit-v2-test',
            'user_id': 7, 'data': [{
                'id_tenue': 1, 'is_liked': 1, 'temperature': 20,
                'nb_vetements': 2, 'nb_favoris': 1, 'ratio_favoris': 0.5,
                'zone_torse': 1,
            }]}


class PredictionDiagnosticTests(unittest.TestCase):
    def test_measure_only_personalized_and_exclude_label_and_outfit_id(self):
        calls = []

        def inference(features, user_id):
            calls.append((features, user_id))
            return {'model_used': 'personalized', 'probability_like': 0.5}

        result = measure(payload(), inference)
        self.assertEqual(result['status'], 'measured')
        self.assertEqual(result['repetitions'], 5)
        self.assertEqual(len(calls), 5)
        self.assertTrue(all(user_id == 7 and 'id_tenue' not in features and
                            'is_liked' not in features for features, user_id in calls))

    def test_fallback_is_not_reported_as_personalized_performance(self):
        result = measure(payload(), lambda *_args, **_kwargs:
                         {'model_used': 'fallback', 'reason': 'no_model'})
        self.assertEqual(result['status'], 'not_measured')
        self.assertEqual(result['reason'], 'no_model')
        self.assertNotIn('inference_ms', result)

    def test_invalid_user_is_rejected(self):
        candidate = payload()
        candidate['user_id'] = '../other'
        with self.assertRaises(ValueError):
            measure(candidate)


if __name__ == '__main__':
    unittest.main()
