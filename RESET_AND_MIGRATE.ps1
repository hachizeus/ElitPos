# ==============================================================================
# RESET DATABASE AND RUN MIGRATIONS
# ==============================================================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   RESET DATABASE & RUN MIGRATIONS" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Drop ALL tables in the database" -ForegroundColor White
Write-Host "  2. Run all 123 migrations from scratch" -ForegroundColor White
Write-Host "  3. Takes about 2-3 minutes" -ForegroundColor White
Write-Host ""
Write-Host "WARNING: This will DELETE all data in the database!" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Continue? Type 'YES' to confirm"
if ($confirm -ne 'YES') {
    Write-Host "Cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Drop all tables
Write-Host "[1/3] Dropping all tables..." -ForegroundColor Yellow
$dropScript = @"
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:0a0b0c0D.@localhost:5433/retail_smart_erp'
});

async function dropAll() {
  try {
    console.log('Dropping all tables and schemas...');
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO postgres');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✓ All tables dropped');
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

dropAll();
"@

$dropScript | Out-File -FilePath "drop-all-temp.js" -Encoding UTF8
node drop-all-temp.js
Remove-Item "drop-all-temp.js" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to drop tables" -ForegroundColor Red
    exit 1
}
Write-Host "  OK: All tables dropped" -ForegroundColor Green

# Step 2: Run migrations
Write-Host "[2/3] Running all migrations..." -ForegroundColor Yellow
Write-Host "  This takes 2-3 minutes for 123 migrations..." -ForegroundColor Gray
Write-Host ""

$env:NODE_OPTIONS = "--max-old-space-size=4096"
npm run db:migrate 2>&1 | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ERROR: Migrations failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  OK: All migrations completed" -ForegroundColor Green

# Step 3: Verify tables exist
Write-Host "[3/3] Verifying tables..." -ForegroundColor Yellow
node test-db.js 2>&1 | ForEach-Object { Write-Host "  $_" }

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Table verification failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  SUCCESS: Database Reset Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start server with:" -ForegroundColor Cyan
Write-Host '  $env:DISABLE_TURBOPACK = "1"' -ForegroundColor White
Write-Host "  node server.js" -ForegroundColor White
Write-Host ""
Write-Host "Then create a super admin:" -ForegroundColor Cyan
Write-Host "  npm run db:seed-admin" -ForegroundColor White
Write-Host ""
