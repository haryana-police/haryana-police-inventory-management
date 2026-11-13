'use strict';
/* Exports the Panipat inventory catalog (categories + items) from the live
   database into seed/panipat-catalog.json — no users, no passwords, no
   sessions. The file is safe to commit: it holds only stock catalog data. */
const fs = require('node:fs');
const path = require('node:path');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local-data', 'db.json'), 'utf8'));
const state = db.app_state;
const districtId = 'dist_mugr9nwgs812q';

const district = (state['hp_inventory.districts'] || []).find(d => d.id === districtId);
if (!district) throw new Error('Panipat district not found in db.json');

const categories = state['hp_inventory.categories'][districtId] || [];
const items = state['hp_inventory.items'][districtId] || [];
const locations = state['hp_inventory.locations'][districtId] || [];
const hq = locations.find(l => l.type === 'district') || null;

const usedLocIds = [...new Set(items.map(i => i.locationId))];
const usedLocs = locations.filter(l => usedLocIds.includes(l.id));

const out = {
  _comment: 'Panipat inventory catalog — categories + items only. No users, no passwords. Import target must already have the district and the referenced locations.',
  exportedAt: new Date().toISOString(),
  district: { id: district.id, name: district.name, code: district.code || '' },
  hqLocation: hq ? { id: hq.id, name: hq.name, type: hq.type } : null,
  locations: usedLocs.map(l => ({ id: l.id, name: l.name, type: l.type })),
  categories,
  items,
};

const dest = path.join(__dirname, 'panipat-catalog.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log('Wrote', dest);
console.log('categories:', categories.length, '| items:', items.length, '| locations:', usedLocs.length);
