import numpy as np

from app.schemas.prediction_request import (
    FraudPredictionRequest
)


class FeatureBuilder:

    @staticmethod
    def build(
        request: FraudPredictionRequest
    ):

        return np.array([
            [
                float(request.trans_amount),

                float(request.age_hours_open_acc),

                float(
                    request.receiver_txn_count_last_3d
                ),

                float(
                    request.unique_senders_last_3d
                ),

                float(
                    request.multi_same_amt_count_2d
                ),

                float(
                    request.sender_txn_count_last_1h
                ),

                float(
                    request.sender_volume_last_1h
                ),

                float(
                    request.days_since_last_trans
                ),

                float(
                    request.geo_speed_kmh
                )
            ]
        ])