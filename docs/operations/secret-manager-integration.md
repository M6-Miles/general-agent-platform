# Secret Manager Integration - Complete Implementation Guide

## Overview

The Agent Runtime platform now supports centralized secret management through AWS Secrets Manager, HashiCorp Vault, or environment variables. This document explains the implementation, migration path, and operational considerations.

## Current State (Completed)

### Modules Updated

All critical runtime modules now use `get_settings_with_secrets()` for unified secret loading:

1. **Database Connection** ([app/db.py](../../app/db.py))
   - Loads database credentials from Secret Manager
   - Supports `{{PASSWORD}}` placeholder in DATABASE_URL
   - Falls back to environment variables

2. **JWT Security** ([app/security.py](../../app/security.py))
   - SECRET_KEY loaded from Secret Manager
   - Ensures production-grade key rotation capability
   - Backward compatible with environment-only deployments

3. **Worker Process** ([app/worker.py](../../app/worker.py))
   - Model API keys loaded from Secret Manager
   - Supports hot reload of secrets without restart
   - Maintains compatibility with existing deployments

4. **Embedding Service** ([app/embeddings.py](../../app/embeddings.py))
   - Model credentials loaded from Secret Manager
   - Caches provider instances for performance
   - Graceful fallback on secret loading failure

5. **Main API** ([app/main.py](../../app/main.py))
   - Uses `get_settings_with_secrets()` for all configuration
   - Validates secrets at startup in production mode

## Architecture

### Module Structure

```text
app/
├── config.py              # Base settings with Pydantic validation
├── config_secrets.py      # Enhanced settings with Secret Manager
├── secrets.py             # Secret Manager provider abstraction
├── db.py                  # Database with secret-aware config
├── security.py            # JWT with secret-aware config
├── worker.py              # Worker with secret-aware config
└── embeddings.py          # Embeddings with secret-aware config
```

### Secret Loading Flow

```text
Application Startup
    ↓
get_settings_with_secrets()
    ↓
Check APP_ENV (production/development)
    ↓
If production + SECRET_MANAGER != env:
    ↓
    Initialize Secret Manager (AWS/Vault)
    ↓
    Load SECRET_KEY (required)
    Load MODEL_API_KEY (optional)
    Load DATABASE_PASSWORD (if {{PASSWORD}} present)
    ↓
    Replace placeholders in settings
    ↓
Validate production secrets
    ↓
Return EnhancedSettings (cached via @lru_cache)
```

## Configuration

### Environment Variables

#### Core Configuration

```bash
# Application environment (triggers secret manager in production)
APP_ENV=production

# Secret manager type: env|aws|vault
SECRET_MANAGER=aws

# Secret paths (optional, defaults provided)
SECRET_KEY_PATH=runtime/secret_key
MODEL_API_KEY_PATH=runtime/model_api_key
DATABASE_PASSWORD_PATH=runtime/database_password
SMTP_PASSWORD_PATH=runtime/smtp_password
```

#### AWS Secrets Manager

```bash
SECRET_MANAGER=aws
AWS_REGION=us-east-1

# AWS credentials (via IAM role recommended)
# AWS_ACCESS_KEY_ID=...  (not recommended, use IAM role)
# AWS_SECRET_ACCESS_KEY=...
```

#### HashiCorp Vault

```bash
SECRET_MANAGER=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=s.xxxxxxxxxxxxxxxxxx
VAULT_MOUNT_POINT=secret  # optional, defaults to 'secret'
```

#### Database URL with Password Placeholder

```bash
# Use {{PASSWORD}} placeholder for secret injection
DATABASE_URL=postgresql://agent_runtime:{{PASSWORD}}@postgres.example.com:5432/agent_runtime

# Secret manager will replace {{PASSWORD}} with actual password from:
# AWS: secret at path defined by DATABASE_PASSWORD_PATH
# Vault: secret at path defined by DATABASE_PASSWORD_PATH
# Env: environment variable DATABASE_PASSWORD
```

### Secret Structure

#### AWS Secrets Manager

Secrets should be stored as plain text strings:

```bash
# Create SECRET_KEY
aws secretsmanager create-secret \
    --name runtime/secret_key \
    --secret-string "$(openssl rand -base64 64)" \
    --region us-east-1

# Create MODEL_API_KEY
aws secretsmanager create-secret \
    --name runtime/model_api_key \
    --secret-string "sk-proj-xxxxxxxxxxxxx" \
    --region us-east-1

# Create DATABASE_PASSWORD
aws secretsmanager create-secret \
    --name runtime/database_password \
    --secret-string "$(openssl rand -base64 32)" \
    --region us-east-1
```

#### HashiCorp Vault

Secrets should be stored in KV v2 engine:

