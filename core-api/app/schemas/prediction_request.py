from decimal import Decimal

from pydantic import BaseModel, Field


class FraudPredictionRequest(BaseModel):

    transaction_id: str

    sender_account_id: str

    receiver_account_id: str

    trans_amount: Decimal = Field(
        ...,
        gt=0
    )

    age_hours_open_acc: float = Field(
        ...,
        ge=0
    )

    receiver_txn_count_last_3d: int = Field(
        ...,
        ge=0
    )

    unique_senders_last_3d: int = Field(
        ...,
        ge=0
    )

    multi_same_amt_count_2d: int = Field(
        ...,
        ge=0
    )

    sender_txn_count_last_1h: int = Field(
        ...,
        ge=0
    )

    sender_volume_last_1h: Decimal = Field(
        ...,
        ge=0
    )

    days_since_last_trans: float = Field(
        ...,
        ge=0
    )

    geo_speed_kmh: float = Field(
        ...,
        ge=0
    )

    event_time: str