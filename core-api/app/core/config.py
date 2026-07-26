from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    app_name: str = "AI Fraud Detection Service"

    app_version: str = "1.0.0"

    environment: str = "development"

    kafka_bootstrap_servers: str = "localhost:9092"

    kafka_fraud_prediction_topic: str = "fraud-predictions"

    model_path: str = "app/models/fraud_model.pkl"

    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:

    return Settings()