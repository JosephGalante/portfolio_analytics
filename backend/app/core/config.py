from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Portfolio Analytics"
    app_env: str = "local"
    app_host: str = "0.0.0.0"
    app_port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()
