// Adds the second Inspector General demo account, ig.fbd.
//
// The published demo list in api/index.js names ig.fbd, but no such account has
// ever existed, so its card silently never appeared. This creates it.
//
// Deliberately additive: no existing user, district or range is modified. The
// account is put in the IG Range that actually contains Faridabad
// (loc_range_1, "IG Range - Gurugram + Faridabad") and its own scope is the
// single district it answers for, so RBAC confines it to Faridabad whatever the
// range happens to hold. The live database gets the published demo password,
// exactly as its other accounts have; make-demo-data.js then writes the
// sanitised copy with the demo password on it like every other account.
//
//   node add-ig-fbd.js
//
'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB = path.join(__dirname, 'local-data', 'db.json');
const USERS = 'hp_inventory.users';
const DEMO_PASSWORD = 'hp@123';
const USERNAME = 'ig.fbd';
const DISTRICT_ID = 'dist_2';       // Faridabad
const RANGE_ID = 'loc_range_1';     // IG Range - Gurugram + Faridabad

(async () => {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const state = db.app_state || db;
  const users = state[USERS];
  if (!Array.isArray(users)) throw new Error('no ' + USERS + ' array');

  if (users.some(u => u && String(u.username || '').toLowerCase() === USERNAME)) {
    console.log(USERNAME + ' already exists - nothing to do.');
    process.exit(0);
  }

  const district = (state['hp_inventory.districts'] || []).find(d => d && d.id === DISTRICT_ID);
  if (!district) throw new Error('district ' + DISTRICT_ID + ' is not in the database');
  const range = ((state['hp_inventory.locations'] || {}).__hq__ || []).find(l => l && l.id === RANGE_ID);
  if (!range) throw new Error('IG Range ' + RANGE_ID + ' is not in the database');

  // The id format matches what the rest of the file already uses for this kind
  // of record, so nothing that parses the id has to learn a new shape.
  const rec = {
    id: 'igfbd_' + require('crypto').randomBytes(6).toString('hex'),
    username: USERNAME,
    name: 'IG - ' + district.name,
    role: 'ig',
    mobile: '9000000002',
    districtId: DISTRICT_ID,
    districtIds: [DISTRICT_ID],
    locationId: RANGE_ID,
    locationType: 'igRange',
    rangeId: RANGE_ID,
    state: 'Haryana',
    active: true,
    createdAt: Date.now(),
    password: await bcrypt.hash(DEMO_PASSWORD, 12),
  };

  users.push(rec);
  if (db.app_state) db.app_state[USERS] = users;
  fs.writeFileSync(DB, JSON.stringify(db));

  console.log('added ' + USERNAME);
  console.log('  id          : ' + rec.id);
  console.log('  role        : ig (Inspector General)');
  console.log('  district    : ' + district.name + '  (' + DISTRICT_ID + ')');
  console.log('  IG Range    : ' + range.name + '  (' + RANGE_ID + ')');
  console.log('  districtIds : ' + JSON.stringify(rec.districtIds));
  console.log('  password    : ' + DEMO_PASSWORD + ' (same as every other demo account)');
  console.log('  users now   : ' + users.length);
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
