# Upload WoodCraft / Furniture to VPS (same flow as Adam project).
# https://github.com/MCtext043/Adam
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File deploy\upload-to-server.ps1
#
# With options:
#   powershell -ExecutionPolicy Bypass -File deploy\upload-to-server.ps1 `
#     -Server 45.11.26.79 -User root -RemoteDir /opt/furniture
#
# First time: copy deploy\server.env.sample to deploy\local.env and set passwords.
# deploy\local.env is uploaded as server .env (not committed to git).


param(
    [string]$Server = "45.11.26.79",
    [string]$User = "root",
    [string]$RemoteDir = "/opt/furniture",
    [switch]$Fast,
    [switch]$ResetDb
)

$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$archive = Join-Path $env:TEMP "furniture-deploy-$stamp.tar.gz"
$remoteSh = Join-Path $env:TEMP "furniture-remote-$stamp.sh"
$secretsLocal = Join-Path $PSScriptRoot "local.env"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "== Furniture upload-to-server ==" -ForegroundColor Cyan
Write-Host "Server: ${User}@${Server}"
Write-Host "Remote: ${RemoteDir}"
if ($Fast) { Write-Host "Mode:   FAST (gateway/frontend only)" -ForegroundColor Yellow }
elseif ($ResetDb) { Write-Host "Mode:   FULL + RESET_DB (wipes PostgreSQL volume)" -ForegroundColor Red }
else { Write-Host "Mode:   FULL (all services)" -ForegroundColor Yellow }
Write-Host ""

function Normalize-ShellScripts {
    param([string]$Root)
    Get-ChildItem -Path (Join-Path $Root "deploy") -Filter "*.sh" -File -ErrorAction SilentlyContinue | ForEach-Object {
        $text = [IO.File]::ReadAllText($_.FullName)
        $fixed = $text -replace "`r`n", "`n" -replace "`r", "`n"
        if ($fixed -ne $text) {
            [IO.File]::WriteAllText($_.FullName, $fixed, $utf8NoBom)
            Write-Host "Normalized LF: $($_.Name)" -ForegroundColor DarkGray
        }
    }
}

Push-Location $repoRoot
try {
    Normalize-ShellScripts -Root $repoRoot
    Write-Host "[1/4] Creating archive..."
    tar -czf $archive `
        --exclude="./.git" `
        --exclude="./.venv" `
        --exclude="./venv" `
        --exclude="./__pycache__" `
        --exclude="./.pytest_cache" `
        --exclude="./.cursor" `
        --exclude="./agent-transcripts" `
        --exclude="./deploy/local.env" `
        --exclude="*.pyc" `
        .
    $sizeMb = [math]::Round((Get-Item $archive).Length / 1MB, 1)
    Write-Host "Archive: $archive ($sizeMb MB)"
}
finally {
    Pop-Location
}

Write-Host "[2/4] Uploading (enter SSH password when prompted)..."
scp $archive "${User}@${Server}:/tmp/furniture-deploy.tar.gz"
Assert-LastExitCode "Upload archive"

if (Test-Path $secretsLocal) {
    Write-Host "Uploading deploy/local.env as server secrets..."
    scp $secretsLocal "${User}@${Server}:/tmp/furniture-secrets.env"
    Assert-LastExitCode "Upload secrets"
} else {
    Write-Host "No deploy/local.env - server keeps existing .env or uses sample." -ForegroundColor DarkYellow
    Write-Host "Tip: copy deploy\server.env.sample deploy\local.env then edit passwords"
}

$remoteTemplate = Join-Path $PSScriptRoot "remote-deploy.sh"
$remoteScript = (Get-Content $remoteTemplate -Raw).Replace("__REMOTE_DIR__", $RemoteDir)
$prefix = ""
if ($Fast) { $prefix = "export FAST_DEPLOY=1`n" }
if ($ResetDb) { $prefix += "export RESET_DB=1`n" }
if ($prefix) { $remoteScript = $prefix + $remoteScript }
$remoteScript = ($remoteScript -replace "`r`n", "`n") -replace "`r", "`n"
[System.IO.File]::WriteAllText($remoteSh, $remoteScript, $utf8NoBom)

Write-Host "[3/4] Uploading remote script..."
scp $remoteSh "${User}@${Server}:/tmp/furniture-deploy-remote.sh"
Assert-LastExitCode "Upload remote script"

Write-Host "[4/4] Deploying on server (docker build, 2-10 min)..."
ssh "${User}@${Server}" "bash /tmp/furniture-deploy-remote.sh"
Assert-LastExitCode "Remote deploy"

Remove-Item -Force $archive, $remoteSh -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
$gatewayPort = "8002"
$httpsEnabled = $false
$publicHost = $Server
$publicDomain = ""
if (Test-Path $secretsLocal) {
    foreach ($line in Get-Content $secretsLocal) {
        if ($line -match '^\s*GATEWAY_PORT=(\d+)\s*$') {
            $gatewayPort = $Matches[1]
        }
        if ($line -match '^\s*HTTPS_ENABLED=(.+)\s*$') {
            $httpsEnabled = $Matches[1].Trim() -eq "1"
        }
        if ($line -match '^\s*PUBLIC_HOST=(.+)\s*$') {
            $publicHost = $Matches[1].Trim()
        }
        if ($line -match '^\s*PUBLIC_DOMAIN=(.+)\s*$') {
            $publicDomain = $Matches[1].Trim()
        }
    }
}
$siteHost = if ($publicDomain) { $publicDomain } else { $publicHost }
if ($httpsEnabled) {
    Write-Host "Site: https://${siteHost}/" -ForegroundColor Green
    Write-Host "Health: https://${siteHost}/health"
} else {
    Write-Host "Site: http://${Server}:${gatewayPort}/" -ForegroundColor Green
    Write-Host "Health: http://${Server}:${gatewayPort}/health"
}
Write-Host "Browser: Ctrl+F5"
