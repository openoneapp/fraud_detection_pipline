from pydantic import BaseModel


class FraudPredictionResponse(BaseModel):

    transaction_id: str

    is_fraud: bool

    fraud_probability: float

    fraud_type: str | None = None

    model_version: str

    status: str