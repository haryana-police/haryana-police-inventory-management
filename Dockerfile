# Haryana Police Inventory - fully local (no internet, no cloud DB)
FROM node:24-alpine

WORKDIR /app

# Copy everything (node_modules included = bcryptjs already there,
# so the build needs NO npm install and works fully offline)
COPY . .

EXPOSE 3210

# filedb mode: JSON file database at /app/local-data/db.json
CMD ["node", "local-dev.js", "3210", "--filedb"]