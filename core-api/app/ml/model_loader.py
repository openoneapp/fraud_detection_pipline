from pathlib import Path

import joblib

from app.ml.feature_builder import FeatureBuilder


class ModelLoader:

    def __init__(
        self,
        model_path: str,
        fraud_type_model_path: str | None = None,
    ):

        self.model_path = Path(model_path)

        self.fraud_type_model_path = (
            Path(fraud_type_model_path)
            if fraud_type_model_path
            else None
        )

        self.model = None

        self.fraud_type_model = None

    def load(self):

        if not self.model_path.exists():

            raise FileNotFoundError(
                f"Model not found: {self.model_path}"
            )

        self.model = joblib.load(self.model_path)

        if self.fraud_type_model_path and self.fraud_type_model_path.exists():
            self.fraud_type_model = joblib.load(self.fraud_type_model_path)

        return self.model

    def predict(self, features):

        if self.model is None:

            raise RuntimeError(
                "Model has not been loaded"
            )

        model_features = features
        expected_features = getattr(self.model, "n_features_in_", None)
        if expected_features == len(FeatureBuilder.BASE_FEATURES):
            model_features = features[FeatureBuilder.BASE_FEATURES]

        prediction = self.model.predict(model_features)

        probability = self.model.predict_proba(model_features)

        return prediction, probability

    def predict_fraud_type(self, features):

        if self.fraud_type_model is None:
            return None

        return self.fraud_type_model.predict(features)