"""Create or rotate a production administrator from injected credentials.

The command is intentionally environment-driven so the password can come from
AWS Secrets Manager, Vault, or another approved secret-injection mechanism.
It never prints the password and refuses the development demo identity.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.models import Tenant, User
from app.security import hash_password


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"))
    parser.add_argument("--tenant-slug", default=os.getenv("ADMIN_TENANT_SLUG"))
    parser.add_argument("--tenant-name", default=os.getenv("ADMIN_TENANT_NAME"))
    parser.add_argument("--rotate-existing", action="store_true")
    return parser


def _validate(email: str | None, password: str | None, tenant_slug: str | None) -> tuple[str, str, str]:
    if not email or not password or not tenant_slug:
        raise SystemExit("ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_TENANT_SLUG are required")
    if email.lower() == "admin@example.com" or tenant_slug.lower() == "demo":
        raise SystemExit("DEMO_IDENTITY_FORBIDDEN_IN_ADMIN_PROVISIONING")
    if password == "ChangeMe123456!" or len(password) < 20:
        raise SystemExit("ADMIN_PASSWORD_MUST_BE_AT_LEAST_20_CHARACTERS_AND_NOT_DEMO_PASSWORD")
    return email, password, tenant_slug


def main() -> None:
    args = _parser().parse_args()
    email, password, tenant_slug = _validate(args.email, args.password, args.tenant_slug)
    tenant_name = args.tenant_name or tenant_slug
    with SessionLocal() as db:
        tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
        if tenant is None:
            tenant = Tenant(name=tenant_name, slug=tenant_slug)
            db.add(tenant)
            db.flush()
        user = db.query(User).filter(User.tenant_id == tenant.id, User.email == email).first()
        if user is None:
            user = User(tenant_id=tenant.id, email=email, display_name="Production Administrator", role="admin", password_hash=hash_password(password))
            db.add(user)
        elif args.rotate_existing:
            user.password_hash = hash_password(password)
            user.role = "admin"
            user.status = "active"
        else:
            raise SystemExit("ADMIN_ALREADY_EXISTS_USE_ROTATE_EXISTING")
        db.commit()
    print(f"Provisioned production administrator: {email} (tenant={tenant_slug})")


if __name__ == "__main__":
    main()
