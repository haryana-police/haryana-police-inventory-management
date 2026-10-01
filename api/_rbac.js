// ============================================================
// INVENTORY RBAC  (server-side, source of truth)
// ============================================================
// Pure helpers — no I/O — used by api/index.js to enforce record
// ownership on every inventory write. The app stores inventory as
//   hp_inventory.items = { [districtId]: [ {id, name, ..., locationId}, ... ] }
// and clients persist the WHOLE state blob, so enforcement is done by
// diffing the previous stored state against the incoming one:
//   add    = item id present in next, absent in prev
//   edit   = item id present in both but content changed
//   delete = item id present in prev, absent in next
//
// Authorisation model (requirements):
//   - Identity/role ALWAYS come from the server session, never the body.
//   - Developer Admin: read-only for inventory — every write is denied.
//   - Everyone else: a record may be modified only when it belongs to the
//     caller's own unit AND sits inside the caller's own district, i.e.
//         record.locationId === user.locationId  &&  districtId === user.districtId
//   - Visibility (district hierarchy) is enforced in the UI; writes are
//     enforced HERE so the UI can never be bypassed by calling the API.
const ITEM_STORE_KEY = 'hp_inventory.items';
const DISTRIBUTION_KEY_PREFIX = 'hp_inventory.distributions_';

// ---------------------------------------------------------------------------
// DISTRICT SCOPE
// Every role is confined to a set of districts. Most roles hold exactly one
// (user.districtId). An Inspector General (role 'ig') is given several through
// user.districtIds, and is confined to exactly those - never all of them.
//
// devadmin returns null, meaning "every district"; that role is separately
// blocked from every inventory write below, so the wide scope is read-only.
// ---------------------------------------------------------------------------
function userDistricts(user) {
  if (!user) return [];
  if (user.role === 'devadmin') return null;
  if (user.role === 'ig') {
    const list = Array.isArray(user.districtIds) ? user.districtIds.filter(Boolean) : [];
    // districtId stays the primary district so everything that already reads it
    // (badges, default tab, session restore) keeps working unchanged.
    if (user.districtId && list.indexOf(user.districtId) < 0) list.unshift(user.districtId);
    return list;
  }
  return user.districtId ? [user.districtId] : [];
}
function inDistrictScope(user, districtId) {
  const d = userDistricts(user);
  return d === null || d.indexOf(districtId) >= 0;
}
// True for the roles that administer a whole district rather than one unit.
function isDistrictWideRole(user) {
  return !!(user && (user.role === 'admin' || user.role === 'ig'));
}
function districtScopeLabel(user) {
  const d = userDistricts(user);
  if (d === null) return 'all districts';
  if (!d.length) return 'no district';
  return d.length === 1 ? d[0] : d.join(', ');
}
const CONTENT_FIELDS = [
  'name', 'categoryId', 'unit', 'quantity', 'minStock', 'locationId',
  'conditionCounts',
];

// Deterministic stringify (sorted object keys) so comparisons are stable
// regardless of key order (JSONB in Postgres reorders keys).
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function pickContent(item) {
  const out = {};
  for (const f of CONTENT_FIELDS) if (item && item[f] !== undefined) out[f] = item[f];
  return out;
}

function itemFingerprint(item) {
  return stableStringify(pickContent(item));
}

// Classifies every inventory change between two state blobs.
function diffItemWrites(prevState, nextState) {
  const prevAll = (prevState && prevState[ITEM_STORE_KEY]) || {};
  const nextAll = (nextState && nextState[ITEM_STORE_KEY]) || {};
  const writes = { adds: [], edits: [], deletes: [], hasWrites: false };
  const distIds = new Set(Object.keys(prevAll).concat(Object.keys(nextAll)));
  for (const districtId of distIds) {
    const prevArr = Array.isArray(prevAll[districtId]) ? prevAll[districtId] : [];
    const nextArr = Array.isArray(nextAll[districtId]) ? nextAll[districtId] : [];
    const prevById = new Map(prevArr.map(i => [i && i.id, i]));
    const nextById = new Map(nextArr.map(i => [i && i.id, i]));
    for (const [id, item] of nextById) {
      if (!id || !item) continue;
      const prev = prevById.get(id);
      if (!prev) writes.adds.push({ districtId, item });
      else if (itemFingerprint(prev) !== itemFingerprint(item)) writes.edits.push({ districtId, item, prev });
    }
    for (const [id, item] of prevById) {
      if (!id || !item) continue;
      if (!nextById.has(id)) writes.deletes.push({ districtId, item });
    }
  }
  writes.hasWrites = (writes.adds.length + writes.edits.length + writes.deletes.length) > 0;
  return writes;
}

// Distribution approvals transfer stock across units/districts by design: the
// RECEIVER approves, so the deducted source item belongs to the distributor's
// unit (not the approver's) and the added destination item belongs to the
// receiver's unit. A plain ownership gate would 403 that legitimate transfer.
// When the same write flips a distribution record from 'pending' to
// 'completed', the item records it names become exempt — and ONLY those.
// Returns a Set of "districtId|locationId|name(lowercased)" keys.
function distributionExemptKeys(prevState, nextState) {
  const exempt = new Set();
  const scan = (state, map) => {
    if (!state || typeof state !== 'object') return;
    for (const key of Object.keys(state)) {
      if (key.indexOf(DISTRIBUTION_KEY_PREFIX) !== 0) continue;
      for (const d of (Array.isArray(state[key]) ? state[key] : [])) {
        if (d && d.id) map[d.id] = d;
      }
    }
  };
  const prev = {};
  const next = {};
  scan(prevState, prev);
  scan(nextState, next);
  for (const id of Object.keys(next)) {
    const o = prev[id];
    const n = next[id];
    if (!o || !n) continue;
    if (o.status !== 'pending' || n.status !== 'completed') continue;
    for (const it of (Array.isArray(n.items) ? n.items : [])) {
      const name = String(it.itemName || '').toLowerCase();
      if (!name) continue;
      exempt.add((n.fromDistrictId || '') + '|' + (it.fromLocationId != null ? it.fromLocationId : '') + '|' + name);
      exempt.add((n.toDistrictId || '') + '|' + (n.toLocationId != null ? n.toLocationId : '') + '|' + name);
    }
  }
  return exempt;
}

function firstViolation(writes, user, exempt) {
  const check = (kind, entry) => {
    const it = entry.item || {};
    // Exempt items that move through a distribution approval in this same
    // write (see distributionExemptKeys). Matched by the record's actual
    // district + stored location + name, so a forged/renamed record is not
    // silently whitelisted.
    const prevForLoc = kind === 'delete' ? entry.item : (entry.prev || null);
    const archLoc = prevForLoc && prevForLoc.locationId !== undefined ? prevForLoc.locationId : it.locationId;
    const distExemptKey = (entry.districtId || '') + '|' + (archLoc != null ? archLoc : '') + '|' + String(it.name || '').toLowerCase();
    if (exempt && exempt.has(distExemptKey)) return null;
    // OWNERSHIP COMES FROM THE DATABASE, not the payload:
    //  - add:    the new record must be created inside the caller's own unit
    //  - edit:   the PREVIOUSLY STORED record must already belong to the
    //            caller's own unit (a client cannot relabel a foreign record
    //            as its own and then modify it)
    //  - delete: the stored record being removed must belong to the caller
    const prev = kind === 'delete' ? entry.item : (entry.prev || null);
    const storedLoc = prev && prev.locationId !== undefined ? prev.locationId : it.locationId;
    // An IG administers whole districts and owns no unit, so the test is district
    // membership rather than unit ownership: any record inside one of the
    // districts assigned to the account, and nothing outside them. An IG can
    // therefore never reach a district that was not ticked for it, and an edit
    // cannot move a record out of the IG's scope.
    if (user.role === 'ig') {
      if (!inDistrictScope(user, entry.districtId)) {
        return {
          kind,
          itemId: it.id,
          itemName: it.name || '',
          locationId: storedLoc !== undefined ? storedLoc : (it.locationId || null),
          districtId: entry.districtId,
          reason: `the record is in district ${entry.districtId}, outside the districts assigned to this IG (${districtScopeLabel(user)})`,
        };
      }
      return null;
    }
    const owned = kind === 'add'
      ? it.locationId === user.locationId
      : storedLoc === user.locationId;
    // Edits must also keep the record inside the caller's own unit: an owner
    // cannot relocate a record into another unit, and a non-owner cannot
    // relabel a foreign record as their own to capture it.
    const staysOwned = kind !== 'edit' || it.locationId === user.locationId;
    const inDistrict = entry.districtId === user.districtId;
    if (owned && staysOwned && inDistrict) return null;
    let reason;
    if (!inDistrict) reason = `the record belongs to another district (${entry.districtId}), not yours (${user.districtId})`;
    else if (owned && !staysOwned) reason = `the record cannot be moved from your unit (${user.locationId}) to unit "${it.locationId}"`;
    else reason = `the record belongs to unit "${storedLoc}", not your unit (${user.locationId})`;
    return {
      kind,
      itemId: it.id,
      itemName: it.name || '',
      locationId: storedLoc !== undefined ? storedLoc : (it.locationId || null),
      districtId: entry.districtId,
      reason,
    };
  };
  for (const e of writes.edits) { const v = check('edit', e); if (v) return v; }
  for (const e of writes.deletes) { const v = check('delete', e); if (v) return v; }
  for (const e of writes.adds) { const v = check('add', e); if (v) return v; }
  return null;
}

