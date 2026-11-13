'use strict';
/**
 * clear-entries.js — saari transactional entries clear karta hai, categories
 * aur items (catalogue) ko chhod kar.
 *
 * KYA CLEAR hota hai (per district + global):
 *   distributions_*, demands_*, inspections_*, shramdaan_*,
 *   notifications_*, audit_*, maintenance_*, persons, allotments,
 *   accessRequests, consumable_txns, personPhotos, scan_files.*
 *   + top-level rt_events / rt_dedupe / rt_seq (notification feed)
 *
 * KYA BACHA rehta hai:
 *   districts, users, locations, items, consumable_items,
 *   categories, cons_categories, seedVersion, sequence counters, sessions
 *
 * PER-DISTRICT keys ko DELETE nahi kiya jata — EMPTY ARRAY set hota hai,
 * kyunki app.js seedAll() missing keys par dobara demo seed kar deta hai;
 * khaali array rehne se seed dobara nahi hota.
 *
 * SERVER pehle band karna zaroori hai (FilePool DB memory me rakhta hai —
 * chalte server ke saamne file edit karne par agle save par changes
 * overwrite ho jayenge).
 *
 * Run:  node clear-entries.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'local-data', 'db.json');
const BACKUP_DIR = path.join(__dirname, 'local-data', 'backups');

/* Per-district stores jo khaali array bane — seed dobara na chale isliye
   key delete nahi, empty array. */
const CLEAR_ARRAY_PREFIXES = [
  'hp_inventory.distributions_',
  'hp_inventory.demands_',
  'hp_inventory.inspections_',
  'hp_inventory.shramdaan_',
  'hp_inventory.notifications_',
  'hp_inventory.audit_',
  'hp_inventory.maintenance_',
];

/* Global keys jo khaali array bane. */
const CLEAR_ARRAY_KEYS = [
  'hp_inventory.persons',
  'hp_inventory.allotments',
  'hp_inventory.accessRequests',
];

/* Global keys jo khaali object bane (map shape). */
const CLEAR_OBJECT_KEYS = [
  'hp_inventory.personPhotos',
  'hp_inventory.consumable_txns',
  'hp_inventory.itemPhotos',
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('[x] ' + DATA_FILE + ' nahi mila — server kahan chal raha hai?');
    process.exit(1);
  }

  /* 1) Explicit backup, taaki kuch galat ho to wapas le saken. */
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = path.join(BACKUP_DIR, 'db-before-clear-entries-' + stamp() + '.json');
  fs.copyFileSync(DATA_FILE, backupFile);
  console.log('[1/4] backup: ' + path.basename(backupFile));

  /* 2) Load */
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const st = db.app_state || {};
  const summary = [];

  /* 3) Clean */
  for (const key of Object.keys(st)) {
    if (CLEAR_ARRAY_PREFIXES.some(p => key.indexOf(p) === 0)) {
      const before = Array.isArray(st[key]) ? st[key].length : 0;
      if (before > 0) summary.push(key.replace('hp_inventory.', '') + ': ' + before + ' -> 0');
      st[key] = [];
    } else if (CLEAR_OBJECT_KEYS.indexOf(key) >= 0) {
      const before = (st[key] && typeof st[key] === 'object') ? Object.keys(st[key]).length : 0;
      if (before > 0) summary.push(key.replace('hp_inventory.', '') + ': ' + before + ' keys -> 0');
      st[key] = {};
    } else if (CLEAR_ARRAY_KEYS.indexOf(key) >= 0) {
      const before = Array.isArray(st[key]) ? st[key].length : 0;
      if (before > 0) summary.push(key.replace('hp_inventory.', '') + ': ' + before + ' -> 0');
      st[key] = [];
    } else if (key.indexOf('hp_inventory.scan_files.') === 0) {
      /* Blob storage — maintenance/grievance photos. Orphan ho jayenge,
         isliye poori key hata di jaati hai. */
      summary.push(key.replace('hp_inventory.', '') + ': removed');
      delete st[key];
    }
  }

  /* Notification feed (top-level realtime events) bhi clear. */
  if (Array.isArray(db.rt_events) && db.rt_events.length) {
    summary.push('rt_events: ' + db.rt_events.length + ' -> 0');
  }
  db.rt_events = [];
  db.rt_dedupe = {};
  db.rt_seq = 0;

  db.app_state = st;

  /* 4) Save */
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE);

  console.log('[2/4] cleaned:');
  if (summary.length) summary.forEach(s => console.log('      - ' + s));
  else console.log('      (kuch clear karne ko nahi tha — sab pehle se khaali)');

  /* 5) Report what survived */
  const kept = ['hp_inventory.districts', 'hp_inventory.users', 'hp_inventory.locations',
    'hp_inventory.items', 'hp_inventory.consumable_items', 'hp_inventory.categories',
    'hp_inventory.cons_categories', 'hp_inventory.sessions'];
  console.log('[3/4] intact (catalogue + structure):');
  for (const k of kept) {
    if (st[k] === undefined) continue;
    const v = st[k];
    const c = Array.isArray(v) ? v.length : Object.keys(v).length;
    console.log('      - ' + k.replace('hp_inventory.', '') + ': ' + c);
  }
  console.log('[4/4] done. Ab server restart karo (run-local.bat).');
}

main();
