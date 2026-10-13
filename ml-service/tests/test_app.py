import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import joblib
from fastapi.testclient import TestClient

from app import app


def rows(inverted=False):
    result = []
    for index in range(20):
        positive = index >= 10
        result.append({
            "temperature": 20,
            "nb_vetements": 2,
            "nb_favoris": int(positive),
            "ratio_favoris": float(positive),
            "zone_torse": 1,
            "is_liked": int(positive != inverted),
        })
    return result


class MlServiceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {
            "ML_MODELS_DIR": self.directory.name,
            "ML_SERVICE_SECRET": "test-secret",
            "ML_MIN_TRAIN_SAMPLES": "20",
            "ML_MIN_SAMPLES_PER_CLASS": "5",
        })
        self.environment.start()
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        self.client.close()
        self.environment.stop()
        self.directory.cleanup()

    def post(self, endpoint, user=1, body=None, secret="test-secret"):
        headers = {"X-FITS-USER-ID": str(user), "X-FITS-ML-SECRET": secret}
        return self.client.post(endpoint, json=body or {}, headers=headers)

    def test_two_users_have_distinct_models_and_predictions(self):
        self.assertEqual(self.post("/train", 1, {"data": rows()}).json()["status"], "model trained")
        self.assertEqual(self.post("/train", 2, {"data": rows(True)}).json()["status"], "model trained")
        candidate = {key: value for key, value in rows()[15].items() if key != "is_liked"}
        first = self.post("/predict", 1, candidate).json()
        second = self.post("/predict", 2, candidate).json()

        self.assertEqual(first["model_used"], "personalized")
        self.assertEqual(second["model_used"], "personalized")
        self.assertGreater(first["probability_like"], second["probability_like"])
        self.assertTrue((Path(self.directory.name) / "user_1.joblib").is_file())
        self.assertTrue((Path(self.directory.name) / "user_2.joblib").is_file())

    def test_no_model_falls_back_to_favorite_ratio(self):
        response = self.post("/predict", 3, {"ratio_favoris": 0.4})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "probability_like": 0.4, "model_used": "fallback", "reason": "no_model"
        })

    def test_empty_single_class_and_small_datasets_do_not_create_model(self):
        cases = [
            ([], "empty_dataset"),
            (rows()[:10], "single_class"),
            (rows()[:9] + rows()[10:19], "too_few_samples"),
            (rows()[:4] + rows()[10:], "too_few_samples"),
        ]
        for index, (data, reason) in enumerate(cases, start=1):
            with self.subTest(reason=reason, index=index):
                response = self.post("/train", index, {"data": data})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "insufficient_data")
                self.assertEqual(response.json()["reason"], reason)
                self.assertFalse((Path(self.directory.name) / f"user_{index}.joblib").exists())

    def test_training_thresholds_are_configurable(self):
        small_balanced = rows()[:2] + rows()[10:12]
        with patch.dict(os.environ, {"ML_MIN_TRAIN_SAMPLES": "4",
                                     "ML_MIN_SAMPLES_PER_CLASS": "2"}):
            response = self.post("/train", 1, {"data": small_balanced})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "model trained")

    def test_failed_retraining_preserves_existing_model(self):
        self.post("/train", 1, {"data": rows()})
        path = Path(self.directory.name) / "user_1.joblib"
        original = path.read_bytes()
        self.assertEqual(self.post("/train", 1, {"data": rows()[:10]}).json()["status"],
                         "insufficient_data")
        self.assertEqual(path.read_bytes(), original)

        with patch("app.joblib.dump", side_effect=OSError("stockage indisponible")):
            response = self.post("/train", 1, {"data": rows(True)})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(path.read_bytes(), original)
        self.assertFalse(list(Path(self.directory.name).glob("*.tmp")))
        self.assertEqual(joblib.load(path).classes_.tolist(), [0, 1])
        self.assertEqual(self.post("/predict", 1, {"ratio_favoris": 1,
                          "temperature": 20, "nb_vetements": 2,
                          "nb_favoris": 1, "zone_torse": 1}).json()["model_used"],
                         "personalized")

    def test_concurrent_training_keeps_complete_model(self):
        def train(inverted):
            return self.post("/train", 1, {"data": rows(inverted)})

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(train, [False, True]))
        self.assertTrue(all(response.status_code == 200 for response in responses))
        model = joblib.load(Path(self.directory.name) / "user_1.joblib")
        self.assertEqual(model.classes_.tolist(), [0, 1])
        self.assertFalse(list(Path(self.directory.name).glob("*.tmp")))

    def test_unauthorized_and_invalid_user_identifiers(self):
        self.post("/train", 1, {"data": rows()})
        self.assertEqual(self.post("/predict", 1, {}, secret="wrong").status_code, 401)
        self.assertEqual(self.client.post("/predict", json={}).status_code, 401)
        for value in ("../1", "1/../2", "0", "-2", "99999999999999", "9" * 5000):
            with self.subTest(value=value):
                self.assertEqual(self.post("/predict", value, {}).status_code, 400)
        self.assertEqual(self.post("/predict", 2, {"ratio_favoris": 0.25}).json()["reason"],
                         "no_model")

    def test_invalid_rows_and_corrupt_model(self):
        invalid = rows()
        invalid[0]["is_liked"] = True
        self.assertEqual(self.post("/train", 1, {"data": invalid}).status_code, 422)
        self.assertEqual(self.post("/train", 1, {"data": rows()}).status_code, 200)
        path = Path(self.directory.name) / "user_1.joblib"
        path.write_bytes(b"invalid model")
        response = self.post("/predict", 1, {"ratio_favoris": 0.6})
        self.assertEqual(response.json()["reason"], "invalid_model")

    def test_symlink_cannot_load_another_users_model(self):
        self.post("/train", 1, {"data": rows()})
        (Path(self.directory.name) / "user_2.joblib").symlink_to("user_1.joblib")
        response = self.post("/predict", 2, {"ratio_favoris": 0.2})
        self.assertEqual(response.json()["model_used"], "fallback")
        self.assertEqual(response.json()["reason"], "invalid_model")


if __name__ == "__main__":
    unittest.main()
