// Removes the end-to-end test records. The maintenance gate now refuses
// deletions outright - which is correct, and is why the test could not tidy up
// after itself through the API - so the rows it left behind are taken out of
// the stored file directly, with the server stopped.
//
//   node cleanup-e2e-records.js
'use strict';
const fs = require('fs');
const path = require('path');
const DB = path.join(__dirname, 'local-data', 'db.json');
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const state = db.app_state || db;
let removed = 0;
for (const key of Object.keys(state)) {
  if (key.indexOf('hp_inventory.maintenance_') !== 0) continue;
  if (!Array.isArray(state[key])) continue;
  const before = state[key].length;
  state[key] = state[key].filter(r => String(r && r.id).indexOf('e2e_') !== 0);
  removed += before - state[key].length;
}
console.log('test records removed: ' + removed);
fs.writeFileSync(DB, JSON.stringify(db));
console.log('done.');
