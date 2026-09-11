# EMERGENCY FIX - Force Webpack Mode
# Run this to completely clear all caches and force Webpack

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "║        EMERGENCY FIX - FORCE WEBPACK MODE         ║" -ForegroundColor Red
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""

Write-Host "⚠️  This will:" -ForegroundColor Yellow
Write-Host "  - Kill all Node.js processes" -ForegroundColor Gray
Write-Host "  - Delete ALL cache folders" -ForegroundColor Gray
Write-Host "  - Rebuild server with Webpack" -ForegroundColor Gray
Write-Host "  - Start fresh" -ForegroundColor Gray
Write-Host ""

$confirmation = Read-Host "Continue? (Y/N)"
if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Kill all Node processes
Write-Host "[1/6] Killing all Node.js processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Node processes killed" -ForegroundColor Green
} catch {
    Write-Host "  ✓ No Node processes running" -ForegroundColor Green
}
Start-Sleep -Seconds 1
Write-Host ""

# Step 2: Delete .next
Write-Host "[2/6] Deleting .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next -ErrorAction Stop
    Write-Host "  ✓ .next deleted" -ForegroundColor Green
} else {
    Write-Host "  ✓ .next not found (already clean)" -ForegroundColor Green
}
Write-Host ""

# Step 3: Delete node_modules/.cache
Write-Host "[3/6] Deleting node_modules cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction Stop
    Write-Host "  ✓ node_modules\.cache deleted" -ForegroundColor Green
} else {
    Write-Host "  ✓ node_modules\.cache not found (already clean)" -ForegroundColor Green
}
Write-Host ""

# Step 4: Delete server.js to force rebuild
Write-Host "[4/6] Deleting old server.js..." -ForegroundColor Yellow
if (Test-Path "server.js") {
    Remove-Item server.js -ErrorAction Stop
    Write-Host "  ✓ server.js deleted" -ForegroundColor Green
} else {
    Write-Host "  ✓ server.js not found" -ForegroundColor Green
}
Write-Host ""

# Step 5: Rebuild server.js
Write-Host "[5/6] Rebuilding server.js with Webpack config..." -ForegroundColor Yellow
$buildOutput = node scripts/build-server.mjs 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ server.js rebuilt successfully" -ForegroundColor Green
    
    # Verify TURBOPACK=0
    $turboCheck = Get-Content server.js | Select-String -Pattern 'TURBOPACK.*=.*"0"'
    if ($turboCheck) {
        Write-Host "  ✓ Verified: TURBOPACK=0 in server.js" -ForegroundColor Green
    } else {
        Write-Host "  ✗ WARNING: TURBOPACK=0 not found!" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ Failed to rebuild server.js" -ForegroundColor Red
    Write-Host "    Error: $buildOutput" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Start server
Write-Host "[6/6] Starting server with Webpack..." -ForegroundColor Yellow
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Starting ElitPOS with Webpack (NOT Turbopack)    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Watch the logs for:" -ForegroundColor Yellow
Write-Host "  ✓ Should see: 'Compiling middleware'" -ForegroundColor Green
Write-Host "  ✗ Should NOT see: 'Turbopack'" -ForegroundColor Red
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Set environment variables to force Webpack
$env:TURBOPACK = "0"
$env:NEXT_DISABLE_TURBOPACK = "1"

# Start server
node server.js
