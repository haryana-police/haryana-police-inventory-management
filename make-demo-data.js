// Builds local-data/db.demo.json from the live database.
//
// The live database holds real records: officer names, 10-digit mobile numbers,
// uploaded scan documents, item photographs, audit trails naming who did what,
// and live session tokens. None of that may travel to a shared repository.
//
// This produces the same document with every one of those replaced or removed,
// so anyone who opens the project sees a working app full of plausible demo
// content and no trace of the real data. Structure, ids, roles and district
// wiring are kept, because RBAC, district scoping and the demo sign-in panel all
// key off them - a demo copy that lost those would look broken, not empty.
//
//   node make-demo-data.js
//
'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DIR = path.join(__dirname, 'local-data');
const SRC = path.join(DIR, 'db.json');
const OUT = path.join(DIR, 'db.demo.json');
const DEMO_PASSWORD = 'demo@123';
const ROUNDS = 10;

const PHONE = /\b[6-9]\d{9}\b/g;
// A stable, obviously-fake number per record: the demo looks populated, but
// nothing in it can be dialled or match a real subscriber.
const demoPhone = (seed, i) => '98765' + String(10000 + ((seed * 37 + i * 91) % 89999)).padStart(5, '0');

const ROLE_LABEL = {
  devadmin: 'Developer Admin', ig: 'IG', admin: 'District Admin', mhc: 'MHC Officer',
  station: 'Station Manager', itstaff: 'Computer/IT Staff', mtostaff: 'MTO Staff',
  post: 'Police Post', user: 'General Staff', tsi: 'TSI', staff: 'Staff',
};

(async () => {
  const raw = fs.readFileSync(SRC, 'utf8');
  const db = JSON.parse(raw);
  const state = db.app_state || db;
  const districts = state['hp_inventory.districts'] || [];
  const removed = [];

  // ---- 1. Users: keep the identity and the wiring, replace the person ----
  const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
  const hash = await bcrypt.hash(DEMO_PASSWORD, ROUNDS);
  state['hp_inventory.users'] = users.map((u, i) => {
    const copy = { ...u, password: hash };
    // The name keeps the part that says what the account IS and drops anything
    // that identifies a person, so the panel stays readable.
    if (copy.name) {
      const where = districts.find(d => d && d.id === copy.districtId);
      const label = ROLE_LABEL[copy.role] || 'Staff';
      copy.name = label + (where ? ' - ' + where.name : '') + ' (Demo)';
    }
    if (copy.mobile) copy.mobile = demoPhone(7, i);
    if (copy.email) copy.email = 'demo@example.invalid';
    return copy;
  });

  // ---- 2. Sessions: live bearer tokens, never shareable ----
  if (state['hp_inventory.sessions']) {
    state['hp_inventory.sessions'] = {};
    removed.push('hp_inventory.sessions  (live auth tokens)');
  }

  // ---- 3. Photographs and uploaded documents ----
  for (const k of Object.keys(state)) {
    if (/photo/i.test(k) || k.indexOf('hp_inventory.scan_files.') === 0) {
      delete state[k];
      removed.push(k + '  (photographs / uploaded documents)');
    }
  }

  // ---- 4. Audit trails: they name who did what ----
  for (const k of Object.keys(state)) {
    if (k.indexOf('hp_inventory.audit') === 0) { delete state[k]; removed.push(k + '  (audit trail)'); }
  }

  // ---- 5. persons and accessRequests: records kept, identity replaced ----
  const anonymise = (rec, label, i) => {
    const c = { ...rec };
    if (c.name) c.name = label + ' ' + (i + 1);
    if (c.mobile) c.mobile = demoPhone(3, i);
    if (c.phone) c.phone = demoPhone(5, i);
    if (c.email) c.email = 'demo@example.invalid';
    if (c.address) c.address = 'Demo address, Haryana';
    if (c.remarks) c.remarks = 'Demo record.';
    delete c.photo;
    delete c.photoData;
    return c;
  };
  if (Array.isArray(state['hp_inventory.persons'])) {
    state['hp_inventory.persons'] = state['hp_inventory.persons'].map((r, i) => anonymise(r, 'Demo Person', i));
  }
  if (Array.isArray(state['hp_inventory.accessRequests'])) {
    state['hp_inventory.accessRequests'] = state['hp_inventory.accessRequests'].map((r, i) => anonymise(r, 'Demo Applicant', i));
  }
  // ---- 6. Belt and braces: strip any 10-digit number left anywhere ----
  // The targeted passes above cover what is known to be personal. This one
  // does not care what a field is called: any 10-digit number anywhere in the
  // document is replaced, so a record nobody thought about cannot leak.
  let stripped = 0;
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string') {
          PHONE.lastIndex = 0;
          if (PHONE.test(v)) {
            PHONE.lastIndex = 0;
            node[k] = v.replace(PHONE, '9876500000');
            PHONE.lastIndex = 0;
            stripped++;
          }
        } else if (v && typeof v === 'object') walk(v);
      }
    }
  };
  walk(state);
  PHONE.lastIndex = 0;

  // ---- 7. The realtime log can carry record contents ----
  if (Array.isArray(db.rt_events)) { db.rt_events = []; removed.push('rt_events  (event log)'); }
  if (db.rt_dedupe) db.rt_dedupe = {};

  // ---- 8. Mark the copy, so nobody mistakes it for the real thing ----
  state['hp_inventory.isDemoData'] = true;
  state['hp_inventory.demoNote'] = 'Sample data. Every name, mobile number and document here is invented. Every account uses the password ' + DEMO_PASSWORD + '.';

  const out = JSON.stringify(db);
  fs.writeFileSync(OUT, out);

  // ---- Verify before claiming success ----
  const back = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const text = JSON.stringify(back);
  const left = (text.match(/\b[6-9]\d{9}\b/g) || []).filter(x => x !== '9876500000');
  const demoUsers = (back.app_state || back)['hp_inventory.users'] || [];
  const pwOk = demoUsers.length ? await bcrypt.compare(DEMO_PASSWORD, demoUsers[0].password) : false;
  const allPw = demoUsers.every(u => u.password === demoUsers[0].password);
  const hasToken = Object.keys((back.app_state || back)['hp_inventory.sessions'] || {}).length > 0;
  const names = demoUsers.filter(u => u.name && !/\(Demo\)$/.test(u.name)).length;

  console.log('wrote ' + path.relative(__dirname, OUT));
  console.log('  size               : ' + (out.length / 1024).toFixed(0) + ' KB   (live db was ' + (raw.length / 1024).toFixed(0) + ' KB)');
  console.log('  accounts           : ' + demoUsers.length + ', all passwords = ' + DEMO_PASSWORD + ' -> ' + (allPw && pwOk ? 'PASS' : 'FAIL'));
  console.log('  names not marked   : ' + names + (names ? '  <-- FAIL' : '  (all suffixed "(Demo)")'));
  console.log('  real mobile numbers: ' + left.length + (left.length ? '  <-- FAIL -> ' + left.slice(0, 5).join(', ') : '  (none)'));
  console.log('  session tokens     : ' + (hasToken ? 'PRESENT  <-- FAIL' : 'none'));
  console.log('  stray nums swept   : ' + stripped);
  console.log('\n  removed entirely:');
  for (const r of removed) console.log('    - ' + r);

  const fail = left.length || names || hasToken || !allPw || !pwOk;
  if (fail) { console.error('\nFAILED: the demo copy is not clean - do not commit it.'); process.exit(1); }
  console.log('\nClean. No real names, no real numbers, no tokens, no documents.');
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(1); });
