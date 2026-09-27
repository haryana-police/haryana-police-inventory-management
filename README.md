# Haryana Police Inventory Management System
## Neon (PostgreSQL) + Vercel Serverless Backend

This project connects the frontend (vanilla HTML/CSS/JS) to a **Neon PostgreSQL** database via **Vercel serverless functions**. It replaces the old browser localStorage-only storage.

---

## Project Structure
```
inventory-app/
├── index.html          # Frontend (login, sidebar, all views)
├── styles.css          # Styling
├── api-client.js       # API adapter - switches localStorage <-> Neon
├── app.js              # Core app logic
├── api/
│   └── index.js        # Vercel serverless function (Neon connection)
├── db/
│   └── schema.sql      # (Optional) relational schema reference
├── package.json
└── vercel.json
```

---

## 1. Create a Neon Database

1. Sign up at https://neon.tech
2. Create a new project (region: any, e.g. Mumbai/Asia)
3. Copy the **connection string** (looks like):
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

> ⚠️ Keep this secret. Do not commit it to git.

---

## 2. Deploy to Vercel (with the API)

### Option A: Vercel Dashboard (recommended, no CLI)
1. Go to https://vercel.com and log in
2. Click **Add New → Project**
3. Import your Git repo (or use the CLI below for direct upload)
4. Framework preset: **Other**
5. Click **Environment Variables**, add:
   - `DATABASE_URL` = your Neon connection string
6. Deploy. Get URL like `https://your-app.vercel.app`

### Option B: Vercel CLI
```bash
npm i -g vercel
cd inventory-app
vercel          # first time: set up project
vercel env add DATABASE_URL   # add secret
vercel --prod
```

---

## 3. Enable Remote Mode in the Frontend

In `api-client.js`, set:
```js
var CONFIG = {
  useRemote: true,                      // <-- change to true
  apiBase: "https://your-app.vercel.app" // <-- your deployed URL
};
```

- If hosting the frontend and API on the **same** Vercel deployment, you can set `apiBase: "/api"` (relative).
- If the frontend is a separate site (e.g. GitHub Pages), use the full API URL.

---

## 4. Seed Initial Data

On first run, `app.js`'s `seedAll()` will create default districts (Gurugram, Faridabad), users, categories, locations, items, etc. automatically because the Neon state is empty.

Default logins:
| Role | Username | Password |
|------|----------|----------|
| Developer Admin | `developer` | `dev@123` |
| Gurugram Admin | `admin` | `admin123` |
| Faridabad Admin | `admin2` | `admin123` |
| Staff | `user` | `user123` |

---

## API Endpoints
All requests go to `/api/...` (serverless function).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/state` | Load full app state (JSON) |
| POST | `/api/state` | Save full app state `{ state: {...} }` |
| POST | `/api/seed` | Seed defaults (only if empty) |
| POST | `/api/key` | Save single key `{ key, value }` |
