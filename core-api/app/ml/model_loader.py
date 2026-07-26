from pathlib import Path

import joblib


class ModelLoader:

    def __init__(self, model_path: str):

        self.model_path = Path(model_path)

        self.model = None

    def load(self):

        if not self.model_path.exists():

            raise FileNotFoundError(
                f"Model not found: {self.model_path}"
            )

        self.model = joblib.load(self.model_path)

        return self.model

    def predict(self, features):

        if self.model is None:

            raise RuntimeError(
                "Model has not been loaded"
            )

        prediction = self.model.predict(features)

        probability = self.model.predict_proba(features)

        return prediction, probability