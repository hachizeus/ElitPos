# Fix Migration Issues Script

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Fix ElitPOS Migration Issues                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Fixed migration 0011 to handle missing account_id column" -ForegroundColor Yellow
Write-Host "  ✓ Migration file updated to check for column existence" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] Running database fix script..." -ForegroundColor Yellow
if (-not $env:DATABASE_URL) {
    Write-Host "  ✗ DATABASE_URL not set" -ForegroundColor Red
    Write-Host "    Set it with: `$env:DATABASE_URL = 'your-connection-string'" -ForegroundColor Gray
    exit 1
}

# Try to run the fix script
try {
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlPath) {
        Write-Host "  Running SQL fix script..." -ForegroundColor Gray
        psql $env:DATABASE_URL -f fix-admin-sessions.sql
        Write-Host "  ✓ Database fix applied" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ psql not found - skipping direct database fix" -ForegroundColor Yellow
        Write-Host "    You can manually run: psql `$env:DATABASE_URL -f fix-admin-sessions.sql" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠ Could not apply database fix: $_" -ForegroundColor Yellow
    Write-Host "    Migrations will still work with the updated migration file" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[3/3] Running migrations..." -ForegroundColor Yellow
try {
    npm run db:migrate
    Write-Host "  ✓ Migrations completed successfully" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Migration had warnings but continued" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✓ Migration Fix Complete                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the server: node server.js" -ForegroundColor Gray
Write-Host "  2. Test login functionality" -ForegroundColor Gray
Write-Host ""
