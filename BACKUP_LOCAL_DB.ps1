# ==============================================================================
# BACKUP LOCAL POSTGRESQL DATABASE
# ==============================================================================
# Optional: Back up your local database before switching to Render

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Backup Local PostgreSQL Database" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

$localDbUrl = "postgresql://postgres:0a0b0c0D.@localhost:5433/retail_smart_erp"
$backupFile = "backup-local-$(Get-Date -Format 'yyyy-MM-dd-HHmm').sql"

Write-Host "This will backup your local database to:" -ForegroundColor Yellow
Write-Host "  $backupFile" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue? (Y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Backing up database..." -ForegroundColor Yellow
Write-Host "  This may take 1-2 minutes..." -ForegroundColor Gray
Write-Host ""

# Check if pg_dump is available
$pgDumpPath = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
if (-not (Test-Path $pgDumpPath)) {
    # Try to find it
    $pgDumpPath = (Get-Command pg_dump.exe -ErrorAction SilentlyContinue).Source
    if (-not $pgDumpPath) {
        Write-Host "❌ pg_dump not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install PostgreSQL client tools or add to PATH:" -ForegroundColor Yellow
        Write-Host "  C:\Program Files\PostgreSQL\16\bin" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

try {
    $env:PGPASSWORD = "0a0b0c0D."
    & $pgDumpPath -h localhost -p 5433 -U postgres -d retail_smart_erp -f $backupFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Backup completed!" -ForegroundColor Green
        Write-Host ""
        $fileSize = (Get-Item $backupFile).Length / 1MB
        Write-Host "Backup file: $backupFile ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor White
        Write-Host ""
        Write-Host "To restore later:" -ForegroundColor Cyan
        Write-Host "  psql -h localhost -p 5433 -U postgres -d retail_smart_erp -f $backupFile" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Backup failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
