#!/usr/bin/env sh
set -eu
test -n "${BACKUP_FILE:-}" || { echo BACKUP_FILE_REQUIRED; exit 2; }
test -f "$BACKUP_FILE" || { echo "BACKUP_FILE_NOT_FOUND:$BACKUP_FILE" >&2; exit 3; }
if test -f "$BACKUP_FILE.sha256"; then sha256sum -c "$BACKUP_FILE.sha256"; fi
if echo "${DATABASE_URL:-}" | grep -q '^sqlite:'; then cp "$BACKUP_FILE" "${DATABASE_URL#sqlite:///}"; else psql "${DATABASE_URL}" < "$BACKUP_FILE"; fi
echo RESTORE_COMPLETED
