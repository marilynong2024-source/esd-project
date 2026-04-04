# Quick integration smoke checks (Twilio config, payment health, Kong, RabbitMQ, GraphQL).
# Run from repo root with the stack up:  docker compose up -d
#   powershell -ExecutionPolicy Bypass -File scripts/check_stack_integrations.ps1

$ErrorActionPreference = "Continue"
$fail = 0

function Test-Url {
    param([string]$Name, [string]$Url, [int]$WantStatus = 200)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -eq $WantStatus) {
            Write-Host "PASS: $Name ($Url)" -ForegroundColor Green
            return $r
        }
        Write-Host "FAIL: $Name HTTP $($r.StatusCode) ($Url)" -ForegroundColor Red
        $script:fail++
        return $r
    }
    catch {
        Write-Host "FAIL: $Name $($_.Exception.Message) ($Url)" -ForegroundColor Red
        $script:fail++
        return $null
    }
}

Write-Host ""
Write-Host "=== Docker Compose (is the stack up?) ===" -ForegroundColor Cyan
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    docker compose ps 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARN: docker compose ps failed - start stack: docker compose up -d" -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== UI nginx (localhost:8080) ===" -ForegroundColor Cyan
Test-Url "Twilio config GET" "http://localhost:8080/api/notification/twilio/config" | Out-Null
Test-Url "Payment health (simulated)" "http://localhost:8080/api/payment/payment/health" | Out-Null
Test-Url "GraphQL gateway health" "http://localhost:8080/api/graphql/health" | Out-Null
Test-Url "Booking FX integrations health" "http://localhost:8080/api/booking/booking/integrations/health" | Out-Null
Test-Url "Flight external integrations health" "http://localhost:8080/api/flight/integrations/health" | Out-Null
Test-Url "Booking FX rate USD" "http://localhost:8080/api/booking/booking/fx-rate?to=USD" | Out-Null

Write-Host ""
Write-Host "=== Kong gateway (localhost:9000) ===" -ForegroundColor Cyan
Test-Url "Kong to loyalty" "http://localhost:9000/loyalty/1/points" | Out-Null
Test-Url "Kong to payment health" "http://localhost:9000/payment/health" | Out-Null
try {
    $gqBody = @{
        query = "{ packagePreview(customerID: 1, flightID: `"SQ634`", hotelID: 1) { estimatedTotalPrice currency } }"
    } | ConvertTo-Json
    $gk = Invoke-RestMethod -Uri "http://localhost:9000/graphql" -Method Post -ContentType "application/json" -Body $gqBody -TimeoutSec 15
    if ($gk.errors) {
        Write-Host "FAIL: Kong GraphQL POST $($gk.errors | ConvertTo-Json -Compress)" -ForegroundColor Red
        $fail++
    }
    else {
        Write-Host "PASS: Kong GraphQL POST packagePreview" -ForegroundColor Green
    }
}
catch {
    Write-Host "FAIL: Kong GraphQL POST $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

Write-Host ""
Write-Host "=== GraphQL query POST via UI proxy ===" -ForegroundColor Cyan
try {
    $body = @{
        query = "{ packagePreview(customerID: 1, flightID: `"SQ634`", hotelID: 1) { estimatedTotalPrice currency loyalty { tier } } }"
    } | ConvertTo-Json
    $g = Invoke-RestMethod -Uri "http://localhost:8080/api/graphql/graphql" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 20
    if ($g.errors) {
        Write-Host "FAIL: GraphQL errors: $($g.errors | ConvertTo-Json -Compress)" -ForegroundColor Red
        $fail++
    }
    else {
        Write-Host "PASS: GraphQL packagePreview" -ForegroundColor Green
        $g.data | ConvertTo-Json -Compress | Write-Host
    }
}
catch {
    Write-Host "FAIL: GraphQL POST $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

Write-Host ""
Write-Host "=== RabbitMQ management API (guest:guest, port 15673) ===" -ForegroundColor Cyan
try {
    $pair = "guest:guest"
    $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $rmq = Invoke-RestMethod -Uri "http://localhost:15673/api/overview" -Headers @{ Authorization = "Basic $b64" } -TimeoutSec 10
    Write-Host "PASS: RabbitMQ overview product_version=$($rmq.product_version)" -ForegroundColor Green
}
catch {
    Write-Host "FAIL: RabbitMQ management $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

Write-Host ""
Write-Host "=== Twilio / Stripe hints ===" -ForegroundColor Cyan
try {
    $tw = Invoke-RestMethod "http://localhost:8080/api/notification/twilio/config"
    $d = $tw.data
    Write-Host "Twilio enabled=$($d.enabled) hasSid=$($d.hasAccountSid) hasToken=$($d.hasAuthToken) from=$($d.fromNumber) defaultToEnv=$($d.defaultToFromEnv)"
    if (-not $d.hasAccountSid) {
        Write-Host "  Hint: set TWILIO_* in .env or use UI SMS settings (sidebar)." -ForegroundColor DarkYellow
    }
    if (-not $d.defaultToFromEnv) {
        Write-Host "  Hint: optional TWILIO_TO_NUMBER when booking form has no mobile." -ForegroundColor DarkYellow
    }
}
catch { Write-Host "(skip Twilio JSON)" -ForegroundColor DarkGray }

try {
    $ph = Invoke-RestMethod "http://localhost:8080/api/payment/payment/health"
    $root = $ph.data
    if (-not $root) { $root = $ph }
    Write-Host "Payment engine=$($root.engine) service=$($root.service)"
}
catch { Write-Host "(skip payment health JSON)" -ForegroundColor DarkGray }

Write-Host ""
if ($fail -eq 0) {
    Write-Host "All automated checks passed." -ForegroundColor Green
    exit 0
}
Write-Host "$fail check(s) failed." -ForegroundColor Red
exit 1
