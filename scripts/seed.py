import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import Base, SessionLocal, engine
from app.models import Tenant, User
from app.security import hash_password


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        tenant = db.query(Tenant).filter_by(slug="demo").first()
        if tenant is None:
            tenant = Tenant(name="Demo Tenant", slug="demo")
            db.add(tenant)
            db.flush()
        demo_users = [
            ("admin@example.com", "Demo Admin", "admin"),
            ("member@example.com", "Demo Member", "member"),
            ("readonly@example.com", "Demo Readonly", "readonly"),
        ]
        for email, display_name, role in demo_users:
            user = db.query(User).filter_by(tenant_id=tenant.id, email=email).first()
            if user is None:
                db.add(User(tenant_id=tenant.id, email=email, display_name=display_name, role=role, password_hash=hash_password("ChangeMe123456!")))
        db.commit()
    print("Seeded demo tenant and admin@example.com")


if __name__ == "__main__":
    main()
