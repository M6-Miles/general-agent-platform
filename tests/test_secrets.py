"""Tests for Secret Manager integration."""

from unittest.mock import MagicMock, patch

import pytest

from app.config_secrets import EnhancedSettings
from app.secrets import (
    AWSSecretsManager,
    EnvironmentSecretManager,
    VaultSecretManager,
    get_secret_manager,
)


class TestEnvironmentSecretManager:
    """Tests for environment variable-based secret management."""

    def test_get_existing_env_var(self, monkeypatch):
        """Test retrieving an existing environment variable."""
        monkeypatch.setenv("DATABASE_PASSWORD", "test-password")
        manager = EnvironmentSecretManager()
        assert manager.get("database/password") == "test-password"

    def test_get_missing_env_var(self):
        """Test retrieving a non-existent environment variable."""
        manager = EnvironmentSecretManager()
        assert manager.get("nonexistent/key") is None

    def test_get_json_valid(self, monkeypatch):
        """Test retrieving and parsing valid JSON."""
        monkeypatch.setenv("DB_CONFIG", '{"host": "localhost", "port": 5432}')
        manager = EnvironmentSecretManager()
        result = manager.get_json("db/config")
        assert result == {"host": "localhost", "port": 5432}

    def test_get_json_invalid(self, monkeypatch):
        """Test handling invalid JSON."""
        monkeypatch.setenv("BAD_JSON", "not-valid-json")
        manager = EnvironmentSecretManager()
        result = manager.get_json("bad/json")
        assert result == {}

    def test_get_json_missing(self):
        """Test retrieving non-existent JSON secret."""
        manager = EnvironmentSecretManager()
        result = manager.get_json("missing/json")
        assert result == {}

    def test_key_normalization(self, monkeypatch):
        """Test that path-like keys are normalized to env var format."""
        monkeypatch.setenv("MY_SECRET_KEY", "value")
        manager = EnvironmentSecretManager()
        assert manager.get("my/secret-key") == "value"


class TestAWSSecretsManager:
    """Tests for AWS Secrets Manager integration."""

    @pytest.fixture
    def mock_boto3(self):
        """Mock boto3 client."""
        with patch("app.secrets.boto3") as mock:
            mock_client = MagicMock()
            mock.client.return_value = mock_client
            yield mock_client

    def test_get_existing_secret(self, mock_boto3):
        """Test retrieving an existing secret."""
        mock_boto3.get_secret_value.return_value = {"SecretString": "test-value"}
        manager = AWSSecretsManager(region="us-east-1")
        assert manager.get("runtime/secret_key") == "test-value"

    def test_get_missing_secret(self, mock_boto3):
        """Test handling missing secret."""
        # Create a mock exception that behaves like ClientError
        class MockClientError(Exception):
            def __init__(self, response, operation_name):
                self.response = response
                super().__init__(f"{operation_name}: {response}")

        mock_error = MockClientError(
            {"Error": {"Code": "ResourceNotFoundException"}}, "GetSecretValue"
        )
        mock_boto3.get_secret_value.side_effect = mock_error

        manager = AWSSecretsManager(region="us-east-1")
        manager.ClientError = MockClientError

        result = manager.get("runtime/missing_key")
        assert result is None

    def test_get_json_secret(self, mock_boto3):
        """Test retrieving JSON secret."""
        mock_boto3.get_secret_value.return_value = {
            "SecretString": '{"key": "value"}'
        }
        manager = AWSSecretsManager(region="us-east-1")
        result = manager.get_json("runtime/config")
        assert result == {"key": "value"}


