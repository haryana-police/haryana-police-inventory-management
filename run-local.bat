@echo off
title Haryana Police Inventory - Local (Fully Offline)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [x] Node.js not found. Install it from https://nodejs.org  then run this again.
  echo.
  pause
  exit /b 1
)
echo.
echo  Starting FULLY LOCAL server (frontend + API + local database file)...
echo  The browser will open automatically at the right address.
echo  (Agar port 3000 busy ho to server khud agli khaali port pakad lega —
echo   console me jo "App:" URL dikhe wahi aapka inventory app hai.)
echo  (Keep this window open. Ctrl+C stops the server.)
echo.
node local-dev.js --filedb
echo.
echo  Server stopped.
pause
