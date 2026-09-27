@echo off
cd /d %~dp0
echo Building and starting HP Inventory (Docker)...
docker compose up -d --build
if errorlevel 1 ( echo Docker failed. Is Docker Desktop installed and running? & pause & exit /b 1 )
timeout /t 3 >nul
start "" http://localhost:3211
echo App running at http://localhost:3211
pause