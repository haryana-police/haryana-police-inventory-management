// reset-passwords.js - set ALL users' password to a given value (bcrypt hashed)
// Usage: node reset-passwords.js <newPassword>
// Safe: reads db.json, rewrites only the password field of every user, writes atomically.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const NEW_PASSWORD = process.argv[2];
if (!NEW_PASSWORD) {
  console.error('Usage: node reset-passwords.js <newPassword>');
  process.exit(1);
}

const DB = path.join(__dirname, 'local-data', 'db.json');
const USERS_KEY = 'hp_inventory.users';
const ROUNDS = 12;

(async function main() {
  console.log('Reading DB (' + fs.statSync(DB).size + ' bytes)...');
  const raw = await fs.promises.readFile(DB, 'utf8');
  const db = JSON.parse(raw);

  const store = db && db.app_state ? db.app_state : db;
  const users = store[USERS_KEY];
  if (!Array.isArray(users) || users.length === 0) {
    console.error('No users found under ' + USERS_KEY);
    process.exit(1);
  }
  console.log('Found ' + users.length + ' users.');

  console.log('Hashing "' + NEW_PASSWORD + '" (bcrypt, ' + ROUNDS + ' rounds)...');
  const hash = await bcrypt.hash(NEW_PASSWORD, ROUNDS);

  let changed = 0;
  for (const u of users) {
    if (u && typeof u === 'object') {
      u.password = hash;
      changed++;
    }
  }
  console.log('Updated password for ' + changed + ' users.');

  const tmp = DB + '.tmp';
  console.log('Writing DB...');
  await fs.promises.writeFile(tmp, JSON.stringify(db), 'utf8');
  await fs.promises.rename(tmp, DB);
  console.log('Done. All ' + changed + ' accounts now use the new password.');

  // verify one hash round-trips
  const ok = await bcrypt.compare(NEW_PASSWORD, hash);
  console.log('Verify check: ' + (ok ? 'PASS' : 'FAIL'));
})().catch(function (e) {
  console.error('ERROR: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});

