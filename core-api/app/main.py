import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import api_router

from app.core.config import (
    get_settings
)

from app.ml.model_loader import (
    ModelLoader
)

from app.services.kafka_service import (
    KafkaService
)

from app.services.prediction_service import (
    PredictionService
)


settings = get_settings()


logging.basicConfig(

    level=settings.log_level,

    format=(
        "%(asctime)s "
        "%(levelname)s "
        "%(name)s "
        "%(message)s"
    )
)


model_loader = ModelLoader(

    model_path=settings.model_path
)


kafka_service = KafkaService(

    bootstrap_servers=
        settings.kafka_bootstrap_servers,

    topic=
        settings.kafka_fraud_prediction_topic
)


prediction_service = PredictionService(

    model_loader=model_loader,

    kafka_service=kafka_service
)


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Application startup

    model_loader.load()

    print(
        "Fraud AI model loaded successfully"
    )

    yield

    # Application shutdown

    kafka_service.close()

    print(
        "Kafka producer closed"
    )


app = FastAPI(

    title=settings.app_name,

    version=settings.app_version,

    lifespan=lifespan
)


app.include_router(
    api_router
)


@app.get(
    "/health"
)
def health():

    return {

        "status": "UP",

        "service":
            settings.app_name,

        "version":
            settings.app_version
    }