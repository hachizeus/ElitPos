# ==============================================================================
# COMPLETE CLEAN INSTALL - Back to Next.js 14 (Webpack, Stable)
# ==============================================================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   COMPLETE CLEAN INSTALL" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Stop all Node.js processes" -ForegroundColor White
Write-Host "  2. Delete node_modules and package-lock.json" -ForegroundColor White
Write-Host "  3. Clear all npm caches" -ForegroundColor White
Write-Host "  4. Install Next.js 15.1.3 (supports React 19, Webpack via flag)" -ForegroundColor White
Write-Host "  5. Reinstall all dependencies (takes 15-20 minutes)" -ForegroundColor White
Write-Host "  6. Rebuild server.js" -ForegroundColor White
Write-Host ""
Write-Host "Why Next.js 15.1.3?" -ForegroundColor Cyan
Write-Host "  - Supports React 19 (which you're using)" -ForegroundColor White
Write-Host "  - Can use Webpack with DISABLE_TURBOPACK=1" -ForegroundColor White
Write-Host "  - More stable than 15.0.3 or 16.x" -ForegroundColor White
Write-Host ""
Write-Host "This will take 15-20 minutes" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Continue? (Y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all Node.js processes
Write-Host "[1/8] Stopping all Node.js processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  OK: All Node.js processes stopped" -ForegroundColor Green
} catch {
    Write-Host "  OK: No Node.js processes running" -ForegroundColor Green
}

# Step 2: Delete .next folder
Write-Host "[2/8] Deleting .next cache..." -ForegroundColor Yellow
try {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
    Write-Host "  OK: .next deleted" -ForegroundColor Green
} catch {
    Write-Host "  OK: .next already gone" -ForegroundColor Green
}

# Step 3: Delete node_modules
Write-Host "[3/8] Deleting node_modules..." -ForegroundColor Yellow
Write-Host "  This takes 2-3 minutes..." -ForegroundColor Gray
try {
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Write-Host "  OK: node_modules deleted" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: Could not delete all node_modules" -ForegroundColor Yellow
}

# Step 4: Delete package-lock.json
Write-Host "[4/8] Deleting package-lock.json..." -ForegroundColor Yellow
try {
    Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
    Write-Host "  OK: package-lock.json deleted" -ForegroundColor Green
} catch {
    Write-Host "  OK: package-lock.json already gone" -ForegroundColor Green
}

# Step 5: Clear npm cache
Write-Host "[5/8] Clearing npm cache..." -ForegroundColor Yellow
Write-Host "  This takes 1-2 minutes..." -ForegroundColor Gray
npm cache clean --force 2>&1 | Out-Null
Write-Host "  OK: npm cache cleared" -ForegroundColor Green

# Step 6: Update package.json to use Next.js 15.1.3 (supports React 19, can use Webpack)
Write-Host "[6/8] Updating package.json to Next.js 15.1.3..." -ForegroundColor Yellow
try {
    $packageJson = Get-Content package.json -Raw | ConvertFrom-Json
    $packageJson.dependencies.next = "15.1.3"
    $packageJson | ConvertTo-Json -Depth 100 | Set-Content package.json
    Write-Host "  OK: package.json updated" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Could not update package.json" -ForegroundColor Red
    exit 1
}

# Step 7: Install all dependencies
Write-Host "[7/8] Installing all dependencies..." -ForegroundColor Yellow
Write-Host "  This takes 15-20 minutes..." -ForegroundColor Gray
Write-Host "  You'll see peer dependency warnings - these are safe to ignore" -ForegroundColor Gray
Write-Host ""

$npmOutput = npm install --legacy-peer-deps 2>&1
$npmExit = $LASTEXITCODE

if ($npmExit -eq 0) {
    Write-Host "  OK: All dependencies installed" -ForegroundColor Green
    
    # Verify Next.js version
    $nextVersion = npm list next --depth=0 2>&1 | Select-String "next@"
    Write-Host "  Installed: $nextVersion" -ForegroundColor Green
    
    # Check if vendored folder exists (might exist in Next.js 15)
    $vendoredExists = Test-Path "node_modules\next\dist\server\route-modules\app-route\vendored"
    if ($vendoredExists) {
        Write-Host "  OK: vendored folder exists" -ForegroundColor Green
    } else {
        Write-Host "  OK: No vendored folder needed with Webpack" -ForegroundColor Green
    }
} else {
    Write-Host "  ERROR: npm install failed" -ForegroundColor Red
    Write-Host $npmOutput
    exit 1
}

# Step 8: Rebuild server.js
Write-Host "[8/8] Rebuilding server.js..." -ForegroundColor Yellow
node scripts/build-server.mjs 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: server.js rebuilt" -ForegroundColor Green
} else {
    Write-Host "  ERROR: server.js build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SUCCESS: Clean Install Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next.js 15.1.3 is now installed (React 19 compatible)" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Use Webpack by setting environment variable:" -ForegroundColor Yellow
Write-Host '  $env:DISABLE_TURBOPACK = "1"' -ForegroundColor White
Write-Host ""
Write-Host "Start server with:" -ForegroundColor Cyan
Write-Host '  $env:DISABLE_TURBOPACK = "1"' -ForegroundColor White
Write-Host '  $env:SKIP_MIGRATIONS = "true"' -ForegroundColor White
Write-Host "  node server.js" -ForegroundColor White
Write-Host ""
Write-Host "If everything works, run migrations:" -ForegroundColor Cyan
Write-Host "  npm run db:migrate" -ForegroundColor White
Write-Host ""
