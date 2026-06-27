from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = (
        "postgresql+psycopg://akiya:akiya_dev_password@localhost:5432/akiya_radar"
    )
    cors_origins: str = "http://localhost:5173"

    # Single-user auth (MVP). Password may be set in plain (dev) and is hashed at runtime.
    auth_enabled: bool = False
    admin_password: str = "akiya_admin_dev"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Pluggable provider switches — all default to mock so the MVP has no paid deps.
    exchange_rate_provider: str = "mock"
    translation_provider: str = "mock"
    llm_provider: str = "mock"

    # Static fallback rate used by the mock exchange provider (EUR per 1 JPY).
    jpy_to_eur_rate: float = 0.0060

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
