#!/usr/bin/env sh
set -eu
work_dir="$(mktemp -d)"
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT
source_db="$work_dir/source.db"
restored_db="$work_dir/restored.db"
python - "$source_db" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute("create table verification(id integer primary key, value text not null)")
db.execute("insert into verification(value) values (?)", ("backup-restore-ok",))
db.commit()
PY
backup_file="$(DATABASE_URL="sqlite:///$source_db" BACKUP_DIR="$work_dir/backups" sh scripts/backup.sh)"
DATABASE_URL="sqlite:///$restored_db" BACKUP_FILE="$backup_file" sh scripts/restore.sh
python - "$restored_db" <<'PY'
import sqlite3, sys
value = sqlite3.connect(sys.argv[1]).execute("select value from verification").fetchone()[0]
assert value == "backup-restore-ok", value
print("BACKUP_RESTORE_VERIFIED")
PY
echo "BACKUP_FILE=$backup_file"
