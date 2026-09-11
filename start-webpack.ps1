# Start ElitPOS dev server using Webpack instead of Turbopack
# This avoids the Turbopack PostCSS crash

Write-Host "Starting ElitPOS with Webpack (Turbopack disabled)..." -ForegroundColor Green

# Build the server first
Write-Host "`nBuilding custom server..." -ForegroundColor Yellow
node scripts/build-server.mjs

if ($LASTEXITCODE -ne 0) {
    Write-Host "Server build failed!" -ForegroundColor Red
    exit 1
}

# Start with webpack
Write-Host "`nStarting dev server with Webpack..." -ForegroundColor Yellow
$env:TURBOPACK = "0"
node server.js