class TestVaultSecretManager:
    """Tests for HashiCorp Vault integration."""

    @pytest.fixture
    def mock_hvac(self):
        """Mock hvac client."""
        with patch("app.secrets.hvac") as mock:
            mock_client = MagicMock()
            mock_client.is_authenticated.return_value = True
            mock.Client.return_value = mock_client
            yield mock_client

    def test_get_single_value_secret(self, mock_hvac):
        """Test retrieving a single-value secret."""
        mock_hvac.secrets.kv.v2.read_secret_version.return_value = {
            "data": {"data": {"value": "test-secret"}}
        }
        manager = VaultSecretManager(
            url="http://vault:8200", token="test-token"
        )
        assert manager.get("runtime/secret_key") == "test-secret"

    def test_get_multi_value_secret(self, mock_hvac):
        """Test retrieving a multi-value secret as JSON."""
        mock_hvac.secrets.kv.v2.read_secret_version.return_value = {
            "data": {"data": {"username": "user", "password": "pass"}}
        }
        manager = VaultSecretManager(
            url="http://vault:8200", token="test-token"
        )
        result = manager.get("runtime/db_creds")
        assert '"username"' in result
        assert '"password"' in result

    def test_get_json_secret(self, mock_hvac):
        """Test retrieving structured secret."""
        mock_hvac.secrets.kv.v2.read_secret_version.return_value = {
            "data": {"data": {"host": "localhost", "port": 5432}}
        }
        manager = VaultSecretManager(
            url="http://vault:8200", token="test-token"
        )
        result = manager.get_json("runtime/db_config")
        assert result == {"host": "localhost", "port": 5432}

    def test_authentication_failure(self):
        """Test handling authentication failure."""
        with patch("app.secrets.hvac") as mock:
            mock_client = MagicMock()
            mock_client.is_authenticated.return_value = False
            mock.Client.return_value = mock_client
            with pytest.raises(ValueError, match="authentication failed"):
                VaultSecretManager(url="http://vault:8200", token="bad-token")


class TestSecretManagerFactory:
    """Tests for get_secret_manager factory function."""

    def test_default_env_manager(self, monkeypatch):
        """Test that environment manager is default."""
        monkeypatch.delenv("SECRET_MANAGER", raising=False)
        get_secret_manager.cache_clear()
        manager = get_secret_manager()
        assert isinstance(manager, EnvironmentSecretManager)

    def test_aws_manager(self, monkeypatch):
        """Test creating AWS manager."""
        monkeypatch.setenv("SECRET_MANAGER", "aws")
        monkeypatch.setenv("AWS_REGION", "us-west-2")
        get_secret_manager.cache_clear()
        with patch("app.secrets.boto3"):
            manager = get_secret_manager()
            assert isinstance(manager, AWSSecretsManager)

    def test_vault_manager(self, monkeypatch):
        """Test creating Vault manager."""
        monkeypatch.setenv("SECRET_MANAGER", "vault")
        monkeypatch.setenv("VAULT_ADDR", "http://vault:8200")
        monkeypatch.setenv("VAULT_TOKEN", "test-token")
        get_secret_manager.cache_clear()
        with patch("app.secrets.hvac") as mock:
            mock_client = MagicMock()
            mock_client.is_authenticated.return_value = True
            mock.Client.return_value = mock_client
            manager = get_secret_manager()
            assert isinstance(manager, VaultSecretManager)

    def test_vault_missing_config(self, monkeypatch):
        """Test error when Vault config is incomplete."""
        monkeypatch.setenv("SECRET_MANAGER", "vault")
        monkeypatch.delenv("VAULT_ADDR", raising=False)
        get_secret_manager.cache_clear()
        with pytest.raises(ValueError, match="VAULT_ADDR and VAULT_TOKEN"):
            get_secret_manager()

    def test_caching(self, monkeypatch):
        """Test that manager instance is cached."""
        monkeypatch.delenv("SECRET_MANAGER", raising=False)
        get_secret_manager.cache_clear()
        manager1 = get_secret_manager()
        manager2 = get_secret_manager()
        assert manager1 is manager2


def test_production_secret_manager_failure_fails_closed(monkeypatch):
    """Production startup must not continue with an empty or weak JWT key."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_MANAGER", "aws")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setattr(
        "app.config_secrets.get_secret_manager",
        lambda: (_ for _ in ()).throw(ValueError("provider unavailable")),
    )

    with pytest.raises(RuntimeError, match="Production secret loading failed"):
        EnhancedSettings()


def test_enhanced_settings_loads_smtp_password_from_secret_manager(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_MANAGER", "aws")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-at-least-32-characters")
    monkeypatch.setenv("SMTP_PASSWORD_PATH", "runtime/smtp_password")
    manager = MagicMock()
    manager.get.return_value = "smtp-secret"
    monkeypatch.setattr("app.config_secrets.get_secret_manager", lambda: manager)

    settings = EnhancedSettings()

    assert settings.smtp_password == "smtp-secret"
    manager.get.assert_called_once_with("runtime/smtp_password")
