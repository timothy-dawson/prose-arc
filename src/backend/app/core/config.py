from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------
    # Database
    # -------------------------
    database_url: str = "postgresql+asyncpg://prosearc:prosearc@localhost:5432/prosearc"

    # -------------------------
    # Redis
    # -------------------------
    redis_url: str = "redis://localhost:6379/0"

    # -------------------------
    # Object Storage
    # -------------------------
    storage_backend: Literal["minio", "gcs"] = "minio"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "prosearc"
    minio_use_ssl: bool = False

    gcs_bucket: str = "prosearc-prod"
    gcs_credentials_path: str = ""

    # -------------------------
    # Auth / JWT
    # -------------------------
    jwt_secret: str = "dev-secret-change-in-prod"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    # -------------------------
    # Google OAuth
    # -------------------------
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""

    # -------------------------
    # Celery
    # -------------------------
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # -------------------------
    # Application
    # -------------------------
    app_env: Literal["development", "staging", "production"] = "development"
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
