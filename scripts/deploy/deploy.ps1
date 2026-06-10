# Local deploy for WoodCraft Market (Windows PowerShell)
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy.ps1

$ErrorActionPreference = "Stop"

$RootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RootDir

Write-Host "== WoodCraft deploy ==" -ForegroundColor Cyan
Write-Host "Project: $RootDir"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found. Install Docker Desktop and retry."
}

Write-Host ""
Write-Host "[1/4] Stopping old containers (if any)..." -ForegroundColor Yellow
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& docker compose down 2>&1 | Out-Null
$ErrorActionPreference = $prevEap

Write-Host "[2/4] Building gateway-service and cutting-service..." -ForegroundColor Yellow
& docker compose build gateway-service cutting-service
if ($LASTEXITCODE -ne 0) { throw "docker compose build failed with exit code $LASTEXITCODE" }

Write-Host "[3/4] Starting stack..." -ForegroundColor Yellow
& docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed with exit code $LASTEXITCODE" }

Write-Host "[4/4] Waiting for gateway..." -ForegroundColor Yellow
$healthUrl = "http://127.0.0.1:8080/health"
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Warning "Gateway did not respond in 60s. Check: docker compose logs gateway-service"
} else {
    Write-Host "Gateway OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Site:    http://127.0.0.1:8080/" -ForegroundColor Green
Write-Host " Health:  http://127.0.0.1:8080/health" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Hard refresh if UI is stale: Ctrl+F5" -ForegroundColor DarkYellow
Write-Host "Container status: docker compose ps" -ForegroundColor DarkGray
