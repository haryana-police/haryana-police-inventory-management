// clean-users.js — de-duplicate the users collection and set a fresh password.
//  - keeps ONE record per distinct username (most complete / newest wins)
//  - sets every kept account's password to the given value (bcrypt, 12 rounds)
//  - rewrites db.json atomically
//
// Usage: node clean-users.js <newPassword>
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const NEW_PASSWORD = process.argv[2];
if (!NEW_PASSWORD) {
  console.error('Usage: node clean-users.js <newPassword>');
  process.exit(1);
}

const DB = path.join(__dirname, 'local-data', 'db.json');
const USERS_KEY = 'hp_inventory.users';
const ROUNDS = 12;

// score a record: prefer records that look "real"/complete
function score(u) {
  let s = 0;
  if (u.password) s += 2;
  if (u.role) s += 2;
  if (u.name) s += 1;
  if (u.districtId) s += 1;
  if (u.mobile) s += 1;
  if (u.active === true) s += 1;
  return s;
}

(async function main() {
  console.log('Reading DB (' + fs.statSync(DB).size + ' bytes)...');
  const db = JSON.parse(await fs.promises.readFile(DB, 'utf8'));
  const store = db && db.app_state ? db.app_state : db;
  const users = store[USERS_KEY];

  if (!Array.isArray(users)) {
    console.error('No array at ' + USERS_KEY);
    process.exit(1);
  }
  console.log('User records found: ' + users.length);

  // ---- de-duplicate by username (case-insensitive, trimmed) ----
  const best = new Map();
  let dropped = 0;
  for (const u of users) {
    if (!u || typeof u !== 'object') { dropped++; continue; }
    const key = String(u.username || '').trim().toLowerCase();
    if (!key) { dropped++; continue; }
    const cur = best.get(key);
    if (!cur) { best.set(key, u); continue; }
    // keep the better record; tie-break on newer createdAt
    const cs = score(cur), us = score(u);
    const newer = (u.createdAt || 0) > (cur.createdAt || 0);
    if (us > cs || (us === cs && newer)) best.set(key, u);
    dropped++;
  }

  const kept = Array.from(best.values());
  console.log('Distinct usernames: ' + kept.length);
  console.log('Duplicates/invalid removed: ' + dropped);

  kept.sort((a, b) => String(a.username).localeCompare(String(b.username)));

  // ---- set password on every kept account ----
  console.log('Hashing "' + NEW_PASSWORD + '" (bcrypt ' + ROUNDS + ')...');
  const hash = await bcrypt.hash(NEW_PASSWORD, ROUNDS);
  for (const u of kept) u.password = hash;

  store[USERS_KEY] = kept;

  // ---- write atomically ----
  const tmp = DB + '.tmp';
  console.log('Writing cleaned DB...');
  await fs.promises.writeFile(tmp, JSON.stringify(db), 'utf8');
  await fs.promises.rename(tmp, DB);

  const size = fs.statSync(DB).size;
  console.log('Done. Users now: ' + kept.length + '  |  DB size: ' + (size / 1048576).toFixed(2) + ' MB');
  console.log('Kept usernames: ' + kept.map(u => u.username).join(', '));
  console.log('Verify check: ' + ((await bcrypt.compare(NEW_PASSWORD, hash)) ? 'PASS' : 'FAIL'));
})().catch(e => {
  console.error('ERROR: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
