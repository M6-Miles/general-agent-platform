$ErrorActionPreference = 'Stop'
$dir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $PSScriptRoot '..\backups' }
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir ("runtime-{0}.dump" -f (Get-Date -Format 'yyyyMMddHHmmss'))
$env:DOCKER_HOST = if ($env:DOCKER_HOST) { $env:DOCKER_HOST } else { 'npipe:////./pipe/dockerDesktopLinuxEngine' }
docker compose exec -T postgres sh -c "pg_dump -U agent -d agent_runtime --format=custom > /tmp/runtime.dump"
$container = (docker compose ps -q postgres)
docker cp "$container`:/tmp/runtime.dump" $file
if (-not (Test-Path -LiteralPath $file)) { throw "BACKUP_NOT_CREATED:$file" }
Get-FileHash -LiteralPath $file -Algorithm SHA256 | ForEach-Object { "$($_.Hash)  $file" } | Set-Content -LiteralPath "$file.sha256"
Write-Output $file
