@echo off
cd /d %~dp0
echo Building image hp-inventory:latest ...
docker build -t hp-inventory:latest .
if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
echo Saving image to hp-inventory-image.tar (copy this file to the USB)...
docker save -o hp-inventory-image.tar hp-inventory:latest
echo Done. Copy hp-inventory-image.tar + docker-load-image.bat to the USB.
pause