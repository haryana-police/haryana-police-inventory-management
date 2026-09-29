// Restores the password on any account that has lost it.
//
// Ten accounts were left with no password at all. Every account in this
// database is a demo account and they all shared one password, so the repair
// takes each missing hash from the backup taken before the last change rather
// than inventing one, and falls back to that same published demo password for
// an account the backup does not have.
//
//   node repair-missing-passwords.js [--apply]
'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DIR = path.join(__dirname, 'local-data');
const DB = path.join(DIR, 'db.json');
const BACKUP = path.join(DIR, 'db.backup-pre-igfbd.json');
const USERS = 'hp_inventory.users';
const DEMO_PASSWORD = 'hp@123';
const APPLY = process.argv.indexOf('--apply') >= 0;

(async () => {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const state = db.app_state || db;
  const users = state[USERS];
  const missing = users.filter(u => u && !u.password);
  console.log('accounts: ' + users.length + '   without a password: ' + missing.length);
  if (!missing.length) { console.log('nothing to repair.'); return; }

  let backupUsers = [];
  try { backupUsers = (JSON.parse(fs.readFileSync(BACKUP, 'utf8')).app_state || {})[USERS] || []; }
  catch (e) { console.log('no usable backup: ' + e.message); }
  const byId = new Map(backupUsers.map(u => [u.id, u]));

  const fresh = await bcrypt.hash(DEMO_PASSWORD, 12);
  const plan = missing.map(u => {
    const prev = byId.get(u.id);
    return { user: u, hash: (prev && prev.password) ? prev.password : fresh, from: (prev && prev.password) ? 'backup' : 'demo default' };
  });
  for (const p of plan) console.log('  ' + p.user.username + '  <- ' + p.from);
  if (!APPLY) { console.log('\nDRY RUN. Re-run with --apply.'); return; }

  for (const p of plan) p.user.password = p.hash;
  state[USERS] = users;
  fs.writeFileSync(DB, JSON.stringify(db));
  console.log('\nrestored ' + plan.length + ' password(s).');
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
