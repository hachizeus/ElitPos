@echo off
echo ========================================
echo EMERGENCY FIX - Removing ALL caches
echo ========================================
echo.

echo STOP YOUR SERVER NOW! (Ctrl+C)
echo.
pause

echo.
echo [1/5] Killing all Node processes...
taskkill /F /IM node.exe /T 2>nul
if %ERRORLEVEL% EQU 0 (
    echo OK: Node processes killed
) else (
    echo OK: No Node processes running
)
echo.

echo [2/5] Deleting .next folder...
if exist .next (
    rmdir /s /q .next
    echo OK: .next deleted
) else (
    echo OK: .next not found
)
echo.

echo [3/5] Deleting node_modules cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo OK: node_modules\.cache deleted
) else (
    echo OK: node_modules\.cache not found
)
echo.

echo [4/5] Rebuilding server.js...
node scripts/build-server.mjs
if %ERRORLEVEL% EQU 0 (
    echo OK: server.js rebuilt with Webpack
) else (
    echo ERROR: Failed to rebuild
    pause
    exit /b 1
)
echo.

echo [5/5] Starting server with Webpack...
echo.
echo ========================================
echo Server starting... Watch for:
echo  - Should NOT see "Turbopack"
echo  - Should see "Compiling middleware"
echo ========================================
echo.

set TURBOPACK=0
set NEXT_DISABLE_TURBOPACK=1
node server.js
