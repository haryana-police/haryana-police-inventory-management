'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const RESET_ID = 'inventory-entry-reset-2026-11-16';
const DISTRICT_STORES = [
  'distributions', 'demands', 'inspections', 'shramdaan',
  'notifications', 'audit', 'maintenance'
];

function writeJson(file, data) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(data), { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function resetEntries(dataDir, { once = false } = {}) {
  const database = path.join(dataDir, 'db.json');
  const grievances = path.join(dataDir, 'grievances.json');
  if (!fs.existsSync(database)) return false;

  const db = JSON.parse(fs.readFileSync(database, 'utf8'));
  if (once && db.entryReset === RESET_ID) return false;
  const state = db.app_state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('Reset requires a valid inventory database.');
  }

  const backupDir = path.join(dataDir, 'backups', RESET_ID + '-' + randomUUID());
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(database, path.join(backupDir, 'db.json'));
  if (fs.existsSync(grievances)) fs.copyFileSync(grievances, path.join(backupDir, 'grievances.json'));

  const prefix = 'hp_inventory.';
  for (const key of Object.keys(state)) {
    if (DISTRICT_STORES.some(store => key.startsWith(prefix + store + '_'))) state[key] = [];
    if (key.startsWith(prefix + 'scan_files.')) delete state[key];
  }
  for (const district of state[prefix + 'districts'] || []) {
    for (const store of DISTRICT_STORES) state[prefix + store + '_' + district.id] = [];
  }
  for (const key of ['persons', 'allotments', 'accessRequests', 'rt_events']) state[prefix + key] = [];
  for (const key of ['personPhotos', 'consumable_txns']) state[prefix + key] = {};
  for (const key of ['demandSeq', 'distSeq', 'maintSeq']) state[prefix + key] = 0;

  db.rt_events = [];
  db.rt_dedupe = {};
  // Keep the realtime cursor monotonic for browsers that are still connected.
  db.entryReset = RESET_ID;
  if (fs.existsSync(grievances)) writeJson(grievances, []);
  writeJson(database, db);
  console.log('[entry reset] Completed. Backup: ' + backupDir);
  return true;
}

module.exports = { resetEntries };

if (require.main === module) {
  // Stop the server before running this command against its database.
  if (!resetEntries(path.join(__dirname, 'local-data'))) {
    console.error('[entry reset] local-data/db.json was not found.');
    process.exitCode = 1;
  }
}
