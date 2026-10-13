// One-off: drops sessions that have already expired.
//
// Deleting a session is the same thing as signing out: the token stops
// working. An expired one cannot do anything anyway, since every request is
// checked against its expiry and refused.
//
// The server prunes these one at a time and only for the token that happens to
// be presented (see authFromRequest), so a session is only ever removed when
// its own holder comes back with it. Nobody ever does. That is why 168 of them
// had piled up in the file, and the file is rewritten whole on every save.
//
//   node cleanup-sessions.js [--apply] [--grace-minutes N]
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'local-data');
const DB = path.join(DIR, 'db.json');
const BACKUP = path.join(DIR, 'db.backup-pre-sessionprune.json');
const TOKEN_KEY = 'hp_inventory.sessions';
const APPLY = process.argv.indexOf('--apply') >= 0;

// Stop the server first. It holds the document in memory and writes the whole
// thing back on any change, so an edit made underneath it is simply lost.
const gi = process.argv.indexOf('--grace-minutes');
const GRACE_MIN = gi >= 0 ? Math.max(0, Number(process.argv[gi + 1]) || 0) : 0;
const cutoff = Date.now() - GRACE_MIN * 60 * 1000;

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const state = db.app_state || db;
const sessions = state[TOKEN_KEY] || {};
const keys = Object.keys(sessions);

const expired = [];
const kept = [];
for (const k of keys) {
  const s = sessions[k];
  const msLeft = s ? (Number(s.expiresAt) || 0) - Date.now() : -Infinity;
  (msLeft <= -GRACE_MIN * 60 * 1000 ? expired : kept).push({ k, s, msLeft });
}
expired.sort((a, b) => a.msLeft - b.msLeft);

console.log('sessions: ' + keys.length + '   expired: ' + expired.length + '   still valid: ' + kept.length);
if (GRACE_MIN) console.log('  (a session must be expired by at least ' + GRACE_MIN + ' min)');
if (!expired.length) { console.log('nothing to remove.'); return; }

console.log('\noldest 5 removed (token shown only as a prefix):');
for (const e of expired.slice(0, 5)) {
  console.log('  ' + e.k.slice(0, 10) + '…  ended ' + new Date(e.s.expiresAt).toISOString() + '  (user ' + (e.s.userId || '?') + ')');
}
if (expired.length > 5) console.log('  … and ' + (expired.length - 5) + ' more');

if (!APPLY) { console.log('\nDRY RUN. Stop the server, then re-run with --apply.'); return; }

// Every removed token must belong to a session that is genuinely over, and no
// live session may be in the list. Checked here rather than trusted.
const bad = expired.filter(e => !(e.s && typeof e.s.expiresAt === 'number' && e.s.expiresAt + GRACE_MIN * 60000 < Date.now()));
if (bad.length) { console.log('\nABORT: ' + bad.length + ' session(s) are not actually expired.'); process.exit(1); }
const keptSet = new Set(kept.map(e => e.k));
if (expired.some(e => keptSet.has(e.k))) { console.log('\nABORT: overlap between removed and kept.'); process.exit(1); }

for (const e of expired) delete sessions[e.k];
state[TOKEN_KEY] = sessions;
db.app_state = state;

fs.writeFileSync(BACKUP, fs.readFileSync(DB));
fs.writeFileSync(DB, JSON.stringify(db));
const kb = Math.round(fs.statSync(DB).size / 1024);
console.log('\nremoved ' + expired.length + ' expired session(s).');
console.log('kept ' + kept.length + ' live session(s) - nobody is signed out.');
console.log('backup: local-data/db.backup-pre-sessionprune.json');
console.log('db.json is now ' + kb + ' KB');
