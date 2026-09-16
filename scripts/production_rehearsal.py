"""Run a local, side-effect-free production configuration rehearsal."""

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings, validate_production_secrets

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    strong_key = "rehearsal-" + "x" * 64
    settings = Settings(_env_file=None, app_env="production", secret_key=strong_key, model_provider="mock")
    validate_production_secrets(settings)

    example = (ROOT / ".env.production.example").read_text(encoding="utf-8")
    forbidden = ("admin@example.com", "ChangeMe123456!")
    if any(value in example for value in forbidden):
        raise SystemExit("PRODUCTION_EXAMPLE_CONTAINS_DEMO_CREDENTIAL")

    compose = yaml.safe_load((ROOT / "docker-compose.production.yml").read_text(encoding="utf-8"))
    seed_command = " ".join(compose["services"]["seed"]["command"])
    if "disabled" not in seed_command.lower():
        raise SystemExit("PRODUCTION_DEMO_SEED_NOT_DISABLED")
    if not (ROOT / "scripts/provision_admin.py").exists():
        raise SystemExit("PRODUCTION_ADMIN_PROVISIONER_MISSING")

    print("production-rehearsal-ok")
    print("secret-manager-write: pending external AWS/Vault credentials")


if __name__ == "__main__":
    main()
