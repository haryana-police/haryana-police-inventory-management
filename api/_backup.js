'use strict';
/**
 * api/_backup.js — rotating backups of the app database.
 *
 * Every time the database is written, a dated copy is kept in
 *   local-data/backups/db-YYYY-MM-DD_HHMMSS.json
 * and the oldest copies are pruned so the folder cannot grow without bound.
 *
 * This is deliberately simple: the database is a single JSON file, so backing
 * it up is a file copy. A backup failure is logged and then ignored — it must
 * never stop a save.
 *
 *   HP_BACKUP=0        turn backups off
 *   HP_BACKUP_KEEP=n   how many copies to keep (default 50)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'local-data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const ENABLED = String(process.env.HP_BACKUP === undefined ? '1' : process.env.HP_BACKUP) !== '0';
const KEEP = Math.max(1, parseInt(process.env.HP_BACKUP_KEEP || '50', 10) || 50);

/* A cheap content signature. Used to skip the copy when a save produced exactly
   the same bytes, so that repeated no-op saves do not fill the folder. */
function signature(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h + ':' + s.length;
}

let lastSignature = null;

function stamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
         '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

/* Two saves can land inside the same second, so a plain timestamp is not enough -
   the second copy would overwrite the first and the folder would never grow.
   Add a counter until the name is free. */
function freeName(base) {
  let name = base + '.json';
  let n = 2;
  while (fs.existsSync(path.join(BACKUP_DIR, name))) { name = base + '-' + n + '.json'; n++; }
  return name;
}

/* Keep only the newest KEEP copies. The names sort chronologically (the -2, -3
   suffixes also sort correctly because they are all single digits up to 9), so the
   oldest are simply the ones at the front. */
function prune() {
  let names;
  try { names = fs.readdirSync(BACKUP_DIR); } catch (e) { return 0; }
  const copies = names.filter(n => /^db-\d{4}-\d{2}-\d{2}_\d{6}(-\d+)?\.json$/.test(n)).sort();
  let removed = 0;
  for (let i = 0; i < copies.length - KEEP; i++) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, copies[i])); removed++; } catch (e) {}
  }
  return removed;
}

/* Copy the freshly written database into the backup folder. */
function backupNow(reason) {
  if (!ENABLED) return null;
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const dest = path.join(BACKUP_DIR, freeName('db-' + stamp(new Date())));
    fs.copyFileSync(DATA_FILE, dest);
    const removed = prune();
    console.log('[backup] ' + path.basename(dest) + (reason ? ' (' + reason + ')' : '') + (removed ? ', pruned ' + removed : ''));
    return dest;
  } catch (e) {
    console.error('[backup] failed:', e && e.message);
    return null;
  }
}

/* Called right after a successful save. Skips the copy when the bytes on disk
   are identical to the previous save. */
function noteSaved(json) {
  if (!ENABLED) return null;
  const sig = signature(json);
  if (sig === lastSignature) return null;
  lastSignature = sig;
  return backupNow('auto');
}

/* Called on startup so the first save is always captured. */
function noteStartup() { lastSignature = null; }

module.exports = { backupNow, noteSaved, noteStartup, prune, BACKUP_DIR, DATA_FILE, KEEP, ENABLED };
