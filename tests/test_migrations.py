import os
import subprocess
from pathlib import Path


def test_alembic_upgrade_downgrade_upgrade_cycle(tmp_path):
    root = Path(__file__).resolve().parents[1]
    database_url = f"sqlite:///{tmp_path / 'migration.db'}"
    env = {**os.environ, "DATABASE_URL": database_url, "SECRET_KEY": "test-secret-key-with-at-least-32-characters"}
    for command in (["upgrade", "head"], ["downgrade", "base"], ["upgrade", "head"]):
        result = subprocess.run(["alembic", *command], cwd=root, env=env, capture_output=True, text=True, check=False)
        assert result.returncode == 0, result.stdout + result.stderr
    current = subprocess.run(["alembic", "current"], cwd=root, env=env, capture_output=True, text=True, check=False)
    assert current.returncode == 0
    assert "w2d3e4f5a6b7" in current.stdout
