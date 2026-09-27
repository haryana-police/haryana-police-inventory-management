#!/usr/bin/env node
/**
 * local-dev.js — Haryana Police Inventory: local runner (zero dependencies).
 *
 * Serves the static frontend AND the /api/* backend on one local port.
 *
 *   node local-dev.js [port] [--filedb] [--local] [--proxy] [--target=https://...]
 *
 * Modes (auto-selected, can be forced):
 *   filedb : FULLY LOCAL. Runs api/index.js in this Node process with a
 *            file-backed database at local-data/db.json. No Postgres, no
 *            Neon, no internet, no secrets needed. (default of run-local.bat)
 *   local  : runs api/index.js against a REAL Postgres/Neon URL taken from
 *            DATABASE_URL in .env.local.
 *   proxy  : frontend served locally, /api/* forwarded to the deployed
 *            Vercel backend (live production data).
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// ---------- CLI ----------
let PORT = 3210; // 3000 is taken by another local dev server on this PC — avoid the fight
let FORCE = null;               // 'filedb' | 'local' | 'proxy' | null (auto)
let TARGET = 'https://hp-inventory.vercel.app';
let PROJECT_OVERRIDE = null;
for (const a of process.argv.slice(2)) {
  if (/^\d+$/.test(a)) PORT = Number(a);
  else if (a === '--filedb') FORCE = 'filedb';
  else if (a === '--local') FORCE = 'local';
  else if (a === '--proxy') FORCE = 'proxy';
  else if (a.indexOf('--target=') === 0) TARGET = a.slice('--target='.length);
  else if (a.indexOf('http') === 0) TARGET = a;
  else PROJECT_OVERRIDE = a;
}

// ---------- project directory ----------
const CANDIDATES = [__dirname, PROJECT_OVERRIDE, 'C:\\Users\\HP\\Documents\\Default Project\\inventory-app'].filter(Boolean);
const PROJECT_DIR = CANDIDATES.find(d => { try { return fs.existsSync(path.join(d, 'api', 'index.js')); } catch (e) { return false; } });
if (!PROJECT_DIR) {
  console.error('[x] Project not found (api/index.js). Pass the folder: node local-dev.js "C:\\path\\to\\inventory-app"');
  process.exit(1);
}

// ---------- env (.env.local -> .vercel/.env.production.local; shell vars win) ----------
function parseEnvFile(p) {
  try {
    const env = {};
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.charAt(0) === '#') continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      let k = t.slice(0, i).trim(), v = t.slice(i + 1).trim();
      if ((v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') || (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")) v = v.slice(1, -1);
      env[k] = v;
    }
    return env;
  } catch (e) { return null; }
}
for (const f of ['.env.local', path.join('.vercel', '.env.production.local')]) {
  const env = parseEnvFile(path.join(PROJECT_DIR, f));
  if (env) for (const k of Object.keys(env)) if (!(k in process.env)) process.env[k] = env[k];
}

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const DB_USABLE = /^postgres(ql)?:\/\//.test(DB_URL);
const MODE = FORCE || (DB_USABLE ? 'local' : 'proxy');

// ============================================================
// FILE-BACKED DATABASE (mode: filedb)
// The whole backend is a document store: app_state = ONE JSONB row, plus an
// rt_events append-only log. This shim implements exactly the SQL surface
// api/index.js uses (the same surface test/rbac.test.js stubs) and persists
// it to a single JSON file. No Postgres install required.
// ============================================================
const DATA_DIR = path.join(PROJECT_DIR, 'local-data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const FILE_DB_NOTIFY_CBS = new Set();

function safeParse(v, d) {
  if (v && typeof v === 'object') return v;
  try { const o = JSON.parse(v); return (o && typeof o === 'object') ? o : d; } catch (e) { return d; }
}

class FilePool {
  constructor() {
    try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
    this._load();
  }
  _empty() { return { app_state: null, rt_seq: 0, rt_events: [], rt_dedupe: {} }; }
  _load() {
    try { this.db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { this.db = null; }
    if (!this.db || typeof this.db !== 'object') this.db = this._empty();
    if (typeof this.db.app_state !== 'object' || this.db.app_state === null) this.db.app_state = {};
    if (!Array.isArray(this.db.rt_events)) this.db.rt_events = [];
    if (!this.db.rt_dedupe || typeof this.db.rt_dedupe !== 'object') this.db.rt_dedupe = {};
    if (typeof this.db.rt_seq !== 'number') this.db.rt_seq = 0;
    if (this.db.app_state && Object.keys(this.db.app_state).length > 0) this._persist();
  }
  _persist() {
    try {
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.db));
      try { fs.renameSync(tmp, DATA_FILE); }
      catch (e) { fs.writeFileSync(DATA_FILE, JSON.stringify(this.db)); }
    } catch (e) { console.error('[filedb] persist failed:', e && e.message); }
  }
  _notifyAll() {
    for (const cb of Array.from(FILE_DB_NOTIFY_CBS)) {
      try { cb('notification', { payload: 'new' }); } catch (e) {}
    }
  }
  async query(sql, params) {
    params = params || [];
    const s = String(sql);
    if (s.indexOf('CREATE TABLE') === 0) return { rows: [] };
    if (s.indexOf('SELECT data FROM app_state') >= 0) {
      const has = this.db.app_state && Object.keys(this.db.app_state).length > 0;
      return { rows: has ? [{ data: this.db.app_state }] : [] };
    }
    if (s.indexOf('INSERT INTO app_state') >= 0) {
      this.db.app_state = safeParse(params[0], {});
      this._persist();
      return { rows: [] };
    }
    if (s.indexOf('FROM rt_events') >= 0 && s.indexOf('SELECT') === 0) {
      const after = Number(params[0]) || 0;
      const limit = Math.max(1, Number(params[1]) || 200);
      const rows = this.db.rt_events
        .filter(e => e.id > after)
        .sort((a, b) => a.id - b.id)
        .slice(0, limit)
        .map(e => ({ id: e.id, type: e.type, title: e.title, message: e.message, scope: e.scope, payload: e.payload, created_at: e.created_at }));
      return { rows };
    }
    if (s.indexOf('INSERT INTO rt_events') >= 0) {
      const dedupe = params[5] || null;
      if (dedupe) {
        if (this.db.rt_dedupe[dedupe]) return { rows: [] };
        this.db.rt_dedupe[dedupe] = true;
      }
      this.db.rt_events.push({
        id: ++this.db.rt_seq,
        type: params[0], title: params[1], message: params[2],
        scope: safeParse(params[3], {}), payload: safeParse(params[4], {}),
        dedupe, created_at: Number(params[6]) || Date.now(),
      });
      if (this.db.rt_events.length > 2000) this.db.rt_events = this.db.rt_events.slice(-1000);
      this._persist();
      this._notifyAll();
      return { rows: [] };
    }
    if (s.indexOf('pg_notify') >= 0) { this._notifyAll(); return { rows: [] }; }
    if (s.indexOf('LISTEN') === 0) return { rows: [] };
    console.warn('[filedb] unhandled SQL:', s.slice(0, 120));
    return { rows: [] };
  }
  async connect() {
    const self = this;
    const mine = new Set();
    return {
      query: (sql, params) => self.query(sql, params),
      on: (event, cb) => { if (event === 'notification') { mine.add(cb); FILE_DB_NOTIFY_CBS.add(cb); } },
      release: () => { for (const cb of mine) FILE_DB_NOTIFY_CBS.delete(cb); mine.clear(); },
    };
  }
}

// ---------- static serving ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.map': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.gz': 'application/gzip', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function serveStatic(res, rel) {
  if (rel === '/' || rel === '') rel = '/index.html';
  let abs;
  try { abs = path.normalize(path.join(PROJECT_DIR, decodeURIComponent(rel))); }
  catch (e) { res.statusCode = 400; res.end('Bad path'); return; }
  if (abs !== PROJECT_DIR && abs.indexOf(PROJECT_DIR + path.sep) !== 0) {
    res.statusCode = 403; res.end('Forbidden'); return;
  }
  fs.readFile(abs, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found: ' + rel);
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  });
}

// ---------- Vercel-style res wrapper ----------
function wrap(res) {
  res.status = c => { res.statusCode = c; return res; };
  res.json = obj => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({ __raw: raw }); }
    });
    req.on('error', () => resolve({}));
  });
}

// ---------- local API mode (real Postgres/Neon) ----------
function handleApiLocal(req, res, pathname) {
  const rest = pathname === '/api' ? '' : pathname.slice('/api/'.length);
  const seg = rest.split('/').filter(Boolean); // handler decodes parts itself
  const query = {};
  if (req.url.indexOf('?') >= 0) {
    try { new URL(req.url, 'http://x').searchParams.forEach((v, k) => { query[k] = v; }); } catch (e) {}
  }
  query.path = seg;
  req.query = query;
  const p = (req.method !== 'GET' && req.method !== 'HEAD') ? readBody(req).then(b => { req.body = b; req._body = true; }) : Promise.resolve({}).then(b => { req.body = b; req._body = true; });
  return p.then(() => apiHandler(req, res));
}

// ---------- proxy API mode ----------
function handleApiProxy(req, res, pathname) {
  let target;
  try { target = new URL(TARGET); } catch (e) { res.statusCode = 500; res.end('Bad --target URL'); return; }
  const mod = target.protocol === 'http:' ? http : https;
  const headers = Object.assign({}, req.headers);
  headers.host = target.host;
  delete headers.connection;
  const opts = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'http:' ? 80 : 443),
    method: req.method,
    path: req.url,
    headers,
  };
  const up = mod.request(opts, upres => {
    const h = Object.assign({}, upres.headers);
    delete h['transfer-encoding'];
    delete h.connection;
    res.writeHead(upres.statusCode || 502, h);
    upres.pipe(res);
  });
  up.on('error', e => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Upstream unreachable: ' + (e && e.message || e) + ' — is ' + TARGET + ' online?' }));
    } else { try { res.end(); } catch (e2) {} }
  });
  req.pipe(up);
  req.on('error', () => { try { up.destroy(); } catch (e) {} });
}

// ---------- acquire the serverless handler ----------
let apiHandler = null;
if (MODE === 'local') {
  if (!DB_USABLE) {
    console.error('[x] --local needs a REAL Neon connection string in .env.local');
    console.error('    Current DATABASE_URL value is not a postgres:// URL. Example:');
    console.error('      DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require');
    console.error('    Copy it from the Neon dashboard, or Vercel -> your project -> Settings -> Environment Variables.');
    process.exit(1);
  }
  apiHandler = require(path.join(PROJECT_DIR, 'api', 'index.js'));
} else if (MODE === 'filedb') {
  // Feed the handler a file-backed Pool instead of pg. Same interception
  // pattern test/rbac.test.js uses — proven against this exact handler.
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'pg') return { Pool: FilePool };
    return origLoad.apply(this, arguments);
  };
  apiHandler = require(path.join(PROJECT_DIR, 'api', 'index.js'));
}

// ---------- one-time vendor bootstrap (binary assets only) ----------
// Text libraries ship in vendor/. The two BINARY assets below are fetched
// once at first start (needs internet once) and then live locally forever.
const VENDOR_BINARIES = [
  { file: path.join(PROJECT_DIR, 'vendor', 'fonts', 'inter-var.woff2'),
    url: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.2.5/files/inter-latin-wght-normal.woff2', min: 20000 },
  { file: path.join(PROJECT_DIR, 'vendor', 'tessdata', 'eng.traineddata.gz'),
    url: 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz', min: 1000000 },
];
function fetchToFile(url, file, minSize) {
  return new Promise(resolve => {
    const get = (u, redirects) => {
      const mod = u.indexOf('https:') === 0 ? https : http;
      let settled = false;
      const done = v => { if (!settled) { settled = true; resolve(v); } };
      const req = mod.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
          res.resume();
          return get(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return done(false); }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < minSize) return done(false);
          try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, buf);
            done(true);
          } catch (e) { done(false); }
        });
        res.on('error', () => done(false));
      });
      req.on('error', () => done(false));
      req.setTimeout(120000, () => { try { req.destroy(); } catch (e) {} done(false); });
    };
    get(url, 0);
  });
}
async function ensureVendorBinaries() {
  for (const b of VENDOR_BINARIES) {
    let size = 0;
    try { size = fs.existsSync(b.file) ? fs.statSync(b.file).size : 0; } catch (e) {}
    if (size >= b.min) { console.log('[vendor] ok     ' + path.relative(PROJECT_DIR, b.file) + ' (' + size + ' bytes)'); continue; }
    console.log('[vendor] fetching (one-time, then fully offline): ' + b.url);
    const ok = await fetchToFile(b.url, b.file, b.min);
    console.log(ok
      ? '[vendor] saved   ' + path.relative(PROJECT_DIR, b.file)
      : '[vendor] could not fetch ' + path.basename(b.file) + ' (offline?) — app still runs; retries next start.');
  }
}

// ---------- server ----------
const server = http.createServer((req, res) => {
  wrap(res);
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch (e) { res.statusCode = 400; res.end('Bad request'); return; }

  if (pathname === '/api' || pathname.indexOf('/api/') === 0 || pathname === '/api/') {
    const t0 = Date.now();
    if (MODE === 'proxy') { handleApiProxy(req, res, pathname); return; }
    const done = handleApiLocal(req, res, pathname);
    done.then(() => console.log('[api]', req.method, pathname, '->', res.statusCode, '(' + (Date.now() - t0) + 'ms)'))
      .catch(e => {
        console.error('[api] crashed:', e && (e.stack || e.message || e));
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(e && e.message || e) }));
        }
      });
    return;
  }
  serveStatic(res, pathname);
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE' && currentPort - PORT < 20) {
    console.warn('[!] Port ' + currentPort + ' is busy (another app is using it) — trying port ' + (currentPort + 1) + '…');
    currentPort += 1;
    server.listen(currentPort);
  } else {
    console.error('[x] Server error:', e && (e.stack || e.message || e));
    process.exit(1);
  }
});

function dbHost(url) {
  try { const u = new URL(url); return u.protocol + '//' + u.hostname + (u.pathname || ''); }
  catch (e) { return '(unparseable)'; }
}

ensureVendorBinaries(); // fire-and-forget: never blocks server start

let currentPort = PORT;
server.listen(PORT, () => {
  const url = 'http://localhost:' + currentPort;
  const line = '  ----------------------------------------------------------';
  console.log('');
  console.log(line);
  console.log('  Haryana Police Inventory — local dev server');
  console.log(line);
  console.log('  App:       ' + url + '   << open THIS in your browser');
  console.log('  Health:    ' + url + '/api/health');
  if (MODE === 'filedb') {
    console.log('  Mode:      FULLY LOCAL — frontend + API + database on this PC');
    console.log('  Database:  ' + DATA_FILE);
    console.log('  First run: empty DB -> the app auto-seeds defaults');
    console.log('             (developer/dev@123, admin/admin123, admin2/admin123, user/user123)');
    console.log('  Backup:    copy ' + DATA_FILE);
    console.log('  Reset:     delete ' + DATA_FILE + ' and restart');
  } else if (MODE === 'local') {
    console.log('  Mode:      LOCAL backend (api/index.js in this Node process)');
    console.log('  Database:  ' + dbHost(DB_URL) + '   << REAL Neon data!');
  } else {
    console.log('  Mode:      PROXY -> ' + TARGET + '  (deployed API, live data)');
    console.log('  Tip:       run-local.bat defaults to --filedb (fully local).');
  }
  console.log('  Stop:      Ctrl+C');
  console.log(line);
  console.log('');
  // open the browser automatically at the right URL
  if (process.argv.indexOf('--no-open') < 0) {
    try { require('child_process').exec('start "" "' + url + '"'); } catch (e) {}
  }
});
