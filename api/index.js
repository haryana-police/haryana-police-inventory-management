// Local API - Haryana Police Inventory
// Document-store style: the whole app state is stored as one JSON blob
// in a single file (local-data/db.json). This matches how the frontend uses
// localStorage (loadData / saveData with a central JSON cache).
//
// SECURITY:
//  - Passwords are hashed with bcryptjs before storage; plaintext is
//    never persisted and never returned to the browser.
//  - POST /api/auth/login verifies credentials server-side, applies a
//    per-IP rate limit, and returns an opaque session token.
//  - Account-changing writes (users collection alters) require that token.
//  - INVENTORY RBAC: every add/edit/delete of inventory records is authorised
//    server-side (api/_rbac.js) against the session user and the record's
//    stored ownership (locationId / district). Developer Admin is read-only
//    for inventory; everyone else may only modify their OWN unit's records.
//    Unauthorised writes are rejected with 401/403 â€” the UI can be bypassed,
//    this gate cannot.
const { Pool } = require('./_filepool');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { projectStateFor, restoreScopeFor, ITEM_STORE_KEY, diffItemWrites, authorizeItemWrites, authorizeUserCollectionWrite, diffConsumableWrites, authorizeConsumableWrites, diffStructureWrites, authorizeStructureWrites, diffMaintenanceWrites, authorizeMaintenanceWrites, finalizeMaintenanceState, MAINT_KEY_PREFIX } = require('./_rbac');
const pool = new Pool();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// DEMO LOGIN
// One-click sign-in from the login page. The browser sends a USERNAME and
// nothing else: the password is never part of the request, so it can never
// leak through devtools, the page source, or a screenshot of the network tab.
// The session it produces is an ordinary session - createSession() is the same
// call POST /auth/login makes - so every downstream permission check behaves
// exactly as it does for a typed login.
//
// Only accounts whose credentials are already published in this repository's
// seed data are eligible, and only when the caller supplies the correct
// password for that account. The allowlist is therefore not a way into the 34
// real accounts: every other user in the database is unreachable here.
//
// IMS_DEMO_LOGIN=0 turns the whole thing off.
const DEMO_LOGIN_ENABLED = process.env.IMS_DEMO_LOGIN !== '0';

// The seed accounts from DEFAULT_USERS (app.js) plus the fixed district staff
// accounts created by provisionDistrictStaff(). Passwords live here only so the
// server can PROVE the caller is entitled to the account - the browser is
// never sent this table.
// Every demo account shares one published password, so the panel can be handed
// to someone without reading out eight separate credentials. The server still
// proves entitlement by comparing against this table before issuing a session,
// so an account whose password was changed stops being a demo account.
const DEMO_PASSWORD = 'hp@123';
// local-data/db.demo.json - the copy that ships with the project - puts this on
// every account instead, so that a published demo never hands out a password
// that was once a real one. The one-click demo sign-in below has to prove the
// account still holds the password its own database was built with, so it
// accepts the one that matches the database in front of it and not both. A real
// installation still answers to DEMO_PASSWORD alone.
const DEMO_DATA_PASSWORD = 'demo@123';
const DEMO_SEED_ACCOUNTS = [
  'developer', 'admin', 'admin2', 'user', 'fbd_user', 'mhc', 'fbd_mhc', 'station',
  'it.staff.gurugramdist', 'mto.staff.gurugramdist',
  'it.staff.faridabaddis', 'mto.staff.faridabaddis',
  'it.staff.panipatdistr', 'mto.staff.panipatdistr',
  'ig', 'ig.fbd',
].map(username => ({ username, password: DEMO_PASSWORD }));

// A deployment that was started before an account existed never picks it up:
// db.json is written once and not overwritten, so the account is in the
// repository and in the demo copy but not in the file the app reads, and the
// demo list drops it silently. This adds whatever accounts from the demo copy
// are missing - and only those. Placed after DEMO_PASSWORD because that is the
// password the new accounts are hashed with; carried over from the demo copy
// they would be built for demo@123 and a real installation, which answers to
// hp@123, would show the card and then refuse the sign-in.
try { pool.syncDemoAccounts(DEMO_PASSWORD); } catch (e) { console.warn('[demo-sync]', e && e.message); }

// Mirrors ROLE_LABELS in app.js, kept server-side so the demo list is built from
// the same vocabulary the app already uses - no role is invented.
const ROLE_LABELS = {
  devadmin: 'Developer Admin', ig: 'Inspector General', admin: 'District Admin',
  station: 'Station Manager', staff: 'Staff', mhc: 'MHC', tsi: 'TSI', post: 'Police Post',
  user: 'General User', itstaff: 'Computer/IT Staff', mtostaff: 'MTO Staff',
};

// Display order on the login page, and the accent colour each role gets.
const DEMO_ROLE_ORDER = ['devadmin', 'ig', 'admin', 'station', 'user', 'mhc', 'post', 'itstaff', 'mtostaff'];
const DEMO_ROLE_ACCENT = {
  devadmin: 'violet', ig: 'gold', admin: 'blue', station: 'teal', user: 'amber',
  mhc: 'green', post: 'rose', itstaff: 'cyan', mtostaff: 'indigo',
};

function demoSeedFor(username) {
  const u = String(username || '').toLowerCase();
  return DEMO_SEED_ACCOUNTS.find(a => a.username === u) || null;
}

// Builds the card list from accounts that actually exist in the database, so a
// district that was never provisioned simply does not appear. Public fields
// only - no password, ever.
async function listDemoAccounts() {
  const state = await getState();
  const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
  const dists = Array.isArray(state['hp_inventory.districts']) ? state['hp_inventory.districts'] : [];
  const locMap = state['hp_inventory.locations'];
  const distName = id => { const d = dists.find(x => x && x.id === id); return (d && (d.name || d.code)) || ''; };
  const locName = (locId, distId) => {
    const list = (locMap && locMap[distId]) || [];
    const l = Array.isArray(list) ? list.find(x => x && x.id === locId) : null;
    return (l && l.name) || '';
  };
  // A Developer Admin sits at the PHQ and an IG at an IG Range; both live in the
  // state scope rather than under a district, so the card is built from there.
  const hqList = (locMap && locMap.__hq__) || [];
  const hqName = id => { const l = hqList.find(x => x && x.id === id); return (l && l.name) || ''; };
  const rangeNameOf = id => hqName(id);
  const districtsInRange = (rangeId) => dists.filter(d => d && d.rangeId === rangeId);
  const out = [];
  for (const seed of DEMO_SEED_ACCOUNTS) {
    const u = users.find(x => x && String(x.username || '').toLowerCase() === seed.username);
    if (!u) continue;
    const role = u.role || 'user';
    out.push({
      username: u.username,
      name: u.name || u.username,
      role: role,
      roleLabel: ROLE_LABELS[role] || role,
      accent: DEMO_ROLE_ACCENT[role] || 'blue',
      // a state-level role is placed at the PHQ or an IG Range, not a district
      district: u.locationType === 'phq' || u.locationType === 'igRange' ? '' : distName(u.districtId),
      location: u.locationType === 'phq' || u.locationType === 'igRange' ? hqName(u.locationId) : locName(u.locationId, u.districtId),
      locationType: u.locationType || null,
      range: u.rangeId ? rangeNameOf(u.rangeId) : null,
      // Which districts this account may actually open. The stored districtIds
      // are the authority - they are what the RBAC check reads - so they are
      // used first. The range is only a fallback for an IG whose districtIds
      // were never filled in. Reading the range first, as this used to, showed
      // an account districts it has no permission for: two IGs can sit on one
      // range while each answers for a different district, and the card then
      // promised the one that was not theirs.
      districts: Array.isArray(u.districtIds) && u.districtIds.length
        ? u.districtIds.map(distName).filter(Boolean)
        : (u.role === 'ig' && u.rangeId
          ? districtsInRange(u.rangeId).map(d => d.name).filter(Boolean)
          : null),
      initials: String(u.name || u.username).trim().charAt(0).toUpperCase(),
    });
  }
  out.sort((a, b) => {
    const d = DEMO_ROLE_ORDER.indexOf(a.role) - DEMO_ROLE_ORDER.indexOf(b.role);
    return d !== 0 ? d : String(a.name).localeCompare(String(b.name));
  });
  return out;
}

