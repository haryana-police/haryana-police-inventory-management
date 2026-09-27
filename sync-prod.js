#!/usr/bin/env node
/**
 * sync-prod.js — Pull LIVE production data + version from Vercel and store them locally.
 *
 *   node sync-prod.js            -> backup prod state + version to local-data/
 *   node sync-prod.js --restore  -> ALSO load the prod snapshot into the local
 *                                   database (local db.json is backed up first;
 *                                   local user accounts are kept so logins work)
 *
 * Outputs:
 *   local-data/prod-state.json              latest production state (full JSON)
 *   local-data/prod-backups/prod-<stamp>.json  timestamped backup copies
 *   local-data/prod-status.json             production version + fetch info
 *
 * Zero dependencies. Requires Node 18+ (built-in fetch).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PROD = 'https://hp-inventory.vercel.app';
const DATA = path.join(__dirname, 'local-data');
const BAK = path.join(DATA, 'prod-backups');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url, tries) {
  for (let i = 0; i < (tries || 3); i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'hp-sync/1.0' } });
      if (r.ok) return await r.text();
      console.error('  HTTP ' + r.status + ' from ' + url + ' (try ' + (i + 1) + ')');
    } catch (e) {
      console.error('  ' + e.message + ' (try ' + (i + 1) + ')');
    }
    await sleep(1500);
  }
  throw new Error('failed: ' + url);
}

async function main() {
  const restore = process.argv.includes('--restore');
  if (!fs.existsSync(BAK)) fs.mkdirSync(BAK, { recursive: true });

  console.log('Fetching production state from ' + PROD + ' ...');
  const stateRaw = await getText(PROD + '/api/state', 4);
  const state = JSON.parse(stateRaw);

  console.log('Fetching production version...');
  const appJs = await getText(PROD + '/app.js?nocache=' + Date.now(), 3);
  const ver = (appJs.match(/APP_VERSION = "([^"]+)"/) || [])[1] || 'unknown';

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const stateFile = path.join(DATA, 'prod-state.json');
  const bakFile = path.join(BAK, 'prod-' + stamp + '.json');
  fs.writeFileSync(stateFile, stateRaw);
  fs.writeFileSync(bakFile, stateRaw);

  const counts = {};
  for (const [k, v] of Object.entries(state)) {
    if (Array.isArray(v)) counts[k.replace('hp_inventory.', '')] = v.length;
    else if (v && typeof v === 'object') counts[k.replace('hp_inventory.', '')] = Object.keys(v).length + ' keys';
  }
  const status = {
    source: PROD,
    productionVersion: ver,
    fetchedAt: new Date().toISOString(),
    savedTo: { state: 'local-data/prod-state.json', backup: 'local-data/prod-backups/prod-' + stamp + '.json' },
    contents: counts,
  };
  fs.writeFileSync(path.join(DATA, 'prod-status.json'), JSON.stringify(status, null, 2));
  console.log('Production version : ' + ver);
  for (const [k, v] of Object.entries(counts)) console.log('  ' + k + ': ' + v);
  console.log('Saved -> local-data/prod-state.json');
  console.log('Backup-> local-data/prod-backups/prod-' + stamp + '.json');

  if (restore) {
    const localDbPath = path.join(DATA, 'db.json');
    let localUsers = [];
    if (fs.existsSync(localDbPath)) {
      try {
        const ldb = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
        localUsers = (ldb.app_state && ldb.app_state['hp_inventory.users']) || [];
        const stamp2 = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.writeFileSync(path.join(DATA, 'db.backup-' + stamp2 + '.json'), JSON.stringify(ldb));
        console.log('Local database backed up -> db.backup-' + stamp2 + '.json');
      } catch (e) {
        console.error('Could not back up local db:', e.message);
        process.exit(1);
      }
    }
    const prod = JSON.parse(stateRaw);
    if (localUsers.length) prod['hp_inventory.users'] = localUsers; // keep local logins working
    const db = { app_state: prod, rt_seq: 0, rt_events: [], rt_dedupe: {} };
    fs.writeFileSync(localDbPath, JSON.stringify(db));
    console.log('Prod data loaded into local db.json' + (localUsers.length ? ' (local user accounts kept: ' + localUsers.length + ')' : ''));
    console.log('>>> Restart the local server (close node, run: node local-dev.js 3210 --filedb) to load it.');
  }
}

main().catch((e) => { console.error('[x] sync failed:', e.message); process.exit(1); });
