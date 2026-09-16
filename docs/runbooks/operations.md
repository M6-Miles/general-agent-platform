# Operations Runbook

## API or readiness failure

Check `/health`, `/ready`, PostgreSQL connectivity, Redis connectivity, and recent container logs. Stop traffic only after preserving request IDs and trace context.

## Redis outage

The API continues with database-backed acceptance and the Worker polling fallback. Restore Redis, verify stream depth and dead-letter entries, then replay only verified messages.

## Database restore

Restore into an isolated PostgreSQL instance first, run Alembic compatibility checks, verify tenant counts, Run terminal states, Runtime Events, approvals, and audit rows, then switch traffic.

## Key exposure

Revoke the exposed provider key, rotate application secrets, inspect audit and access logs, and record the incident ID. Never place replacement credentials in source control or chat.

## Production initialization

Production Compose intentionally disables the demo `seed` service. Create the first administrator as a one-off operation from a Secret Manager-injected environment:

```powershell
$env:APP_ENV = "production"
$env:SECRET_MANAGER = "aws" # or vault
$env:SECRET_KEY_PATH = "runtime/secret_key"
$env:DATABASE_URL = $env:MIGRATION_DATABASE_URL
$env:ADMIN_EMAIL = "owner@your-company.example"
$env:ADMIN_PASSWORD = (aws secretsmanager get-secret-value --secret-id runtime/admin_password --query SecretString --output text)
$env:ADMIN_TENANT_SLUG = "your-company"
$env:ADMIN_TENANT_NAME = "Your Company"
python scripts/provision_admin.py
Remove-Item Env:ADMIN_PASSWORD
```

The command is idempotent for a new account and requires `--rotate-existing` for password rotation. It rejects the demo tenant, demo email, and demo password. Keep `DATABASE_URL` pointed at the migration/owner connection for this one-off operation; the API and Worker continue to use the least-privileged `APP_DATABASE_URL` role.

Run `python scripts/production_rehearsal.py` before deployment. It validates strong production settings, the disabled demo seed, and the administrator provisioner without contacting an external provider or printing secrets.
