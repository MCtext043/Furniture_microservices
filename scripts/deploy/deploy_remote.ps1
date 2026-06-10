# Legacy wrapper — use deploy\upload-to-server.ps1 (Adam-style) instead.
Write-Host "Use: powershell -ExecutionPolicy Bypass -File deploy\upload-to-server.ps1" -ForegroundColor Yellow
& (Join-Path (Split-Path $PSScriptRoot -Parent -Parent) "deploy\upload-to-server.ps1") @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
