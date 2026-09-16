import shutil
import subprocess

import pytest


@pytest.mark.skipif(shutil.which("sh") is None, reason="requires POSIX shell")
def test_backup_restore_script_is_repeatable():
    result = subprocess.run(["sh", "scripts/test_backup_restore.sh"], capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert "BACKUP_RESTORE_VERIFIED" in result.stdout
