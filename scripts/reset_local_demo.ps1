[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repoRoot "docker-compose.yml"
if (-not (Test-Path -LiteralPath $composeFile)) {
    throw "docker-compose.yml was not found under $repoRoot"
}

Write-Host "Local demo reset target: $repoRoot"
Write-Warning "This removes the Docker Compose PostgreSQL, Redis, Prometheus, and Grafana volumes for this project."

if (-not $Force) {
    $confirmation = Read-Host "Type RESET to delete all local demo data"
    if ($confirmation -cne "RESET") {
        Write-Host "Reset cancelled. No data was changed."
        exit 1
    }
}

Push-Location $repoRoot
try {
    docker compose --profile frontend down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed while removing the local demo stack."
    }

    if ($SkipBuild) {
        docker compose --profile frontend up -d
    } else {
        docker compose --profile frontend up -d --build
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed while rebuilding the local demo stack."
    }

    docker compose --profile frontend ps
    Write-Host "Local demo data was reset and the demo accounts were recreated."
    Write-Host "Open http://localhost:3000/login"
} finally {
    Pop-Location
}
