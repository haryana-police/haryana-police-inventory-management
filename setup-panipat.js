'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const quickAccounts = [
  'igkarnal', 'thcpanipat', 'it.staff.panipatdistr', 'mto.staff.panipatdistr',
  'mhcbapoli', 'mhcchandanibagh', 'mhccity', 'mhccybercrime', 'mhcindustrialsec29',
  'mhcisrana', 'mhcmatlauda', 'mhcmodeltown', 'mhcoldindustrial', 'mhcquilla',
  'mhcsadar', 'mhcsamalkha', 'mhcsanoli', 'mhcsector13/17', 'mhctehsilcamp',
  'mhctraffic', 'mhcwomen',
];
const allowed = new Set(['developer', ...quickAccounts]);
const dataDir = path.join(__dirname, 'local-data');
const dbPath = path.join(dataDir, 'db.json');
const envPath = path.join(__dirname, '.env.local');
const original = fs.readFileSync(dbPath, 'utf8');
const db = JSON.parse(original);
const state = db.app_state;
const userKey = 'hp_inventory.users';
const users = state[userKey];
const district = state['hp_inventory.districts'].find(d => d.name === 'Panipat District');
const missing = [...allowed].filter(name => !users.some(user =>
  user.username === name && (name === 'developer' ? user.role === 'devadmin' : district && user.districtId === district.id)));
if (missing.length) {
  throw new Error('Restore the private Panipat database before running setup. Missing accounts: ' + missing.join(', '));
}

function replaceFile(file, content) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, content, { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

const settings = {
  SKIP_DEMO_USER_SYNC: '1',
  SKIP_DISTRICT_STAFF_PROVISION: '1',
  IMS_DEMO_LOGIN: 'local',
};
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const lines = env.split(/\r?\n/).filter(line => !Object.hasOwn(settings, line.split('=')[0].trim()));
const retained = users.filter(user => allowed.has(user.username));
const removedIds = new Set(users.filter(user => !allowed.has(user.username)).map(user => user.id));
state[userKey] = retained;
for (const store of [db, state]) {
  const sessions = store['hp_inventory.sessions'] || {};
  for (const [key, session] of Object.entries(sessions)) {
    if (removedIds.has(session.userId)) delete sessions[key];
  }
}
if (removedIds.size) {
  fs.writeFileSync(path.join(dataDir, 'db-BEFORE-panipat-' + randomUUID() + '.json'), original, { flag: 'wx' });
  replaceFile(dbPath, JSON.stringify(db));
}
replaceFile(envPath, [...lines, ...Object.entries(settings).map(([key, value]) => key + '=' + value), ''].join('\n').trimStart());
console.log(`Retained ${retained.length} accounts, removed ${removedIds.size}. Start the app with npm start.`);