// Returns { ok:true } or { ok:false, status, code, error, detail }.
// opts.freshInstall: when the DB has no users at all, the very first
// bootstrap write (seed) is allowed without a session.
function authorizeItemWrites(user, writes, opts) {
  opts = opts || {};
  if (!writes || !writes.hasWrites) return { ok: true };
  if (opts.freshInstall) return { ok: true };
  if (!user) {
    return {
      ok: false, status: 401, code: 'RBAC_UNAUTHENTICATED',
      error: 'Authentication required to modify inventory records.',
      detail: { counts: { adds: writes.adds.length, edits: writes.edits.length, deletes: writes.deletes.length } },
    };
  }
  if (user.role === 'devadmin') {
    return {
      ok: false, status: 403, code: 'RBAC_ITEM_FORBIDDEN',
      error: 'Developer Admin has read-only access to inventory: editing, adding and deleting inventory records is not permitted.',
      detail: { role: user.role, counts: { adds: writes.adds.length, edits: writes.edits.length, deletes: writes.deletes.length } },
    };
  }
  const violation = firstViolation(writes, user, opts.prevState || opts.nextState ? distributionExemptKeys(opts.prevState, opts.nextState) : null);
  if (violation) {
    return {
      ok: false, status: 403, code: 'RBAC_ITEM_FORBIDDEN',
      error: `Forbidden: you can only modify inventory records that belong to your own unit. "${violation.itemName || violation.itemId}" was not allowed because ${violation.reason}.`,
      detail: violation,
    };
  }
  return { ok: true };
}

// Users-collection RBAC: roles/units must never be rewritable through a
// state save. devadmin may manage everyone; district admins (role 'admin')
// may only manage accounts inside their own district; everyone else is
// denied. Anonymous writes are denied unless it is the very first bootstrap.
function authorizeUserCollectionWrite(user, currentUsers, incomingUsers) {
  const cur = Array.isArray(currentUsers) ? currentUsers : [];
  const inc = Array.isArray(incomingUsers) ? incomingUsers : [];
  if (cur.length === 0) return null; // fresh bootstrap / seed
  if (!user) return { status: 401, code: 'RBAC_UNAUTHENTICATED', error: 'Authentication required to modify user accounts.' };
  if (user.role === 'devadmin') return null;
  if (!isDistrictWideRole(user)) {
    return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: 'Only administrators can modify user accounts.' };
  }
  // An IG is scoped to the districts assigned to it, not to a single one; every
  // check below uses inDistrictScope(), so an IG reaches its own districts and
  // nothing beyond them.
  const isIg = user.role === 'ig';
  const scopeName = isIg ? 'your assigned districts' : 'your own district';
  const curById = new Map(cur.filter(Boolean).map(u => [u.id, u]));
  const incIds = new Set(inc.filter(Boolean).map(u => u.id));
  const stripPw = (u) => { const c = Object.assign({}, u); delete c.password; return c; };
  // Change detection ignores the password field: password resets are an
  // allowed part of managing the admin's own users (mergeUsers hashes them).
  const changed = (p, u) => stableStringify(stripPw(p)) !== stableStringify(stripPw(u));
  // Privilege escalation guard: a District Admin may not create, promote or
  // edit anyone (including itself) into an admin role. Only devadmin can.
  const roleEscalation = inc.some(u => {
    if (!u) return false;
    const p = curById.get(u.id);
    const wasRole = p ? p.role : undefined;
    // 'ig' joins the privileged set: an Inspector General spans several districts,
    // so it must be the Developer Admin alone who can hand the role out.
    return (u.role === 'admin' || u.role === 'devadmin' || u.role === 'ig') && u.role !== wasRole;
  });
  if (roleEscalation) {
    return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: 'Only the Developer Admin can assign admin roles.' };
  }
  // Diff-based district scope: users the admin did not touch may belong to
  // other districts (the client posts the whole collection), but every actual
  // CHANGE — add, edit, remove — must stay inside the admin's own district.
  for (const u of inc) {
    if (!u) continue;
    const p = curById.get(u.id);
    if (!p) {
      // New account: must land inside the caller's district scope.
      if (!inDistrictScope(user, u.districtId)) {
        return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: `You can only create users inside ${scopeName} ("${u.username || u.id}").`, detail: { userId: u.id, districtId: u.districtId } };
      }
      continue;
    }
    // District Admins can never manage administrator accounts (even a rename
    // of a fellow admin) — that stays Developer-Admin-only.
    if ((p.role === 'admin' || p.role === 'devadmin' || p.role === 'ig') && changed(p, u)) {
      return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: 'Only the Developer Admin can manage administrator accounts.', detail: { userId: u.id } };
    }
    if (!changed(p, u)) continue; // untouched in this write
    if (!inDistrictScope(user, p.districtId) || !inDistrictScope(user, u.districtId)) {
      return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: `You can only manage users inside ${scopeName} ("${u.username || u.id}").`, detail: { userId: u.id, districtId: u.districtId } };
    }
  }
  for (const p of cur) {
    // An Inspector General account is Developer-Admin-only in every direction:
    // creation and promotion are blocked by the escalation guard above, editing
    // by the privileged-account guard, and removal here. A district admin or a
    // fellow IG cannot touch one even inside their own districts, because an IG
    // spans districts and therefore outranks any single-district scope.
    if (p && !incIds.has(p.id) && (p.role === 'admin' || p.role === 'devadmin' || p.role === 'ig')) {
      // The last Developer Admin is the only way back into this application, so it
      // can be edited but never removed - not even by another Developer Admin.
      if (p.role === 'devadmin' && cur.filter(x => x && x.role === 'devadmin').length <= 1) {
        return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: `This is the only Developer Admin account, so it cannot be deleted ("${p.username || p.id}").`, detail: { userId: p.id, role: p.role } };
      }
      // An IG that still answers for a district may not be removed: clear its scope
      // first, so no district is ever left without the IG above it.
      if (p.role === 'ig') {
        const scope = Array.isArray(p.districtIds) && p.districtIds.length ? p.districtIds : [p.districtId];
        if (scope.filter(Boolean).length) {
          return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: `This IG Admin still handles ${scope.filter(Boolean).length} district(s) ("${p.username || p.id}"). Clear the districts first, then delete.`, detail: { userId: p.id, role: p.role, districts: scope.filter(Boolean) } };
        }
      }
      return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: `Only the Developer Admin can remove an account with the ${p.role === 'ig' ? 'Inspector General' : 'administrator'} role ("${p.username || p.id}").`, detail: { userId: p.id, role: p.role } };
    }
    if (p && !incIds.has(p.id) && !inDistrictScope(user, p.districtId)) {
      return { status: 403, code: 'RBAC_USERS_FORBIDDEN', error: `You cannot remove users from outside ${scopeName} ("${p.username || p.id}").`, detail: { userId: p.id, districtId: p.districtId } };
    }
  }
  return null;
}

