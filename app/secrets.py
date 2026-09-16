"""
Secret Manager integration for production secret retrieval.

Supports:
- AWS Secrets Manager
- HashiCorp Vault
- Environment variables (fallback)

Usage:
    from app.secrets import get_secret_manager

    secrets = get_secret_manager()
    db_password = secrets.get("database/password")
    api_key = secrets.get("openai/api_key")
"""

import json
import os
from abc import ABC, abstractmethod
from functools import lru_cache

# Optional imports for AWS and Vault - will be None if not installed
try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None  # type: ignore
    ClientError = None  # type: ignore

try:
    import hvac
except ImportError:
    hvac = None  # type: ignore


class SecretManager(ABC):
    """Abstract base class for secret management providers."""

    @abstractmethod
    def get(self, key: str) -> str | None:
        """Retrieve a secret by key."""

    @abstractmethod
    def get_json(self, key: str) -> dict:
        """Retrieve and parse a JSON secret."""


class EnvironmentSecretManager(SecretManager):
    """Fallback secret manager using environment variables."""

    def get(self, key: str) -> str | None:
        """Get secret from environment variable."""
        # Convert path-like keys to env var format
        # e.g., "database/password" -> "DATABASE_PASSWORD"
        env_key = key.replace("/", "_").replace("-", "_").upper()
        return os.getenv(env_key)

    def get_json(self, key: str) -> dict:
        """Get and parse JSON secret from environment."""
        value = self.get(key)
        if value is None:
            return {}
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {}


class AWSSecretsManager(SecretManager):
    """AWS Secrets Manager integration."""

    def __init__(self, region: str = "us-east-1"):
        """Initialize AWS Secrets Manager client."""
        if boto3 is None:
            raise ImportError(
                "boto3 is required for AWS Secrets Manager. "
                "Install with: pip install boto3"
            )
        self.client = boto3.client("secretsmanager", region_name=region)
        self.ClientError = ClientError

    def get(self, key: str) -> str | None:
        """Retrieve secret from AWS Secrets Manager."""
        try:
            response = self.client.get_secret_value(SecretId=key)
            return response.get("SecretString")
        except self.ClientError as e:
            if e.response["Error"]["Code"] == "ResourceNotFoundException":
                return None
            raise

    def get_json(self, key: str) -> dict:
        """Retrieve and parse JSON secret from AWS."""
        value = self.get(key)
        if value is None:
            return {}
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {}


class VaultSecretManager(SecretManager):
    """HashiCorp Vault integration."""

    def __init__(self, url: str, token: str, mount_point: str = "secret"):
        """Initialize Vault client."""
        if hvac is None:
            raise ImportError(
                "hvac is required for HashiCorp Vault. "
                "Install with: pip install hvac"
            )
        self.client = hvac.Client(url=url, token=token)
        self.mount_point = mount_point
        if not self.client.is_authenticated():
            raise ValueError("Vault authentication failed")

    def get(self, key: str) -> str | None:
        """Retrieve secret from Vault."""
        try:
            response = self.client.secrets.kv.v2.read_secret_version(
                path=key, mount_point=self.mount_point
            )
            data = response.get("data", {}).get("data", {})
            # If single value, return it; if multiple, return as JSON
            if len(data) == 1:
                return next(iter(data.values()))
            return json.dumps(data)
        except (KeyError, ValueError, TypeError):
            return None

    def get_json(self, key: str) -> dict:
        """Retrieve JSON secret from Vault."""
        try:
            response = self.client.secrets.kv.v2.read_secret_version(
                path=key, mount_point=self.mount_point
            )
            return response.get("data", {}).get("data", {})
        except (KeyError, ValueError, TypeError):
            return {}


@lru_cache
def get_secret_manager() -> SecretManager:
    """
    Get the configured secret manager instance.

    Configuration via environment variables:
    - SECRET_MANAGER=aws|vault|env (default: env)
    - AWS_REGION (for AWS Secrets Manager)
    - VAULT_ADDR (for HashiCorp Vault)
    - VAULT_TOKEN (for HashiCorp Vault)
    - VAULT_MOUNT_POINT (for HashiCorp Vault, default: secret)
    """
    provider = os.getenv("SECRET_MANAGER", "env").lower()

    if provider == "aws":
        region = os.getenv("AWS_REGION", "us-east-1")
        return AWSSecretsManager(region=region)

    elif provider == "vault":
        vault_addr = os.getenv("VAULT_ADDR")
        vault_token = os.getenv("VAULT_TOKEN")
        vault_mount = os.getenv("VAULT_MOUNT_POINT", "secret")

        if not vault_addr or not vault_token:
            raise ValueError(
                "VAULT_ADDR and VAULT_TOKEN must be set when using Vault"
            )

        return VaultSecretManager(
            url=vault_addr, token=vault_token, mount_point=vault_mount
        )

    else:  # env or unknown falls back to environment
        return EnvironmentSecretManager()


def get_secret(key: str, default: str | None = None) -> str | None:
    """
    Convenience function to retrieve a single secret.

    Args:
        key: Secret key/path
        default: Default value if secret not found

    Returns:
        Secret value or default
    """
    manager = get_secret_manager()
    value = manager.get(key)
    return value if value is not None else default
