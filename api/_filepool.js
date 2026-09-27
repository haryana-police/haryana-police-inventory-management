'use strict';
/**
 * api/_filepool.js — file-backed database pool (the ONLY database in this app).
 *
 * The whole backend is a document store: app_state = ONE document, plus an
 * rt_events append-only log. This class implements exactly the SQL surface
 * api/index.js uses, and persists it to a single JSON file:
 *
 *   local-data/db.json
 *
 * No Postgres, no Neon, no connection string, no secrets. Copy the file to
 * back up, delete it to reset.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'local-data');
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
    if (s.indexOf('LISTEN') === 0) return { rows: [] };
    if (s.indexOf('pg_notify') >= 0) { this._notifyAll(); return { rows: [] }; }
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
  async end() { /* file-backed: nothing to close */ }
}

module.exports = { Pool: FilePool, DATA_FILE, DATA_DIR };
