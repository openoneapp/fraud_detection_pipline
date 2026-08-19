from app.ml.feature_builder import FeatureBuilder
from app.ml.model_loader import ModelLoader
from app.schemas.prediction_request import FraudPredictionRequest
from app.services.prediction_service import PredictionService


class FakeKafkaService:

	def __init__(self):
		self.predictions = []

	def publish_prediction(self, transaction_id, prediction):
		self.predictions.append(prediction)


def build_request():
	return FraudPredictionRequest(
		trans_amount=850.00,
		age_hours_open_acc=240,
		receiver_txn_count_last_3d=12,
		unique_senders_last_3d=4,
		multi_same_amt_count_2d=1,
		sender_txn_count_last_1h=4,
		sender_volume_last_1h=2400.00,
		days_since_last_trans=1,
		geo_speed_kmh=25,
	)


def test_supplied_payload_matches_shipped_model():
	request = build_request()
	features = FeatureBuilder.build(request)
	loader = ModelLoader("app/models/fraud_model.pkl")
	loader.load()

	predictions, probabilities = loader.predict(features)

	assert features.shape == (1, 13)
	assert predictions.shape == (1,)
	assert probabilities.shape == (1, 2)


def test_prediction_service_returns_fraud_decision():
	loader = ModelLoader("app/models/fraud_model.pkl")
	loader.load()
	kafka_service = FakeKafkaService()
	service = PredictionService(loader, kafka_service)

	response = service.predict(build_request())

	assert isinstance(response.is_fraud, bool)
	assert 0 <= response.fraud_probability <= 1
	assert response.status == "PREDICTION_COMPLETED"
	assert len(kafka_service.predictions) == 1
