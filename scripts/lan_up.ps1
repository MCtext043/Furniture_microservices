# Развернуть Furniture в текущей LAN и напечатать рабочую ссылку.
# Запуск из корня репозитория или из любой папки:
#   powershell -ExecutionPolicy Bypass -File scripts\lan_up.ps1
# Флаги передаются в scripts/lan_up.py, например:
#   powershell -ExecutionPolicy Bypass -File scripts\lan_up.ps1 --no-build

$ErrorActionPreference = "Stop"
$RootDir = Split-Path $PSScriptRoot -Parent
Set-Location $RootDir

function Find-Python {
    foreach ($name in @("py", "python", "python3")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        if ($name -eq "py") {
            & $cmd.Source -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" 2>$null
            if ($LASTEXITCODE -eq 0) { return @($cmd.Source, "-3") }
        } else {
            & $cmd.Source -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" 2>$null
            if ($LASTEXITCODE -eq 0) { return @($cmd.Source) }
        }
    }
    return $null
}

$python = Find-Python
if (-not $python) {
    Write-Error "Нужен Python 3.9+. Установите Python и повторите, либо: python scripts\lan_up.py"
}

$scriptPath = Join-Path $RootDir "scripts\lan_up.py"
if ($python.Count -gt 1) {
    & $python[0] $python[1] $scriptPath @args
} else {
    & $python[0] $scriptPath @args
}
exit $LASTEXITCODE
