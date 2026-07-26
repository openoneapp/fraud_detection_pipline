from fastapi import APIRouter

from app.api.v1.prediction import router as prediction_router


api_router = APIRouter(
    prefix="/api/v1"
)


api_router.include_router(
    prediction_router
)