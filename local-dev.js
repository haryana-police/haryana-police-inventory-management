#!/usr/bin/env node
/**
 * local-dev.js - Haryana Police Inventory: local runner (zero dependencies).
 *
 * Serves the static frontend AND the /api/* backend on one local port,
 * backed by a file-based database. Nothing ever leaves this PC.
 *
 *   node local-dev.js [port] [--no-open]
 *
 * The database is local-data/db.json (see api/_filepool.js). No Postgres,
 * no connection string, no secrets, no internet required.
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------- CLI ----------
let PORT = 3210;               // 3000 is often taken by another local dev server on this PC
let PROJECT_OVERRIDE = null;
for (const a of process.argv.slice(2)) {
  if (/^\d+$/.test(a)) PORT = Number(a);
  else if (a === '--filedb' || a === '--no-open') continue; // kept for run-local.bat compat
  else PROJECT_OVERRIDE = a;
}

// ---------- project directory ----------
const CANDIDATES = [__dirname, PROJECT_OVERRIDE, 'C:\\Users\\HP\\Documents\\Default Project\\inventory-app'].filter(Boolean);
const PROJECT_DIR = CANDIDATES.find(d => { try { return fs.existsSync(path.join(d, 'api', 'index.js')); } catch (e) { return false; } });
if (!PROJECT_DIR) {
  console.error('[x] Project not found (api/index.js). Pass the folder: node local-dev.js "C:\\path\\to\\inventory-app"');
  process.exit(1);
}

// ---------- env (.env.local; shell vars win) ----------
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
for (const f of ['.env.local']) {
  const env = parseEnvFile(path.join(PROJECT_DIR, f));
  if (env) for (const k of Object.keys(env)) if (!(k in process.env)) process.env[k] = env[k];
}


// ---------- database ----------
// The file-backed pool lives with the API (api/_filepool.js) so the backend
// and this runner share one instance (and one notification channel).
const { DATA_FILE } = require(path.join(PROJECT_DIR, 'api', '_filepool.js'));
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

// ---------- response helpers ----------
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

// ---------- API handler ----------
let _cachedApiHandler = null;
let _lastApiMtime = 0;

function getApiHandler() {
  let apiMtime = 0;
  try {
    const apiDir = path.join(PROJECT_DIR, 'api');
    for (const f of fs.readdirSync(apiDir)) {
      if (f.endsWith('.js')) {
        const stat = fs.statSync(path.join(apiDir, f));
        if (stat.mtimeMs > apiMtime) apiMtime = stat.mtimeMs;
      }
    }
  } catch (e) {}

  if (!_cachedApiHandler || apiMtime > _lastApiMtime) {
    for (const k of Object.keys(require.cache)) {
      if (k.includes(path.join('api', ''))) delete require.cache[k];
    }
    _cachedApiHandler = require(path.join(PROJECT_DIR, 'api', 'index.js'));
    _lastApiMtime = apiMtime;
  }
  return _cachedApiHandler;
}

function handleApi(req, res, pathname) {
  const rest = pathname === '/api' ? '' : pathname.slice('/api/'.length);
  const seg = rest.split('/').filter(Boolean); // handler decodes parts itself
  const query = {};
  if (req.url.indexOf('?') >= 0) {
    try { new URL(req.url, 'http://x').searchParams.forEach((v, k) => { query[k] = v; }); } catch (e) {}
  }
  query.path = seg;
  req.query = query;
  const p = (req.method !== 'GET' && req.method !== 'HEAD') ? readBody(req).then(b => { req.body = b; req._body = true; }) : Promise.resolve({}).then(b => { req.body = b; req._body = true; });
  const handler = getApiHandler();
  return p.then(() => handler(req, res));
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
    const done = handleApi(req, res, pathname);
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

process.on('uncaughtException', err => {
  console.error('[local-dev] Uncaught exception:', err && (err.stack || err.message || err));
});
process.on('unhandledRejection', reason => {
  console.error('[local-dev] Unhandled rejection:', reason && (reason.stack || reason.message || reason));
});
process.on('beforeExit', code => {
  console.log('[local-dev] beforeExit with code:', code);
});
process.on('exit', code => {
  console.log('[local-dev] exit with code:', code);
});

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
  console.log('  Mode:      FULLY LOCAL - frontend + API + database on this PC');
  console.log('  Database:  ' + DATA_FILE);
  console.log('  First run: empty DB -> the app auto-seeds defaults');
  console.log('             (developer/dev@123, admin/admin123, admin2/admin123, user/user123)');
  console.log('  Backup:    copy ' + DATA_FILE);
  console.log('  Reset:     delete ' + DATA_FILE + ' and restart');
  console.log('  Stop:      Ctrl+C');
  console.log(line);
  console.log('');
  // open the browser automatically at the right URL
  if (process.argv.indexOf('--no-open') < 0) {
    try { require('child_process').exec('start "" "' + url + '"'); } catch (e) {}
  }
});
