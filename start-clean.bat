@echo off
echo ===================================
echo ElitPOS Clean Start - Webpack Mode
echo ===================================
echo.

echo [1/4] Clearing .next cache...
if exist .next (
    rmdir /s /q .next
    echo OK: .next cache cleared
) else (
    echo OK: No .next cache to clear
)
echo.

echo [2/4] Clearing node_modules cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo OK: node_modules cache cleared
) else (
    echo OK: No node_modules cache to clear
)
echo.

echo [3/4] Rebuilding server.js...
node scripts/build-server.mjs
if %ERRORLEVEL% EQU 0 (
    echo OK: server.js rebuilt
) else (
    echo ERROR: Failed to rebuild server.js
    pause
    exit /b 1
)
echo.

echo [4/4] Starting server with Webpack...
set TURBOPACK=0
node server.js
