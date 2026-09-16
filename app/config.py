from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def validate_production_secrets(settings: "Settings") -> None:
    """Reject well-known development credentials when running in production."""
    if settings.app_env.lower() not in {"production", "prod"}:
        return
    weak = ("dev-secret", "changeme", "password123", "secret-key", "change-me")
    if any(value in settings.secret_key.lower() for value in weak) or len(settings.secret_key) < 48:
        raise ValueError("SECRET_KEY must be a strong production secret")


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "auditable-agent-runtime"
    secret_key: str = Field(default="", min_length=0)  # Allow empty for cold start with Secret Manager
    access_token_ttl_minutes: int = Field(default=30, ge=5, le=1440)
    database_url: str = "sqlite:///./data/agent_runtime.db"
    db_echo: bool = False
    redis_url: str = "redis://localhost:6379/0"
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"
    model_provider: str = "mock"
    model_base_url: str = "https://api.openai.com/v1"
    model_api_key: str | None = None
    model_name: str = "gpt-4o-mini"
    model_timeout_seconds: int = Field(default=30, ge=1, le=180)
    model_max_retries: int = Field(default=2, ge=0, le=5)
    model_circuit_threshold: int = Field(default=3, ge=1, le=20)
    model_cost_per_1k_input_usd: float = Field(default=0.00027, ge=0)
    model_cost_per_1k_output_usd: float = Field(default=0.0011, ge=0)
    embedding_provider: str = "mock"
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    rate_limit_enabled: bool = True
    rate_limit_default: int = Field(default=120, ge=0)
    max_upload_bytes: int = Field(default=2_000_000, ge=1_024, le=50_000_000)
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool = True
    public_app_url: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
