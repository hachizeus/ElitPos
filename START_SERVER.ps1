# ==============================================================================
# START ELITPOS SERVER
# ==============================================================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Starting ElitPOS Server" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Stop any existing Node.js processes
Write-Host "Stopping existing Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Set environment variables
Write-Host "Setting environment variables..." -ForegroundColor Yellow
$env:DISABLE_TURBOPACK = "1"

# Start server
Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

node server.js
