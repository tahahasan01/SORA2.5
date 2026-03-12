"""Application configuration — loaded from environment / .env file."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/drone_compliance"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/drone_compliance"
    APP_TITLE: str = "Drone Compliance API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
