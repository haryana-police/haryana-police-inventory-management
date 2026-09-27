@echo off
cd /d %~dp0
if not exist hp-inventory-image.tar ( echo hp-inventory-image.tar not found next to this file. & pause & exit /b 1 )
echo Loading image...
docker load -i hp-inventory-image.tar
echo Starting container...
docker run -d --name hp-inventory -p 3210:3210 -v "%~dp0local-data:/app/local-data" --restart unless-stopped hp-inventory:latest
timeout /t 3 >nul
start "" http://localhost:3210
echo App running at http://localhost:3210
pause