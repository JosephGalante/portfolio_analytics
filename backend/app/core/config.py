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

    database_url: str = (
        "postgresql+asyncpg://portfolio:portfolio@localhost:5432/portfolio_analytics"
    )
    redis_url: str = "redis://localhost:6379/0"
    stytch_project_id: str = ""
    stytch_secret: str = ""
    stytch_api_url: str = "https://test.stytch.com/v1"
    simulator_symbols: str = "AAPL,MSFT,NVDA,GOOGL,AMZN"
    simulator_tick_interval_ms: int = 1500
    simulator_initial_price_aapl: str = "185.00"
    simulator_initial_price_msft: str = "420.00"
    simulator_initial_price_nvda: str = "910.00"
    simulator_initial_price_googl: str = "145.00"
    simulator_initial_price_amzn: str = "180.00"

    @property
    def symbol_list(self) -> list[str]:
        return [
            symbol.strip().upper() for symbol in self.simulator_symbols.split(",") if symbol.strip()
        ]

    @property
    def initial_prices(self) -> dict[str, str]:
        return {
            "AAPL": self.simulator_initial_price_aapl,
            "MSFT": self.simulator_initial_price_msft,
            "NVDA": self.simulator_initial_price_nvda,
            "GOOGL": self.simulator_initial_price_googl,
            "AMZN": self.simulator_initial_price_amzn,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
