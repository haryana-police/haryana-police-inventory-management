# Run HP Inventory with Docker

## Option A - build on the other PC (needs internet once, for the node:24-alpine base image)
1. Install Docker Desktop on the target PC and start it.
2. Copy this whole folder to the PC (USB).
3. Double-click `docker-run.bat`  ->  app opens at http://localhost:3210

## Option B - prebuilt image (fully offline on the target PC)
1. On a PC that HAS Docker: double-click `docker-save-image.bat`
   -> creates `hp-inventory-image.tar` (~150-200 MB).
2. Copy `hp-inventory-image.tar` + `docker-load-image.bat` to the USB.
3. On the target PC (Docker Desktop installed, any internet state):
   put both files in one folder and double-click `docker-load-image.bat`
   -> app opens at http://localhost:3210

## Data
- Database = `local-data/db.json` (mounted as a volume).
- Backups: stop the container, copy `local-data/db.json`.
- Remove container: `docker rm -f hp-inventory`