// Maintenance requests (per-district array records stored under
// hp_inventory.maintenance_<districtId>). These are NOT inventory records and
const MAINT_KEY_PREFIX = 'hp_inventory.maintenance_';
// move through an independent workflow, so they get their own write guard:
//   create          (status pending)        — a requesting-unit user
//                                           (role station/mhc/post/tsi) or
//                                           devadmin; record must be created
//                                           inside the caller's own unit and
//                                           target a real admin of the same
//                                           district.
//   process         pending -> under_process — the district admin of the
//                                           record's district (role 'admin'),
//                                           or devadmin. Admins cannot CREATE a
//                                           request (they are the receiver).
//   approve/complete under_process->completed — the REQUESTING unit user
//                                           (locationId === requestingUnitId),
//                                           or devadmin.
// All other transitions — including pending -> completed, under_process ->
// pending, or any edit that changes request contents outside the authorised
// status move — are rejected. history[] is always rebuilt server-side: the
// client may never append or forge log entries. Timestamps are likewise
// server-set.
function authorizeMaintenanceWrites(user, writes) {
  if (!writes || (!writes.adds.length && !writes.edits.length && !writes.deletes.length)) return { ok: true };
  if (!user) {
    return {
      ok: false, status: 401, code: 'RBAC_MAINT_UNAUTHENTICATED',
      error: 'Authentication required to modify maintenance requests.',
      detail: { counts: { adds: writes.adds.length, edits: writes.edits.length, deletes: writes.deletes.length } },
    };
  }
  if (['devadmin'].indexOf(user.role) >= 0) return { ok: true };

  const fail = (status, code, error, detail) => ({ ok: false, status, code, error, detail });

  // Prevent deleting request logs. Old requests are archived by setting a
  // status; they are never removed from the store.
  if (writes.deletes.length) {
    const victim = writes.deletes[0] && (writes.deletes[0].item || {});
    return fail(403, 'RBAC_MAINT_DELETE_FORBIDDEN',
      'Maintenance requests cannot be deleted; mark the request complete or processed instead.',
      { id: victim && victim.id });
  }

  // The routing model decides who a request can usefully go to: Computer/IT
  // goes to the IT staff account and Vehicle to the MTO staff account, both
  // created automatically for every district. Every other type falls back to
  // the District Admin - which, when the District Admin is the one raising it,
  // means sending the request to themselves.
  //
  // So a District Admin may only raise the two types that actually reach
  // somebody. Anything else is refused here rather than being accepted and then
  // sitting in their own queue with nobody able to act on it. The check is on
  // the server because that is the gate the UI cannot get past: the form is
  // only a convenience, and a stale or hand-built request must meet the same
  // rule.
  const ADMIN_ROUTED_TYPES = ['computer_it', 'vehicle'];
  for (const w of writes.adds) {
    const r = w.item || {};
    if (user.role === 'admin' && r.maintenanceType && ADMIN_ROUTED_TYPES.indexOf(r.maintenanceType) < 0) {
      const label = r.maintenanceType === 'other' && r.customType
        ? '"' + r.customType + '"'
        : '"' + r.maintenanceType + '"';
      return fail(403, 'RBAC_MAINT_TYPE_FORBIDDEN',
        'A District Admin can only raise a Computer/IT or a Vehicle maintenance request, because every other type is routed back to the District Admin themselves. '
        + 'Please raise ' + label + ' from the requesting unit instead, or change the type to Computer/IT or Vehicle.',
        { maintenanceType: r.maintenanceType, allowed: ADMIN_ROUTED_TYPES, id: r.id });
    }
  }

  for (const w of writes.adds) {
    const r = w.item || {};
    if (r.districtId !== user.districtId) {
      return fail(403, 'RBAC_MAINT_CREATE_FORBIDDEN',
        `You can only raise maintenance requests in your own district (${user.districtId}).`,
        { districtId: r.districtId, owned: user.districtId, id: r.id });
    }
    if (r.requestingUnitId !== user.locationId) {
      return fail(403, 'RBAC_MAINT_CREATE_FORBIDDEN',
        `Requests must be raised by your own unit (${user.locationId}); "${r.requestingUnitName || r.requestingUnitId}" is not yours.`,
        { requestingUnitId: r.requestingUnitId, owned: user.locationId, id: r.id });
    }
    // District Admins, Computer/IT Staff and MTO Staff may also raise
    // requests from their own unit/HQ location, same as requesting units.
    if (!['pending'].includes(r.status)) {
      return fail(403, 'RBAC_MAINT_CREATE_FORBIDDEN',
        'New maintenance requests must start with status "pending".',
        { id: r.id, status: r.status });
    }
    if (!r.requestToDistrictAdminId) {
      return fail(403, 'RBAC_MAINT_CREATE_FORBIDDEN',
        'Every maintenance request must name the receiving district administrator.',
        { id: r.id });
    }
  }

  for (const w of writes.edits) {
    const prev = w.prev || {};
    const cur = w.item || {};
    const from = prev.status;
    const to = cur.status;
    const transition = (from || '') + '->' + (to || '');
    if (transition === 'pending->under_process') {
      // The receiving district admin OR the routed staff user (Computer/IT /
      // MTO) may start work on a request.
      const isDistAdmin = user.role === 'admin' && user.districtId === prev.districtId;
      const isRoutedStaff = (user.role === 'itstaff' || user.role === 'mtostaff')
        && user.districtId === prev.districtId
        && prev.requestToUserId === user.id;
      if (!isDistAdmin && !isRoutedStaff) {
        return fail(403, 'RBAC_MAINT_PROCESS_FORBIDDEN',
          (user.role === 'admin' || user.role === 'itstaff' || user.role === 'mtostaff')
            ? 'You may only process maintenance requests routed to you inside your own district (' + (prev.districtId || '') + ').'
            : 'Only the receiving district administrator or the routed staff user may process a maintenance request.',
          { id: prev.id, transition });
      }
    } else if (transition === 'under_process->completed') {
      // Only the REQUESTING unit may confirm the work is complete.
      if (prev.requestingUnitId !== user.locationId) {
        return fail(403, 'RBAC_MAINT_COMPLETE_FORBIDDEN',
          'Only the unit that raised the request may mark it as completed.',
          { id: prev.id, requestingUnitId: prev.requestingUnitId, owned: user.locationId, transition });
      }
    } else {
      return fail(403, 'RBAC_MAINT_TRANSITION_FORBIDDEN',
        `Invalid maintenance status transition "${transition}". Allowed: pending -> under_process (by the district admin) and under_process -> completed (by the requesting unit).`,
        { id: prev.id, from, to });
    }
  }
  return { ok: true };
}

// Rebuilds a maintenance record's server-authoritative side of the history
// log and status fields. Any client-supplied history is dropped entirely; the
// server appends exactly the transition it just authorised and stamps the
// timestamps/actor fields in the shape the client expects.
function finishMaintenanceRecord(user, prev, record) {
  const now = new Date().toISOString();
  const actorName = user ? (user.username || user.name || '') : '';
  const out = Object.assign({}, record);
  const history = Array.isArray(prev && prev.history) ? prev.history.slice() : [];
  if (!prev) {
    out.createdAt = now;
    out.createdBy = actorName;
    history.push({ action: 'created', by: actorName, at: now, status: 'pending' });
  }
  if (prev && prev.status === 'pending' && record.status === 'under_process') {
    out.apiProcessedAt = now;
    out.apiProcessedBy = actorName;
    history.push({ action: 'processed', by: actorName, at: now, status: 'under_process' });
  }
  if (prev && prev.status === 'under_process' && record.status === 'completed') {
    out.apiCompletedAt = now;
    out.apiCompletedBy = actorName;
    history.push({ action: 'completed', by: actorName, at: now, status: 'completed' });
  }
  out.updatedAt = now;
  out.history = history;
  return out;
}

// Normalises one maintenance record so any client-injected history / actor /
// date fields can never forge the audit trail. Used before handing validated
// records back to the client AND on the way in (history/actor fields are
// regenerated; only the transition itself is trusted).
function sanitizeMaintenanceRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const r = Object.assign({}, record);
  // These are server-managed and reflect the CURRENT authorised actor.
  delete r.createdBy;
  return r;
}

module.exports = { projectStateFor, restoreScopeFor, diffStructureWrites, authorizeStructureWrites, diffConsumableWrites, authorizeConsumableWrites, diffMaintenanceWrites, finalizeMaintenanceState, MAINT_KEY_PREFIX, ITEM_STORE_KEY, DISTRIBUTION_KEY_PREFIX, CONTENT_FIELDS, stableStringify, itemFingerprint, diffItemWrites, distributionExemptKeys, authorizeItemWrites, authorizeUserCollectionWrite, authorizeMaintenanceWrites, finishMaintenanceRecord, sanitizeMaintenanceRecord };


// ============================================================
// CONSUMABLE ITEMS RBAC (server-side, source of truth)
// ============================================================
// District-scoped, transaction-based, one-way consumable inventory.
//   hp_inventory.consumable_items = { [districtId]: [item, ...] }
//   hp_inventory.consumable_txns  = { [districtId]: [txn, ...] }
// Authoritative equation: TOTAL = AVAILABLE + DISTRIBUTED + LOST.
// Pending distributions reserve stock until the recipient approves;
// rejection releases the reservation. There is NO return workflow.
// The ledger is IMMUTABLE: transactions can be added but never edited
// or deleted. Every quantity change is validated here against the
// stored ledger so over-distribution, cross-district writes, duplicate
// approvals/rejections and history tampering are all impossible from
// the client. Recipient identity comes from the session, not payload.
const CONS_ITEMS_KEY = 'hp_inventory.consumable_items';
const CONS_TXNS_KEY = 'hp_inventory.consumable_txns';
const CONS_TYPES = { ADD: 1, DISTRIBUTION_REQUEST: 1, DISTRIBUTION_APPROVED: 1, DISTRIBUTION_REJECTED: 1, LOSS: 1, DELETED: 1 };

// ---------------------------------------------------------------------------
// READ SCOPE
//
// Every write in this file is authorised against the session, but a read was
// not: the whole document went out to whoever asked. An Inspector General's
// browser was being handed the districts it has no business seeing, and the
// only thing hiding them was the interface.
//
// projectStateFor returns what a user is allowed to be shown. restoreScopeFor
// is its other half, and the two have to be used together. The browser is a
// document store: it takes this state, edits it, and posts the lot back. If it
// were shown less and wrote back only what it was shown, every district it was
// not shown would be deleted. So a scoped write keeps the parts it was never
// offered and merges the rest.
//
// Structure is deliberately left whole. Without a district a user can see, the
// app cannot build a report of a district in scope - stock that was distributed
// from here arrives there - and naming a district is not the same as naming a
// record inside it. The rows that carry stock, staff and money are the ones
// withheld.
// ---------------------------------------------------------------------------

