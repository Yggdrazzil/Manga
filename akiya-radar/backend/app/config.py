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

    # Pluggable provider switches. Translation stays mock (no paid deps), but
    # the exchange rate is live by default: it is free, key-less and a stale
    # hard-coded rate silently misprices every listing in euros.
    exchange_rate_provider: str = "live"  # "live" | "static"
    translation_provider: str = "mock"
    llm_provider: str = "mock"

    # Offline fallback only (EUR per 1 JPY) — refreshed value, used when every
    # live provider is unreachable.
    jpy_to_eur_rate: float = 0.0055

    # Manual-import URL fetching (robots-respecting, best-effort, never fatal).
    import_fetch_enabled: bool = True
    import_fetch_timeout: float = 8.0

    # JavaScript rendering (Scrapling) for sources that serve an empty app
    # shell. Used as an escalation, never as the default path: a browser launch
    # costs ~100× an HTTP GET. Rendering only — no anti-bot circumvention.
    dynamic_fetch_enabled: bool = True
    dynamic_fetch_timeout: float = 45.0
    # Reuse an existing browser instead of downloading one (also AKIYA_BROWSER_PATH).
    browser_executable_path: str = ""

    # Public-data enrichment. GSI geocoding and J-SHIS seismic hazard are free,
    # key-less government APIs; MLIT transaction prices need a free API key
    # (https://www.reinfolib.mlit.go.jp/api/request/). All are best-effort.
    geocoding_enabled: bool = True
    hazard_enabled: bool = True
    mlit_api_key: str = ""
    user_agent: str = (
        "AkiyaRadarBot/0.1 (+personal akiya research; respects robots.txt)"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
