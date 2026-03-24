from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Portfolio Analytics"
    app_version: str = "0.1.0"
    app_env: str = "local"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    database_url: str = "postgresql+asyncpg://portfolio:portfolio@localhost:5432/portfolio_analytics"
    redis_url: str = "redis://localhost:6379/0"
    seeded_user_email: str = "demo@example.com"
    seeded_user_name: str = "Demo User"


@lru_cache
def get_settings() -> Settings:
    return Settings()
