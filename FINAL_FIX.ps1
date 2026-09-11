# FINAL FIX - Complete Next.js reinstallation

Write-Host "===============================================" -ForegroundColor Red
Write-Host "   FINAL FIX - Complete Next.js Reinstall" -ForegroundColor Red
Write-Host "===============================================" -ForegroundColor Red
Write-Host ""

Write-Host "The Next.js installation is corrupted (missing vendored folder)" -ForegroundColor Yellow
Write-Host "We need to completely remove and reinstall Next.js" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Continue? (Y/N)"
if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan

# Step 1: Stop all Node processes
Write-Host "[1/7] Stopping all Node.js processes..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Write-Host "  OK: Node processes stopped" -ForegroundColor Green
Start-Sleep -Seconds 2
Write-Host ""

# Step 2: Delete node_modules/next completely
Write-Host "[2/7] Deleting node_modules\next folder..." -ForegroundColor Yellow
if (Test-Path "node_modules\next") {
    Remove-Item -Recurse -Force "node_modules\next" -ErrorAction SilentlyContinue
    if (Test-Path "node_modules\next") {
        Write-Host "  Trying alternate delete method..." -ForegroundColor Yellow
        cmd /c "rmdir /s /q node_modules\next" 2>$null
    }
    Write-Host "  OK: Deleted node_modules\next" -ForegroundColor Green
}
else {
    Write-Host "  OK: Already deleted" -ForegroundColor Green
}
Write-Host ""

# Step 3: Delete .next cache
Write-Host "[3/7] Deleting .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
    Write-Host "  OK: .next deleted" -ForegroundColor Green
}
else {
    Write-Host "  OK: .next already clean" -ForegroundColor Green
}
Write-Host ""

# Step 4: Clean npm cache
Write-Host "[4/7] Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>&1 | Out-Null
Write-Host "  OK: npm cache cleaned" -ForegroundColor Green
Write-Host ""

# Step 5: Reinstall Next.js
Write-Host "[5/7] Reinstalling Next.js 16.1.6..." -ForegroundColor Yellow
Write-Host "  This will take 5-10 minutes..." -ForegroundColor Gray
npm install next@16.1.6 --force
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: Next.js 16.1.6 installed" -ForegroundColor Green
}
else {
    Write-Host "  ERROR: Installation failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Verify installation
Write-Host "[6/7] Verifying Next.js installation..." -ForegroundColor Yellow
$vendoredPath = "node_modules\next\dist\server\route-modules\app-route\vendored"
if (Test-Path $vendoredPath) {
    Write-Host "  OK: vendored folder exists" -ForegroundColor Green
    $contextPath = Join-Path $vendoredPath "contexts\app-router-context.js"
    if (Test-Path $contextPath) {
        Write-Host "  OK: app-router-context.js exists" -ForegroundColor Green
    }
    else {
        Write-Host "  ERROR: app-router-context.js missing!" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "  ERROR: vendored folder still missing!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 7: Rebuild server.js
Write-Host "[7/7] Rebuilding server.js..." -ForegroundColor Yellow
node scripts/build-server.mjs
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: server.js rebuilt" -ForegroundColor Green
}
else {
    Write-Host "  ERROR: Rebuild failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "===============================================" -ForegroundColor Green
Write-Host "  SUCCESS: Next.js Installation Fixed!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start server with:" -ForegroundColor Gray
Write-Host '     $env:SKIP_MIGRATIONS = "true"' -ForegroundColor Gray
Write-Host "     node server.js" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. If server starts OK, run migrations:" -ForegroundColor Gray
Write-Host "     npm run db:migrate" -ForegroundColor Gray
Write-Host ""
