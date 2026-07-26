import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from kafka import KafkaProducer


logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):

    def default(self, o):

        if isinstance(o, Decimal):

            return float(o)

        if isinstance(o, datetime):

            return o.isoformat()

        return super().default(o)


class KafkaService:

    def __init__(
        self,
        bootstrap_servers: str,
        topic: str
    ):

        self.topic = topic

        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            key_serializer=lambda key: key.encode("utf-8") if key else None,
            value_serializer=lambda value: json.dumps(
                value,
                cls=DecimalEncoder
            ).encode("utf-8"),
            acks="all",
            retries=3,
            linger_ms=10,
            request_timeout_ms=30000
        )

    def publish_prediction(
        self,
        transaction_id: str,
        prediction: dict
    ):

        message = {
            "event_type": "FRAUD_PREDICTION",
            "event_version": "1.0",
            "event_time": datetime.now(timezone.utc).isoformat(),
            "transaction_id": transaction_id,
            "prediction": prediction
        }

        try:
            future = self.producer.send(
                self.topic,
                key=transaction_id,
                value=message
            )
            metadata = future.get(timeout=10)
            logger.info(
                "Published fraud prediction. topic=%s partition=%s offset=%s",
                metadata.topic,
                metadata.partition,
                metadata.offset
            )
            return message
        except Exception as e:
            logger.error(
                "Failed to publish fraud prediction for transaction_id=%s: %s",
                transaction_id,
                str(e)
            )
            raise

    def close(self):
        """Close the Kafka producer gracefully."""
        try:
            self.producer.flush(timeout_ms=5000)
            self.producer.close(timeout_secs=10)
            logger.info("Kafka producer closed successfully")
        except Exception as e:
            logger.error("Error closing Kafka producer: %s", str(e))
            raise