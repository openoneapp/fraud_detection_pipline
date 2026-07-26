import logging

from app.ml.feature_builder import FeatureBuilder
from app.ml.model_loader import ModelLoader
from app.schemas.prediction_request import (
    FraudPredictionRequest
)
from app.schemas.prediction_response import (
    FraudPredictionResponse
)
from app.services.kafka_service import KafkaService


logger = logging.getLogger(__name__)


class PredictionService:

    MODEL_VERSION = "fraud-model-v1"

    def __init__(
        self,
        model_loader: ModelLoader,
        kafka_service: KafkaService
    ):

        self.model_loader = model_loader

        self.kafka_service = kafka_service

    def predict(
        self,
        request: FraudPredictionRequest
    ) -> FraudPredictionResponse:

        # 1. Build AI features

        features = FeatureBuilder.build(
            request
        )

        # 2. Run model

        predictions, probabilities = (
            self.model_loader.predict(
                features
            )
        )

        # 3. Get prediction

        prediction = int(
            predictions[0]
        )

        fraud_probability = float(
            probabilities[0][1]
        )

        is_fraud = prediction == 1

        # 4. Build Kafka event

        kafka_prediction = {

            "transaction_id":
                request.transaction_id,

            "sender_account_id":
                request.sender_account_id,

            "receiver_account_id":
                request.receiver_account_id,

            "is_fraud":
                is_fraud,

            "fraud_probability":
                fraud_probability,

            "model_version":
                self.MODEL_VERSION,

            "features": {

                "trans_amount":
                    request.trans_amount,

                "age_hours_open_acc":
                    request.age_hours_open_acc,

                "receiver_txn_count_last_3d":
                    request.receiver_txn_count_last_3d,

                "unique_senders_last_3d":
                    request.unique_senders_last_3d,

                "multi_same_amt_count_2d":
                    request.multi_same_amt_count_2d,

                "sender_txn_count_last_1h":
                    request.sender_txn_count_last_1h,

                "sender_volume_last_1h":
                    request.sender_volume_last_1h,

                "days_since_last_trans":
                    request.days_since_last_trans,

                "geo_speed_kmh":
                    request.geo_speed_kmh
            }
        }

        # 5. Produce to Kafka

        self.kafka_service.publish_prediction(

            transaction_id=request.transaction_id,

            prediction=kafka_prediction
        )

        # 6. Return HTTP response

        return FraudPredictionResponse(

            transaction_id=request.transaction_id,

            is_fraud=is_fraud,

            fraud_probability=fraud_probability,

            model_version=self.MODEL_VERSION,

            status="PREDICTION_COMPLETED"
        )