```bash
# Enable KV v2 secrets engine
vault secrets enable -path=secret kv-v2

# Write SECRET_KEY
vault kv put secret/runtime/secret_key value="$(openssl rand -base64 64)"

# Write MODEL_API_KEY
vault kv put secret/runtime/model_api_key value="sk-proj-xxxxxxxxxxxxx"

# Write DATABASE_PASSWORD
vault kv put secret/runtime/database_password value="$(openssl rand -base64 32)"
```

## Migration Guide

### Phase 1: Install Dependencies (Optional)

For AWS Secrets Manager:
```bash
pip install boto3
```

For HashiCorp Vault:
```bash
pip install hvac
```

### Phase 2: Store Secrets

#### Option A: AWS Secrets Manager

```bash
# 1. Generate strong SECRET_KEY
SECRET_KEY=$(openssl rand -base64 64)
aws secretsmanager create-secret \
    --name runtime/secret_key \
    --secret-string "$SECRET_KEY"

# 2. Store existing MODEL_API_KEY
aws secretsmanager create-secret \
    --name runtime/model_api_key \
    --secret-string "$MODEL_API_KEY"

# 3. Store DATABASE_PASSWORD
aws secretsmanager create-secret \
    --name runtime/database_password \
    --secret-string "$DATABASE_PASSWORD"
```

#### Option B: HashiCorp Vault

```bash
# 1. Authenticate to Vault
vault login

# 2. Store secrets
vault kv put secret/runtime/secret_key value="$(openssl rand -base64 64)"
vault kv put secret/runtime/model_api_key value="$MODEL_API_KEY"
vault kv put secret/runtime/database_password value="$DATABASE_PASSWORD"
```

### Phase 3: Update Configuration

```bash
# Update environment configuration
cat >> .env.production <<EOF
APP_ENV=production
SECRET_MANAGER=aws
AWS_REGION=us-east-1

# Remove plain-text secrets from .env
# SECRET_KEY=...  # Remove this
# MODEL_API_KEY=... # Remove this

# Update DATABASE_URL with placeholder
DATABASE_URL=postgresql://agent_runtime:{{PASSWORD}}@postgres:5432/agent_runtime
EOF
```

### Phase 4: Test

```bash
# Test secret loading
python -c "
from app.config_secrets import get_settings_with_secrets
settings = get_settings_with_secrets()
print(f'SECRET_KEY length: {len(settings.secret_key)}')
print(f'MODEL_API_KEY set: {bool(settings.model_api_key)}')
print(f'DATABASE_URL has password: {\"{{PASSWORD}}\" not in settings.database_url}')
"
```

### Phase 5: Deploy

Deploy with the new configuration. The system will:
1. Load secrets from Secret Manager on startup
2. Validate secrets meet production requirements
3. Fail startup in production when the configured Secret Manager cannot load required secrets

## Security Considerations

### Cold Start and SECRET_KEY

**Previous Issue**: The base `Settings` class required `SECRET_KEY` to exist in environment variables at import time, preventing Secret Manager from being the sole source of truth.

**Fix Applied**: Modified [app/config.py](../../app/config.py) to allow empty `SECRET_KEY` initially, then validates it after Secret Manager loading in production mode.

```python
# Before
secret_key: str = Field(min_length=32)  # Required at import

# After
secret_key: str = Field(default="", min_length=0)  # Validated after loading
```

### Production Validation

In production mode (`APP_ENV=production`), the system enforces:
- SECRET_KEY must be at least 48 characters
- SECRET_KEY cannot contain weak patterns (dev-secret, changeme, password123, etc.)
- Validation occurs after Secret Manager loading

### Failure Modes

#### Graceful Degradation

If Secret Manager is unavailable:
1. System logs a warning
2. Falls back to environment variables
3. Application continues to run
4. Suitable for dev/staging environments

#### Strict Mode (Recommended for Production)

To enforce strict secret loading, ensure:
- SECRET_KEY is NOT set in environment variables
- SECRET_MANAGER is set to `aws` or `vault`
- SECRET_KEY_PATH points to valid secret
- Application will fail to start if secret not found

### IAM Permissions (AWS)

