import numpy as np
import pandas as pd

from app.schemas.prediction_request import (
    FraudPredictionRequest
)


class FeatureBuilder:

    BASE_FEATURES = [
        "trans_amount",
        "age_hours_open_acc",
        "receiver_txn_count_last_3d",
        "unique_senders_last_3d",
        "multi_same_amt_count_2d",
        "sender_txn_count_last_1h",
        "sender_volume_last_1h",
        "days_since_last_trans",
        "geo_speed_kmh",
    ]

    @staticmethod
    def build(
        request: FraudPredictionRequest
    ):

        features = pd.DataFrame([{
            "trans_amount": float(request.trans_amount),
            "age_hours_open_acc": float(request.age_hours_open_acc),
            "receiver_txn_count_last_3d": float(request.receiver_txn_count_last_3d),
            "unique_senders_last_3d": float(request.unique_senders_last_3d),
            "multi_same_amt_count_2d": float(request.multi_same_amt_count_2d),
            "sender_txn_count_last_1h": float(request.sender_txn_count_last_1h),
            "sender_volume_last_1h": float(request.sender_volume_last_1h),
            "days_since_last_trans": float(request.days_since_last_trans),
            "geo_speed_kmh": float(request.geo_speed_kmh),
        }])
        features["is_new_account_no_history"] = (
            features["days_since_last_trans"] >= 9999
        ).astype(int)
        real_days = features.loc[
            features["days_since_last_trans"] < 9999,
            "days_since_last_trans",
        ].max()
        features.loc[
            features["days_since_last_trans"] >= 9999,
            "days_since_last_trans",
        ] = 0 if pd.isna(real_days) else real_days

        for column in ["trans_amount", "sender_volume_last_1h"]:
            features[f"{column}_log"] = np.log1p(features[column].clip(lower=0))

        features["avg_amt_per_txn_last_1h"] = (
            features["sender_volume_last_1h"] /
            features["sender_txn_count_last_1h"].replace(0, np.nan)
        ).fillna(0)

        return features