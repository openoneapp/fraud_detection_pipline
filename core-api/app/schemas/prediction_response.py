from pydantic import BaseModel


class FraudPredictionResponse(BaseModel):

    transaction_id: str

    is_fraud: bool

    fraud_probability: float

    model_version: str

    status: str