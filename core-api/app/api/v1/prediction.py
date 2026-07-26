from fastapi import APIRouter, Depends

from app.schemas.prediction_request import (
    FraudPredictionRequest
)

from app.schemas.prediction_response import (
    FraudPredictionResponse
)

from app.services.prediction_service import (
    PredictionService
)


router = APIRouter(
    prefix="/predictions",
    tags=["Fraud Prediction"]
)


def get_prediction_service():

    from app.main import prediction_service

    return prediction_service


@router.post(
    "",
    response_model=FraudPredictionResponse
)
def predict_fraud(

    request: FraudPredictionRequest,

    service: PredictionService = Depends(
        get_prediction_service
    )
):

    return service.predict(
        request
    )