// ---- rate limiting (per serverless instance; fine for this scale) ----
const loginAttempts = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  return rec.count >= 10;
}
function recordFailure(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  rec.count += 1;
  loginAttempts.set(ip, rec);
}
function resetFailures(ip) {
  loginAttempts.delete(ip);
}
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

// ---- session helpers ----
const TOKEN_KEY = 'hp_inventory.sessions';
/* IMS Agent: read-only state accessor for session lookup */
let __imsStateRef = null;
async function __imsRefreshRef() { try { __imsStateRef = await getState(); } catch (e) {} }
process.nextTick(function () { __imsRefreshRef(); });
global.__imsGetState = function () { return __imsStateRef; };
const SCAN_FILES_PREFIX = 'hp_inventory.scan_files.';

async function getState() {
  const { rows } = await pool.query('SELECT data FROM app_state WHERE id=1');
  return rows.length ? rows[0].data : {};
}
async function setState(data) {
  await pool.query(
    `INSERT INTO app_state (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(data)]
  );
}

function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

// Self-healing: every district always has its fixed staff accounts and
// default staff locations (Computer/IT Staff + MTO Staff). Idempotent â€”
// returns true when anything was created or linked.
function provisionDistrictStaff(state) {
  const dists = Array.isArray(state['hp_inventory.districts']) ? state['hp_inventory.districts'] : [];
  const provision = (distId) => {
    if (!distId) return false;
    const d = dists.find(x => x && x.id === distId);
    const slug = String((d && d.name) || distId).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || String(distId).toLowerCase().replace(/[^a-z0-9]+/g, '');
    let changed = false;
    const list = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
    // locations are stored per district: { [districtId]: [loc...] }
    const locMap = (state['hp_inventory.locations'] && typeof state['hp_inventory.locations'] === 'object' && !Array.isArray(state['hp_inventory.locations'])) ? state['hp_inventory.locations'] : {};
    const locs = Array.isArray(locMap[distId]) ? locMap[distId].slice() : [];
    const defs = [
      { role: 'itstaff', name: 'Computer/IT Staff', uname: 'it.staff.' + slug, locId: 'staff_it_' + distId },
      { role: 'mtostaff', name: 'MTO Staff', uname: 'mto.staff.' + slug, locId: 'staff_mto_' + distId },
    ];
    for (const def of defs) {
      // Default staff location in the district's location list.
      if (!locs.some(l => l && l.id === def.locId)) {
        locs.push({ id: def.locId, name: def.name, type: 'staff', districtId: distId });
        changed = true;
      }
      if (!list.some(u => u && u.role === def.role && u.districtId === distId)) {
        list.push({ id: 'us_' + crypto.randomBytes(8).toString('hex'), username: def.uname, name: def.name, role: def.role, districtId: distId, locationId: def.locId, mobile: '', password: DEMO_PASSWORD, active: true, createdAt: Date.now() });
        changed = true;
      }
      for (const u of list) {
        if (u && u.role === def.role && u.districtId === distId && u.locationId !== def.locId) { u.locationId = def.locId; changed = true; }
      }
    }
    if (changed) {
      state['hp_inventory.users'] = list;
      locMap[distId] = locs;
      state['hp_inventory.locations'] = locMap;
    }
    return changed;
  };
  let touched = false;
  for (const d of dists) { if (d && provision(d.id)) touched = true; }
  return touched;
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const state = await getState();
  const sessions = state[TOKEN_KEY] || {};
  sessions[hash] = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  state[TOKEN_KEY] = sessions;
  await setState(state);
  return token;
}

async function destroySession(token) {
  if (!token) return;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const state = await getState();
  const sessions = state[TOKEN_KEY] || {};
  if (sessions[hash]) {
    delete sessions[hash];
    state[TOKEN_KEY] = sessions;
    await setState(state);
  }
}

// Validates the Authorization: Bearer token; prunes expired sessions.
async function authFromRequest(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { user: null };
  const token = m[1].trim();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const state = await getState();
  const sessions = state[TOKEN_KEY] || {};
  const sess = sessions[hash];
  if (!sess) return { user: null };
  if (Date.now() > sess.expiresAt) {
    delete sessions[hash];
    state[TOKEN_KEY] = sessions;
    await setState(state);
    return { user: null };
  }
  const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
  const user = users.find(u => u.id === sess.userId) || null;
  return { user };
}

// ============================================================
// REALTIME EVENT SYSTEM
// ============================================================
// Events are derived on the server by diffing the previous stored state
// against every `/api/state` write (document-store model). Each event is
// dedupe-keyed and written to `rt_events`; a pg LISTEN/NOTIFY channel
// wakes connected long-polls so delivery is push-based and near-instant.
const RT_CHANNEL = 'hp_rt';
const RT_MAX_HOLD_MS = 2000;

function sleep(ms) { return new Promise(r => setTimeout(r, Math.max(0, ms))); }

// RBAC visibility: only users the event targets (or their district/role
// scope) may receive it. Anonymous requests see nothing.
function rtVisible(user, scope) {
  if (!user) return false;
  if (user.role === 'devadmin') return true;
  scope = scope || {};
  if (scope.users && Array.isArray(scope.users) && scope.users.includes(user.id)) return true;
  const dists = Array.isArray(scope.districts) ? scope.districts : [];
  if (dists.length && !dists.includes(user.districtId)) return false;
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.length && !roles.includes(user.role)) return false;
  const locs = Array.isArray(scope.locations) ? scope.locations : [];
  if (locs.length && user.locationId && !locs.includes(user.locationId)) return false;
  return true;
}

async function rtFetch(afterId, user, limit) {
  const { rows } = await pool.query(
    `SELECT id, type, title, message, scope, payload, created_at
     FROM rt_events WHERE id > $1 ORDER BY id LIMIT $2`,
    [Number(afterId) || 0, limit || 200]
  );
  const out = [];
  for (const r of rows) {
    if (!rtVisible(user, r.scope)) continue;
    out.push({ id: Number(r.id), type: r.type, title: r.title, message: r.message, scope: r.scope || {}, payload: r.payload || {}, createdAt: Number(r.created_at) });
  }
  return out;
}

async function rtPublish(events) {
  if (!events || !events.length) return;
  const client = await pool.connect();
  try {
    for (const ev of events) {
      await client.query(
        `INSERT INTO rt_events (type, title, message, scope, payload, dedupe, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (dedupe) DO NOTHING`,
        [ev.type, ev.title, ev.message, JSON.stringify(ev.scope || {}), JSON.stringify(ev.payload || {}), ev.dedupe || null, Date.now()]
      );
    }
    await client.query('SELECT pg_notify($1, $2)', [RT_CHANNEL, 'new']);
  } finally {
    client.release();
  }
}

function rtDemandScope(d, fromDist) {
  const scope = { districts: [fromDist, d.demandToDistrict].filter(Boolean) };
  if (d.requestedFromLocation) scope.locations = [d.requestedFromLocation];
  return scope;
}


// Derives realtime events by comparing the previous and incoming state blobs.
function rtDiffState(prev, next) {
  const events = [];
  const locsAll = next['hp_inventory.locations'] || {};
  const dists = Array.isArray(next['hp_inventory.districts']) ? next['hp_inventory.districts'] : [];
  const distName = (id) => { const d = dists.find(x => x.id === id); return d ? d.name : (id || ''); };
  const locName = (id) => {
    if (!id) return '';
    for (const arr of Object.values(locsAll)) {
      const l = (arr || []).find(x => x.id === id);
      if (l) return l.name;
    }
    return id;
  };

  // --- users / roles ---
  const pu = Array.isArray(prev['hp_inventory.users']) ? prev['hp_inventory.users'] : [];
  const nu = Array.isArray(next['hp_inventory.users']) ? next['hp_inventory.users'] : [];
  const pub = new Map(pu.map(u => [u.id, u]));
  for (const u of nu) {
    const o = pub.get(u.id);
    if (!o) {
      events.push({
        type: 'USER_CREATED', title: 'New User',
        message: `New user "${u.name || u.username}" (${u.role || 'user'}) created in ${distName(u.districtId)}.`,
        scope: { districts: [u.districtId], roles: ['admin', 'devadmin'] }, payload: { userId: u.id },
        dedupe: 'user:' + u.id,
      });
    } else if ((o.role && o.role !== u.role) || (o.active !== undefined && o.active !== u.active)) {
      events.push({
        type: 'ROLE_UPDATED', title: 'User / Role Updated',
        message: `${u.name || u.username}'s role changed to ${u.role}.`,
        scope: { districts: [u.districtId], roles: ['admin', 'devadmin'] }, payload: { userId: u.id },
        dedupe: 'user:' + u.id + ':role:' + (o.role || '') + '->' + (u.role || ''),
      });
    }
  }

  // --- access requests ---
  const pa = Array.isArray(prev['hp_inventory.accessRequests']) ? prev['hp_inventory.accessRequests'] : [];
  const na = Array.isArray(next['hp_inventory.accessRequests']) ? next['hp_inventory.accessRequests'] : [];
  const pab = new Map(pa.map(a => [a.id, a]));
  for (const a of na) {
    const o = pab.get(a.id);
    const locTxt = a.locationId ? `, ${locName(a.locationId)}` : '';
    if (!o) {
      events.push({
        type: 'ACCESS_REQUEST_CREATED', title: 'Access Request',
        message: `${a.name} (${a.post || 'Officer'}, ${distName(a.districtId)}${locTxt}) requested ${a.userType || 'user'} access.`,
        scope: { districts: [a.districtId], roles: ['admin', 'devadmin'] }, payload: { requestId: a.id },
        dedupe: 'access:' + a.id,
      });
    } else if (o.status !== a.status) {
      const ok = a.status === 'approved';
      events.push({
        type: ok ? 'ACCESS_REQUEST_APPROVED' : 'ACCESS_REQUEST_REJECTED',
        title: ok ? 'Access Approved' : 'Access Rejected',
        message: `${a.name}'s access request was ${ok ? 'approved' : 'rejected'} by the administrator.`,
        scope: { districts: [a.districtId], roles: ['admin', 'devadmin'] }, payload: { requestId: a.id },
        dedupe: 'access:' + a.id + ':' + a.status,
      });
    }
  }

  // --- demands (per-district stores) ---
  for (const key of Object.keys(next)) {
    if (key.indexOf('hp_inventory.demands_') !== 0) continue;
    const distId = key.slice('hp_inventory.demands_'.length);
    const oldList = Array.isArray(prev[key]) ? prev[key] : [];
    const newList = Array.isArray(next[key]) ? next[key] : [];
    const oldById = new Map(oldList.map(d => [d.id, d]));
    for (const d of newList) {
      const o = oldById.get(d.id);
      const itemTxt = `${d.quantity} x ${d.itemName}`;
      if (!o) {
        events.push({
          type: 'DEMAND_CREATED', title: 'New Demand Request',
          message: `${d.requestedBy || 'A user'} submitted a demand for ${itemTxt} to ${d.demandToDistrictName || distName(d.demandToDistrict || distId)}.`,
          scope: rtDemandScope(d, distId), payload: { demandId: d.id },
          dedupe: 'demand:' + d.id,
        });
      } else if (o.status !== d.status) {
        const map = { approved: 'DEMAND_APPROVED', rejected: 'DEMAND_REJECTED', issued: 'DEMAND_ISSUED', completed: 'DEMAND_COMPLETED', pending: 'DEMAND_UPDATED', pending_review: 'DEMAND_AWAITING_REVIEW' };
        const evType = map[d.status] || 'DEMAND_UPDATED';
        events.push({
          type: evType,
          title: evType === 'DEMAND_APPROVED' ? 'Demand Approved' : evType === 'DEMAND_REJECTED' ? 'Demand Rejected' : 'Demand Status Changed',
          message: evType === 'DEMAND_REJECTED'
            ? `Demand for ${itemTxt} was rejected. Reason: ${d.rejectionReason || d.actionRemarks || 'Not available'}`
            : `Demand for ${itemTxt} is now ${d.status}${d.demandToDistrictName ? ' by ' + d.demandToDistrictName : ''}.`,
          scope: rtDemandScope(d, distId), payload: { demandId: d.id },
          dedupe: 'demand:' + d.id + ':' + d.status,
        });
      }
    }
  }


  // --- distributions (per-district stores) ---
  for (const key of Object.keys(next)) {
    if (key.indexOf('hp_inventory.distributions_') !== 0) continue;
    const fromDist = key.slice('hp_inventory.distributions_'.length);
    const oldList = Array.isArray(prev[key]) ? prev[key] : [];
    const newList = Array.isArray(next[key]) ? next[key] : [];
    const oldById = new Map(oldList.map(d => [d.id, d]));
    for (const d of newList) {
      const o = oldById.get(d.id);
      const itemsTxt = (Array.isArray(d.items) ? d.items : []).map(it => `${it.qty || 0} x ${it.itemName || ''}`).join(', ');
      const toTxt = d.toName || distName(d.toDistrictId || fromDist);
      const scopeDistricts = [fromDist, d.toDistrictId].filter(Boolean);
      const scopeLocs = [d.toLocationId, d.fromLocationId].filter(Boolean);
      if (!o) {
        events.push({
          type: 'DISTRIBUTION_CREATED', title: 'New Distribution',
          message: `${d.fromUserName || 'A user'} distributed ${itemsTxt} to ${toTxt}.`,
          scope: { districts: scopeDistricts, locations: scopeLocs },
          payload: { distributionId: d.id, fromDistrictId: fromDist, toDistrictId: d.toDistrictId },
          dedupe: 'distribution:' + d.id,
        });
      } else if (o.status !== d.status) {
        const evType = d.status === 'completed' ? 'DISTRIBUTION_APPROVED' : d.status === 'rejected' ? 'DISTRIBUTION_REJECTED' : null;
        if (evType) {
          events.push({
            type: evType,
            title: evType === 'DISTRIBUTION_APPROVED' ? 'Distribution Approved' : 'Distribution Rejected',
            message: evType === 'DISTRIBUTION_APPROVED'
              ? `Distribution of ${itemsTxt} to ${toTxt} was approved by ${d.approvedByName || 'the receiving unit'}.`
              : `Distribution of ${itemsTxt} to ${toTxt} was rejected. Reason: ${d.rejectRemark || d.actionRemarks || 'Not accepted'}`,
            scope: { districts: scopeDistricts, locations: scopeLocs },
            payload: { distributionId: d.id, fromDistrictId: fromDist, toDistrictId: d.toDistrictId },
            dedupe: 'distribution:' + d.id + ':' + d.status,
          });
        }
      }
    }
  }

  // --- maintenance requests (per-district stores, mirror of the demand
  // gate's scope so the receiving admin + the requesting unit both see it) ---
  for (const key of Object.keys(next)) {
    if (key.indexOf('hp_inventory.maintenance_') !== 0) continue;
    const mDistId = key.slice('hp_inventory.maintenance_'.length);
    const mOldList = Array.isArray(prev[key]) ? prev[key] : [];
    const mNewList = Array.isArray(next[key]) ? next[key] : [];
    const mOldById = new Map(mOldList.map(m => [m.id, m]));
    for (const m of mNewList) {
      const mo = mOldById.get(m.id);
      const unitTxt = m.requestingUnitName || (m.requestingUnitId ? locName(m.requestingUnitId) : 'A unit');
      const mTypeTxt = (m.maintenanceType === 'other' && m.customType) ? m.customType
        : (m.maintenanceType || 'Maintenance');
      const mDateTxt = m.requestedDate ? new Date(m.requestedDate).toLocaleDateString() : '';
      if (!mo) {
        events.push({
          type: 'MAINTENANCE_CREATED', title: 'New Maintenance Request',
          message: `${unitTxt} raised a maintenance request: ${mTypeTxt}${mDateTxt ? ` (scheduled ${mDateTxt})` : ''}.`,
          scope: { districts: [m.districtId || mDistId], locations: [m.requestingUnitId].filter(Boolean) },
          payload: { maintenanceId: m.id },
          dedupe: 'maint:' + m.id,
        });
      } else if (mo.status !== m.status) {
        const map = { 'pending->under_process': 'MAINTENANCE_PROCESSED', 'under_process->completed': 'MAINTENANCE_COMPLETED' };
        const oTrans = mo.status + '->' + m.status;
        const evType = map[oTrans];
        if (evType) {
          events.push({
            type: evType,
            title: evType === 'MAINTENANCE_COMPLETED' ? 'Maintenance Completed' : 'Maintenance Under Process',
            message: evType === 'MAINTENANCE_COMPLETED'
              ? `${m.completedByName || unitTxt} confirmed ${mTypeTxt} work as complete.`
              : `${m.processedByName || 'The district admin'} started work on ${mTypeTxt} for ${unitTxt}.`,
            scope: { districts: [m.districtId || mDistId], locations: [m.requestingUnitId].filter(Boolean) },
            payload: { maintenanceId: m.id },
            dedupe: 'maint:' + m.id + ':' + m.status,
          });
        }
      }
    }
  }

  // --- low stock alerts (only when an item crosses into low) ---
  const oldItems = prev['hp_inventory.items'] || {};
  const newItems = next['hp_inventory.items'] || {};
  for (const distId of Object.keys(newItems)) {
    const oldArr = Array.isArray(oldItems[distId]) ? oldItems[distId] : [];
    const newArr = Array.isArray(newItems[distId]) ? newItems[distId] : [];
    const oldById = new Map(oldArr.map(i => [i.id, i]));
    for (const i of newArr) {
      const o = oldById.get(i.id);
      if (!o) continue;
      const wasLow = (o.quantity || 0) <= (o.minStock || 0);
      const isLow = (i.quantity || 0) <= (i.minStock || 0);
      if (!wasLow && isLow) {
        events.push({
          type: 'LOW_STOCK_ALERT', title: 'Low Stock Alert',
          message: `${i.quantity} units of ${i.name} remaining. Minimum threshold: ${i.minStock || 0}${i.unit ? ' ' + i.unit : ''}.`,
          scope: { districts: [distId] }, payload: { itemId: i.id },
          dedupe: 'lowstock:' + distId + ':' + i.id + ':' + i.quantity,
        });
      }
    }
  }

  return events;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try { return await route(req, res); } catch (e) { console.error(e); return res.status(500).json({ error: e.message }); }
};

