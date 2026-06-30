# System health check for WoodCraft / Furniture
param(
    [string]$Base = "http://127.0.0.1:8080",
    [string]$AdminUser = "admin",
    [string]$AdminPass = "demo123456"
)

$ErrorActionPreference = "Continue"
$results = @()

function Add-Result($name, $ok, $detail) {
    $script:results += [PSCustomObject]@{ Check = $name; OK = $ok; Detail = $detail }
}

function Invoke-Api($method, $path, $body = $null, $token = $null) {
    $headers = @{ Accept = "application/json" }
    if ($body -ne $null) { $headers["Content-Type"] = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $params = @{
        Uri = "$Base$path"
        Method = $method
        Headers = $headers
        TimeoutSec = 20
        UseBasicParsing = $true
    }
    if ($body -ne $null) { $params.Body = ($body | ConvertTo-Json -Compress) }
    try {
        $resp = Invoke-WebRequest @params
        $text = $resp.Content
        $json = $null
        try { $json = $text | ConvertFrom-Json } catch {}
        return @{ Ok = $true; Status = $resp.StatusCode; Text = $text; Json = $json }
    } catch {
        $status = $null
        $text = $_.Exception.Message
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $text = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }
        $json = $null
        try { $json = $text | ConvertFrom-Json } catch {}
        return @{ Ok = $false; Status = $status; Text = $text; Json = $json }
    }
}

Write-Host "== System check: $Base ==" -ForegroundColor Cyan

# Gateway
$r = Invoke-Api GET "/health"
Add-Result "Gateway /health" ($r.Ok -and $r.Status -eq 200) ($r.Text -replace "`n", " ")

# Static frontend
$r = Invoke-Api GET "/"
Add-Result "Frontend index.html" ($r.Ok -and $r.Status -eq 200) "HTTP $($r.Status)"
$r = Invoke-Api GET "/admin.html"
Add-Result "Frontend admin.html" ($r.Ok -and $r.Status -eq 200) "HTTP $($r.Status)"
$r = Invoke-Api GET "/app.js"
Add-Result "Frontend app.js" ($r.Ok -and $r.Status -eq 200) "HTTP $($r.Status)"

# Catalog
$r = Invoke-Api GET "/catalog/health"
Add-Result "Catalog /health" ($r.Ok -and $r.Status -eq 200) ($r.Text -replace "`n", " ")
$r = Invoke-Api GET "/catalog/products"
$prodCount = if ($r.Json -is [array]) { $r.Json.Count } else { "?" }
Add-Result "Catalog /products" ($r.Ok -and $r.Status -eq 200) "count=$prodCount"
$r = Invoke-Api GET "/catalog/categories"
$catCount = if ($r.Json -is [array]) { $r.Json.Count } else { "?" }
Add-Result "Catalog /categories" ($r.Ok -and $r.Status -eq 200) "count=$catCount"

# Auth token (endpoint is /auth/token, not /login)
$r = Invoke-Api POST "/auth/token" @{ username = $AdminUser; password = $AdminPass }
$token = $null
if ($r.Ok -and $r.Json.access_token) {
    $token = $r.Json.access_token
    Add-Result "Auth /token" $true "token ok"
} else {
    Add-Result "Auth /token" $false ($r.Text -replace "`n", " ")
}

# CRM (needs auth)
if ($token) {
    $r = Invoke-Api GET "/catalog/crm/warehouse" $null $token
    Add-Result "CRM /warehouse" ($r.Ok -and $r.Status -eq 200) "HTTP $($r.Status)"
    $r = Invoke-Api GET "/catalog/crm/orders" $null $token
    Add-Result "CRM /orders" ($r.Ok -and $r.Status -eq 200) "HTTP $($r.Status)"
    $r = Invoke-Api POST "/catalog/crm/seed-demo" @{} $token
    if ($r.Ok) {
        Add-Result "CRM /seed-demo" $true ($r.Text -replace "`n", " ")
    } else {
        $detail = if ($r.Json.detail) { $r.Json.detail } else { $r.Text }
        Add-Result "CRM /seed-demo" $false ($detail -replace "`n", " ")
    }
} else {
    Add-Result "CRM endpoints" $false "skipped (no token)"
}

# Cutting health
$r = Invoke-Api GET "/cutting/health"
Add-Result "Cutting /health" ($r.Ok -and $r.Status -eq 200) ($r.Text -replace "`n", " ")

# Planner health
$r = Invoke-Api GET "/planner/health"
Add-Result "Planner /health" ($r.Ok -and $r.Status -eq 200) ($r.Text -replace "`n", " ")
if ($token) {
    $r = Invoke-Api POST "/cutting/optimize" @{
        sheet_width = 1000; sheet_height = 500
        parts = @(@{ name = "Test"; width = 200; height = 100; quantity = 1 })
    } $token
    Add-Result "Cutting /optimize" ($r.Ok -and $r.Status -eq 200) "HTTP $($r.Status)"
} else {
    Add-Result "Cutting /optimize" $false "skipped (no token)"
}

# Planner (requires planner:write role)
if ($token) {
    $r = Invoke-Api POST "/planner/projects" @{ name = "HealthCheck"; location = "Test" } $token
    Add-Result "Planner /projects" ($r.Ok -and $r.Status -eq 201) "HTTP $($r.Status)"
} else {
    Add-Result "Planner /projects" $false "skipped (no token)"
}

# Assets
$r = Invoke-Api GET "/assets/health"
Add-Result "Assets /health" ($r.Ok -and $r.Status -eq 200) ($r.Text -replace "`n", " ")

Write-Host ""
$passed = ($results | Where-Object { $_.OK }).Count
$failed = ($results | Where-Object { -not $_.OK }).Count
$results | ForEach-Object {
    $color = if ($_.OK) { "Green" } else { "Red" }
    $mark = if ($_.OK) { "OK" } else { "FAIL" }
    Write-Host ("[{0}] {1}: {2}" -f $mark, $_.Check, $_.Detail) -ForegroundColor $color
}
Write-Host ""
Write-Host "Passed: $passed / $($results.Count)" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
if ($failed -gt 0) { exit 1 }
