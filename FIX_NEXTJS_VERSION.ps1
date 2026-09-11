# PERMANENT FIX: Downgrade to Next.js 15 to disable Turbopack

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   PERMANENT FIX: Downgrade to Next.js 15          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Downgrade from Next.js 16.1.6 → 15.1.4" -ForegroundColor Gray
Write-Host "  2. Delete .next cache" -ForegroundColor Gray
Write-Host "  3. Rebuild server.js" -ForegroundColor Gray
Write-Host "  4. Start server with Webpack" -ForegroundColor Gray
Write-Host ""

Write-Host "Next.js 15 uses Webpack by default (fast, stable)" -ForegroundColor Green
Write-Host "Next.js 16 forces Turbopack (slow, crashes on Windows)" -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Continue? (Y/N)"
if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Stop any running servers
Write-Host "[1/5] Stopping Node processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Node processes stopped" -ForegroundColor Green
} catch {
    Write-Host "  ✓ No Node processes running" -ForegroundColor Green
}
Start-Sleep -Seconds 2
Write-Host ""

# Step 2: Downgrade Next.js
Write-Host "[2/5] Downgrading Next.js 16 → 15..." -ForegroundColor Yellow
Write-Host "  This may take 1-2 minutes..." -ForegroundColor Gray
$installOutput = npm install next@15.1.4 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Next.js 15.1.4 installed" -ForegroundColor Green
    
    # Verify version
    $pkgJson = Get-Content package.json | ConvertFrom-Json
    $nextVersion = npm list next --depth=0 2>&1 | Select-String "next@"
    Write-Host "  ✓ Installed version: $nextVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to install Next.js 15" -ForegroundColor Red
    Write-Host "    Error: $installOutput" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Delete .next cache
Write-Host "[3/5] Deleting .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next -ErrorAction Stop
    Write-Host "  ✓ .next deleted" -ForegroundColor Green
} else {
    Write-Host "  ✓ .next already clean" -ForegroundColor Green
}
Write-Host ""

# Step 4: Rebuild server.js
Write-Host "[4/5] Rebuilding server.js..." -ForegroundColor Yellow
$buildOutput = node scripts/build-server.mjs 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ server.js rebuilt" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to rebuild" -ForegroundColor Red
    Write-Host "    Error: $buildOutput" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Start server
Write-Host "[5/5] Starting server with Webpack..." -ForegroundColor Yellow
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Starting ElitPOS with Next.js 15 + Webpack       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected results:" -ForegroundColor Yellow
Write-Host "  ✓ Should say 'Next.js 15.x.x'" -ForegroundColor Green
Write-Host "  ✓ Should NOT say 'Turbopack'" -ForegroundColor Green
Write-Host "  ✓ Compilation: 3-10 seconds" -ForegroundColor Green
Write-Host "  ✓ Login should work" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Start server
node server.js
