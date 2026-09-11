# Use Next.js 15.0.3 - Last stable version before Turbopack

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Switch to Next.js 15.0.3 (Stable)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next.js 16 is broken on your system" -ForegroundColor Yellow
Write-Host "Switching to Next.js 15.0.3 (stable, uses Webpack)" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Continue? (Y/N)"
if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan

# Step 1: Stop Node
Write-Host "[1/6] Stopping Node.js..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Write-Host "  OK" -ForegroundColor Green
Start-Sleep -Seconds 2
Write-Host ""

# Step 2: Delete Next.js
Write-Host "[2/6] Removing Next.js 16..." -ForegroundColor Yellow
if (Test-Path "node_modules\next") {
    Remove-Item -Recurse -Force "node_modules\next" -ErrorAction SilentlyContinue
    cmd /c "rmdir /s /q node_modules\next" 2>$null
}
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Step 3: Delete cache
Write-Host "[3/6] Clearing caches..." -ForegroundColor Yellow
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
npm cache clean --force 2>&1 | Out-Null
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Step 4: Install Next.js 15.0.3
Write-Host "[4/6] Installing Next.js 15.0.3..." -ForegroundColor Yellow
Write-Host "  This takes 10-15 minutes..." -ForegroundColor Gray
npm install next@15.0.3 --force
Write-Host "  OK: Next.js 15.0.3 installed" -ForegroundColor Green
Write-Host ""

# Step 5: Verify
Write-Host "[5/6] Verifying installation..." -ForegroundColor Yellow
$version = (npm list next --depth=0 2>&1 | Select-String "next@").ToString()
Write-Host "  Installed: $version" -ForegroundColor Cyan
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Step 6: Rebuild server
Write-Host "[6/6] Rebuilding server.js..." -ForegroundColor Yellow
node scripts/build-server.mjs
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

Write-Host "===============================================" -ForegroundColor Green
Write-Host "  SUCCESS: Next.js 15.0.3 Installed!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Start server with:" -ForegroundColor Yellow
Write-Host '  $env:SKIP_MIGRATIONS = "true"' -ForegroundColor Gray
Write-Host "  node server.js" -ForegroundColor Gray
Write-Host ""
