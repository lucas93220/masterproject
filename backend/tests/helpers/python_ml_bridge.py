"""Exercise the real FastAPI endpoints with fictitious Node payloads and temporary models."""

import json
import os
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "ml-service"))

from fastapi.testclient import TestClient
from app import app


def main():
    payload = json.load(sys.stdin)
    with tempfile.TemporaryDirectory(prefix="fits-ml-journey-") as directory:
        os.environ.update({
            "ML_MODELS_DIR": directory,
            "ML_SERVICE_SECRET": "integration-test-secret",
            "ML_MIN_TRAIN_SAMPLES": "20",
            "ML_MIN_SAMPLES_PER_CLASS": "5",
        })
        with TestClient(app) as client:
            def request(endpoint, user_id, body):
                response = client.post(endpoint, json=body, headers={
                    "X-FITS-USER-ID": str(user_id),
                    "X-FITS-ML-SECRET": "integration-test-secret",
                })
                return {"http": response.status_code, "body": response.json()}

            result = {
                "empty": request("/train", 3, payload["empty"]),
                "train_one": request("/train", 1, payload["train_one"]),
                "train_two": request("/train", 2, payload["train_two"]),
                "predict_one": request("/predict", 1, payload["candidate"]),
                "predict_two": request("/predict", 2, payload["candidate"]),
                "predict_three": request("/predict", 3, payload["candidate"]),
                "saved_files": sorted(path.name for path in Path(directory).glob("*.joblib")),
            }
            print(json.dumps(result))


if __name__ == "__main__":
    main()
