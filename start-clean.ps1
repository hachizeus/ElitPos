# ElitPOS Clean Start Script
# This script clears all caches and starts the server with Webpack

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ElitPOS Clean Start - Webpack Mode" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clear .next cache
Write-Host "[1/4] Clearing .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next
    Write-Host "✓ .next cache cleared" -ForegroundColor Green
} else {
    Write-Host "✓ No .next cache to clear" -ForegroundColor Green
}
Write-Host ""

# Step 2: Clear node_modules cache
Write-Host "[2/4] Clearing node_modules cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force node_modules\.cache
    Write-Host "✓ node_modules\.cache cleared" -ForegroundColor Green
} else {
    Write-Host "✓ No node_modules cache to clear" -ForegroundColor Green
}
Write-Host ""

# Step 3: Rebuild server.js
Write-Host "[3/4] Rebuilding server.js with Webpack config..." -ForegroundColor Yellow
node scripts/build-server.mjs
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ server.js rebuilt successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to rebuild server.js" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Verify configuration
Write-Host "[4/4] Verifying Webpack configuration..." -ForegroundColor Yellow
$turboCheck = Get-Content server.js | Select-String -Pattern 'TURBOPACK.*=.*"0"'
if ($turboCheck) {
    Write-Host "✓ TURBOPACK=0 found in server.js" -ForegroundColor Green
} else {
    Write-Host "✗ WARNING: TURBOPACK=0 not found!" -ForegroundColor Red
}

$turboFalse = Get-Content server.js | Select-String -Pattern 'turbo:\s*false'
if ($turboFalse) {
    Write-Host "✓ turbo: false found in server.js" -ForegroundColor Green
} else {
    Write-Host "✗ WARNING: turbo: false not found!" -ForegroundColor Red
}
Write-Host ""

# Ready to start
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✓ Ready to start server" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting server with Webpack..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Set environment variable to force Webpack
$env:TURBOPACK = "0"

# Start the server
node server.js
