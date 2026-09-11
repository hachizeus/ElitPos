# ElitPOS Configuration Check Script
# Run this to verify Webpack configuration is correct

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ElitPOS Configuration Verification" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: server.js exists
Write-Host "[1/6] Checking server.js exists..." -ForegroundColor Yellow
if (Test-Path "server.js") {
    Write-Host "  ✓ server.js found" -ForegroundColor Green
} else {
    Write-Host "  ✗ server.js NOT FOUND - Run: node scripts/build-server.mjs" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 2: TURBOPACK=0 in server.js
Write-Host "[2/6] Checking TURBOPACK=0 environment variable..." -ForegroundColor Yellow
$turboCheck = Get-Content server.js -ErrorAction SilentlyContinue | Select-String -Pattern 'TURBOPACK.*=.*"0"'
if ($turboCheck) {
    Write-Host "  ✓ Found: process.env.TURBOPACK = '0'" -ForegroundColor Green
} else {
    Write-Host "  ✗ TURBOPACK=0 NOT FOUND - Rebuild: node scripts/build-server.mjs" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 3: turbo: false in server.js
Write-Host "[3/6] Checking turbo: false configuration..." -ForegroundColor Yellow
$turboFalse = Get-Content server.js -ErrorAction SilentlyContinue | Select-String -Pattern 'turbo:\s*false'
if ($turboFalse) {
    Write-Host "  ✓ Found: turbo: false" -ForegroundColor Green
} else {
    Write-Host "  ✗ turbo: false NOT FOUND - Rebuild: node scripts/build-server.mjs" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Check 4: .next folder should NOT exist for clean start
Write-Host "[4/6] Checking .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Write-Host "  ⚠ .next folder exists (should delete for clean start)" -ForegroundColor Yellow
    Write-Host "    Run: Remove-Item -Recurse -Force .next" -ForegroundColor Gray
} else {
    Write-Host "  ✓ .next cache cleared (ready for clean start)" -ForegroundColor Green
}
Write-Host ""

# Check 5: node_modules/.cache should NOT exist
Write-Host "[5/6] Checking node_modules cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Write-Host "  ⚠ node_modules\.cache exists (should delete for clean start)" -ForegroundColor Yellow
    Write-Host "    Run: Remove-Item -Recurse -Force node_modules\.cache" -ForegroundColor Gray
} else {
    Write-Host "  ✓ node_modules cache cleared (ready for clean start)" -ForegroundColor Green
}
Write-Host ""

# Check 6: Node.js version
Write-Host "[6/6] Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "  Node.js version: $nodeVersion" -ForegroundColor Cyan
$majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($majorVersion -ge 20) {
    Write-Host "  ✓ Node.js version is compatible (>= 20)" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js version too old (need >= 20.9.0)" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# Summary
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "║  ✓ Configuration OK - Ready to Start!" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Delete caches if they exist:" -ForegroundColor Gray
    Write-Host "     Remove-Item -Recurse -Force .next" -ForegroundColor Gray
    Write-Host "     Remove-Item -Recurse -Force node_modules\.cache" -ForegroundColor Gray
    Write-Host "  2. Set environment variable:" -ForegroundColor Gray
    Write-Host "     `$env:TURBOPACK = '0'" -ForegroundColor Gray
    Write-Host "  3. Start server:" -ForegroundColor Gray
    Write-Host "     node server.js" -ForegroundColor Gray
    Write-Host ""
    Write-Host "OR just run: .\start-clean.ps1" -ForegroundColor Cyan
} else {
    Write-Host "║  ✗ Configuration Issues Found" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Fix by running:" -ForegroundColor Yellow
    Write-Host "  node scripts/build-server.mjs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then run this check again: .\check-config.ps1" -ForegroundColor Cyan
}
Write-Host ""
