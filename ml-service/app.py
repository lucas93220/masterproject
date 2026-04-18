from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

app = FastAPI()
model = None

class Dataset(BaseModel):
    data: list

@app.post("/train")
def train_model(dataset: Dataset):
    global model

    df = pd.DataFrame(dataset.data)

    X = df.drop("is_liked", axis=1)
    y = df["is_liked"]

    model = RandomForestClassifier()
    model.fit(X, y)

    joblib.dump(model, "model.joblib")

    return {"status": "model trained"}

@app.post("/predict")
def predict(data: dict):
    global model

    if model is None:
        model = joblib.load("model.joblib")

    df = pd.DataFrame([data])
    prediction = model.predict_proba(df)[0][1]

    return {"probability_like": float(prediction)}