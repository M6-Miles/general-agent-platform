#!/usr/bin/env sh
set -eu
backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
stamp="$(date +%Y%m%d%H%M%S)"
if echo "${DATABASE_URL:-}" | grep -q '^sqlite:'; then
  source_file="${DATABASE_URL#sqlite:///}"
  test -f "$source_file" || { echo "BACKUP_SOURCE_NOT_FOUND:$source_file" >&2; exit 3; }
  output="$backup_dir/runtime-$stamp.db"
  cp "$source_file" "$output"
else
  test -n "${DATABASE_URL:-}" || { echo DATABASE_URL_REQUIRED >&2; exit 2; }
  output="$backup_dir/runtime-$stamp.sql"
  pg_dump "$DATABASE_URL" > "$output"
fi
sha256sum "$output" > "$output.sha256"
echo "$output"