async function route(req, res) {
  let path = req.query.path || [];
  if (!Array.isArray(path)) path = [path];
  // The path may arrive as a joined string ("auth,login" or "auth/login");
  // normalise both into segment arrays.
  const seg = [];
  for (const p of path) {
    for (const part of String(p).split(/[/,]/)) {
      if (part) seg.push(decodeURIComponent(part));
    }
  }
  const body = req.body || {};
  const p0 = seg[0];

  // ensure tables exist
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, data JSONB NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rt_events (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    scope JSONB NOT NULL DEFAULT '{}',
    payload JSONB,
    dedupe TEXT UNIQUE,
    created_at BIGINT NOT NULL
  )`);

  // Self-heal legacy plaintext passwords before handling any request.
  await sweepPlaintextPasswords();
  // And collapse any duplicate user rows before one can be written back.
  // Order matters: hashing runs first so the rows that are about to be
  // compared already carry their final stored form.
  await sweepDuplicateUsers();

  // ---------- IMS AGENT ----------
  if (p0 === 'agent' && req.method === 'POST') {
    try { await __imsRefreshRef(); } catch (e) {}
    return await require('./agent.js').handleAgent(req, res, body);
  }

  // ---------- HEALTH ----------
  if (p0 === 'health') {
    if (body.key === 'hp_inventory.districts' || body.key === 'hp_inventory.locations' || body.key === 'hp_inventory.users') {
      const { user: sUser } = await authFromRequest(req);
      if (!sUser) return res.status(401).json({ error: 'Not authenticated' });
      const stateNow = await getState();
      const nextSt = Object.assign({}, stateNow);
      nextSt[body.key] = body.value;
      const sv = authorizeStructureWrites(
        { id: sUser.id, username: sUser.username, role: sUser.role, locationId: sUser.locationId, districtId: sUser.districtId },
        stateNow, nextSt
      );
      if (sv && sv.ok !== true) {
        console.warn('[rbac] structure key-write denied:', sUser.username + ' (' + sUser.role + ')', JSON.stringify({ code: sv.code, error: sv.error }));
        return res.status(sv.status || 403).json({ error: sv.error, code: sv.code || 'RBAC_STRUCT_FORBIDDEN' });
      }
    }
    const state = await getState();
    const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
    const bcryptHashed = users.filter(u => typeof u.password === 'string' && u.password.startsWith('$2')).length;
    return res.json({
      ok: true,
      db: 'filedb',
      users: users.length,
      bcryptHashed,
      passwordsAllHashed: users.length > 0 && bcryptHashed === users.length,
      bcryptRounds: BCRYPT_ROUNDS,
      rateLimit: '10 failed attempts / 15 min / IP',
      sessions: 'sha256 hashed tokens, 12h TTL'
    });
  }

  // ---------- LOGIN ----------
  if (p0 === 'auth' && seg[1] === 'login') {
    const ip = clientIp(req);
    if (rateLimited(ip)) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    const { username, password } = body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    const state = await getState();
    const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
    const user = users.find(u => u.username && u.username.toLowerCase() === String(username).toLowerCase());

    if (!user || !user.password) {
      recordFailure(ip);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Legacy support + migration: if the stored value isn't a bcrypt hash,
    // compare in plaintext and upgrade it to a hash on success.
    let ok;
    if (user.password.startsWith('$2')) {
      ok = await bcrypt.compare(String(password), user.password);
    } else {
      ok = user.password === String(password);
      if (ok) {
        user.password = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
        await setState(state);
      }
    }
    if (!ok) {
      recordFailure(ip);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    resetFailures(ip);
    // Auto-provision the fixed district staff accounts (Computer/IT + MTO).
    try { if (provisionDistrictStaff(state)) await setState(state); } catch (e) { console.warn('[staff-provision]', e && e.message); }
    const token = await createSession(user.id);
    return res.json({ ok: true, token, user: publicUser(user) });
  }

  // ---------- DEMO ACCOUNTS (list) ----------
  // Read-only: tells the login page which cards to draw. Returns no
  // password and no user id, so it cannot be used to log in.
  if (p0 === 'auth' && seg[1] === 'demo-users') {
    if (!DEMO_LOGIN_ENABLED) return res.status(404).json({ error: 'Demo login is disabled on this server' });
    try {
      return res.json({ ok: true, enabled: true, accounts: await listDemoAccounts() });
    } catch (e) {
      console.error('[demo-users]', e && e.message);
      return res.status(500).json({ error: 'Could not load demo accounts' });
    }
  }

  // ---------- DEMO LOGIN (one click) ----------
  // The request carries a username only. Entitlement is proven here by the
  // server against its own seed table, and the resulting session is created
  // by the same createSession() the normal login uses, so nothing downstream
  // can tell a demo session from a typed one - RBAC still applies in full.
  if (p0 === 'auth' && seg[1] === 'demo') {
    const ip = clientIp(req);
    if (!DEMO_LOGIN_ENABLED) return res.status(404).json({ error: 'Demo login is disabled on this server' });
    if (rateLimited(ip)) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    const { username } = body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const seed = demoSeedFor(username);
    if (!seed) {
      recordFailure(ip);
      return res.status(403).json({ error: 'That account is not available as a demo account' });
    }
    const state = await getState();
    const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
    const user = users.find(u => u && String(u.username || '').toLowerCase() === seed.username);
    if (!user) {
      recordFailure(ip);
      return res.status(404).json({ error: 'That demo account no longer exists' });
    }
    // Prove the account still holds the password its own database was built
    // with. If somebody changed it, the demo card is refused rather than
    // becoming a silent bypass. Which password that is depends on the database:
    // the bundled demo copy carries demo@123 and says so in its own state, a
    // real installation carries the published demo password. Exactly one of the
    // two is ever accepted, so this is not a wider door than before.
    const isDemoData = state['hp_inventory.isDemoData'] === true;
    const expected = isDemoData ? DEMO_DATA_PASSWORD : DEMO_PASSWORD;
    let ok = false;
    if (user.password && String(user.password).startsWith('$2')) {
      ok = await bcrypt.compare(expected, user.password);
    } else {
      ok = user.password === expected;
    }
    if (!ok) {
      recordFailure(ip);
      return res.status(403).json({ error: 'This demo account is not available. Sign in with your password.' });
    }
    resetFailures(ip);
    const token = await createSession(user.id);
    return res.json({ ok: true, token, user: publicUser(user), demo: true });
  }

  // ---------- LOGOUT ----------
  if (p0 === 'auth' && seg[1] === 'logout') {
    const header = req.headers['authorization'] || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (m) await destroySession(m[1].trim());
    return res.json({ ok: true });
  }

  // ---------- VERIFY SESSION ----------
  if (p0 === 'auth' && seg[1] === 'me') {
    const { user } = await authFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    return res.json({ ok: true, user: publicUser(user) });
  }

  // ---------- ALLOTMENT / STOCK INVARIANTS ----------
function validateAllocState(state) {
  const items = state['hp_inventory.items'];
  if (items && typeof items === 'object') {
    for (const dist of Object.values(items)) {
      if (!Array.isArray(dist)) continue;
      for (const i of dist) {
        const q = i.quantity || 0;
        const al = i.allotted || 0;
        const dmg = i.damagedReturned || 0;
        const lost = i.lostReturned || 0;
        if (!Number.isFinite(q) || q < 0 || al < 0 || dmg < 0 || lost < 0) {
          return `Negative quantity not allowed for item "${(i.name || '')}"`;
        }
        if (al + dmg + lost > q) {
          return `Available quantity cannot go negative for item "${(i.name || '')}"`;
        }
      }
    }
  }
  const allots = state['hp_inventory.allotments'];
  if (Array.isArray(allots)) {
    for (const a of allots) {
      const allotted = a.qtyAllotted || 0;
      const returned = a.qtyReturned || 0;
      const lost = a.qtyLost || 0;
      const recovered = a.qtyRecovered || 0;
      if (!Number.isFinite(allotted) || !Number.isFinite(returned) || !Number.isFinite(lost) || !Number.isFinite(recovered) || allotted < 0 || returned < 0 || lost < 0 || recovered < 0) {
        return 'Allotment quantities must be non-negative numbers';
      }
      if (returned + lost > allotted) {
        return `Returned + lost quantity (${returned + lost}) exceeds allotted quantity (${allotted}) for allotment "${a.id}"`;
      }
      if (recovered > lost) {
        return `Recovered quantity (${recovered}) exceeds lost quantity (${lost}) for allotment "${a.id}"`;
      }
    }
  }
  return null;
}

  // ---------- LOAD FULL STATE ----------
  if (p0 === 'state' && req.method === 'GET') {
    const state = await getState();
    // Self-heal: make sure every district has its fixed staff accounts and
    // default staff locations (Computer/IT Staff + MTO Staff). Idempotent.
    try { if (provisionDistrictStaff(state)) await setState(state); } catch (e) { console.warn('[staff-provision]', e && e.message); }
    // A read used to be answered with the whole document to anyone holding a
    // session, so an Inspector General's browser was carrying the districts it
    // has no business seeing. The caller is resolved first so the answer can be
    // narrowed to the districts they are entitled to; an unknown caller is
    // refused rather than trusted, and a Developer Admin - who is entitled to
    // every district - still receives the whole document.
    const { user: stateUser } = await authFromRequest(req);
    if (!stateUser) return res.status(401).json({ error: 'Sign in required', code: 'AUTH_REQUIRED' });
    const scoped = projectStateFor(stateUser, state);
    const publicState = {};
    for (const [k, v] of Object.entries(scoped)) {
      if (k === TOKEN_KEY) continue;
      if (k.indexOf(SCAN_FILES_PREFIX) === 0) continue; // scan files stay out of full state
      if (k === 'hp_inventory.users' && Array.isArray(v)) {
        publicState[k] = v.map(publicUser).filter(Boolean);
        continue;
      }
      publicState[k] = v;
    }
    return res.json(publicState);
  }

  // ---------- WRITE-INTENT AUTH GATE ----------
  // Every write that could alter the `users` collection (or the token map)
  // must present a valid session token. Writes that do not touch users are
  // allowed unauth for backward compat (document-store model), but we still
  // sanitise any passwords present before persisting.
  if (p0 === 'state' && req.method === 'POST') {
    if (!body.state) return res.status(400).json({ error: 'state required' });
    const current = await getState();
    // The client posts the whole document back, and a client that was only
    // shown its own districts is therefore posting a document that is missing
    // everyone else's. Put those parts back before anything is diffed, so that
    // being unable to see a district also means being unable to erase it. A
    // Developer Admin is shown everything, so nothing is restored and the
    // document is written exactly as it was sent.
    const { user: writeUser } = await authFromRequest(req);
    let incoming = restoreScopeFor(writeUser, current, body.state);
    body.state = incoming;
    const currentUsers = Array.isArray(current['hp_inventory.users']) ? current['hp_inventory.users'] : [];
    const incomingUsers = Array.isArray(incoming['hp_inventory.users']) ? incoming['hp_inventory.users'] : [];
    // Only account mutations require a session. If the users collection is
    // unchanged (plain writes of inventory data, request-access, etc.), the
    // write proceeds without auth, matching the doc-store model.
    const usersChanged = !usersEqual(incomingUsers, currentUsers);
    if (usersChanged) {
      // Users-collection RBAC: identity comes from the session token, never
      // the payload. devadmin manages everyone; district admins may only
      // manage accounts inside their own district and cannot assign admin
      // roles; everyone else is denied.
      const { user: ucUser } = await authFromRequest(req);
      const ucVerdict = authorizeUserCollectionWrite(
        // districtIds must travel with the session user: it is what scopes an
        // Inspector General, and leaving it out would silently empty their reach.
        ucUser ? { id: ucUser.id, username: ucUser.username, role: ucUser.role, districtId: ucUser.districtId, districtIds: ucUser.districtIds } : null,
        currentUsers,
        incomingUsers
      );
      if (ucVerdict) {
        console.warn('[rbac] users write denied:',
          ucUser ? `${ucUser.username} (${ucUser.role})` : 'anonymous');
        return res.status(ucVerdict.status).json({
          error: ucVerdict.error,
          code: ucVerdict.code,
          detail: ucVerdict.detail || null,
        });
      }
    }
    // RBAC GATE (inventory): the client sends its whole state blob, so the
    // server diffs the stored items against the incoming ones and authorises
    // every add/edit/delete against the SESSION user â€” never the payload.
    // Identity, role and unit all come from the token; ownership comes from
    // the previously stored record. 403 on any violation.
    const { user: rbacUser } = await authFromRequest(req);
    const rbacVerdict = authorizeItemWrites(
      rbacUser ? { id: rbacUser.id, username: rbacUser.username, role: rbacUser.role, locationId: rbacUser.locationId, districtId: rbacUser.districtId, districtIds: rbacUser.districtIds } : null,
      diffItemWrites(current, incoming),
      { freshInstall: currentUsers.length === 0, prevState: current, nextState: incoming }
    );
    if (!rbacVerdict.ok) {
      console.warn('[rbac] inventory write denied:',
        rbacUser ? `${rbacUser.username} (${rbacUser.role})` : 'anonymous',
        JSON.stringify(rbacVerdict.detail));
      return res.status(rbacVerdict.status).json({
        error: rbacVerdict.error,
        code: rbacVerdict.code,
        detail: rbacVerdict.detail,
      });
    }
    // RBAC GATE (consumables): district-scoped, immutable one-way ledger.
    const consVerdict = authorizeConsumableWrites(
      rbacUser ? { id: rbacUser.id, username: rbacUser.username, role: rbacUser.role, locationId: rbacUser.locationId, districtId: rbacUser.districtId, districtIds: rbacUser.districtIds } : null,
      diffConsumableWrites(current, incoming),
      { prevState: current, nextState: incoming }
    );
    if (consVerdict && consVerdict.ok !== true) {
      console.warn('[rbac] consumable write denied:', rbacUser ? `${rbacUser.username} (${rbacUser.role})` : 'anonymous', JSON.stringify(consVerdict.detail));
      return res.status(consVerdict.status || 403).json({ error: consVerdict.error, code: consVerdict.code || 'RBAC_CONS_FORBIDDEN', detail: consVerdict.detail || null });
    }
    // RBAC GATE (structure): districts / locations / users management.
    const structVerdict = authorizeStructureWrites(
      rbacUser ? { id: rbacUser.id, username: rbacUser.username, role: rbacUser.role, locationId: rbacUser.locationId, districtId: rbacUser.districtId, districtIds: rbacUser.districtIds } : null,
      current, incoming
    );
    if (structVerdict && structVerdict.ok !== true) {
      console.warn('[rbac] structure write denied:', rbacUser ? rbacUser.username + ' (' + rbacUser.role + ')' : 'anonymous', JSON.stringify({ code: structVerdict.code, error: structVerdict.error }));
      return res.status(structVerdict.status || 403).json({ error: structVerdict.error, code: structVerdict.code || 'RBAC_STRUCT_FORBIDDEN' });
    }
    // RBAC GATE (maintenance).
    // This gate was written but never called, which meant every rule in it -
    // no deleting a request, no raising one for another unit, no forging a
    // history, no jumping a status, and the District Admin type limit - was
    // enforced by the form alone. The form is a convenience: a request posted
    // straight at this endpoint went through, because nothing here looked at
    // it. It is placed with the other gates, before anything is written, and it
    // sees the SAME user object they do, so a role the form does not offer
    // cannot be used to slip past.
    const maintVerdict = authorizeMaintenanceWrites(
      rbacUser ? { id: rbacUser.id, username: rbacUser.username, role: rbacUser.role, locationId: rbacUser.locationId, districtId: rbacUser.districtId, districtIds: rbacUser.districtIds } : null,
      diffMaintenanceWrites(current, incoming)
    );
    if (maintVerdict && maintVerdict.ok !== true) {
      console.warn('[rbac] maintenance write denied:', rbacUser ? rbacUser.username + ' (' + rbacUser.role + ')' : 'anonymous', JSON.stringify({ code: maintVerdict.code, error: maintVerdict.error }));
      return res.status(maintVerdict.status || 403).json({ error: maintVerdict.error, code: maintVerdict.code || 'RBAC_MAINT_FORBIDDEN', detail: maintVerdict.detail || null });
    }
    // The history and the actor fields on a maintenance record are the server's
    // to write, not the client's. Rebuilt here from what was just authorised, so
    // a request cannot arrive with a history that says somebody else did it.
    const incomingFinal = finalizeMaintenanceState(
      rbacUser ? { username: rbacUser.username, name: rbacUser.name } : null,
      current, incoming
    );
    // Category-store shape guard (2026.09.213): once "categories" /
    // "cons_categories" have migrated to per-district maps, a stale client
    // (old cached bundle) must never overwrite them with a flat array â€” that
    // would re-trigger the client-side legacy migration and leak one
    // district's categories into every other district.
    for (const ck of ['hp_inventory.categories', 'hp_inventory.cons_categories']) {
      const prev = current[ck];
      if (prev && !Array.isArray(prev) && typeof prev === 'object' && Array.isArray(incoming[ck])) {
        console.warn('[rbac] category-store shape guard: kept per-district map for', ck);
        incoming[ck] = prev;
      }
    }
    // Sanitise: hash any plaintext passwords that slipped in.
    if (Array.isArray(incoming['hp_inventory.users'])) {
      const existing = await getState();
      const currentUsers = Array.isArray(existing['hp_inventory.users']) ? existing['hp_inventory.users'] : [];
      incoming['hp_inventory.users'] = await mergeUsers(incoming['hp_inventory.users'], currentUsers);
    }
    // Keep it server-managed: never let a client persist its own sessions.
    incoming[TOKEN_KEY] = current[TOKEN_KEY] || {};
    // Preserve self-hosted scan files (client never loads them into its cache).
    for (const k of Object.keys(current)) {
      if (k.indexOf(SCAN_FILES_PREFIX) === 0) incoming[k] = current[k];
    }
    const verr = validateAllocState(incoming);
    if (verr) return res.status(400).json({ error: verr });
    // Only the maintenance keys are taken from the finalised document, never
    // the whole of it. finalising captures the state as it arrived, which is
    // BEFORE the password merge below runs, so copying the whole document back
    // over `incoming` replaced the freshly merged user list with the raw one
    // the client sent - and with it, every password the server had just put
    // back. Ten accounts were left unable to sign in.
    for (const k of Object.keys(incoming)) {
      if (k.indexOf(MAINT_KEY_PREFIX) === 0) delete incoming[k];
    }
    for (const k of Object.keys(incomingFinal)) {
      if (k.indexOf(MAINT_KEY_PREFIX) === 0) incoming[k] = incomingFinal[k];
    }
    await setState(incoming);
    // Publish realtime events by diffing what changed between the
    // previously stored state and the incoming state (server = source of
    // truth, dedupe-keyed so concurrent writes cannot duplicate events).
    try {
      const rtEvents = rtDiffState(current, incoming);
      if (rtEvents.length) await rtPublish(rtEvents);
    } catch (e) { console.error('rt publish failed:', e); }
    // Return the sanitised users so the client never keeps plaintext in memory.
    const resp = { ok: true };
    if (Array.isArray(incoming['hp_inventory.users'])) {
      // Projected back down to what this caller is entitled to see, NOT the
      // whole list that was just stored. This used to answer with
      // `incoming`, which is the document AFTER restoreScopeFor put every
      // out-of-scope user back. The client copies that answer straight into
      // its own cache and sends it again on the next save - at which point
      // restoreScopeFor holds those same users AND receives them, so they
      // were counted twice. Every save doubled the collection, which is how
      // 40 real accounts became 1,695,786 rows and a 493MB database. The
      // client must only ever hold the slice it is allowed to hold.
      const scopedBack = projectStateFor(writeUser, incoming);
      const visible = Array.isArray(scopedBack['hp_inventory.users']) ? scopedBack['hp_inventory.users'] : [];
      resp.users = visible.map(publicUser).filter(Boolean);
    }
    return res.json(resp);
  }

  // ---------- SAVE A SINGLE KEY (incremental) ----------
  if (p0 === 'key' && req.method === 'POST') {
    if (!body.key || !body.value) return res.status(400).json({ error: 'key and value required' });
    const isUsersWrite = body.key === 'hp_inventory.users' || body.key === TOKEN_KEY;
    const isItemsWrite = body.key === ITEM_STORE_KEY;
    const isMaintenanceWrite = body.key.indexOf(MAINT_KEY_PREFIX) === 0;
    let nextAll = null; // normalised items map for item key-writes (legacy arrays are merged)
    if (isUsersWrite || isItemsWrite || isMaintenanceWrite) {
      const { user } = await authFromRequest(req);
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      if (isUsersWrite && body.key === 'hp_inventory.users' && Array.isArray(body.value)) {
        // Users-collection RBAC (same rules as the whole-state save).
        const stateNow = await getState();
        const currentUsers = Array.isArray(stateNow['hp_inventory.users']) ? stateNow['hp_inventory.users'] : [];
        const ucVerdict = authorizeUserCollectionWrite(
          { id: user.id, username: user.username, role: user.role, districtId: user.districtId, districtIds: user.districtIds },
          currentUsers,
          body.value
        );
        if (ucVerdict) {
          console.warn('[rbac] users key-write denied:', `${user.username} (${user.role})`);
          return res.status(ucVerdict.status).json({ error: ucVerdict.error, code: ucVerdict.code, detail: ucVerdict.detail || null });
        }
      }
      if (isItemsWrite) {
        // RBAC GATE (inventory): normalise legacy array writes under the
        // caller's own district so the same ownership rules apply as for
        // whole-state saves. Ownership and identity come from the session.
        const stateNow = await getState();
        const usersNow = Array.isArray(stateNow['hp_inventory.users']) ? stateNow['hp_inventory.users'] : [];
        const prevAll = (stateNow[ITEM_STORE_KEY] && typeof stateNow[ITEM_STORE_KEY] === 'object') ? stateNow[ITEM_STORE_KEY] : {};
        nextAll = body.value;
        if (Array.isArray(body.value)) {
          // Legacy array form: the array replaces ONE district's items â€”
          // merge it over the stored map so other districts are untouched
          // (otherwise they would look deleted and be wrongly denied).
          const distId = body.districtId || user.districtId || 'dist_1';
          nextAll = { ...prevAll, [distId]: body.value };
        }
        const verdict = authorizeItemWrites(
          { id: user.id, username: user.username, role: user.role, locationId: user.locationId, districtId: user.districtId, districtIds: user.districtIds },
          diffItemWrites({ [ITEM_STORE_KEY]: prevAll }, { [ITEM_STORE_KEY]: nextAll }),
          { freshInstall: usersNow.length === 0, prevState: { [ITEM_STORE_KEY]: prevAll }, nextState: { [ITEM_STORE_KEY]: nextAll } }
        );
        if (!verdict.ok) {
          console.warn('[rbac] inventory key-write denied:',
            `${user.username} (${user.role})`, JSON.stringify(verdict.detail));
          return res.status(verdict.status).json({
            error: verdict.error,
            code: verdict.code,
            detail: verdict.detail,
          });
        }
      }
      if (isMaintenanceWrite) {
        // The same gate the whole-state save uses, applied to this one key.
        // Diffed against what is actually stored rather than against what the
        // client says it started from, so the comparison cannot be talked round.
        const stateNow = await getState();
        const mVerdict = authorizeMaintenanceWrites(
          { id: user.id, username: user.username, role: user.role, locationId: user.locationId, districtId: user.districtId, districtIds: user.districtIds },
          diffMaintenanceWrites(stateNow, { [body.key]: body.value })
        );
        if (mVerdict && mVerdict.ok !== true) {
          console.warn('[rbac] maintenance key-write denied:', `${user.username} (${user.role})`, JSON.stringify({ code: mVerdict.code }));
          return res.status(mVerdict.status || 403).json({ error: mVerdict.error, code: mVerdict.code || 'RBAC_MAINT_FORBIDDEN', detail: mVerdict.detail || null });
        }
      }
    }
    const state = await getState();
    if (body.key === 'hp_inventory.users' && Array.isArray(body.value)) {
      const currentUsers = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
      state[body.key] = await mergeUsers(body.value, currentUsers);
    } else if (body.key === TOKEN_KEY) {
      // ignore client attempts to manage sessions
    } else if (isItemsWrite && typeof nextAll === 'object') {
      // Persist the NORMALISED items map (legacy array writes are merged under
      // the caller's district) so the store keeps its {districtId: [...]} shape.
      state[body.key] = nextAll;
    } else if (isMaintenanceWrite) {
      // Same rules as a whole-state save, reached by a different door. Left out,
      // a caller could raise or complete a maintenance request through this
      // endpoint with the form's restrictions never consulted. The stored value
      // is the finalised one, so the history on the record is the server's.
      state[body.key] = (finalizeMaintenanceState(
        user ? { username: user.username, name: user.name } : null,
        state, { [body.key]: body.value }
      ))[body.key];
    } else {
      state[body.key] = body.value;
    }
    const verr = validateAllocState(state);
    if (verr) return res.status(400).json({ error: verr });
    await setState(state);
    return res.json({ ok: true });
  }

  // ---------- SCAN FILE STORAGE (self-hosted original documents) ----------
  // Scan file bytes are stored under dedicated keys that are EXCLUDED from
  // GET /api/state so the main state payload stays small. They are fetched
  // individually only when the user opens a scanned document.
  if (p0 === 'scanfile') {
    if (req.method === 'POST') {
      if (!body.id || !body.dataUrl) return res.status(400).json({ error: 'id and dataUrl required' });
      if (typeof body.dataUrl !== 'string' || body.dataUrl.length > 12 * 1024 * 1024) {
        return res.status(413).json({ error: 'File too large (max ~8MB)' });
      }
      const state = await getState();
      state[SCAN_FILES_PREFIX + body.id] = { savedAt: Date.now(), dataUrl: body.dataUrl, length: body.dataUrl.length };
      await setState(state);
      return res.json({ ok: true });
    }
    if (req.method === 'GET') {
      const id = seg[1];
      if (!id) return res.status(400).json({ error: 'file id required' });
      const state = await getState();
      const rec = state[SCAN_FILES_PREFIX + id];
      if (!rec) return res.status(404).json({ error: 'File not found' });
      return res.json({ ok: true, savedAt: rec.savedAt, length: rec.length, dataUrl: rec.dataUrl });
    }
    return res.status(404).json({ error: 'Not found' });
  }

  // ---------- REALTIME EVENT STREAM (cursor catch-up) ----------
  // Returns events with id greater than `since`, filtered by the caller's
  // RBAC scope. Used for initial feed backfill and reconnect sync.
  if (p0 === 'rt' && req.method === 'GET') {
    const since = Number(req.query.since) || 0;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const { user } = await authFromRequest(req);
    const events = await rtFetch(since, user, limit);
    return res.json({ ok: true, serverTime: Date.now(), events, live: true });
  }

  // ---------- REALTIME EVENT STREAM (long-poll, LISTEN/NOTIFY) ----------
  // Holds the request open up to ~8s (inside the 10s function cap) and
  // returns the instant an event is published for this user. The client
  // reconnects immediately, so delivery to connected clients is ~instant.
  if (p0 === 'rtstream' && req.method === 'GET') {
    const since = Number(req.query.since) || 0;
    const { user } = await authFromRequest(req);
    const client = await pool.connect();
    try {
      await client.query('LISTEN ' + RT_CHANNEL);
      const deadline = Date.now() + RT_MAX_HOLD_MS;
      const notificationP = new Promise(res => client.on('notification', res));
      while (Date.now() < deadline) {
        const events = await rtFetch(since, user, 200);
        if (events.length) {
          return res.json({ ok: true, serverTime: Date.now(), events, live: true });
        }
        await Promise.race([notificationP, sleep(Math.min(700, deadline - Date.now()))]);
      }
      const events = await rtFetch(since, user, 200);
      return res.json({ ok: true, serverTime: Date.now(), events, live: false });
    } finally {
      try { client.release(); } catch (e) { /* ignore */ }
    }
  }

  // ---------- SEED DEFAULTS (client-sent defaults) ----------
  if (p0 === 'seed' && req.method === 'POST') {
    if (!body.state) return res.status(400).json({ error: 'state required' });
    const { rows } = await pool.query('SELECT data FROM app_state WHERE id=1');
    if (rows.length) return res.json({ ok: true, existed: true });
    const seedState = { ...body.state };
    if (Array.isArray(seedState['hp_inventory.users'])) {
      seedState['hp_inventory.users'] = await hashAllPasswords(seedState['hp_inventory.users']);
    }
    delete seedState[TOKEN_KEY];
    await setState(seedState);
    return res.json({ ok: true, existed: false });
  }

  return res.status(404).json({ error: 'Not found' });
}

// Compares two user lists ignoring passwords and any undefined fields.
function usersEqual(a, b) {
  const clean = (arr) => (arr || []).map(u => {
    const { password, ...rest } = u;
    for (const k of Object.keys(rest)) if (rest[k] === undefined) delete rest[k];
    return rest;
  });
  const norm = (arr) => clean(arr).sort((x, y) => (x.id < y.id ? -1 : 1)).map(u => JSON.stringify(u)).join("|");
  return norm(a) === norm(b);
}

// Returns a users array whose plaintext passwords have been hashed; any
// existing bcrypt hashes (e.g. from prior saves) are preserved by id.
//
// A record that arrives with no password AND has no stored counterpart is
// dropped rather than saved. It could never be signed into - the login path
// compares against a hash, and there is none - so storing it only produces an
// account that exists, shows in every list, and locks its owner out. Ten such
// rows appeared once because the record could not be matched to a stored one
// by id; keeping them out is the point.
async function mergeUsers(incoming, existing) {
  const existingById = {};
  for (const u of existing || []) if (u && u.id) existingById[u.id] = u;
  const out = [];
  let dropped = 0;
  for (const u of incoming || []) {
    if (!u || typeof u !== 'object') { dropped++; continue; }
    const copy = { ...u };
    const prev = existingById[u.id];
    if (copy.password) {
      if (copy.password.startsWith('$2')) {
        copy.password = copy.password; // already a bcrypt hash
      } else {
        copy.password = await bcrypt.hash(copy.password, BCRYPT_ROUNDS);
      }
    } else if (prev && prev.password) {
      // Preserve the stored hash; if it is a legacy plaintext value,
      // upgrade it to bcrypt here so data self-migrates on next write.
      copy.password = prev.password.startsWith('$2')
        ? prev.password
        : await bcrypt.hash(prev.password, BCRYPT_ROUNDS);
    } else {
      // No password came in and none is stored for this id. There is nothing
      // this account could be signed into with, so it is not kept.
      console.warn('[users] dropped record with no password and no stored hash: id=' + (u.id || '?') + ' username=' + (u.username || '?'));
      dropped++;
      continue;
    }
    out.push(copy);
  }
  if (dropped) console.warn('[users] ' + dropped + ' user record(s) dropped for having no usable password');
  return out;
}

async function hashAllPasswords(users) {
  const out = [];
  for (const u of users || []) {
    const copy = { ...u };
    if (copy.password && !copy.password.startsWith('$2')) {
      copy.password = await bcrypt.hash(copy.password, BCRYPT_ROUNDS);
    }
    out.push(copy);
  }
  return out;
}

// Self-healing: collapse duplicate rows out of the users collection.
//
// A users array that holds the same account many times over is never a real
// state - the app looks accounts up by id and by username, so the extra rows
// are pure weight. They got in through the scope stitch in _rbac.js, and
// because that stitch ran on every save the file doubled each time until it
// reached hundreds of megabytes. The two fixes above stop new ones arriving;
// this removes the ones already there, so an installation that is already
// bloated does not have to be reset by hand.
//
// The LAST row for an id wins, which is the one the most recent saves wrote.
// Only an exact id collision is collapsed - two genuinely different accounts
// that happen to share a username are left alone, since that is a different
// problem and silently merging them could lock someone out. Returns the count
// removed so the caller can log it.
function dedupeUsersById(users) {
  const list = Array.isArray(users) ? users : [];
  const byId = new Map();
  let withoutId = 0;
  for (const u of list) {
    if (!u || typeof u !== 'object') continue;
    const id = u.id;
    if (id === undefined || id === null || id === '') { withoutId++; continue; }
    byId.set(id, u);
  }
  const out = Array.from(byId.values());
  const removed = list.length - out.length - withoutId;
  return { users: out, removed, withoutId };
}

// Runs at most once per minute, and only when there is something to do - the
// size check is a cheap count, so an already-clean database costs one integer
// comparison per minute rather than a rewrite.
let lastDupSweep = 0;
async function sweepDuplicateUsers() {
  const now = Date.now();
  if (now - lastDupSweep < 60_000) return;
  lastDupSweep = now;
  try {
    const state = await getState();
    const users = state['hp_inventory.users'];
    if (!Array.isArray(users)) return;
    const seen = new Set();
    let dupes = 0;
    for (const u of users) {
      if (!u || typeof u !== 'object' || u.id === undefined || u.id === null || u.id === '') continue;
      if (seen.has(u.id)) dupes++;
      else seen.add(u.id);
    }
    if (!dupes) return;
    const before = users.length;
    const { users: clean, removed, withoutId } = dedupeUsersById(users);
    if (!removed) return;
    state['hp_inventory.users'] = clean;
    await setState(state);
    console.log('[repair] users: collapsed ' + removed + ' duplicate row(s), ' + before + ' -> ' + clean.length
      + (withoutId ? ' (' + withoutId + ' row(s) had no id and were left alone)' : ''));
  } catch (e) {
    lastDupSweep = 0; // allow a retry on the next request
  }
}

// Self-healing: guarantees no plaintext password can survive in the DB.
// Runs at most once per minute per serverless instance. Upgrades any
// legacy plaintext values to bcrypt so every stored password is a hash.
let lastPasswordSweep = 0;
async function sweepPlaintextPasswords() {
  const now = Date.now();
  if (now - lastPasswordSweep < 60_000) return;
  lastPasswordSweep = now;
  try {
    const state = await getState();
    const users = Array.isArray(state['hp_inventory.users']) ? state['hp_inventory.users'] : [];
    const needsHashing = users.some(u => typeof u.password === 'string' && u.password && !u.password.startsWith('$2'));
    if (!needsHashing) return;
    state['hp_inventory.users'] = await hashAllPasswords(users);
    await setState(state);
    console.log('[security] upgraded legacy plaintext password(s) to bcrypt');
  } catch (e) {
    lastPasswordSweep = 0; // allow a retry on the next request
  }
}
