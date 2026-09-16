"""
Enhanced Settings with Secret Manager support.

This module extends the base Settings to optionally load secrets from
AWS Secrets Manager, HashiCorp Vault, or other secret management systems.

Usage in production:
    export SECRET_MANAGER=aws
    export AWS_REGION=us-east-1
    # Secrets are automatically loaded from AWS Secrets Manager

Configuration:
    SECRET_MANAGER=env|aws|vault (default: env)
    SECRET_KEY_PATH=runtime/secret_key (optional, overrides env var)
    MODEL_API_KEY_PATH=runtime/model_api_key (optional)
    DATABASE_PASSWORD_PATH=runtime/database_password (optional)
"""

from app.config import Settings
from app.secrets import get_secret_manager


class EnhancedSettings(Settings):
    """Settings with Secret Manager support for production secrets."""

    def __init__(self, **kwargs):
        """Initialize settings, optionally loading from Secret Manager."""
        super().__init__(**kwargs)
        self._load_secrets_from_manager()

    def _load_secrets_from_manager(self) -> None:
        """Load production secrets from configured Secret Manager."""
        import os

        # Skip if not configured
        secret_manager_type = os.getenv("SECRET_MANAGER", "env").lower()
        is_production = self.app_env.lower() in {"production", "prod"}
        if secret_manager_type == "env":
            # Only validate in production when using env fallback
            if is_production:
                from app.config import validate_production_secrets
                validate_production_secrets(self)
            return
        if secret_manager_type not in {"aws", "vault"}:
            raise ValueError(f"Unsupported SECRET_MANAGER provider: {secret_manager_type}")

        try:
            manager = get_secret_manager()

            # Load SECRET_KEY if path configured or if current value is empty/weak
            secret_key_path = os.getenv("SECRET_KEY_PATH")
            if secret_key_path or not self.secret_key:
                # Try default path if no path configured
                path = secret_key_path or "runtime/secret_key"
                secret_key = manager.get(path)
                if secret_key:
                    self.secret_key = secret_key
                elif not self.secret_key:
                    raise ValueError(f"SECRET_KEY not found in Secret Manager at {path} and not set in environment")

            # Load MODEL_API_KEY if path configured
            model_api_key_path = os.getenv("MODEL_API_KEY_PATH")
            if model_api_key_path:
                model_api_key = manager.get(model_api_key_path)
                if model_api_key:
                    self.model_api_key = model_api_key

            smtp_password_path = os.getenv("SMTP_PASSWORD_PATH")
            if smtp_password_path:
                smtp_password = manager.get(smtp_password_path)
                if smtp_password:
                    self.smtp_password = smtp_password

            # Load DATABASE_PASSWORD if path configured and URL contains placeholder
            db_password_path = os.getenv("DATABASE_PASSWORD_PATH")
            if db_password_path and "{{PASSWORD}}" in self.database_url:
                db_password = manager.get(db_password_path)
                if db_password:
                    self.database_url = self.database_url.replace(
                        "{{PASSWORD}}", db_password
                    )

            if is_production:
                from app.config import validate_production_secrets
                validate_production_secrets(self)
        except (ImportError, ValueError, KeyError, OSError) as e:
            # Production must fail closed when required secrets cannot be loaded.
            if is_production:
                raise RuntimeError("Production secret loading failed") from e
            # Development environments may continue with environment defaults.
            import sys

            print(
                f"Warning: Failed to load secrets from Secret Manager: {e}",
                file=sys.stderr,
            )


from functools import lru_cache


@lru_cache
def get_settings_with_secrets() -> EnhancedSettings:
    """Get settings instance with Secret Manager support (cached)."""
    return EnhancedSettings()
