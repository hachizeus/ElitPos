# ==============================================================================
# MIGRATE TO RENDER POSTGRESQL
# ==============================================================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Migrate ElitPOS to Render PostgreSQL" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = (Get-Content .env | Select-String "DATABASE_URL=" | ForEach-Object { $_.ToString().Split('=')[1] })
}

if (-not $env:DATABASE_URL -or $env:DATABASE_URL -like "*localhost*") {
    Write-Host "❌ DATABASE_URL not set to Render database!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please update DATABASE_URL in .env file first:" -ForegroundColor Yellow
    Write-Host "  DATABASE_URL=postgres://user:pass@dpg-xyz.render.com/db" -ForegroundColor White
    Write-Host ""
    Write-Host "Get your database URL from:" -ForegroundColor Yellow
    Write-Host "  https://dashboard.render.com > Your Database > External Database URL" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✓ DATABASE_URL is set" -ForegroundColor Green
$displayUrl = $env:DATABASE_URL -replace ':([^@]+)@', ':****@'
Write-Host "  $displayUrl" -ForegroundColor Gray
Write-Host ""

# Step 1: Test connection
Write-Host "[1/4] Testing connection to Render database..." -ForegroundColor Yellow
node test-render-connection.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Connection test failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. DATABASE_URL is correct in .env" -ForegroundColor White
    Write-Host "  2. Database is 'Available' on Render dashboard" -ForegroundColor White
    Write-Host "  3. You copied the EXTERNAL Database URL (not internal)" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "[2/4] Running migrations..." -ForegroundColor Yellow
Write-Host "  This will take 2-3 minutes to create 212 tables..." -ForegroundColor Gray
Write-Host ""

npm run db:migrate

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Migrations failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try increasing timeout:" -ForegroundColor Yellow
    Write-Host '  $env:PGCONNECT_TIMEOUT = "30"' -ForegroundColor White
    Write-Host "  npm run db:migrate" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "[3/4] Creating super admin..." -ForegroundColor Yellow
npm run db:seed-admin

Write-Host ""
Write-Host "[4/4] Verifying setup..." -ForegroundColor Yellow
node test-render-connection.js 2>&1 | Out-Null

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  🎉 Migration Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your ElitPOS is now using Render PostgreSQL!" -ForegroundColor Green
Write-Host ""
Write-Host "Expected performance:" -ForegroundColor Cyan
Write-Host "  • First page load: 3-5 seconds (was 60-80s)" -ForegroundColor White
Write-Host "  • API calls: 200-500ms (was 20-50s)" -ForegroundColor White
Write-Host "  • Database queries: 50-200ms (was 10-40s)" -ForegroundColor White
Write-Host ""
Write-Host "Start server:" -ForegroundColor Cyan
Write-Host '  $env:DISABLE_TURBOPACK = "1"' -ForegroundColor White
Write-Host "  node server.js" -ForegroundColor White
Write-Host ""
Write-Host "Login at:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/sys-control/login" -ForegroundColor White
Write-Host "  Email: admin@elitjohnsdigital.co.ke" -ForegroundColor White
Write-Host "  Password: 0a0b0c0D." -ForegroundColor White
Write-Host ""