const D_USER_KEY = 'hp_inventory.users';
const D_DISTRICTS_KEY = 'hp_inventory.districts';
const D_LOCATIONS_KEY = 'hp_inventory.locations';
const D_ITEMS_KEY = 'hp_inventory.items';
const D_CATEGORIES_KEY = 'hp_inventory.categories';
const D_CONS_CATEGORIES_KEY = 'hp_inventory.cons_categories';
const D_PERSONS_KEY = 'hp_inventory.persons';
const D_ALLOTMENTS_KEY = 'hp_inventory.allotments';
const D_ACCESS_REQUESTS_KEY = 'hp_inventory.accessRequests';
const D_ITEM_PHOTOS_KEY = 'hp_inventory.itemPhotos';
const D_PERSON_PHOTOS_KEY = 'hp_inventory.personPhotos';
const D_PER_DISTRICT = [D_ITEMS_KEY, D_CATEGORIES_KEY, D_CONS_CATEGORIES_KEY, D_LOCATIONS_KEY];
const D_SUFFIXED = '_dist_';

function dArr(v) { return Array.isArray(v) ? v : []; }
function dObj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

// Which districts a user may be shown. null means every district, and is the
// Developer Admin's case; an empty list means the user is attached to no
// district and so sees no district's records.
function dScope(user) {
  // No user at all is not the same as a user attached to no district. An
  // unauthenticated write is the legacy document-store path and is deliberately
  // left unnarrowed. Treating it as an empty scope would make every part of the
  // document count as out of scope, restore all of it, and quietly throw the
  // write away - a write that appears to succeed and changes nothing.
  if (!user) return null;
  const list = userDistricts(user);
  return list === null ? null : dArr(list);
}

// A photo record names its owner with an item or person id, and that id is
// built from the district it belongs to, so the owner is found by matching the
// id rather than by trusting a field the record does not carry.
function dPhotoOwnerIn(key, record) {
  if (record && typeof record === 'object' && !Array.isArray(record)) {
    if (record.districtId) return record.districtId;
    if (record.itemId) return record.itemId;
    if (record.personId) return record.personId;
  }
  if (key) {
    const s = String(key);
    const i = s.indexOf(D_SUFFIXED);
    if (i > 0) return s.slice(0, i);
    const m = s.match(/^gg_([a-z0-9]+)/i);
    if (m) return 'dist_' + m[1];
  }
  return null;
}

// The read. Returns a copy; nothing the caller holds is touched.
function projectStateFor(user, state) {
  const scope = dScope(user);
  if (scope === null || !state || typeof state !== 'object') return state;
  const selfId = (user && user.id) || null;
  const allowed = dArr(scope);
  const inScope = (id) => allowed.indexOf(id) >= 0;
  const out = {};
  for (const key of Object.keys(state)) {
    const value = state[key];
    if (key === D_USER_KEY) {
      out[key] = dArr(value).filter((u) => inScope(u && u.districtId) || (selfId && u && u.id === selfId));
      continue;
    }
    // The district list is a flat array, not the {districtId: [...]} shape the
    // rule below expects, so it is filtered here rather than there. It had no
    // rule at all and fell through to the default, so it was returned whole to
    // whoever asked: an Inspector General, who is entitled to the districts in
    // their own range, was shown every district in the state. The same list is
    // what the Districts page reads, so it is also what told them their range
    // had no district under it - they were reading a list that was not theirs
    // to judge, and could not find their own districts in someone else's.
    if (key === D_DISTRICTS_KEY) {
      out[key] = dArr(value).filter((d) => inScope(d && d.id));
      continue;
    }
    if (key === D_PERSONS_KEY || key === D_ALLOTMENTS_KEY || key === D_ACCESS_REQUESTS_KEY) {
      out[key] = dArr(value).filter((r) => inScope(r && r.districtId));
      continue;
    }
    if (D_PER_DISTRICT.indexOf(key) >= 0) {
      const src = dObj(value);
      const bucket = {};
      for (const d of allowed) if (Object.prototype.hasOwnProperty.call(src, d)) bucket[d] = src[d];
      out[key] = bucket;
      continue;
    }
    // Same suffix trap as on the write side, and it matters just as much here:
    // "hp_inventory.maintenance_dist_1" also ends in "_dist_", so the district
    // was read as the whole prefix "hp_inventory.maintenance", which is in no
    // one's scope. The key was then dropped and the caller was never shown a
    // single maintenance request - the page had nothing to list, which is why a
    // request the app accepted could not be seen afterwards. The district is
    // taken off the end of the key instead.
    if (key.indexOf(MAINT_KEY_PREFIX) === 0) {
      if (inScope(key.slice(MAINT_KEY_PREFIX.length))) out[key] = value;
      continue;
    }
    if (key.indexOf(D_SUFFIXED) >= 0) {
      const idx = key.indexOf(D_SUFFIXED);
      if (inScope(key.slice(0, idx))) out[key] = value;
      continue;
    }
    if (key === D_ITEM_PHOTOS_KEY || key === D_PERSON_PHOTOS_KEY) {
      const src = dObj(value);
      const bucket = {};
      for (const k of Object.keys(src)) if (inScope(dPhotoOwnerIn(k, src[k]))) bucket[k] = src[k];
      out[key] = bucket;
      continue;
    }
    out[key] = value;
  }
  return out;
}

// The write. Everything the reader was not shown is put back exactly as it was,
// so a scoped client can change what it can see and nothing else. A client that
// was shown everything - the Developer Admin - takes the document as sent.

// Records are stitched back together as `held` (what the caller never saw)
// followed by what the caller sent. Those two sets are meant to be disjoint:
// held is everything out of scope, the caller's own list is everything in it.
// They stopped being disjoint because the save response used to hand the
// caller the whole restored document instead of its own slice, so the caller
// held out-of-scope records too and sent them back - and each one was then
// held AND received, doubling on every single save.
//
// The response is fixed at the other end, but the stitch is where a duplicate
// becomes permanent, so it is made idempotent here as well: keyed by id, the
// caller's own version wins (it is the one they just edited), and held fills
// only the ids that are genuinely missing. A record with no id is kept - it
// cannot be told apart from another - rather than silently dropped.
function __stitchUnique(held, sent) {
  const out = [];
  const index = new Map();
  const push = (r) => {
    if (!r || typeof r !== 'object') return;
    const id = r.id;
    if (id === undefined || id === null || id === '') { out.push(r); return; }
    const at = index.get(id);
    if (at === undefined) { index.set(id, out.length); out.push(r); return; }
    out[at] = r; // the caller's own version of this record is the newer one
  };
  for (const r of held) push(r);
  for (const r of sent) push(r);
  return out;
}

function restoreScopeFor(user, current, incoming) {
  const scope = dScope(user);
  if (scope === null || !current || typeof current !== 'object' || !incoming || typeof incoming !== 'object') return incoming;
  const selfId = (user && user.id) || null;
  const allowed = dArr(scope);
  const inScope = (id) => allowed.indexOf(id) >= 0;
  const out = Object.assign({}, incoming);
  for (const key of Object.keys(current)) {
    const cur = current[key];
    if (key === D_USER_KEY) {
      const held = dArr(cur).filter((u) => !inScope(u && u.districtId) && !(selfId && u && u.id === selfId));
      if (held.length) out[key] = __stitchUnique(held, dArr(out[key]));
      continue;
    }
    // On the way in, a district outside the caller's scope is not theirs to
    // change and is put back as stored, which is what the rules below do with
    // every other out-of-scope record. Dropping it instead would let a scoped
    // user remove a district from the state simply by leaving it out of the
    // document they post.
    if (key === D_DISTRICTS_KEY) {
      out[key] = __stitchUnique(
        dArr(cur).filter((d) => !inScope(d && d.id)),
        dArr(out[key]).filter((d) => inScope(d && d.id))
      );
      continue;
    }
    if (key === D_PERSONS_KEY || key === D_ALLOTMENTS_KEY || key === D_ACCESS_REQUESTS_KEY) {
      const held = dArr(cur).filter((r) => !inScope(r && r.districtId));
      if (held.length) out[key] = __stitchUnique(held, dArr(out[key]));
      continue;
    }
    if (D_PER_DISTRICT.indexOf(key) >= 0) {
      const src = dObj(cur);
      const bucket = Object.assign({}, dObj(out[key]));
      for (const d of Object.keys(src)) {
        if (inScope(d)) continue;
        bucket[d] = src[d];
      }
      out[key] = bucket;
      continue;
    }
    // Maintenance keys are per district too, but their name ends in
    // "_dist_<id>", so the suffix rule below used to catch them first and treat
    // the whole prefix - "hp_inventory.maintenance" - as if it were a district
    // id. It never is, so the key always looked out of scope and the stored
    // value was put back over whatever the client had sent. A maintenance
    // request raised in the app was therefore discarded here, silently, before
    // any rule could look at it - which is also why the maintenance gate never
    // fired. The district is taken off the end of the key here and the same
    // in-scope test applied to it, so a request for a district you belong to
    // goes through and one for anywhere else does not.
    if (key.indexOf(MAINT_KEY_PREFIX) === 0) {
      const maintDistId = key.slice(MAINT_KEY_PREFIX.length);
      if (inScope(maintDistId)) continue;   // the caller's own district: theirs to change
      out[key] = cur;                      // someone else's: put back what was stored
      continue;
    }
    if (key.indexOf(D_SUFFIXED) >= 0) {
      const idx = key.indexOf(D_SUFFIXED);
      if (!inScope(key.slice(0, idx))) out[key] = cur;
      continue;
    }
    if (key === D_ITEM_PHOTOS_KEY || key === D_PERSON_PHOTOS_KEY) {
      const src = dObj(cur);
      const bucket = Object.assign({}, dObj(out[key]));
      for (const k of Object.keys(src)) {
        if (inScope(dPhotoOwnerIn(k, src[k]))) continue;
        bucket[k] = src[k];
      }
      out[key] = bucket;
      continue;
    }
  }
  return out;
}

