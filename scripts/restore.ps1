$ErrorActionPreference = 'Stop'
if (-not $env:BACKUP_FILE) { throw 'BACKUP_FILE_REQUIRED' }
if (-not (Test-Path -LiteralPath $env:BACKUP_FILE)) { throw "BACKUP_FILE_NOT_FOUND:$env:BACKUP_FILE" }
if (Test-Path -LiteralPath "$env:BACKUP_FILE.sha256") {
  $expected = (Get-Content -LiteralPath "$env:BACKUP_FILE.sha256" -Raw).Split(' ')[0]
  $actual = (Get-FileHash -LiteralPath $env:BACKUP_FILE -Algorithm SHA256).Hash
  if ($expected -ne $actual) { throw 'BACKUP_CHECKSUM_MISMATCH' }
}
$env:DOCKER_HOST = if ($env:DOCKER_HOST) { $env:DOCKER_HOST } else { 'npipe:////./pipe/dockerDesktopLinuxEngine' }
$container = (docker compose ps -q postgres)
docker cp $env:BACKUP_FILE "$container`:/tmp/restore.dump"
docker compose exec -T postgres pg_restore -U agent -d agent_runtime --clean --if-exists /tmp/restore.dump
Write-Output 'RESTORE_COMPLETED'
