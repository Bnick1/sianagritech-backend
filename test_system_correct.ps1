# File: test_system_correct.ps1
Write-Host "SianAgriTech System Test - $(Get-Date)" -ForegroundColor Yellow
Write-Host "="*50

$endpoints = @("/health", "/ready", "/test", "/api/gateway/status", "/api/weather/enhanced-forecast", "/api/iot/soil-moisture", "/api/ai/crop-health", "/api/ai/disease-risk", "/api/irrigation/history", "/api/ai/irrigation-optimize")
$baseUrl = "http://localhost:3003"
$results = @()

Write-Host "`nTesting Endpoints..." -ForegroundColor Cyan
foreach ($endpoint in $endpoints) {
    $url = "$baseUrl$endpoint"
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
        $stopwatch.Stop()
        Write-Host "  ✓ $endpoint : $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
        $results += [PSCustomObject]@{Endpoint=$endpoint; Status="Success"; Latency=$stopwatch.ElapsedMilliseconds}
    } catch {
        $stopwatch.Stop()
        Write-Host "  ✗ $endpoint : Error" -ForegroundColor Red
        $results += [PSCustomObject]@{Endpoint=$endpoint; Status="Failed"; Latency=$stopwatch.ElapsedMilliseconds}
    }
}

# Test AI POST
Write-Host "`nTesting AI Decision..." -ForegroundColor Cyan
try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $aiTest = @{soil_moisture=35; temperature=28; humidity=65} | ConvertTo-Json
    $aiResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai/irrigation-optimize" -Method Post -Body $aiTest -ContentType "application/json"
    $stopwatch.Stop()
    Write-Host "  ✓ AI Service: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
    Write-Host "    Decision: $($aiResponse.decision)" -ForegroundColor Gray
} catch { Write-Host "  ✗ AI Error" -ForegroundColor Red }

# Summary
$success = ($results | Where-Object { $_.Status -eq "Success" }).Count
$total = $results.Count
$avgLatency = ($results | Where-Object { $_.Latency -gt 0 } | Measure-Object -Property Latency -Average).Average

Write-Host "`n" + "="*50
Write-Host "RESULTS FOR THESIS:" -ForegroundColor Green
Write-Host "Test Date: $(Get-Date)"
Write-Host "Endpoints Tested: $total"
Write-Host "Successful: $success"
Write-Host "Success Rate: $( [math]::Round(($success/$total*100), 1) )%"
Write-Host "Average Latency: $( [math]::Round($avgLatency, 0) )ms"
Write-Host "="*50
