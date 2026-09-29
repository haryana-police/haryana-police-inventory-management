// Adds only the demo ACCOUNTS that are missing from the running database.
// Nothing else is touched.
//
// Why this exists: the server's local-data/db.json is only ever created once,
// and it is never overwritten afterwards. A deployment that started before an
// account was added keeps running the new code against the old data, so the
// account exists in the repository and in db.demo.json but not in the database
// the app actually reads. The demo list then quietly leaves it out, because a
// seed with no matching user is skipped.
//
// This brings the accounts across and leaves every item, allotment, audit entry,
// photograph, session and location exactly where it was. It never edits an
// existing account, never removes one, and never writes any key other than
// hp_inventory.users.
//
//   node merge-demo-users.js            -> reports, changes nothing
//   node merge-demo-users.js --apply    -> makes the change
//
// Stop the server before running --apply, otherwise it holds the document in
// memory and writes the whole thing back, losing this edit.
'use strict';
const fs = require('fs');
const path = require('path');
// bcrypt is only needed if a missing account has no hash at all, which does not
// happen with the bundled demo data. It is loaded lazily so that looking at what
// would change never depends on the node_modules folder being present.

const DIR = path.join(__dirname, 'local-data');
const DB = path.join(DIR, 'db.json');
const DEMO = path.join(DIR, 'db.demo.json');
const USERS = 'hp_inventory.users';
const APPLY = process.argv.indexOf('--apply') >= 0;
const BCRYPT_ROUNDS = 12;

function load(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { doc: doc, state: (doc && doc.app_state) ? doc.app_state : doc };
}

if (!fs.existsSync(DB)) { console.error('no db.json here - is this the server folder?'); process.exit(1); }
if (!fs.existsSync(DEMO)) { console.error('no db.demo.json here - cannot know which accounts are missing'); process.exit(1); }

const real = load(DB);
const demo = load(DEMO);
const have = Array.isArray(real.state[USERS]) ? real.state[USERS] : [];
const wanted = Array.isArray(demo.state[USERS]) ? demo.state[USERS] : [];

const nameOf = (u) => String((u && u.username) || '').trim().toLowerCase();
const present = new Set(have.map(nameOf).filter(Boolean));
const missing = wanted.filter((u) => u && u.username && !present.has(nameOf(u)));

console.log('accounts in this database : ' + have.length);
console.log('accounts in db.demo.json  : ' + wanted.length);
console.log('missing from this database: ' + missing.length);

if (!missing.length) { console.log('\nnothing to add.'); process.exit(0); }
for (const u of missing) {
  console.log('  + ' + u.username + '  (' + (u.role || '?') + ')' + (u.name ? '  ' + u.name : ''));
}

if (!APPLY) {
  console.log('\nDRY RUN. Stop the server, then re-run with --apply.');
  process.exit(0);
}

// A copy of the stored document first. If anything below goes wrong, this is
// the way back.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(DIR, 'db.backup-pre-usermerge-' + stamp + '.json');
fs.writeFileSync(backup, fs.readFileSync(DB));
console.log('\nbackup: ' + path.basename(backup));

(async () => {
  const added = [];
  for (const u of missing) {
    const copy = Object.assign({}, u);
    // The bundled demo accounts carry a bcrypt hash. If one somehow has none it
    // would be an account nobody could sign in to, so it is given the demo
    // password rather than stored unusable.
    if (!copy.password) {
      // eslint-disable-next-line global-require
      const bcrypt = require('bcryptjs');
      copy.password = await bcrypt.hash('demo@123', BCRYPT_ROUNDS);
    }
    added.push(copy);
  }
  real.state[USERS] = have.concat(added);
  fs.writeFileSync(DB, JSON.stringify(real.doc));
  const after = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const n = ((after.app_state || after)[USERS] || []).length;
  console.log('added ' + added.length + ' account(s).');
  console.log('this database now has ' + n + ' accounts.');
  console.log('restart the server. The demo list will include the new ones.');
})().catch((e) => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