Minimum required IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:runtime/*"
      ]
    }
  ]
}
```

### Vault Policies

Minimum required Vault policy:

```hcl
path "secret/data/runtime/*" {
  capabilities = ["read"]
}

path "secret/metadata/runtime/*" {
  capabilities = ["list"]
}
```

## Operational Considerations

### First administrator provisioning

The production Compose file does not create a default account. Store the first administrator password as `runtime/admin_password` in the configured Secret Manager and inject it only for the one-off provisioning command:

```bash
export APP_ENV=production
export SECRET_MANAGER=aws # or vault
export SECRET_KEY_PATH=runtime/secret_key
export DATABASE_URL="$MIGRATION_DATABASE_URL"
export ADMIN_EMAIL=owner@your-company.example
export ADMIN_PASSWORD="$(aws secretsmanager get-secret-value --secret-id runtime/admin_password --query SecretString --output text)"
export ADMIN_TENANT_SLUG=your-company
export ADMIN_TENANT_NAME="Your Company"
python scripts/provision_admin.py
unset ADMIN_PASSWORD
```

For Vault, replace the password lookup with `vault kv get -field=value secret/runtime/admin_password`. The provisioner rejects `demo`, `admin@example.com`, and `ChangeMe123456!`, never logs the password, and requires `--rotate-existing` when changing an existing administrator password. Validate the configuration with `python scripts/production_rehearsal.py` before applying it to production.

### Secret Rotation

#### AWS Secrets Manager

Enable automatic rotation:

```bash
aws secretsmanager rotate-secret \
    --secret-id runtime/secret_key \
    --rotation-lambda-arn arn:aws:lambda:region:account:function:RotateSecret \
    --rotation-rules AutomaticallyAfterDays=30
```

After rotation:
- Restart all API and worker processes
- No database migration required
- JWT tokens issued before rotation remain valid until expiration

#### HashiCorp Vault

Use Vault's versioned secrets:

```bash
# Create new version
vault kv put secret/runtime/secret_key value="$(openssl rand -base64 64)"

# Old version remains accessible during rollout
vault kv get -version=1 secret/runtime/secret_key
```

### Monitoring

Key metrics to monitor:
- Secret loading failures (check application logs)
- Secret Manager API latency
- Failed authentication attempts (may indicate stale secrets)

### Caching

Settings are cached via `@lru_cache` for performance:
- Cache persists for the lifetime of the process
- Requires restart to pick up rotated secrets
- Trade-off: performance vs. hot reload capability

To enable hot reload (advanced):
```python
# In app/config_secrets.py, remove @lru_cache
# Add TTL-based cache with periodic refresh
```

## Testing

### Unit Tests

Secret Manager integration is tested via:
- Import-time initialization in all modules
- Fallback to environment variables
- Production validation

### Integration Tests

Test with actual Secret Manager:

```bash
# Set test environment
export APP_ENV=production
export SECRET_MANAGER=aws
export AWS_REGION=us-east-1
export SECRET_KEY_PATH=test/secret_key

# Run tests
pytest tests/ -v
```

### Local Development

For local development without Secret Manager:

```bash
# Keep using environment variables
export APP_ENV=development
export SECRET_KEY="dev-secret-key-at-least-48-chars-long-for-testing-only"
export DATABASE_URL="sqlite:///./data/agent_runtime.db"

# SECRET_MANAGER defaults to 'env', no change needed
```

## Troubleshooting

### Issue: "SECRET_KEY must be a strong production secret"

**Cause**: SECRET_KEY is too short or contains weak patterns in production mode.

**Fix**:
```bash
# Generate strong key and store in Secret Manager
aws secretsmanager put-secret-value \
    --secret-id runtime/secret_key \
    --secret-string "$(openssl rand -base64 64)"
```

### Issue: "Failed to load secrets from Secret Manager"

**Cause**: Secret Manager is unavailable or credentials are invalid.

**Fix**:
1. Check AWS/Vault credentials
2. Verify secret paths are correct
3. Check IAM/Vault permissions
4. Review application logs for detailed error

**Temporary Workaround**:
```bash
# Fall back to environment variables
export SECRET_MANAGER=env
export SECRET_KEY="$(openssl rand -base64 64)"
```

### Issue: Database connection fails with "password authentication failed"

**Cause**: {{PASSWORD}} placeholder not replaced in DATABASE_URL.

**Fix**:
```bash
# Ensure DATABASE_PASSWORD_PATH is set
export DATABASE_PASSWORD_PATH=runtime/database_password

# Verify secret exists
aws secretsmanager get-secret-value --secret-id runtime/database_password

# Check DATABASE_URL contains placeholder
echo $DATABASE_URL  # Should contain {{PASSWORD}}
```

## Related Documentation

- [Rate Limiting Behavior](./rate-limiting-behavior.md)
- [Release Checklist](../delivery/release-checklist.md)
- [RLS Verification](../security/rls-verification.md)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)

## Code References

- Secret Manager implementation: [app/secrets.py](../../app/secrets.py)
- Enhanced settings: [app/config_secrets.py](../../app/config_secrets.py)
- Base settings: [app/config.py](../../app/config.py)
- Database integration: [app/db.py](../../app/db.py)
- Security integration: [app/security.py](../../app/security.py)
- Worker integration: [app/worker.py](../../app/worker.py)
- Embedding integration: [app/embeddings.py](../../app/embeddings.py)