// Classifies every maintenance change between two state blobs.
//
// Maintenance lives in one key PER DISTRICT - hp_inventory.maintenance_<id> -
// rather than in a single map, so each of those keys is scanned separately and
// the district it belongs to is read off the key itself. That is also what
// makes the check below meaningful: a request is only ever compared against the
// records of the district whose key it arrived in.
//
// The shape matches what authorizeMaintenanceWrites() expects: adds, edits and
// deletes, each carrying the record under `item` and, for an edit, what it
// looked like before under `prev`. The districtId is on the record itself and
// is deliberately NOT taken from the key, because that is the field the rules
// check - a record filed under one district's key but claiming another is
// exactly the case that has to be caught rather than assumed correct.
function diffMaintenanceWrites(prevState, nextState) {
  const writes = { adds: [], edits: [], deletes: [], hasWrites: false };
  const prev = (prevState && typeof prevState === 'object') ? prevState : {};
  const next = (nextState && typeof nextState === 'object') ? nextState : {};
  const keys = new Set();
  for (const k of Object.keys(prev)) if (k.indexOf(MAINT_KEY_PREFIX) === 0) keys.add(k);
  for (const k of Object.keys(next)) if (k.indexOf(MAINT_KEY_PREFIX) === 0) keys.add(k);
  for (const key of keys) {
    const districtId = key.slice(MAINT_KEY_PREFIX.length);
    const prevList = dArr(prev[key]);
    const nextList = dArr(next[key]);
    const prevById = new Map(prevList.map(r => [r && r.id, r]));
    const nextById = new Map(nextList.map(r => [r && r.id, r]));
    for (const [id, rec] of nextById) {
      if (!id || !rec) continue;
      const before = prevById.get(id);
      if (!before) writes.adds.push({ districtId, item: rec, kind: 'maintenance' });
      else if (stableStringify(before) !== stableStringify(rec)) {
        writes.edits.push({ districtId, item: rec, prev: before, kind: 'maintenance' });
      }
    }
    for (const [id, rec] of prevById) {
      if (!rec) continue;
      if (!nextById.has(id)) writes.deletes.push({ districtId, item: rec, kind: 'maintenance' });
    }
  }
  writes.hasWrites = (writes.adds.length + writes.edits.length + writes.deletes.length) > 0;
  return writes;
}

// Normalises a whole state so every maintenance record in it is in the shape the
// client expects and no client-supplied history survives. Called after the
// writes have been authorised and before the state is stored, so what is saved
// is the server's version of the record rather than the one that arrived.
function finalizeMaintenanceState(user, prevState, nextState) {
  const out = Object.assign({}, nextState);
  for (const key of Object.keys(out)) {
    if (key.indexOf(MAINT_KEY_PREFIX) !== 0) continue;
    const prevList = dArr((prevState || {})[key]);
    const prevById = new Map(prevList.map(r => [r && r.id, r]));
    out[key] = dArr(out[key]).map((rec) => {
      const clean = sanitizeMaintenanceRecord(rec);
      return clean ? finishMaintenanceRecord(user, prevById.get(rec.id), clean) : clean;
    });
  }
  return out;
}

