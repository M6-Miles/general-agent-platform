"""Provision the least-privileged PostgreSQL role used by API and Worker."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from psycopg import connect, sql
from sqlalchemy.engine import make_url


def main() -> None:
    admin_url = make_url(os.environ["DATABASE_URL"])
    runtime_url = make_url(os.environ["APP_DATABASE_URL"])
    if admin_url.get_backend_name() != "postgresql":
        print("Runtime role provisioning skipped for non-PostgreSQL database")
        return
    role = runtime_url.username
    password = runtime_url.password
    database = runtime_url.database
    if not role or not password or not database:
        raise RuntimeError("APP_DATABASE_URL must include database, username, and password")

    dsn = admin_url.render_as_string(hide_password=False).replace("postgresql+psycopg://", "postgresql://", 1)
    with connect(dsn, autocommit=True) as connection, connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,))
        if cursor.fetchone() is None:
            cursor.execute(
                sql.SQL("CREATE ROLE {} LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS").format(
                    sql.Identifier(role), sql.Literal(password)
                ),
            )
        else:
            cursor.execute(
                sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS").format(
                    sql.Identifier(role), sql.Literal(password)
                ),
            )
        runtime_role = sql.Identifier(role)
        cursor.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(sql.Identifier(database), runtime_role))
        cursor.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(runtime_role))
        cursor.execute(sql.SQL("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {}").format(runtime_role))
        cursor.execute(sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(runtime_role))
        cursor.execute(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}").format(runtime_role))
        cursor.execute(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {}").format(runtime_role))
    print(f"Provisioned PostgreSQL runtime role: {role}")


if __name__ == "__main__":
    main()
