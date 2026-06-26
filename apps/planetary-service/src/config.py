"""
Application configuration using Pydantic Settings.
All values are read from environment variables with validation.
"""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Application ───
    VERSION: str = "0.1.0"
    APP_ENV: Literal["development", "test", "production"] = "development"
    PORT: int = 4002
    LOG_LEVEL: str = "info"

    # ─── CORS ───
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ─── PostgreSQL ───
    DATABASE_URL: str  # asyncpg format: postgresql+asyncpg://...

    # ─── Redis ───
    REDIS_URL: str  # redis://:password@host:port

    # ─── Kafka ───
    KAFKA_BROKERS: str = "localhost:29092"

    # ─── NASA Horizons ───
    NASA_HORIZONS_API_URL: str = "https://ssd.jpl.nasa.gov/api/horizons.api"

    # ─── Cache TTLs (seconds) ───
    PLANETARY_CACHE_TTL_SECONDS: int = 300  # 5 minutes

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def kafka_brokers_list(self) -> list[str]:
        return [b.strip() for b in self.KAFKA_BROKERS.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Returns cached settings singleton."""
    return Settings()


settings = get_settings()