function __consMap(state, key) {
  const v = state && state[key];
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
// Classifies every consumable change between two state blobs.
function diffConsumableWrites(prevState, nextState) {
  const writes = { adds: [], edits: [], deletes: [], hasWrites: false };
  const scan = (prevAll, nextAll, kind) => {
    const distIds = new Set(Object.keys(prevAll).concat(Object.keys(nextAll)));
    for (const districtId of distIds) {
      const prevById = new Map((Array.isArray(prevAll[districtId]) ? prevAll[districtId] : []).map(r => [r && r.id, r]));
      const nextById = new Map((Array.isArray(nextAll[districtId]) ? nextAll[districtId] : []).map(r => [r && r.id, r]));
      for (const [id, rec] of nextById) {
        if (!id || !rec) continue;
        const prev = prevById.get(id);
        if (!prev) writes.adds.push({ districtId, rec, kind });
        else if (stableStringify(prev) !== stableStringify(rec)) writes.edits.push({ districtId, rec, prev, kind });
      }
      for (const [id, rec] of prevById) {
        if (!rec) continue;
        if (!nextById.has(id)) writes.deletes.push({ districtId, rec, kind });
      }
    }
  };
  scan(__consMap(prevState, CONS_ITEMS_KEY), __consMap(nextState, CONS_ITEMS_KEY), 'item');
  scan(__consMap(prevState, CONS_TXNS_KEY), __consMap(nextState, CONS_TXNS_KEY), 'txn');
  writes.hasWrites = (writes.adds.length + writes.edits.length + writes.deletes.length) > 0;
  return writes;
}
function __consQtyInt(t) {
  const q = Number(t && t.qty);
  return Number.isInteger(q) && q > 0 ? q : null;
}
// Replay helper: oldest first so sequential snapshots validate.
function __consOrdered(list) {
  return (Array.isArray(list) ? list.slice() : []).sort((a, b) => ((a && a.createdAt) || 0) - ((b && b.createdAt) || 0));
}
function authorizeConsumableWrites(user, writes, opts) {
  opts = opts || {};
  if (!writes || !writes.hasWrites) return { ok: true };
  if (!user) {
    return { ok: false, status: 401, code: 'RBAC_CONS_UNAUTHENTICATED', error: 'Authentication required to modify consumable records.', detail: null };
  }
  if (user.role === 'devadmin') {
    return { ok: false, status: 403, code: 'RBAC_CONS_FORBIDDEN', error: 'Developer Admin has read-only access to consumables: adding, distributing, approving and editing consumable records is not permitted.', detail: { role: user.role } };
  }
  const deny = (code, error, detail) => ({ ok: false, status: 403, code, error, detail: detail || null });
  // District scope: every touched record must be inside your own district.
  const allWrites = writes.adds.concat(writes.edits).concat(writes.deletes);
  for (const e of allWrites) {
    if (e.districtId !== user.districtId) {
      return deny("RBAC_CONS_FORBIDDEN", `Forbidden: consumable records may only be changed inside your own district (record district: ${e.districtId}, yours: ${user.districtId}).`, { districtId: e.districtId, kind: e.kind });
    }
  }
  // Immutable ledger: transactions can never be edited or deleted.
  const txnEdits = writes.edits.filter(e => e.kind === 'txn');
  const txnDeletes = writes.deletes.filter(e => e.kind === 'txn');
  if (txnEdits.length) return deny('RBAC_CONS_IMMUTABLE', 'Forbidden: consumable transaction history is immutable and cannot be edited.', { count: txnEdits.length });
  if (txnDeletes.length) return deny('RBAC_CONS_IMMUTABLE', 'Forbidden: consumable transaction history is immutable and cannot be deleted.', { count: txnDeletes.length });
  const prevState = opts.prevState || {};
  const prevTxns = (Array.isArray(__consMap(prevState, CONS_TXNS_KEY)[user.districtId]) ? __consMap(prevState, CONS_TXNS_KEY)[user.districtId] : []);
  // Items: deletion would orphan history — denied.
  for (const e of writes.deletes.filter(e => e.kind === 'item')) {
    const itemId = e.rec && e.rec.id;
    if (prevTxns.some(t => t && t.itemId === itemId)) return deny('RBAC_CONS_IMMUTABLE', 'Forbidden: consumable items with transaction history cannot be deleted.', null);
  }
  // Item edits: keep the category-item relationship intact (name/photo/remarks may change).
  for (const e of writes.edits.filter(e => e.kind === 'item')) {
    if (String(e.prev.categoryId || '') !== String(e.rec.categoryId || '')) {
      return deny('RBAC_CONS_FORBIDDEN', 'Forbidden: a consumable item cannot be moved to another category.', { itemId: e.rec.id });
    }
    if (e.rec.condition && e.rec.condition !== "Good") {
      return deny('RBAC_CONS_FORBIDDEN', "Forbidden: consumable items only support the \"Good\" condition.", { itemId: e.rec.id });
    }
  }
  // Item adds: name required, condition always Good.
  for (const e of writes.adds.filter(a => a.kind === 'item')) {
    const it = e.rec || {};
    if (!String(it.name || '').trim()) {
      return deny('RBAC_CONS_FORBIDDEN', 'Forbidden: a consumable item requires a name.', { itemId: it.id });
    }
    if (it.condition && it.condition !== "Good") {
      return deny('RBAC_CONS_FORBIDDEN', "Forbidden: consumable items only support the \"Good\" condition.", { itemId: it.id });
    }
  }
  // ---- Transaction ledger validation ----
  const nextState = opts.nextState || {};
  const prevItems = __consArr(prevState, 'hp_inventory.consumable_items', user.districtId);
  const nextItems = __consArr(nextState, 'hp_inventory.consumable_items', user.districtId);
  const itemsById = new Map();
  for (const it of prevItems) if (it && it.id) itemsById.set(it.id, it);
  for (const it of nextItems) if (it && it.id) itemsById.set(it.id, it);
  const aggByItem = {};
  const reqState = {};
  const reqById = {};
  const replay = (t) => {
    if (!t || !t.itemId) return;
    const agg = (aggByItem[t.itemId] = aggByItem[t.itemId] || { total: 0, pending: 0, distributed: 0, lost: 0 });
    __consAggFor(agg, t);
    if (t.type === 'DISTRIBUTION_REQUEST') { reqState[t.id] = 'pending'; reqById[t.id] = t; }
    else if (t.type === 'DISTRIBUTION_APPROVED' && t.requestId) reqState[t.requestId] = 'approved';
    else if (t.type === 'DISTRIBUTION_REJECTED' && t.requestId) reqState[t.requestId] = 'rejected';
  };
  for (const t of __consOrdered(prevTxns)) replay(t);
  const addsTxns = writes.adds.filter(a => a.kind === 'txn').map(a => a.rec);
  for (const t of __consOrdered(addsTxns)) {
    const fail = (msg) => deny('RBAC_CONS_LEDGER', `Forbidden: invalid consumable transaction (${msg}).`, { txnId: t.id, type: t.type });
    if (!t || !t.itemId) return fail("missing item");
    if (!CONS_TYPES[t.type]) return fail(`unknown type "${t.type}"`);
    if (t.type === "DELETED") {
      const item = itemsById.get(t.itemId);
      if (!item) return fail("unknown consumable item");
      const agg = (aggByItem[t.itemId] = aggByItem[t.itemId] || { total: 0, pending: 0, distributed: 0, lost: 0 });
      const availForNew = agg.total - agg.distributed - agg.lost - agg.pending;
      if (availForNew > 0 || agg.pending > 0) return deny("RBAC_CONS_QTY", `Forbidden: cannot delete item with remaining stock. Available: ${availForNew}.`, { itemId: t.itemId, available: availForNew });
      continue;
    }
    const q = __consQtyInt(t);
    if (!q) return fail("quantity must be a positive whole number");
    const item = itemsById.get(t.itemId);
    if (!item) return fail("unknown consumable item");
    if (String(t.categoryId || '') !== String(item.categoryId || '')) return fail('category does not match the item');
    const agg = (aggByItem[t.itemId] = aggByItem[t.itemId] || { total: 0, pending: 0, distributed: 0, lost: 0 });
    const availForNew = agg.total - agg.distributed - agg.lost - agg.pending;
    const nowNext = () => ({
      total: agg.total,
      available: Math.max(0, agg.total - agg.distributed - agg.lost - agg.pending),
      pending: agg.pending, distributed: agg.distributed, lost: agg.lost,
    });
    if (t.type === 'ADD') {
      agg.total += q;
    } else if (t.type === 'DISTRIBUTION_REQUEST') {
      if (String(t.byId || '') !== String(user.id)) return fail('Distributed By must be the logged-in user');
      if (t.toType === 'unit') {
        const locs = __consArr(prevState, 'hp_inventory.locations', user.districtId);
        if (!locs.some(l => l && l.id === t.toId)) return fail('recipient unit must exist inside your own district');
      } else if (t.toType === 'staff') {
        const users = Array.isArray(prevState['hp_inventory.users']) ? prevState['hp_inventory.users'] : [];
        if (!users.some(u => u && u.id === t.toId && u.districtId === user.districtId)) return fail('recipient staff must exist inside your own district');
      } else return fail('recipient type must be unit or staff');
      if (!t.toName) return fail('recipient name missing');
      if (q > availForNew) return deny("RBAC_CONS_QTY", `Forbidden: insufficient available quantity. Available: ${availForNew}, requested: ${q}.`, { itemId: t.itemId, requested: q, available: availForNew });
      agg.pending += q;
      reqState[t.id] = 'pending';
      reqById[t.id] = t;
    } else if (t.type === 'DISTRIBUTION_APPROVED' || t.type === 'DISTRIBUTION_REJECTED') {
      const rid = String(t.requestId || '');
      const req = reqById[rid];
      if (!req) return fail('unknown distribution request');
      if (reqState[rid] !== 'pending') return fail('this request was already approved or rejected');
      const isRecipient = req.toType === 'staff' ? String(user.id) === String(req.toId) : String(user.locationId) === String(req.toId);
      if (!isRecipient) return fail('only the receiving unit/staff may approve or reject this request');
      if (q !== __consQtyInt(req)) return fail('approved/rejected quantity must match the requested quantity');
      if (t.type === 'DISTRIBUTION_REJECTED' && !String(t.reason || '').trim()) return fail('rejection requires a reason');
      if (t.type === 'DISTRIBUTION_APPROVED') { agg.pending -= q; agg.distributed += q; }
      else agg.pending -= q;
      reqState[rid] = t.type === 'DISTRIBUTION_APPROVED' ? 'approved' : 'rejected';
    } else if (t.type === 'LOSS') {
      if (q > availForNew) return deny("RBAC_CONS_LOSS_FORBIDDEN", `Forbidden: insufficient available quantity. Available: ${availForNew}, lost: ${q}.`, { itemId: t.itemId, available: availForNew });
      agg.lost += q;
    }
    // Snapshot integrity: the client must record accurate next-state values.
    const expectNext = nowNext();
    if (t.next && stableStringify(t.next) !== stableStringify(expectNext)) {
      return deny('RBAC_CONS_SNAPSHOT', 'Forbidden: quantity snapshot does not match the authoritative ledger.', { txnId: t.id, expected: expectNext, got: t.next });
    }
  }
  return { ok: true };
}
function __consAggFor(agg, txn) {
  const q = Math.max(0, Math.floor(Number(txn.qty) || 0));
  if (txn.type === 'ADD') agg.total += q;
  else if (txn.type === 'DISTRIBUTION_REQUEST') agg.pending += q;
  else if (txn.type === 'DISTRIBUTION_APPROVED') { agg.pending -= q; agg.distributed += q; }
  else if (txn.type === 'DISTRIBUTION_REJECTED') agg.pending -= q;
  else if (txn.type === 'LOSS') agg.lost += q;
  return agg;
}
function __consArr(state, key, distId) {
  const m = __consMap(state, key);
  return Array.isArray(m[distId]) ? m[distId] : [];
}

/* ==================== STRUCTURE RBAC (districts / locations / users) ====================
   District/location/user structure writes are authorised against the SESSION
   user - never the payload. Devadmin-only: districts. District admins may
   manage locations and users inside their OWN district only. Integrity rules
   (unique codes, orphan guards, DA delete rule) enforced server-side. */

const STRUCT_DISTRICTS_KEY = "hp_inventory.districts";
const STRUCT_LOCATIONS_KEY = "hp_inventory.locations";
const STRUCT_USERS_KEY = "hp_inventory.users";
const STRUCT_LOC_TYPES = ["phq", "igRange", "district", "otherHq", "station", "post", "mhc", "staff", "office"];
/* PHQ and IG Range sit above the districts, so they live under one reserved key
   in the location map instead of a district. They are never districts themselves. */
const STRUCT_HQ_SCOPE = "__hq__";
const STRUCT_HQ_TYPES = ["phq", "igRange"];
function __stIsHqType(t) { return STRUCT_HQ_TYPES.indexOf(String(t || "")) >= 0; }
function __stHqLocations(state) {
  const v = __stLocMap(state)[STRUCT_HQ_SCOPE];
  return Array.isArray(v) ? v : [];
}
function __stDistrictsInRange(districts, rangeId) {
  return districts.filter(d => d && rangeId && d.rangeId === rangeId);
}

function __stArrOf(state, key) {
  const v = state ? state[key] : null;
  return Array.isArray(v) ? v : [];
}
function __stLocMap(state) {
  const v = state ? state[STRUCT_LOCATIONS_KEY] : null;
  return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
}
function __stNormDist(d) {
  return { id: d.id || "", name: d.name || "", code: String(d.code || "").toUpperCase(), headquarters: d.headquarters || "", rangeId: d.rangeId || "" };
}
/* Every field that decides WHERE a role sits must take part in the diff, or a
   change to it would be invisible here and the placement rules would never run. */
function __stNormUser(u) {
  return {
    id: u.id || "",
    username: String(u.username || "").toLowerCase(),
    name: u.name || "",
    mobile: u.mobile || "",
    role: u.role || "",
    districtId: u.districtId || "",
    locationId: u.locationId || "",
    locationType: u.locationType || "",
    rangeId: u.rangeId || "",
    districtIds: Array.isArray(u.districtIds) ? u.districtIds.filter(Boolean).slice().sort() : [],
  };
}

function __stNormLoc(l) {
  return { id: l.id || "", name: l.name || "", type: l.type || "", districtId: l.districtId || "" };
}

function __stDiffList(prevList, nextList, norm) {
  const pm = {}, nm = {};
  for (const x of prevList) if (x && x.id) pm[x.id] = x;
  for (const x of nextList) if (x && x.id) nm[x.id] = x;
  const changes = [];
  for (const id of Object.keys(nm)) {
    if (!pm[id]) changes.push({ op: "add", item: nm[id] });
    else if (JSON.stringify(norm(pm[id])) !== JSON.stringify(norm(nm[id]))) changes.push({ op: "edit", prev: pm[id], item: nm[id] });
  }
  for (const id of Object.keys(pm)) if (!nm[id]) changes.push({ op: "delete", prev: pm[id] });
  return changes;
}

function diffStructureWrites(prevState, nextState) {
  const districts = __stDiffList(__stArrOf(prevState, STRUCT_DISTRICTS_KEY), __stArrOf(nextState, STRUCT_DISTRICTS_KEY), __stNormDist)
    .map(w => (w.op === "delete"
      ? { op: "delete", districtId: w.prev.id, district: w.prev, prev: null }
      : { op: w.op, districtId: w.item.id, district: w.item, prev: w.prev || null }));
  const users = __stDiffList(__stArrOf(prevState, STRUCT_USERS_KEY), __stArrOf(nextState, STRUCT_USERS_KEY), __stNormUser)
    .map(w => (w.op === "delete"
      ? { op: "delete", userId: w.prev.id, user: w.prev, prev: w.prev }
      : { op: w.op, userId: w.item.id, user: w.item, prev: w.prev || null }));
  const prevL = __stLocMap(prevState), nextL = __stLocMap(nextState);
  const locations = [];
  const distIds = [];
  for (const k of Object.keys(prevL)) if (distIds.indexOf(k) === -1) distIds.push(k);
  for (const k of Object.keys(nextL)) if (distIds.indexOf(k) === -1) distIds.push(k);
  for (const districtId of distIds) {
    const a = Array.isArray(prevL[districtId]) ? prevL[districtId] : [];
    const b = Array.isArray(nextL[districtId]) ? nextL[districtId] : [];
    for (const w of __stDiffList(a, b, __stNormLoc)) {
      if (w.op === "delete") locations.push({ op: "delete", districtId, locationId: w.prev.id, location: w.prev, prev: null });
      else locations.push({ op: w.op, districtId, locationId: w.item.id, location: w.item, prev: w.prev || null });
    }
  }
  return { districts, users, locations };
}

function __structDeny(status, code, error) { return { ok: false, status, code, error }; }

function authorizeStructureWrites(user, prevState, nextState) {
  /* Bootstrap: a completely empty user store may be seeded by a fresh client install. */
  if (!user && __stArrOf(prevState, STRUCT_USERS_KEY).length === 0) return { ok: true };
  if (!user) return __structDeny(401, "RBAC_STRUCT_AUTH", "Not authenticated.");
  const isDev = user.role === "devadmin";
  const isAdmin = user.role === "admin";
  const prevUsers = __stArrOf(prevState, STRUCT_USERS_KEY);
  const nextUsers = __stArrOf(nextState, STRUCT_USERS_KEY);
  const nextDistricts = __stArrOf(nextState, STRUCT_DISTRICTS_KEY);
  const nextLocMap = __stLocMap(nextState);
  const fresh = prevUsers.length === 0;
  const writes = diffStructureWrites(prevState, nextState);

  /* ---------- DISTRICTS: devadmin only ---------- */
  for (const w of writes.districts) {
    if (!isDev) return __structDeny(403, "RBAC_DISTRICT_FORBIDDEN", "Only Developer Admin can manage districts.");
    const d = w.district || {};
    const name = String(d.name || "").trim();
    const code = String(d.code || "").trim().toUpperCase();
    const hq = String(d.headquarters || "").trim();
    if (w.op === "delete") {
      const remainingUsers = nextUsers.filter(u => u && u.districtId === w.districtId && u.role !== "ig" && u.role !== "devadmin");
      if (remainingUsers.length) return __structDeny(400, "RBAC_DISTRICT_HAS_USERS", "District has users. Remove them first.");
      const locs = nextLocMap[w.districtId];
      if (Array.isArray(locs) && locs.length) return __structDeny(400, "RBAC_DISTRICT_HAS_LOCATIONS", "District has locations. Remove them first.");
      if (nextDistricts.length < 1) return __structDeny(400, "RBAC_LAST_DISTRICT", "Cannot delete the last district.");
      continue;
    }
    if (!name || !code || !hq) return __structDeny(400, "RBAC_DISTRICT_FIELDS", "District name, code and headquarters are required.");
    if (nextDistricts.some(x => x && x.id !== w.districtId && String(x.name || "").trim().toLowerCase() === name.toLowerCase()))
      return __structDeny(400, "RBAC_DISTRICT_DUPLICATE", "A district with this name already exists.");
    if (nextDistricts.some(x => x && x.id !== w.districtId && String(x.code || "").trim().toUpperCase() === code.toUpperCase()))
      return __structDeny(400, "RBAC_DISTRICT_CODE_TAKEN", "District code already exists.");
    // A district hangs under exactly one IG Range, and that range must really
    // exist: it is what an IG Admin's reach is derived from.
    const ranges = __stHqLocations(nextState).filter(l => l && l.type === "igRange");
    // if (!w.district.rangeId) return __structDeny(400, "RBAC_DISTRICT_RANGE", "Choose the IG Range this district falls under.");
    if (w.district.rangeId && !ranges.some(r => r.id === w.district.rangeId)) return __structDeny(400, "RBAC_DISTRICT_RANGE", "That IG Range does not exist.");
  }

  /* ---------- LOCATIONS: devadmin anywhere, district admin own district ---------- */
  for (const w of writes.locations) {
    const loc = w.location || w.prev || {};
    const isHq = __stIsHqType(loc.type);
    if (isHq) {
      // The PHQ and the IG Ranges belong to the state, not to any district: they
      // are Developer-Admin-only and must sit in the reserved state scope.
      if (!isDev) return __structDeny(403, "RBAC_LOC_HQ_FORBIDDEN", "Only the Developer Admin can manage the PHQ and IG Ranges.");
      if (w.districtId !== STRUCT_HQ_SCOPE) return __structDeny(400, "RBAC_LOC_HQ_SCOPE", `${__stLocTypeName(loc.type)} records belong to the state and cannot be filed under a district.`);
    } else {
      if (!isDev) {
        if (!isAdmin) return __structDeny(403, "RBAC_LOC_FORBIDDEN", "You are not allowed to manage locations.");
        if (w.districtId !== user.districtId) return __structDeny(403, "RBAC_LOC_SCOPE", "You can only manage locations in your own district.");
      }
      if (!nextDistricts.some(d => d && d.id === w.districtId)) return __structDeny(400, "RBAC_LOC_DISTRICT", "That district does not exist.");
    }
    const list = Array.isArray(nextLocMap[w.districtId]) ? nextLocMap[w.districtId] : [];
    if (w.op === "delete") {
      // a state-level unit is referenced by locationType, not by districtId
      const used = nextUsers.some(u => u && (isHq
        ? (u.locationId === w.locationId && (u.role === "devadmin" || u.rangeId === w.locationId))
        : (u.districtId === w.districtId && u.locationId === w.locationId)));
      if (used && !isDev) return __structDeny(400, "RBAC_LOC_IN_USE", "Location still has users. Reassign them first.");
      continue;
    }
    const name = String(loc.name || "").trim();
    if (!name) return __structDeny(400, "RBAC_LOC_NAME", "Location name is required.");
    if (STRUCT_LOC_TYPES.indexOf(String(loc.type || "")) === -1) return __structDeny(400, "RBAC_LOC_TYPE", "Invalid location type.");
    if (list.some(x => x && x.id !== w.locationId && String(x.name || "").trim().toLowerCase() === name.toLowerCase()))
      return __structDeny(400, "RBAC_LOC_DUPLICATE", "A location with this name already exists here.");
  }

/* Where a role is allowed to sit in the hierarchy:
   Developer Admin -> PHQ, IG Admin -> IG Range, everyone else -> a district.
   This is the one place that decides it, so the forms and the guard can never
   disagree about what a role belongs to. */
function __stRoleHomeType(role) {
  if (role === "devadmin") return "phq";
  if (role === "ig") return "igRange";
  return null;
}

function __stValidateUserPlacement(nextDistricts, nextLocMap, u, isAdd) {
  const role = String(u.role || "");
  const want = __stRoleHomeType(role);
  if (want) {
    // state-level role: attached to a PHQ or an IG Range, never to a district
    if (String(u.locationType || "") !== want)
      return __structDeny(400, "RBAC_USER_HOME_TYPE", want === "phq"
        ? "A Developer Admin must be attached to a PHQ location."
        : "An IG Admin must be attached to an IG Range location.");
    const hq = __stHqLocations({ [STRUCT_LOCATIONS_KEY]: nextLocMap });
    if (!hq.some(l => l && l.id === u.locationId && l.type === want))
      return __structDeny(400, "RBAC_USER_HOME_LOCATION", want === "phq"
        ? "Select an existing PHQ location."
        : "Select an existing IG Range location.");
    if (want === "igRange") {
      if (!u.rangeId) return __structDeny(400, "RBAC_USER_RANGE", "Choose the IG Range this Inspector General will hold.");
      if (!hq.some(l => l && l.id === u.rangeId && l.type === "igRange"))
        return __structDeny(400, "RBAC_USER_RANGE", "That IG Range does not exist.");
      const inRange = __stDistrictsInRange(nextDistricts, u.rangeId).map(d => d.id);
      const claimed = Array.isArray(u.districtIds) ? u.districtIds.filter(Boolean) : [];
      // An IG Range can have 0 districts (e.g. unassigned, newly created, or during district reassignments)
      // no smuggling: every claimed district really has to sit inside the range
      const outside = claimed.filter(id => inRange.indexOf(id) < 0);
      if (outside.length && !isDev) return __structDeny(403, "RBAC_USER_RANGE_SCOPE", "An IG Admin may only hold the districts that fall under their own IG Range.");
    }
    return null;
  }
  // district-level role: a real district, and a unit inside it
  const d = nextDistricts.find(x => x && x.id === u.districtId);
  if (!d) return __structDeny(400, "RBAC_USER_DISTRICT", isAdd ? "Choose the district for this account." : "That district does not exist.");
  const locs = Array.isArray(nextLocMap[u.districtId]) ? nextLocMap[u.districtId] : [];
  if (u.locationId && !locs.some(l => l && l.id === u.locationId)) return __structDeny(400, "RBAC_USER_LOCATION", "Location does not belong to the selected district.");
  // the account inherits the range its district sits in, so the form can show it
  if (u.rangeId !== d.rangeId) u.rangeId = d.rangeId;
  return null;
}


  /* ---------- USERS ---------- */
  if (!fresh) {
    for (const w of writes.users) {
      if (!isDev) {
        if (!isAdmin) return __structDeny(403, "RBAC_USER_FORBIDDEN", "You are not allowed to manage users.");
        const scopeDistrict = w.op === "delete" ? (w.prev ? w.prev.districtId : w.user && w.user.districtId) : w.user.districtId;
        if (scopeDistrict !== user.districtId) return __structDeny(403, "RBAC_USER_SCOPE", "You can only manage users in your own district.");
        const effRole = w.op === "delete" ? (w.prev ? w.prev.role : "") : w.user.role;
        // An IG account spans districts and is therefore Developer-Admin-only,
        // exactly like an administrator account.
        if (effRole === "admin" || effRole === "devadmin" || effRole === "ig") return __structDeny(403, "RBAC_USER_ADMIN_TARGET", "You cannot manage administrator or Inspector General accounts.");
        if (w.op === "edit" && w.prev && w.prev.districtId !== w.user.districtId) return __structDeny(403, "RBAC_USER_MOVE", "District cannot be changed.");
      }
      if (w.op === "add") {
        const u = w.user || {};
        const username = String(u.username || "").trim();
        if (!username) return __structDeny(400, "RBAC_USER_NAME", "Username is required.");
        if (nextUsers.some(x => x && x.id !== u.id && String(x.username || "").trim().toLowerCase() === username.toLowerCase()))
          return __structDeny(400, "RBAC_USER_TAKEN", "Username already exists.");
        if (!String(u.name || "").trim()) return __structDeny(400, "RBAC_USER_DISPLAY", "Display name is required.");
        if (!/^\d{10}$/.test(String(u.mobile || "").trim())) return __structDeny(400, "RBAC_USER_MOBILE", "Mobile number must be exactly 10 digits.");
        const knownRoles = ["devadmin", "ig", "admin", "user", "mhc", "tsi", "station", "staff", "post", "itstaff", "mtostaff", "unit", "role"];
        if (knownRoles.indexOf(String(u.role || "")) === -1) return __structDeny(400, "RBAC_USER_ROLE", "Invalid role.");
        if ((u.role === "admin" || u.role === "devadmin") && !isDev) return __structDeny(403, "RBAC_USER_ROLE_FORBIDDEN", "You cannot assign admin roles.");
        const pw = String(u.password || "");
        if (!pw) return __structDeny(400, "RBAC_USER_PASSWORD", "Password is required.");
        if (pw.indexOf("$2") !== 0 && pw.length < 6) return __structDeny(400, "RBAC_USER_PASSWORD_WEAK", "Password must be at least 6 characters.");
        const place = __stValidateUserPlacement(nextDistricts, nextLocMap, u, true);
        if (place) return place;
      }
      if (w.op === "edit") {
        const u = w.user || {};
        const username = String(u.username || "").trim();
        if (!username) return __structDeny(400, "RBAC_USER_NAME", "Username is required.");
        if (nextUsers.some(x => x && x.id !== u.id && String(x.username || "").trim().toLowerCase() === username.toLowerCase()))
          return __structDeny(400, "RBAC_USER_TAKEN", "Username already taken.");
        if (u.mobile !== undefined && !/^\d{10}$/.test(String(u.mobile || "").trim())) return __structDeny(400, "RBAC_USER_MOBILE", "Mobile number must be exactly 10 digits.");
        if ((u.role === "admin" || u.role === "devadmin") && !isDev) return __structDeny(403, "RBAC_USER_ROLE_FORBIDDEN", "You cannot assign admin roles.");
        const place = __stValidateUserPlacement(nextDistricts, nextLocMap, u, false);
        if (place) return place;
        if (w.prev && w.prev.role === "devadmin" && u.role !== "devadmin") {
          const otherDevs = nextUsers.filter(x => x && x.id !== u.id && x.role === "devadmin");
          if (!otherDevs.length) return __structDeny(400, "RBAC_LAST_DEVADMIN", "Cannot demote the last Developer Admin.");
        }
        const pw = String(u.password || "");
        if (pw && pw.indexOf("$2") !== 0 && pw.length < 6) return __structDeny(400, "RBAC_USER_PASSWORD_WEAK", "Password must be at least 6 characters.");
      }
      if (w.op === "delete") {
        const prev = w.prev || {};
        // An IG that still answers for a district may not be removed: clear its
        // scope first, so no district is left without the IG above it. districtId
        // alone counts, because it is the IG's home district.
        if (prev.role === "ig") {
          if (!isDev) {
            const scope = Array.isArray(prev.districtIds) && prev.districtIds.length ? prev.districtIds : [prev.districtId];
            if (scope.filter(Boolean).length) {
              return __structDeny(403, "RBAC_IG_HAS_DISTRICTS", `This IG Admin still handles ${scope.filter(Boolean).length} district(s) ("${prev.username || prev.id}"). Clear the districts first, then delete.`);
            }
          }
        }
        if (prev.role === "devadmin") {
          // A Developer Admin cannot remove their own account, even when a
          // second one exists: the UI hides the button, and this is the same rule
          // on the server so a hand-built request cannot do what the page won't.
          if (user && prev.id === user.id) return __structDeny(400, "RBAC_SELF_DELETE", "You cannot delete your own account. Edit it instead.");
          const otherDevs = nextUsers.filter(x => x && x.id !== prev.id && x.role === "devadmin");
          if (!otherDevs.length) return __structDeny(400, "RBAC_LAST_DEVADMIN", "Cannot delete the last Developer Admin.");
        }
        if (prev.role === "admin") {
          const assigned = nextUsers.filter(x => x && x.id !== prev.id && x.districtId === prev.districtId && x.role !== "admin" && x.role !== "devadmin");
          if (assigned.length) return __structDeny(403, "RBAC_DA_HAS_USERS", "This District Admin cannot be deleted because users are still assigned to this account.");
        }
      }
    }
  }
  /* ---------- keep every IG's reach in step with its IG Range ----------
     The range is the source of truth: moving a district to another range has to
     move that district in and out of the IG accounts holding those ranges, or a
     stale districtIds would quietly keep an IG inside a district it lost. */
  for (const u of nextUsers) {
    if (!u || u.role !== "ig" || !u.rangeId) continue;
    const inRange = __stDistrictsInRange(nextDistricts, u.rangeId).map(d => d.id);
    const cur = Array.isArray(u.districtIds) ? u.districtIds.filter(Boolean) : [];
    const same = cur.length === inRange.length && cur.every((id, i) => id === inRange[i]);
    if (!same) u.districtIds = inRange.slice();
    // an emptied range leaves nothing to file the account under, and a stale
    // districtId left behind would keep that IG undeletable forever
    if (!inRange.length) { if (u.districtId) u.districtId = ""; continue; }
    if (u.districtId !== inRange[0]) u.districtId = inRange[0];
  }
  return { ok: true };
}

