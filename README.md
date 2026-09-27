# Haryana Police Inventory Management System
## Fully Local — Node.js server + file database

This project runs **entirely on your own PC**. One Node.js process serves both the
frontend and the `/api/*` backend, and the database is a single JSON file.

- No cloud database
- No serverless hosting
- No connection string, no secrets
- No internet needed after the first start

---

## Project Structure
```
hp-inventory-local/
├── index.html            # Frontend (login, sidebar, all views)
├── styles.css            # Styling
├── app.js                # Core app logic
├── api-client.js         # API adapter (localStorage <-> /api)
├── local-dev.js          # The local server (static + API, one port)
├── api/
│   ├── index.js          # The backend: auth, RBAC, state
│   ├── _filepool.js      # File-backed database pool
│   ├── _rbac.js          # Server-side authorisation
│   └── agent.js          # IMS Agent (optional cloud LLM)
├── local-data/
│   └── db.json           # <-- THE DATABASE (created on first run)
├── run-local.bat         # Windows one-click start
├── Dockerfile            # Optional container
└── package.json
```

---

## 1. Install

You only need [Node.js](https://nodejs.org) (v18+).

```bash
npm install
```

That is the only dependency (`bcryptjs`). Nothing else is fetched.

---

## 2. Run

### Windows (easiest)
Double-click **`run-local.bat`**. The browser opens automatically.

### Any platform
```bash
npm start
# or
node local-dev.js
```

On start it prints the exact URL to open:

```
  App:       http://localhost:3210   << open THIS in your browser
  Health:    http://localhost:3210/api/health
  Mode:      FULLY LOCAL - frontend + API + database on this PC
  Database:  E:\hp-inventory-local\local-data\db.json
```

If that port is busy the server automatically picks the next free one — always
read the `App:` line. Stop the server with **Ctrl+C**.

---

## 3. The database

Everything lives in one file: `local-data/db.json`.

| Task | How |
|------|-----|
| **Back up** | copy `local-data/db.json` somewhere safe |
| **Restore** | copy a backup back over `local-data/db.json`, restart |
| **Reset** | delete `local-data/db.json`, restart → fresh defaults are seeded |

The folder `local-data/` is gitignored, so your data is never pushed to the repo.

---

## 4. Default logins

On first run the app seeds itself. Default accounts:

| Role | Username | Password |
|------|----------|----------|
| Developer Admin | `developer` | `dev@123` |
| Gurugram Admin | `admin` | `admin123` |
| Faridabad Admin | `admin2` | `admin123` |
| Staff | `user` | `user123` |

**Change these before putting real data in.**

---

## API Endpoints

All requests go to `/api/...` on the same local port.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/state` | Load full app state (JSON) |
| POST | `/api/state` | Save full app state `{ state: {...} }` |
| POST | `/api/seed` | Seed defaults (only if empty) |
| POST | `/api/key` | Save single key `{ key, value }` |

---

## Security model

- Passwords are hashed with **bcryptjs** before storage; plaintext is never
  persisted and never returned to the browser.
- `POST /api/auth/login` verifies credentials **server-side**, applies a
  per-IP rate limit (10 failed attempts / 15 min), and returns an opaque session
  token (sha256-hashed, 12h TTL).
- **Inventory RBAC** is enforced server-side in `api/_rbac.js` against the
  session user and each record's stored ownership (location / district).
  Developer Admin is read-only for inventory; everyone else may only modify
  their OWN unit's records.
- Unauthorised writes are rejected with 401/403 — the UI can be bypassed, this
  gate cannot.

---

## Optional: Docker

```bash
docker compose up
```

See [DOCKER-README.md](DOCKER-README.md).

---

## Optional: IMS Agent (cloud LLM)

The agent runs **offline by default** with a built-in local NLU. To upgrade it to
Gemini, copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. The key
stays on your machine and is never committed.
