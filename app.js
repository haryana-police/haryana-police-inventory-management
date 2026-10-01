"use strict";

const STORAGE_PREFIX = "hp_inventory.";
const AUTH_KEY = STORAGE_PREFIX + "auth";
const APP_VERSION = "2026.09.211";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => { const d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; };

/* --- Bilingual item names ---------------------------------------------------
   Item names are stored as one bilingual string, e.g. "Cooler Iron कूलर लोहा".
   In tables we show the English half on the first line and the Devanagari half
   on the second line, instead of running both together on one line.            */
const DEVA_RE = /[\u0900-\u097F]/;
function nameEnHi(name) {
  const s = String(name == null ? "" : name);
  const i = s.search(DEVA_RE);
  if (i < 1) return null;                      // -1 = English only, 0 = Hindi only
  const en = s.slice(0, i).trim();
  const hi = s.slice(i).trim();
  return en && hi ? { en: en, hi: hi } : null;
}
/* HTML for a table cell holding an item name: English on top, Hindi below. */
function nameCell(name) {
  const b = nameEnHi(name);
  if (!b) return esc(name);
  return '<span class="nm-en">' + esc(b.en) + '</span><span class="nm-hi">' + esc(b.hi) + '</span>';
}
window.nameCell = nameCell;
window.nameEnHi = nameEnHi;
/* Column-aware cell for the generic table renderers: an item-name column is drawn
   bilingual, every other column is escaped as before. */
const ITEM_COL_RE = /^\s*(item|item\s*\/\s*asset|item name|asset|item code)\s*$/i;
function isItemCol(header) { return ITEM_COL_RE.test(String(header == null ? "" : header)); }
function colCell(header, value) { return isItemCol(header) ? nameCell(value) : esc(value); }
/* Same split, but styled inline. Print windows and the Word/PDF exports build their
   own stylesheet, so the .nm-en / .nm-hi classes are not available there. */
function nameCellInline(name) {
  const b = nameEnHi(name);
  if (!b) return esc(name);
  return '<span style="display:block;font-weight:600">' + esc(b.en) + '</span>' +
         '<span style="display:block;font-size:.88em;color:#64748b">' + esc(b.hi) + '</span>';
}
function colCellInline(header, value) { return isItemCol(header) ? nameCellInline(value) : esc(value); }
window.nameCellInline = nameCellInline;
window.colCellInline = colCellInline;
window.isItemCol = isItemCol;
window.colCell = colCell;

window.addEventListener("error", e => {
  try {
    if (e && e.message) opencodeToast("Error: " + e.message, "error");
  } catch (_) {}
});
function opencodeToast(msg, type) {
  try { toast(msg, type); } catch (_) { console.error(msg); }
}

const DEFAULT_CATEGORIES = [
  { id: "weapons", name: "Weapons & Ammunition", icon: "🔫" },
  { id: "uniforms", name: "Uniforms & Clothing", icon: "👮" },
  { id: "communication", name: "Communication Equipment", icon: "📻" },
  { id: "office", name: "Office & Admin Supplies", icon: "📋" },
  { id: "forensics", name: "Forensics & Investigation", icon: "🔍" },
  { id: "medical", name: "Medical & First Aid", icon: "🏥" },
  { id: "vehicles", name: "Vehicles & Transport", icon: "🚗" },
  { id: "barricades", name: "Barricades", icon: "🚧" },
  { id: "furniture", name: "Furniture (Tables, Chairs)", icon: "🪑" },
  { id: "sound", name: "Sound System (Speakers, etc.)", icon: "🔊" },
  { id: "riot", name: "Riot Gear", icon: "🛡️" },
  { id: "other", name: "Other Items", icon: "📦" },
];

const DEFAULT_DISTRICTS = [
  { id: "dist_1", name: "Gurugram District", code: "GGN", headquarters: "Gurugram", createdAt: Date.now() },
  { id: "dist_2", name: "Faridabad District", code: "FBD", headquarters: "Faridabad", createdAt: Date.now() },
];

const DEFAULT_LOCATIONS = {
  dist_1: [
    { id: "ggn_hq", name: "District HQ - Gurugram", type: "district", districtId: "dist_1" },
    { id: "ggn_station_1", name: "PS DLF Phase 3", type: "station", districtId: "dist_1" },
    { id: "ggn_station_2", name: "PS Sadar Bazaar", type: "station", districtId: "dist_1" },
    { id: "ggn_post_1", name: "PP Sector 5", type: "post", districtId: "dist_1" },
    { id: "ggn_mhc", name: "MHC Gurugram Central", type: "mhc", districtId: "dist_1" },
  ],
  dist_2: [
    { id: "fbd_hq", name: "District HQ - Faridabad", type: "district", districtId: "dist_2" },
    { id: "fbd_station_1", name: "PS NIT", type: "station", districtId: "dist_2" },
    { id: "fbd_station_2", name: "PS Ballabgarh", type: "station", districtId: "dist_2" },
    { id: "fbd_post_1", name: "PP Nehar Par", type: "post", districtId: "dist_2" },
    { id: "fbd_mhc", name: "MHC Faridabad Central", type: "mhc", districtId: "dist_2" },
  ],
};

const DEFAULT_ITEMS = {}; // demo items removed (2026.09.210) — categories only

const DEFAULT_USERS = [
  { id: "u0", username: "developer", password: "dev@123", role: "devadmin", name: "Developer Admin", mobile: "9999999999", districtId: "dist_1", locationId: "ggn_hq", createdAt: Date.now() },
  { id: "u1", username: "admin", password: "admin123", role: "admin", name: "District Admin - Gurugram", mobile: "9876543210", districtId: "dist_1", locationId: "ggn_hq", createdAt: Date.now() },
  { id: "u2", username: "admin2", password: "admin123", role: "admin", name: "District Admin - Faridabad", mobile: "9876543215", districtId: "dist_2", locationId: "fbd_hq", createdAt: Date.now() },
  { id: "u3", username: "user", password: "user123", role: "user", name: "General Staff", mobile: "9876543211", districtId: "dist_1", locationId: "ggn_station_1", createdAt: Date.now() },
  { id: "u4", username: "mhc", password: "mhc123", role: "mhc", name: "MHC Officer - Gurugram", mobile: "9876543212", districtId: "dist_1", locationId: "ggn_mhc", createdAt: Date.now() },
  { id: "u5", username: "station", password: "station123", role: "station", name: "Station Manager - Gurugram", mobile: "9876543213", districtId: "dist_1", locationId: "ggn_station_1", createdAt: Date.now() },
  { id: "u6", username: "fbd_user", password: "user123", role: "user", name: "Staff - Faridabad", mobile: "9876543216", districtId: "dist_2", locationId: "fbd_station_1", createdAt: Date.now() },
  { id: "u7", username: "fbd_mhc", password: "mhc123", role: "mhc", name: "MHC Officer - Faridabad", mobile: "9876543217", districtId: "dist_2", locationId: "fbd_mhc", createdAt: Date.now() },
];

const ROLE_LABELS = { devadmin: "Developer Admin", ig: "Inspector General", admin: "District Admin", station: "Station Manager", staff: "Staff", mhc: "MHC", tsi: "TSI", post: "Police Post", user: "General User", itstaff: "Computer/IT Staff", mtostaff: "MTO Staff" };

/* ---- DISTRICT SCOPE (mirrors api/_rbac.js) ----
   Every role sits inside a set of districts. Most hold exactly one, through
   user.districtId. An Inspector General is given several through user.districtIds
   and is confined to exactly those - it never means "all districts", which is the
   Developer Admin's read-only scope and nothing else. */
function userDistricts(u) {
  if (!u) return [];
  if (u.role === "devadmin") return null;
  if (u.role === "ig") {
    const list = Array.isArray(u.districtIds) ? u.districtIds.filter(Boolean) : [];
    if (u.districtId && list.indexOf(u.districtId) < 0) list.unshift(u.districtId);
    return list;
  }
  return u.districtId ? [u.districtId] : [];
}
function inDistrictScope(districtId) {
  const d = userDistricts(currentUser);
  return d === null || d.indexOf(districtId) >= 0;
}
function isIg() { return !!(currentUser && currentUser.role === "ig"); }
function igDistrictNames() {
  const d = userDistricts(currentUser) || [];
  return d.map(id => { const x = getDistricts().find(y => y.id === id); return x ? x.name : id; });
}

/* ==================== CONDITION BAR HELPER ==================== */
function buildCondBar(cc) {
  const total = (cc.good || 0) + (cc.poor || 0) + (cc.damaged || 0);
  if (total === 0) return `<span style="color:var(--muted);font-size:.75rem">No data</span>`;
  const pct = (n) => Math.round((n / total) * 100);
  let bar = `<div class="cond-bar">`;
  if (cc.good) bar += `<div class="cond-bar-seg cond-bar-good" style="width:${pct(cc.good)}%" title="Good: ${cc.good}"></div>`;
  if (cc.poor) bar += `<div class="cond-bar-seg cond-bar-poor" style="width:${pct(cc.poor)}%" title="Damaged: ${cc.poor}"></div>`;
  if (cc.damaged) bar += `<div class="cond-bar-seg cond-bar-damaged" style="width:${pct(cc.damaged)}%" title="Scrap: ${cc.damaged}"></div>`;
  bar += `</div>`;
  bar += `<div class="cond-labels">`;
  if (cc.good) bar += `<span style="color:var(--green)">${cc.good}G</span>`;
  if (cc.poor) bar += `<span style="color:var(--amber)">${cc.poor}D</span>`;
  if (cc.damaged) bar += `<span style="color:var(--red)">${cc.damaged}S</span>`;
  bar += `</div>`;
  return bar;
}

/* ==================== PAGINATION ==================== */
const PAGE_SIZE = 30;
const __pg = {};
const __pgLast = {};

function __pgPage(key, totalRows) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  if ((__pgLast[key] || 0) !== totalRows) {
    __pg[key] = 0;
    __pgLast[key] = totalRows;
  }
  let p = __pg[key] || 0;
  if (p >= totalPages) p = totalPages - 1;
  if (p < 0) p = 0;
  __pg[key] = p;
  return p;
}

function __pgReset(key) { delete __pg[key]; delete __pgLast[key]; }

function __pgRows(key, rows) {
  // Sort the whole filtered list first (see TABLE SORTING below), then page it.
  const sorted = __sortRows(key, rows);
  const p = __pgPage(key, sorted.length);
  return sorted.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
}

function __pgButtons(page, totalPages) {
  if (totalPages <= 1) return "";
  const s = new Set([0, totalPages - 1]);
  for (let i = Math.max(0, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) s.add(i);
  const arr = [...s].sort((a, b) => a - b);
  let html = "";
  let prev = -2;
  arr.forEach(p => {
    if (p - prev > 1) html += `<span class="pager-ellipsis">?</span>`;
    const cls = p === page ? "pager-btn active" : "pager-btn";
    html += `<button type="button" class="${cls}" data-pg="${p}">${p + 1}</button>`;
    prev = p;
  });
  return html;
}

function renderPager(key, totalRows, renderFn) {
  // Remember how to re-render this table (used when a column header is clicked)
  // and refresh the sort arrows after every render.
  if (typeof renderFn === "function") __sortRenders[key] = renderFn;
  __sortSyncHeaders(key);
  const el = document.getElementById("pager_" + key);
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const page = __pgPage(key, totalRows);
  const from = totalRows ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min(totalRows, (page + 1) * PAGE_SIZE);
  if (!totalRows) { el.innerHTML = ""; return; }
  el.innerHTML =
    `<div class="pager">` +
      `<span class="pager-info">Showing ${from}–${to} of ${totalRows} ${totalRows === 1 ? "row" : "rows"}</span>` +
      `<div class="pager-btns">` +
        `<button type="button" class="pager-btn" data-pg="prev" ${page === 0 ? "disabled" : ""}>&#9664; Prev</button>` +
        __pgButtons(page, totalPages) +
        `<button type="button" class="pager-btn" data-pg="next" ${page >= totalPages - 1 ? "disabled" : ""}>Next &#9654;</button>` +
      `</div>` +
    `</div>`;
  el.querySelectorAll("[data-pg]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.pg;
      if (v === "prev") { if (page > 0) __pg[key] = page - 1; }
      else if (v === "next") { if (page < totalPages - 1) __pg[key] = page + 1; }
      else __pg[key] = parseInt(v, 10);
      if (typeof renderFn === "function") renderFn();
    });
  });
}

/* ==================== TABLE SORTING (data level) ==================== */
/*
   Clicking a column header (a th carrying data-sort-col) sorts the WHOLE
   filtered list and only then paginates, so sorting is never limited to the
   rows that happen to be on screen, and it survives paging, filtering and
   re-renders (realtime updates call render() again).
   The sortable header cells live in index.html (and in the stat-detail modal,
   whose head is generated at runtime); the pager key is read from the table's
   data-sort-table attribute and must match the key used by renderPager()/
   __pgRows() for that table. Tables without data-sort-table keep the simple
   in-DOM sorter at the bottom of this file (small, non-paginated lists).
*/
const __sortState = {};   // pagerKey -> { col, dir }   (dir: 1 = ascending, -1 = descending)
const __sortRenders = {}; // pagerKey -> function that re-renders that table

function __sortIdx(list, field) {
  const m = new Map();
  (list || []).forEach(x => { if (x && x[field] !== undefined) m.set(x[field], x); });
  return m;
}

/* Lookup maps / active filters an accessor may need. Built once per sort. */
function __sortCtx(key) {
  if (key === "inv") return { cats: __sortIdx(getCategories(), "id"), locs: __sortIdx(getLocations(), "id"), cond: (($("#conditionFilter") || {}).value || "") };
  if (key === "insp") return { locs: __sortIdx(getAllLocationsFlat(), "id") };
  if (key === "dashLow") return { cats: __sortIdx(getCategories(), "id") };
  return {};
}

/* Status / condition columns sort by severity (most urgent first) instead of
   alphabetically. */
const __DEM_STATUS_RANK = { pending: 0, partial: 1, completed: 2, rejected: 3, approved: 2 };
const __INSP_STATUS_RANK = { overdue: 0, pending: 1, completed: 2 };
const __ALLOC_STATUS_RANK = { ALLOTTED: 0, PARTIALLY_RETURNED: 1, RETURNED: 2, DAMAGED: 3, PARTIALLY_RECOVERED: 4, LOST: 5, CANCELLED: 6 };
const __RET_COND_RANK = { good: 0, poor: 1, other: 2, damaged: 3, lost: 4, cancelled: 5 };

function __rank(map, val, fallback) {
  const r = map[val];
  return r === undefined ? (fallback === undefined ? 99 : fallback) : r;
}

function __sortVal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isFinite(v) ? { n: v, s: "" } : null;
  if (typeof v === "boolean") return { n: v ? 1 : 0, s: "" };
  const s = String(v).trim();
  if (!s) return null;
  const num = Number(s.replace(/,/g, ""));
  if (isFinite(num) && /^-?\d[\d,]*(?:\.\d+)?$/.test(s)) return { n: num, s: "" };
  return { n: null, s: s.toLowerCase() };
}

/* Returns the rows sorted per the saved state for that table.
   Returns the array untouched (no copy) when that table is not sorted. */
function __sortRows(key, rows) {
  const def = __SORT_DEFS[key];
  const st = __sortState[key];
  if (!def || !st || !Array.isArray(rows) || rows.length < 2) return rows;
  const ctx = Object.assign({ col: st.col, key }, __sortCtx(key));
  const acc = def.any ? (r) => def.any(r, ctx) : ((def.cols || [])[st.col] || null);
  if (!acc) return rows;
  const dir = st.dir === -1 ? -1 : 1;
  return rows.slice().sort((ra, rb) => {
    const x = __sortVal(acc(ra, ctx));
    const y = __sortVal(acc(rb, ctx));
    if (!x && !y) return 0;
    if (!x) return 1;              // blank values always stay at the bottom
    if (!y) return -1;
    let c;
    if (x.n !== null && y.n !== null) c = x.n - y.n;
    else if (x.n !== null) c = -1; // numbers before text
    else if (y.n !== null) c = 1;
    else c = x.s.localeCompare(y.s, undefined, { numeric: true, sensitivity: "base" });
    return c * dir;
  });
}
/*
   One accessor per column, in the same order as the columns rendered in the
   table. An accessor receives (row, ctx) and returns the value the column
   shows; null means "this column is not sortable" (S.No and the Actions
   column, which only holds buttons).
   Keys must match the pager key used by renderPager()/__pgRows() and the
   data-sort-table attribute of the table.
*/
const __SORT_DEFS = {
  /* Inventory (#inventoryBody, pager_inv) */
  inv: {
    cols: [
      i => i.name,
      (i, c) => { if (c.cond) { const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 }; return cc[c.cond] || 0; } const h = i.history || []; const last = h[h.length - 1]; return last ? (Number(last.qty) || 0) : null; },
      (i, c) => (c.locs.get(i.locationId) || {}).name || "",
      i => (i.conditionCounts || {}).good || 0,
      (i, c) => { const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 }; const q = c.cond ? (cc[c.cond] || 0) : i.quantity; return q <= 0 ? 0 : q <= (Number(i.minStock) || 0) ? 1 : 2; },
      i => __lastChangeAt(i) || null,
      null /* Actions */
    ]
  },
  /* Consumable transactions (#consBody, pager_cons) */
  cons: {
    cols: [
      r => r.categoryName,
      r => r.itemName,
      r => r.t.qty,
      r => r.date || "",
      r => (r.t.toName || ""),
      r => (r.t.byName || ""),
      r => r.status,
      null
    ]
  },
  /* Distribution by location (#consDistBody, pager_consDist) */
  consDist: {
    cols: [
      r => (r.t.toName || ""),
      r => (r.t.toType === "unit" ? "Unit" : "Staff"),
      r => r.categoryName,
      r => r.itemName,
      r => r.t.qty,
      r => r.date || "",
      r => (r.t.byName || ""),
      r => r.status
    ]
  },
  /* Demands (#demandBody, pager_dem) */
  dem: {
    cols: [
      r => (r.d && r.d.demandNo) || "",
      r => (r.d && r.d.requestedBy) || "",
      r => (r.d && (r.d.assigneeName || r.d.demandToLocationName || r.d.demandToDistrictName)) || "",
      r => (r.it && r.it.itemName) || "",
      r => (r.it && r.it.quantity) || null,
      r => (r.it && __rank(__DEM_STATUS_RANK, r.it.status, 3)) || 3,
      r => (r.d && r.d.createdAt) || null,
      null /* Actions */
    ]
  },
  /* Inspections (#inspBody, pager_insp) */
  insp: {
    cols: [
      ins => ins.date || "",
      ins => ins.itemName,
      ins => ins.inspectedBy || "",
      ins => ins.type || "",
      (ins, c) => (c.locs.get(ins.locationId) || {}).name || "",
      ins => __rank(__INSP_STATUS_RANK, ins.status, 3),
      null /* Actions: View button only */
    ]
  },
  /* Allotted items (#allocBody, pager_alloc) */
  alloc: {
    cols: [
      null, /* S.No */
      a => a.name,
      a => a.beltNo || "",
      a => a.itemName || "",
      a => a.categoryName || "",
      a => allocRemaining(a),
      a => allocRecoverable(a),
      a => a.createdAt || null,
      a => a.time || "",
      a => __rank(__ALLOC_STATUS_RANK, allocStatusOf(a)),
      null /* Actions */
    ]
  },
  /* Return history (#allocRetBody, pager_allocRet) - rows are { a, r } */
  allocRet: {
    cols: [
      null, /* S.No */
      w => w.a.name,
      w => w.a.beltNo || "",
      w => w.a.itemName || "",
      w => w.r.qty,
      w => __rank(__RET_COND_RANK, w.r.condition),
      w => w.r.date || "",
      w => w.r.time || "",
      w => w.r.receivedBy || "",
      w => w.r.remarks || ""
    ]
  },
  /* Dashboard: Low Stock Items (#lowStockBody) - Item, Category, Add Stock */
  dashLow: {
    cols: [
      i => i.name,
      (i, c) => (c.cats.get(i.categoryId) || {}).name || ""
    ]
  },
  /* Stat-detail modal (#statDetailBody): runtime columns, rows are arrays */
  statDetail: {
    any: (row, ctx) => (Array.isArray(row) ? row[ctx.col] : "")
  }
};
/* Header row for the stat-detail modal (its columns are built at runtime). */
function __statHeadHtml(cols) {
  return "<tr>" + (cols || []).map((c, i) =>
    `<th class="sortable" data-sort-col="${i}" tabindex="0" aria-sort="none">${esc(c)} <span class="sort-arrow"></span></th>`
  ).join("") + "</tr>";
}

/* Which table belongs to which sort key, matched through the tbody id (unique
   per table in index.html). A table may also carry data-sort-table="key". */
const __SORT_BODY_KEYS = {
  inventoryBody: "inv", demandBody: "dem", inspBody: "insp",
  allocBody: "alloc", allocRetBody: "allocRet", lowStockBody: "dashLow",
  statDetailBody: "statDetail"
};

function __sortKeyOfTable(table) {
  if (!table) return "";
  if (table.hasAttribute("data-sort-table")) return table.getAttribute("data-sort-table");
  const body = table.querySelector("tbody[id]");
  return body ? (__SORT_BODY_KEYS[body.id] || "") : "";
}

function __sortTableEl(key) {
  const tables = document.querySelectorAll("table");
  for (let i = 0; i < tables.length; i++) if (__sortKeyOfTable(tables[i]) === key) return tables[i];
  return null;
}

/* Draw the ?/? indicator on the active column of that table. */
function __sortSyncHeaders(key) {
  const table = __sortTableEl(key);
  if (!table) return;
  const st = __sortState[key] || null;
  table.querySelectorAll("th[data-sort-col]").forEach(th => {
    const col = parseInt(th.getAttribute("data-sort-col"), 10);
    const on = !!st && st.col === col;
    const arrow = th.querySelector(".sort-arrow");
    if (arrow) arrow.textContent = on ? (st.dir === 1 ? " \u25B2" : " \u25BC") : "";
    th.classList.toggle("sorted", on);
    th.setAttribute("aria-sort", on ? (st.dir === 1 ? "ascending" : "descending") : "none");
  });
}

/* Header clicked: flip the direction / switch column, then re-render. */
function __sortToggle(key, col) {
  const cur = __sortState[key];
  if (cur && cur.col === col) cur.dir = cur.dir === 1 ? -1 : 1;
  else __sortState[key] = { col, dir: 1 };
  __pgReset(key);
  __sortSyncHeaders(key);
  const fn = __sortRenders[key];
  if (typeof fn === "function") fn();
}

function __sortHeaderClick(e) {
  if (!e.target || !e.target.closest) return;
  const th = e.target.closest("th[data-sort-col]");
  if (!th) return;
  const key = __sortKeyOfTable(th.closest("table"));
  if (!key) return;
  const col = parseInt(th.getAttribute("data-sort-col"), 10);
  if (isNaN(col)) return;
  __sortToggle(key, col);
}

document.addEventListener("click", __sortHeaderClick);
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  if (!e.target || e.target.tagName !== "TH") return;
  if (!e.target.hasAttribute("data-sort-col")) return;
  e.preventDefault();
  __sortHeaderClick(e);
});

/* Tables without a pager register their own re-render function. */
__sortRenders.dashLow = renderDashboard;


/* ==================== STORAGE ==================== */
function storeKey(name) { return STORAGE_PREFIX + name; }
function loadData(key) {
  // When connected to the server, api-client provides its own cache-backed loadData.
  if (window.CONFIG && window.CONFIG.useRemote && window.__apiLoadFn) return window.__apiLoadFn(key);
  try { return JSON.parse(localStorage.getItem(storeKey(key))); } catch { return null; }
}
function saveData(key, data) {
  if (window.CONFIG && window.CONFIG.useRemote && window.__apiSaveFn) return window.__apiSaveFn(key, data);
  localStorage.setItem(storeKey(key), JSON.stringify(data));
}

/* ==================== SEED ==================== */
function seedAll() {
  const SEED_VERSION = 5;
  const currentVersion = loadData("seedVersion") || 0;
  if (currentVersion < SEED_VERSION) {
    saveData("districts", DEFAULT_DISTRICTS);
    saveData("users", DEFAULT_USERS);
    saveData("locations", DEFAULT_LOCATIONS);
    saveData("items", DEFAULT_ITEMS);
    saveData("seedVersion", SEED_VERSION);
  }
  if (!loadData("districts")) saveData("districts", DEFAULT_DISTRICTS);
  if (!loadData("users")) saveData("users", DEFAULT_USERS);
  if (!loadData("locations")) saveData("locations", DEFAULT_LOCATIONS);
  if (!loadData("items")) saveData("items", DEFAULT_ITEMS);

  // District-scoped categories (2026.09.211) + defaults retired (2026.09.213):
  // every district owns an independent list, and the built-in DEFAULT_CATEGORIES
  // catalogue is no longer seeded — it is stripped from the stored lists
  // (inventory + consumable), so only admin-created categories remain.
  const __defCatIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));
  getDistricts().forEach(d => {
    saveCategoriesForDistrict(d.id, getCategoriesForDistrict(d.id).filter(c => !__defCatIds.has(c.id)));
    saveConsCategoriesForDistrict(d.id, getConsCategoriesForDistrict(d.id).filter(c => !__defCatIds.has(c.id)));
  });

  const allItems = loadData("items") || {};
  Object.keys(DEFAULT_ITEMS).forEach(distId => {
    const existing = allItems[distId] || [];
    const existingIds = new Set(existing.map(i => i.id));
    DEFAULT_ITEMS[distId].forEach(di => { if (!existingIds.has(di.id)) existing.push(di); });
    allItems[distId] = existing;
  });
  saveData("items", allItems);

// Migration: conditionCounts uses only good/poor/damaged (legacy new/fair merged into good)
  let addedDay = 0;
  Object.keys(allItems).forEach(distId => {
    (allItems[distId] || []).forEach(item => {
      if (!item.createdAt) {
        addedDay++;
        item.createdAt = Date.now() - addedDay * 86400000;
      }
      if (!item.conditionCounts) {
        item.conditionCounts = { good: 0, poor: 0, damaged: 0 };
        if (item.condition) {
          let c = item.condition;
          if (c === "new" || c === "fair") c = "good";
          item.conditionCounts[c] = item.quantity || 0;
        } else {
          item.conditionCounts.good = item.quantity || 0;
        }
      }
      const cc = item.conditionCounts;
      cc.good = (cc.good || 0) + (cc.new || 0) + (cc.fair || 0);
      delete cc.new;
      delete cc.fair;
      cc.poor = cc.poor || 0;
      cc.damaged = cc.damaged || 0;
      const sum = (cc.good || 0) + (cc.poor || 0) + (cc.damaged || 0);
      if (sum !== item.quantity) {
        item.quantity = sum;
      }
      delete item.condition;
    });
  });
  saveData("items", allItems);

  const districts = getDistricts();
  districts.forEach(d => {
    const inspKey = `inspections_${d.id}`;
    if (!loadData(inspKey)) seedInspections(d.id);
    const demKey = `demands_${d.id}`;
    if (!loadData(demKey)) seedDemands(d.id);
    const distKey = `distributions_${d.id}`;
    if (!loadData(distKey)) seedDistributions(d.id);
  });
}


/* ==================== DATA ACCESS ==================== */
function getDistricts() { return loadData("districts") || []; }
function saveDistricts(d) { saveData("districts", d); }
function getUsers() { return loadData("users") || []; }
function saveUsers(u) { saveData("users", u); }
/* Mojibake healer: repairs legacy double-encoded icons/text stored in the live DB (2026.09.179) */
const __CP1252 = { "\u20AC":0x80,"\u201A":0x82,"\u0192":0x83,"\u201E":0x84,"\u2026":0x85,"\u2020":0x86,"\u2021":0x87,"\u02C6":0x88,"\u2030":0x89,"\u0160":0x8A,"\u2039":0x8B,"\u0152":0x8C,"\u017D":0x8E,"\u2018":0x91,"\u2019":0x92,"\u201C":0x93,"\u201D":0x94,"\u2022":0x95,"\u2013":0x96,"\u2014":0x97,"\u02DC":0x98,"\u2122":0x99,"\u0161":0x9A,"\u203A":0x9B,"\u0153":0x9C,"\u017E":0x9E,"\u0178":0x9F };
function __cpBytes(str) { const out = []; for (const ch of str) { const c = ch.codePointAt(0); if (c >= 0x80 && c <= 0xFF) out.push(c); else if (__CP1252[ch] !== undefined) out.push(__CP1252[ch]); else return null; } return out; }
function __fixMojibakeStr(s) {
  if (!s || s.length < 3 || !/[\u00C3\u00C2\u00E2]/.test(s)) return s;
  let cur = s, best = null;
  for (let r = 0; r < 5; r++) {
    const bs = __cpBytes(cur);
    if (!bs) break;
    let out;
    try { out = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bs)); } catch (e) { break; }
    if (out.includes("\uFFFD")) break;
    cur = out; best = cur;
  }
  return best && best !== s && !/[\u00C3\u00C2]/.test(best) ? best : s;
}
function __isMojibake(s) { return typeof s === "string" && /[\u00C3\u00C2\u00E2\u20AC\u0192\u0160\u0161\u2039\u203A\u0152\u0153\u0178\u201A\u201E\u2020\u2021\u02C6\u2030\u02DC\u2122\u201C\u201D]/.test(s) && !/^[\u0000-\u007F]*$/.test(s) && /[\u0080-\u00FF\u20AC\u0192\u0160\u0161\u201A\u201C\u201D\u2026]/.test(s); }
function __healCatListInPlace(list) {
  let changed = false;
  list.forEach(c => { if (c && __isMojibake(c.icon)) { c.icon = __fixMojibakeStr(c.icon); changed = true; } if (c && __isMojibake(c.name)) { c.name = __fixMojibakeStr(c.name); changed = true; } });
  return changed;
}
function __healStoredMojibake() {
  try {
    // Works for both the legacy shared array and the per-district map.
    const healKey = (key) => {
      const data = loadData(key);
      if (Array.isArray(data)) { if (__healCatListInPlace(data)) saveData(key, data); }
      else if (data && typeof data === "object") {
        let changed = false;
        Object.keys(data).forEach(dk => { if (Array.isArray(data[dk]) && __healCatListInPlace(data[dk])) changed = true; });
        if (changed) saveData(key, data);
      }
    };
    healKey("categories");
    healKey("cons_categories");
  } catch (e) { /* non-fatal */ }
}
/* District-scoped category store (2026.09.211):
   "categories" is a map { [districtId]: [category...] } — same shape as
   items/locations — so every district owns an independent list. A legacy
   shared array is migrated once by copying it into each known district;
   after that, edits in one district never show up in another. */
function __activeCatDistrictId() {
  return activeDistrictId || (currentUser && currentUser.districtId) || null;
}
function getCategoriesForDistrict(districtId) {
  if (!districtId) return [];
  let map = loadData("categories");
  if (Array.isArray(map)) {
    const legacy = map;
    map = {};
    getDistricts().forEach(d => { map[d.id] = legacy.map(c => Object.assign({}, c)); });
    saveData("categories", map);
  }
  if (!map || typeof map !== "object") { map = {}; saveData("categories", map); }
  if (!Array.isArray(map[districtId])) {
    // New district (or fresh install): start EMPTY — the default catalogue is
    // retired (2026.09.213); admins build their own.
    map[districtId] = [];
    saveData("categories", map);
  }
  return map[districtId];
}
function saveCategoriesForDistrict(districtId, list) {
  if (!districtId) return;
  let map = loadData("categories");
  if (!map || typeof map !== "object" || Array.isArray(map)) map = {};
  map[districtId] = list;
  saveData("categories", map);
}
function getCategories() { return getCategoriesForDistrict(__activeCatDistrictId()); }
function saveCategories(list) { saveCategoriesForDistrict(__activeCatDistrictId(), list); }
function getAllLocations() { return loadData("locations") || {}; }
function saveAllLocations(l) { saveData("locations", l); }
function getAllItems() { return loadData("items") || {}; }
function saveAllItems(i) { saveData("items", i); }

function getLocationsForDistrict(districtId) { return (getAllLocations())[districtId] || []; }
/* ==================== IMS HIERARCHY: STATE > IG RANGE > DISTRICT > LOCATION ====================
   A PHQ and an IG Range both sit ABOVE the districts, so they cannot live in a
   district's location list. They are kept under one reserved scope key instead,
   which keeps the stored shape unchanged and keeps them out of every district
   listing, because those all walk the district array rather than the map keys. */
const HQ_SCOPE_KEY = "__hq__";
const STATE_NAME = "Haryana";
const HQ_TYPES = ["phq", "igRange"];   // types that sit above a district

function getHqLocations() { const m = getAllLocations(); return m[HQ_SCOPE_KEY] || []; }
function saveHqLocations(list) { const m = getAllLocations(); m[HQ_SCOPE_KEY] = list; saveAllLocations(m); }
function getPhqLocations() { return getHqLocations().filter(function(l) { return l.type === "phq"; }); }
function getIgRanges() { return getHqLocations().filter(function(l) { return l.type === "igRange"; }); }
function getRangeById(id) { if (!id) return null; return getIgRanges().find(function(r) { return r.id === id; }) || null; }
function isHqType(t) { return HQ_TYPES.indexOf(t) >= 0; }

// The districts an IG Range covers. This is the single source of the IG's reach.
function districtsInRange(rangeId) {
  if (!rangeId) return [];
  return getDistricts().filter(function(d) { return d.rangeId === rangeId; });
}
function rangeNameOf(rangeId) { const r = getRangeById(rangeId); return r ? r.name : (rangeId || ""); }
/* Synchronizes all IG Admin users' district scopes with their IG Ranges */
function syncAllIgScopes(explicitDistricts) {
  const users = getUsers();
  const districts = explicitDistricts || getDistricts();
  let changed = false;
  users.forEach(u => {
    if (u.role === "ig" && u.rangeId) {
      const inRange = districts.filter(d => d.rangeId === u.rangeId).map(d => d.id);
      const cur = Array.isArray(u.districtIds) ? u.districtIds.filter(Boolean) : [];
      const same = cur.length === inRange.length && cur.every((id, i) => id === inRange[i]);
      const targetHome = inRange.length ? inRange[0] : "";
      if (!same || u.districtId !== targetHome) {
        u.districtIds = inRange.slice();
        u.districtId = targetHome;
        changed = true;
      }
    }
  });
  if (changed) saveUsers(users);
}


// A user's role decides which level of the hierarchy they belong at.
function roleHomeType(role) {
  if (role === "devadmin") return "phq";      // Developer Admin -> PHQ
  if (role === "ig") return "igRange";        // IG Admin -> IG Range
  return null;                                  // everyone else sits inside a district
}
function hqTypeLabel(t) { return t === "phq" ? "PHQ" : (t === "igRange" ? "IG Range" : (t || "—")); }

// Locations of a district, minus anything that does not really belong to one.
function getDistrictUnits(districtId) {
  return getLocationsForDistrict(districtId).filter(function(l) { return !isHqType(l.type); });
}

function getItemsForDistrict(districtId) { return (getAllItems())[districtId] || []; }

let activeDistrictId = null;
function getActiveDistrict() { return activeDistrictId; }
function setActiveDistrict(id) { activeDistrictId = id; localStorage.setItem(STORAGE_PREFIX + "activeDistrict", id); }

function getLocations() { return activeDistrictId ? getLocationsForDistrict(activeDistrictId) : []; }

function getVisibleLocations() {
  const locs = getLocations();
  const locId = getVisibleLocationId();
  if (locId) return locs.filter(l => l.id === locId);
  return locs;
}

function getItems() {
  if (!activeDistrictId) return [];
  // District-hierarchy visibility: never render another district's records,
  // even if the client-side district selector is switched (devadmin tool).
  if (currentUser && currentUser.districtId && activeDistrictId !== currentUser.districtId) return [];
  const all = getItemsForDistrict(activeDistrictId);
  const locId = getVisibleLocationId();
  if (locId) return all.filter(i => i.locationId === locId);
  return all;
}

function getAllDistrictItems() { return activeDistrictId ? getItemsForDistrict(activeDistrictId) : []; }

function saveItems(items) {
  if (!activeDistrictId) return;
  const all = getAllItems();
  const locId = getVisibleLocationId();
  if (locId) {
    const existing = all[activeDistrictId] || [];
    const others = existing.filter(i => i.locationId !== locId);
    all[activeDistrictId] = others.concat(items);
  } else {
    all[activeDistrictId] = items;
  }
  saveAllItems(all);
}


/* ==================== ALL-DISTRICT LOCATION ACCESS ==================== */
function getAllLocationsFlat() {
  const all = getAllLocations();
  const districts = getDistricts();
  const result = [];
  districts.forEach(d => {
    (all[d.id] || []).forEach(loc => {
      result.push({ ...loc, districtName: d.name, districtCode: d.code });
    });
  });
  return result;
}

/* ==================== NOTIFICATIONS ==================== */
function getNotifications(districtId) {
  return loadData(`notifications_${districtId}`) || [];
}

function saveNotifications(districtId, list) {
  saveData(`notifications_${districtId}`, list);
}

function addNotification(targetDistrictId, notif) {
  const list = getNotifications(targetDistrictId);
  list.unshift({
    id: uid(),
    type: notif.type,
    title: notif.title,
    message: notif.message,
    fromDistrictId: notif.fromDistrictId || activeDistrictId,
    demandId: notif.demandId || null,
    txnId: notif.txnId || null,
    targetLocId: notif.targetLocId || null,
    targetUserId: notif.targetUserId || null,
    requestId: notif.requestId || null,
    consReqId: notif.consReqId || null,
    distributionId: notif.distributionId || null,
    maintenanceId: notif.maintenanceId || null,
    read: false,
    createdAt: Date.now(),
  });
  saveNotifications(targetDistrictId, list);
}

function __userMatch(n) {
  if (!n.targetUserId) return true;
  return currentUser && n.targetUserId === currentUser.id;
}

function __locMatch(n) {
  const locId = getVisibleLocationId();
  if (!locId) return true;
  return !n.targetLocId || n.targetLocId === locId;
}

function getUnreadCount() {
  if (!activeDistrictId) return 0;
  const list = getNotifications(activeDistrictId);
  return list.filter(n => !n.read && __userMatch(n) && __locMatch(n)).length + __rtUnreadCount();
}

function markAllRead() {
  if (!activeDistrictId) return;
  if (isDevAdmin()) {
    getDistricts().forEach(d => {
      const list = getNotifications(d.id);
      let changed = false;
      list.forEach(n => { if (__userMatch(n) && __locMatch(n)) { n.read = true; changed = true; } });
      if (changed) saveNotifications(d.id, list);
    });
  } else {
    const list = getNotifications(activeDistrictId);
    let changed = false;
    list.forEach(n => { if (__userMatch(n) && __locMatch(n)) { n.read = true; changed = true; } });
    if (changed) saveNotifications(activeDistrictId, list);
  }
}

function toggleNotifPanel() {
  const panel = $("#notifPanel");
  if (!panel) return;
  const isOpen = !panel.classList.contains("hidden");
  if (isOpen) {
    panel.classList.add("hidden");
  } else {
    renderNotifications();
    panel.classList.remove("hidden");
  }
}

function renderNotifications() {
  if (!activeDistrictId) return;
  let notifs;
  if (isDevAdmin()) {
    const all = [];
    getDistricts().forEach(d => {
      getNotifications(d.id).forEach(n => { if (__userMatch(n)) all.push({ ...n, _distId: d.id }); });
    });
    notifs = all.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  } else {
    notifs = getNotifications(activeDistrictId).filter(n => __userMatch(n) && __locMatch(n)).slice(0, 30);
  }
  const persistKeys = new Set();
  notifs.forEach(n => {
    if (n.demandId) persistKeys.add("demand:" + n.demandId);
    else if (n.requestId) persistKeys.add("access:" + n.requestId);
    else if (n.distributionId) persistKeys.add("dist:" + n.distributionId);
    else if (n.maintenanceId) persistKeys.add("maint:" + n.maintenanceId);
  });
  __rtVisibleEvents().forEach(ev => {
    const pk = __rtPersistKey(ev);
    if (pk && persistKeys.has(pk)) return;
    const p = ev.payload || {};
    notifs.push({
      id: "rt_" + ev.id, rt: true, _extType: ev.type,
      type: __rtToNotifType(ev.type), title: ev.title, message: ev.message,
      demandId: p.demandId, requestId: p.requestId, txnId: p.txnId, distributionId: p.distributionId, maintenanceId: p.maintenanceId,
      createdAt: ev.createdAt, read: __rtMarkedRead(ev.id),
    });
  });
  notifs.sort((a, b) => b.createdAt - a.createdAt);
  notifs = notifs.slice(0, 40);
  const list = $("#notifList");
  const badge = $("#notifBadge");
  const unread = notifs.filter(n => !n.read).length;
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? "flex" : "none";
  }
  if (!list) return;
  if (!notifs.length) {
    list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
    return;
  }
  list.innerHTML = notifs.map(n => {
    const timeAgo = getTimeAgo(n.createdAt);
    const iconCls = __notifIconCls(n.type);
    const iconSvg = __notifIconSvg(n.type);
    let actionsHtml = "";
    if (n.type === "access_request" && !n.read && (isAdmin() || isDevAdmin()) && n.requestId) {
      /* Buttons only for real, still-pending access requests — RT user events
         without requestId and already-processed requests never show dead buttons (2026.09.193) */
      const __areq = getAccessRequests().find(r => r.id === n.requestId);
      if (__areq && __areq.status === "pending") {
        actionsHtml = `<div class="notif-actions">
          <button class="btn btn-sm btn-green" data-notif-approve="${n.id}" data-request-id="${n.requestId}">Approve</button>
          <button class="btn btn-sm btn-red" data-notif-reject="${n.id}" data-request-id="${n.requestId}">Reject</button>
        </div>`;
      }
    }
    return `<div class="notif-item ${n.read ? "" : "notif-unread"}" data-notif-id="${n.id}" data-dist-id="${n._distId || activeDistrictId}" data-rt="${n.rt ? 1 : 0}" style="cursor:pointer">
      <div class="notif-icon ${iconCls}">${iconSvg}</div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}</div>
        <div class="notif-msg">${esc(n.message)}</div>
        <div class="notif-time">${timeAgo}</div>
        ${actionsHtml}
      </div>
    </div>`;
  }).join("");
}

function renderAllNotifs() {
  const box = $("#notifAllList");
  if (!box) return;
  let notifs = [];
  if (isDevAdmin()) {
    getDistricts().forEach(d => { getNotifications(d.id).forEach(n => { if (__userMatch(n)) notifs.push({ ...n, _distId: d.id }); }); });
  } else {
    notifs = getNotifications(activeDistrictId).filter(n => __userMatch(n) && __locMatch(n));
  }
  const persistKeys = new Set();
  notifs.forEach(n => {
    if (n.demandId) persistKeys.add("demand:" + n.demandId);
    else if (n.requestId) persistKeys.add("access:" + n.requestId);
    else if (n.distributionId) persistKeys.add("dist:" + n.distributionId);
    else if (n.maintenanceId) persistKeys.add("maint:" + n.maintenanceId);
  });
  __rtVisibleEvents().forEach(ev => {
    const pk = __rtPersistKey(ev);
    if (pk && persistKeys.has(pk)) return;
    const p = ev.payload || {};
    notifs.push({
      id: "rt_" + ev.id, rt: true, _extType: ev.type,
      type: __rtToNotifType(ev.type), title: ev.title, message: ev.message,
      demandId: p.demandId, requestId: p.requestId, txnId: p.txnId, distributionId: p.distributionId, maintenanceId: p.maintenanceId,
      createdAt: ev.createdAt, read: __rtMarkedRead(ev.id),
    });
  });
  notifs.sort((a, b) => b.createdAt - a.createdAt);
  const badge = $("#notifBadge");
  const unread = notifs.filter(n => !n.read).length;
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? "flex" : "none";
  }
  if (!notifs.length) { box.innerHTML = `<div class="notif-empty">No notifications yet.</div>`; return; }
  box.innerHTML = notifs.map(n => {
    const iconCls = __notifIconCls(n.type);
    const iconSvg = __notifIconSvg(n.type);
    return `<div class="notif-item ${n.read ? "" : "notif-unread"}" data-notif-id="${n.id}" data-dist-id="${n._distId || activeDistrictId}" data-rt="${n.rt ? 1 : 0}" style="cursor:pointer">
      <div class="notif-icon ${iconCls}">${iconSvg}</div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}</div>
        <div class="notif-msg">${esc(n.message)}</div>
        <div class="notif-time">${getTimeAgo(n.createdAt)} ? ${fmtDate(n.createdAt)}</div>
      </div>
    </div>`;
}).join("");
}

/* Deep-link navigation: clicking a notification jumps to the relevant tab
   (demands / inventory / users) and highlights the row. */
function __notifTarget(n) {
  const t = (n._extType || n.type || "").toString();
  if (n.maintenanceId || t.indexOf("MAINTENANCE_") === 0) return { tab: "maintenance", id: n.maintenanceId };
  if (n.demandId || t.indexOf("DEMAND_") === 0) return { tab: "demands", id: n.demandId };
  if (n.itemId || t.indexOf("LOW_STOCK") === 0 || t.indexOf("ITEM_") === 0) return { tab: "inventory", id: n.itemId || null };
  if (n.requestId || t.indexOf("ACCESS_") === 0 || t.indexOf("USER_") === 0 || t.indexOf("PASSWORD") === 0 || t.indexOf("ROLE_") === 0) return { tab: "users", id: n.requestId };
  return null;
}

function __notifFromItem(item) {
  const n = { _extType: "", demandId: null, requestId: null, txnId: null, itemId: null, maintenanceId: null, _distId: item.dataset.distId || activeDistrictId };
  if (item.dataset.rt === "1" && __rt && Array.isArray(__rt.events)) {
    const idNum = Number(String(item.dataset.notifId).replace("rt_", ""));
    const ev = __rt.events.find(e => e.id === idNum);
    if (ev) {
      const p = ev.payload || {};
      n._extType = ev.type; n.demandId = p.demandId; n.requestId = p.requestId; n.txnId = p.txnId; n.itemId = p.itemId; n.maintenanceId = p.maintenanceId;
      return n;
    }
  }
  const dr = item.dataset.distId || activeDistrictId;
  const notif = (getNotifications(dr) || []).find(x => String(x.id) === String(item.dataset.notifId));
  if (notif) Object.assign(n, notif);
  return n;
}

function __goToNotif(item) {
  const n0 = __notifFromItem(item);
  if (n0 && n0.consReqId) {
    const pnl = $("#notifPanel");
    if (pnl) pnl.classList.add("hidden");
    const am = $("#notifAllModal");
    if (am && !am.classList.contains("hidden")) closeModals();
    try { openConsRequest(n0.consReqId); } catch (err) { console.error(err); }
    return;
  }
  const target = __notifTarget(n0);
  const panel = $("#notifPanel");
  if (panel && !panel.classList.contains("hidden")) panel.classList.add("hidden");
  const allModal = $("#notifAllModal");
  if (allModal && !allModal.classList.contains("hidden")) closeModals();
  if (!target) { switchTab("dashboard"); return; }
  if (target.tab === "users") { if (isAdmin() || isDevAdmin()) openUsersModal(); else switchTab("dashboard"); return; }
  ["demandSearch","demandStatusFilter","demandDateFrom","demandDateTo"].forEach(id => { const e = $("#" + id); if (e) e.value = ""; });
  ["maintSearch","maintStatusFilter","maintTypeFilter","maintDateFrom","maintDateTo"].forEach(id => { const e = $("#" + id); if (e) e.value = ""; });
  switchTab(target.tab);
  if (!target.id) return;
  const sel = target.tab === "demands" ? 'tr[data-demand-id="' + target.id + '"]'
    : target.tab === "maintenance" ? 'tr[data-maint-id="' + target.id + '"]'
    : 'tr[data-item-id="' + target.id + '"]';
  setTimeout(() => {
    const el = document.querySelector(sel);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("row-flash");
      void el.offsetWidth;
      el.classList.add("row-flash");
      setTimeout(() => el.classList.remove("row-flash"), 2600);
    }
    if (target.tab === "demands" && target.id) {
      try { openDemandDetails(target.id); } catch (err) { console.error(err); }
    }
    if (target.tab === "maintenance" && target.id) {
      try { openMaintenanceDetail(target.id); } catch (err) { console.error(err); }
    }
  }, 80);
}

function getTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}

/* ==================== AUTH ==================== */
function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function setAuth(payload, persist) {
  if (persist === false) { localStorage.removeItem(AUTH_KEY); sessionStorage.setItem(AUTH_KEY, JSON.stringify(payload)); }
  else { sessionStorage.removeItem(AUTH_KEY); localStorage.setItem(AUTH_KEY, JSON.stringify(payload)); }
}
function clearAuth() { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); }
function getToken() { const a = getAuth(); return (a && a.token) || null; }

const QUICK_USERS_KEY = STORAGE_PREFIX + "quick_users";
function readQuickUsers() {
  const out = [];
  for (const s of [localStorage, sessionStorage]) {
    try { const a = JSON.parse(s.getItem(QUICK_USERS_KEY) || "[]"); if (Array.isArray(a)) out.push(...a); } catch { /* ignore */ }
  }
  return out.filter((u, i) => out.findIndex(x => x.username === u.username) === i);
}
function addQuickUser(u, persist) {
  const list = readQuickUsers().filter(x => x.username !== u.username);
  list.unshift({ username: u.username, name: u.name || u.username, password: u.password || "" });
  const keep = list.slice(0, 3);
  (persist === false ? sessionStorage : localStorage).setItem(QUICK_USERS_KEY, JSON.stringify(keep));
}
function renderQuickLogin() {
  const box = $("#quickLogin");
  const list = $("#quickLoginList");
  if (!box || !list) return;
  const users = readQuickUsers();
  box.classList.toggle("hidden", users.length === 0);
  list.innerHTML = "";
  users.forEach(u => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quick-login-chip";
    b.innerHTML = `<span class="ql-avatar">${esc((u.name || u.username).charAt(0).toUpperCase())}</span>` +
      `<span class="ql-text"><span class="ql-name">${esc(u.name || u.username)}</span><span class="ql-user">@${esc(u.username)}</span></span>`;
    b.addEventListener("click", () => {
      $("#loginUser").value = u.username;
      $("#loginPass").value = u.password || "";
      $("#loginError").classList.add("hidden");
      const form = $("#loginForm");
      if (u.password && form && form.requestSubmit) form.requestSubmit();
      else $("#loginPass").focus();
    });
    list.appendChild(b);
  });
}

async function validateSession(token) {
  if (!window.CONFIG || !window.CONFIG.useRemote) return true;
  if (!token) return false;
  try {
    const res = await __api("POST", "auth/me", {});
    return !!(res && res.ok);
  } catch (e) { return false; }
}

async function login(username, password) {
  if (!window.CONFIG || !window.CONFIG.useRemote) {
    // Local-only fallback (no backend): compare against the client-side list.
    const u = getUsers().find(u => u.username === username && u.password === password) || null;
    if (!u) return { user: null };
    const { password: _pwd, ...safe } = u; // never return/store the password
    return { user: safe };
  }
  const res = await __api("POST", "auth/login", { username, password });
  if (res && res.ok) return res;
  return { user: null };
}


/* ===========================================================================
   DEMO ACCOUNTS PANEL (login screen)
   The card list is fetched from GET /api/auth/demo-users and the one-click
   sign-in goes to POST /api/auth/demo. Neither request carries a password:
   the browser never holds one, so nothing here can be read out of devtools or
   the page source. The server returns an ordinary session, so everything
   downstream (RBAC, district scoping, the dashboard each role lands on) is the
   same code path a typed login uses - showApp() decides where to go, exactly
   as it already did.
   =========================================================================== */

let __demoBusy = false;

function __demoShell() {
  return {
    list: $("#demoList"),
    error: $("#demoError"),
    toggle: $("#demoToggle"),
    panel: $("#demoPanel"),
  };
}

function __demoShowError(msg) {
  const s = __demoShell();
  if (!s.error) { try { toast(msg, "error"); } catch (e) { /* ignore */ } return; }
  s.error.textContent = msg;
  s.error.classList.remove("hidden");
}

function __demoClearError() {
  const s = __demoShell();
  if (s.error) { s.error.textContent = ""; s.error.classList.add("hidden"); }
}

/* One card per account, grouped by role. Group order follows the order the
   server sends, which is the role hierarchy the app already uses. */
function __renderDemoCards(accounts) {
  const s = __demoShell();
  if (!s.list) return;
  s.list.innerHTML = "";
  if (!accounts || !accounts.length) {
    s.list.innerHTML = '<div class="demo-empty">No demo accounts are available on this server. '
      + "Use the sign-in form on the left.</div>";
    return;
  }
  const groups = new Map();
  for (const a of accounts) {
    if (!groups.has(a.role)) groups.set(a.role, { label: a.roleLabel, accent: a.accent, items: [] });
    groups.get(a.role).items.push(a);
  }
  const frag = document.createDocumentFragment();
  for (const g of groups.values()) {
    const wrap = document.createElement("div");
    wrap.className = "demo-group";
    const head = document.createElement("div");
    head.className = "demo-group-head";
    head.innerHTML = '<span>' + esc(g.label) + '</span>'
      + '<span class="demo-group-count">' + g.items.length + '</span>';
    wrap.appendChild(head);
    for (const a of g.items) wrap.appendChild(__demoCard(a, g.accent));
    frag.appendChild(wrap);
  }
  s.list.appendChild(frag);
}

function __demoCard(a, accent) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "demo-card accent-" + (accent || "blue");
  btn.dataset.demoUser = a.username;
  btn.setAttribute("aria-label", "Sign in as " + a.name + " (" + a.roleLabel + ")");
  // An IG account covers several districts, so the card names all of them rather
  // than a single one; every other role keeps its location and district.
  const where = Array.isArray(a.districts) && a.districts.length
    ? a.districts.slice()
    : [a.location, a.district].filter(Boolean);
  btn.innerHTML =
    '<span class="demo-avatar" aria-hidden="true">' + esc(a.initials || a.username.charAt(0).toUpperCase()) + '</span>' +
    '<span class="demo-body">' +
      '<span class="demo-name">' + esc(a.name) + '</span>' +
      '<span class="demo-meta">' +
        '<span class="demo-user">' + esc(a.username) + '</span>' +
        (where.length ? '<span class="demo-sep">•</span><span class="demo-loc">' + esc(where.join(" · ")) + '</span>' : "") +
        '<span class="demo-badge">' + esc(a.roleLabel) + '</span>' +
      '</span>' +
    '</span>' +
    '<span class="demo-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
  btn.addEventListener("click", () => __demoLogin(a.username, btn));
  return btn;
}

async function __demoLogin(username, card) {
  if (__demoBusy) return;
  __demoBusy = true;
  const s = __demoShell();
  __demoClearError();
  if (card) card.setAttribute("aria-busy", "true");
  const btn = $("#loginBtn");
  const loader = $("#loginLoader");
  if (btn) btn.disabled = true;
  if (loader) loader.classList.remove("hidden");
  try {
    const res = await __api("POST", "auth/demo", { username: username });
    if (res && res.ok && res.user) {
      // Identical to the typed-login success path in the submit handler below.
      currentUser = res.user;
      activeDistrictId = currentUser.districtId || "dist_1";
      setActiveDistrict(activeDistrictId);
      const rememberMe = !!$("#rememberMe") && $("#rememberMe").checked;
      setAuth({ user: currentUser, token: res.token || null }, rememberMe);
      addQuickUser({ username: currentUser.username, name: currentUser.name }, rememberMe);
      showApp();
      return;
    }
    __demoShowError("Could not sign in with that demo account. Please try again.");
  } catch (err) {
    const msg = (err && err.body && err.body.error) || "Could not sign in with that demo account.";
    __demoShowError(msg);
  } finally {
    __demoBusy = false;
    if (card) card.removeAttribute("aria-busy");
    if (btn) btn.disabled = false;
    if (loader) loader.classList.add("hidden");
  }
}

async function __loadDemoAccounts() {
  const s = __demoShell();
  if (!s.list) return;
  // No backend (file opened directly): there is no demo endpoint to call.
  if (!window.CONFIG || !window.CONFIG.useRemote) {
    s.list.innerHTML = '<div class="demo-empty">Demo sign-in needs the local server running. '
      + "Start it with run-local.bat, then reload this page.</div>";
    if (s.toggle) s.toggle.classList.add("hidden");
    return;
  }
  s.list.innerHTML = '<div class="demo-loading"><span class="btn-loader"></span> Loading accounts&hellip;</div>';
  try {
    const res = await __api("GET", "auth/demo-users");
    if (res && res.ok) __renderDemoCards(res.accounts || []);
    else __renderDemoCards([]);
  } catch (err) {
    // 404 here means demo login is switched off on the server - that is a
    // normal configuration, not a failure, so the panel just explains itself.
    const off = err && err.status === 404;
    s.list.innerHTML = off
      ? '<div class="demo-empty">Demo sign-in is switched off on this server. '
        + "Please sign in with your username and password.</div>"
      : '<div class="demo-empty">Could not load demo accounts. Please sign in with your username and password.</div>';
    if (s.toggle) s.toggle.classList.add("hidden");
  }
}

let currentUser = null;

function isAdmin() { return currentUser && (currentUser.role === "admin" || currentUser.role === "devadmin" || currentUser.role === "ig"); }
function isDevAdmin() { return currentUser && currentUser.role === "devadmin"; }
function canEdit() {
  if (!currentUser) return false;
  return ["admin", "devadmin", "ig", "mhc", "station", "staff", "post", "tsi", "user", "itstaff", "mtostaff"].includes(currentUser.role);
}
function canManageItems() {
  if (!currentUser || isDevAdmin()) return false;
  if (isAdmin()) return true;
  return !!(currentUser.locationId && ["mhc", "station", "staff", "post", "tsi", "user", "itstaff", "mtostaff"].includes(currentUser.role));
}
/* ---- INVENTORY RBAC (record level) ----
   Visibility is driven by the district hierarchy; Edit/Delete is driven
   strictly by OWNERSHIP of the record: record.locationId must equal the
   logged-in user's own unit. The location/unit FILTER only controls what is
   VIEWED ? it never grants permissions. Developer Admin is permanently
   read-only for inventory (no add/edit/delete, any record, any district). */
function itemOwnedByCurrentUser(i) {
  return !!(currentUser && i && i.locationId === currentUser.locationId);
}
function canViewItem(i) { return !!(currentUser && i); }
function canEditItem(i) { return !!currentUser && !isDevAdmin() && itemOwnedByCurrentUser(i); }
function canDeleteItem(i) { return canEditItem(i); }
function __rbacLockMsg() { return "You can view this unit's inventory, but only the unit owner can modify it."; }
function __devRbacLockMsg() { return "Developer Admin has read-only access to inventory: view only."; }
function canManageItem(i) { return canEditItem(i); }
function canSeeAllLocations() { return isDevAdmin(); }
function canSeeAllDistrictLocations() { return isAdmin(); }
function getVisibleLocationId() { if (isAdmin()) return null; return currentUser ? currentUser.locationId : null; }

function logout() {
  const t = getToken();
  currentUser = null;
  activeDistrictId = null;
  __rtStop();
  clearAuth();
  if (window.CONFIG && window.CONFIG.useRemote && t) {
    try { __api("POST", "auth/logout").catch(() => {}); } catch (e) { /* ignore */ }
  }
  $("#appRoot").classList.add("hidden");
  $("#loginScreen").classList.remove("hidden");
  $("#loginUser").value = "";
  $("#loginPass").value = "";
  $("#loginError").classList.add("hidden");
  try { renderQuickLogin(); } catch (e) { console.error("quick login failed:", e); }
}

function applyRoleUI() {
  if (!currentUser) return;
  $("#userRoleBadge").textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
  $("#userDisplayName").textContent = currentUser.name;
  const dist = getDistricts().find(d => d.id === currentUser.districtId);
  $("#districtBadge").textContent = dist ? dist.name : "";
  document.body.classList.remove("role-admin", "role-devadmin", "role-user", "role-mhc", "role-tsi", "role-station", "role-post", "role-staff");
  document.body.classList.add("role-" + currentUser.role);

  const sidebarUserName = $("#sidebarUserName");
  const sidebarUserRole = $("#sidebarUserRole");
  const sidebarAvatar = $("#sidebarAvatar");
  if (sidebarUserName) sidebarUserName.textContent = currentUser.name;
  if (sidebarUserRole) sidebarUserRole.textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
  if (sidebarAvatar) sidebarAvatar.textContent = (currentUser.name || "U").charAt(0).toUpperCase();

  const distSel = $("#districtSelect");
  if (distSel) {
    const canSwitch = isDevAdmin() || isIg();
    distSel.disabled = !canSwitch;
    distSel.closest(".district-selector").style.opacity = canSwitch ? "1" : "0.6";
    distSel.closest(".district-selector").style.pointerEvents = canSwitch ? "auto" : "none";
  }

  const sub = $("#dashboardSubtitle");
  if (sub) {
    if (isDevAdmin()) {
      sub.textContent = "Overview of inventory status \u2013 All districts";
    } else {
      const _dActive = getDistricts().find(d => d.id === activeDistrictId);
      sub.textContent = "Overview of inventory status \u2013 " + (_dActive ? _dActive.name : "Your district");
    }
  }
// 'ig' and 'devadmin' are both Developer-Admin-only, so every marked option
  // is hidden from anyone else, not just the first one.
  document.querySelectorAll('#nuRole [data-dev-only]').forEach(opt => { opt.style.display = isDevAdmin() ? "" : "none"; });
  ["#backupDBBtn", "#backupExcelBtn", "#restoreDBBtn"].forEach(sel => { const el = $(sel); if (el) el.style.display = isDevAdmin() ? "" : "none"; });
  const _al = $("#auditLogBtn");
  if (_al) _al.style.display = (isAdmin() || isDevAdmin()) ? "" : "none";
  ["#addItemBtn", "#itemImportBtn"].forEach(sel => { const el = $(sel); if (el) el.style.display = (canManageItems() && !isDevAdmin()) ? "" : "none"; });
  const _allotImport = $("#allotImportBtn");
  if (_allotImport) _allotImport.style.display = canEdit() ? "" : "none";
}
/* Called by api-client after the server refused to store a change. The local
   cache has already been pulled back to the server's state, so whatever the form
   said on the way out never happened - say so plainly instead of leaving the user
   looking for a record that was quietly thrown away. */
window.__rbacResynced = function (err) {
  try {
    const body = err && err.body;
    const why = (body && (body.error || body.message)) || "";
    toast(why || "The server rejected that change, so it was not saved. Try again.", "error");
  } catch (e) { /* ignore */ }
  try { render(); } catch (e2) { /* ignore */ }
};

function toast(msg, type) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + (type || "");
  clearTimeout(toast._t);
  if (toast._off) { document.removeEventListener("pointerdown", toast._off, true); toast._off = null; }
  if ((type || "") === "error") {
    /* Error toasts stay on screen until the user clicks/taps anywhere (2026.09.184) */
    toast._off = () => { el.classList.add("hidden"); if (toast._off) { document.removeEventListener("pointerdown", toast._off, true); toast._off = null; } };
    setTimeout(() => { if (toast._off) document.addEventListener("pointerdown", toast._off, true); }, 0);
  } else {
    toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
  }
}
function openModal(id) { $(id).classList.remove("hidden"); }
function closeModals() { $$(".modal-backdrop").forEach(m => m.classList.add("hidden")); }

/* Keep the page behind a dialog from scrolling.
   A dialog is shown in well over a hundred places, and plenty of them toggle
   the `hidden` class directly instead of going through openModal/closeModals,
   so patching those two functions would still have missed a path or two. The
   lock is therefore derived from what is actually on screen: the observer
   fires on every class change anywhere under <body>, and the state is just
   "is any backdrop visible right now". That is also why the check is a scan
   and not a counter - one dialog closing must not unlock the page while
   another is still open, and only the scan can know that.

   The page is only ever made overflow:hidden. It is never re-laid-out, never
   reset and never given position:fixed, so it cannot lose its scroll position
   while the dialog is up, and there is nothing to restore on close. */
function __syncModalScrollLock() {
  try {
    const anyOpen = $$(".modal-backdrop").some(function (m) {
      return m && !m.classList.contains("hidden");
    });
    document.body.classList.toggle("modal-open", anyOpen);
  } catch (e) { /* never let the lock break a dialog */ }
}
if (typeof MutationObserver === "function" && document.body) {
  try {
    new MutationObserver(__syncModalScrollLock).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
    });
  } catch (e) { /* fall through to the direct calls below */ }
}
__syncModalScrollLock();
/* Bulletproof modal dismissal (2026.09.90): delegated at document level so close/cancel/
   cross buttons work even if some other init code fails. */
document.addEventListener("click", function (e) {
  const c = e.target.closest && e.target.closest("[data-close]");
  if (c) { closeModals(); return; }
  const b = e.target.closest && e.target.closest(".modal-backdrop");
  if (b && !b.classList.contains("hidden") && e.target === b) closeModals();
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModals(); });

/* ==================== REQUEST ACCESS ==================== */
function getAccessRequests() { return loadData("accessRequests") || []; }
function saveAccessRequests(arr) { saveData("accessRequests", arr); }

function openRequestAccessModal() {
  const distSel = $("#raDistrict");
  distSel.innerHTML = '<option value="">Select District...</option>' + __byName(getDistricts()).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
  distSel.value = "";
  updateRALocationDropdown();
  $("#raName").value = "";
  $("#raPost").value = "";
  $("#raMobile").value = "";
  $("#raUserType").value = "user";
  $("#raResult").classList.add("hidden");
  $("#raSubmitBtn").disabled = false;
  openModal("#requestAccessModal");
}

function updateRALocationDropdown() {
  const distSel = $("#raDistrict");
  const locSel = $("#raLocation");
  if (!distSel || !locSel) return;
  if (!distSel.value) {
    locSel.innerHTML = '<option value="">Select District first...</option>';
    locSel.disabled = true;
    return;
  }
  locSel.disabled = false;
  locSel.innerHTML = '<option value="">Select Location / Station...</option>' + __byName(getLocationsForDistrict(distSel.value)).map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
}

function submitAccessRequest(e) {
  e.preventDefault();
  const name = $("#raName").value.trim();
  const post = $("#raPost").value.trim();
  const mobile = $("#raMobile").value.trim();
  const districtId = $("#raDistrict").value;
  const locationId = $("#raLocation").value;
  const userType = $("#raUserType").value;
  if (!name || !post || !mobile || !districtId || !locationId || !userType) return;

  const req = { id: "ar_" + Date.now(), name, post, mobile, districtId, locationId, userType, status: "pending", createdAt: Date.now() };
  const requests = getAccessRequests();
  requests.unshift(req);
  saveAccessRequests(requests);

  const dist = getDistricts().find(d => d.id === districtId);
  const loc = getLocationsForDistrict(districtId).find(l => l.id === locationId);
  const msg = `New access request from "${name}" — Post: ${post}, Mobile: ${mobile}, District: ${dist ? dist.name : "?"}, Location: ${loc ? loc.name : "?"}, Role: ${ROLE_LABELS[userType] || userType}.`;

  const admins = getUsers().filter(u => u.role === "admin" && u.districtId === districtId);
  admins.forEach(a => addNotification(districtId, { type: "access_request", title: "Access Request", message: msg, fromDistrictId: districtId, requestId: req.id }));

  const devs = getUsers().filter(u => u.role === "devadmin");
  devs.forEach(d => addNotification(d.districtId, { type: "access_request", title: "Access Request", message: msg, fromDistrictId: districtId, requestId: req.id }));

  $("#raResult").classList.remove("hidden");
  $("#raSubmitBtn").disabled = true;
  toast("Access request submitted!", "success");
}

function handleAccessApproval(notifId, requestId, status, distId) {
  const requests = getAccessRequests();
  const req = requests.find(r => r.id === requestId);
  if (!req) { toast("Access request not found or already processed.", "error"); return; }
  if (req.status !== "pending") {
    const nd = distId || activeDistrictId;
    const ns = getNotifications(nd);
    const nn = ns.find(x => x.id === notifId);
    if (nn) { nn.read = true; saveNotifications(nd, ns); }
    toast("This access request was already " + (req.status === "approved" ? "approved" : "rejected") + ".", "error");
    renderNotifications();
    return;
  }
  req.status = status;
  saveAccessRequests(requests);

  /* Mark every copy of this access-request notification read in ALL districts
     (district admin + dev admin each hold a copy; one action settles all) */
  try {
    getDistricts().forEach(d => {
      const ns = getNotifications(d.id);
      let changed = false;
      ns.forEach(x => { if (x.requestId === requestId && !x.read) { x.read = true; changed = true; } });
      if (changed) saveNotifications(d.id, ns);
    });
  } catch (e) { console.error("notif settle failed:", e); }

  const dist = getDistricts().find(d => d.id === req.districtId);
  const loc = getLocationsForDistrict(req.districtId).find(l => l.id === req.locationId);
  const requestData = `Name: ${req.name}, Post: ${req.post}, Mobile: ${req.mobile}, District: ${dist ? dist.name : "?"}, Location: ${loc ? loc.name : "?"}, Role: ${ROLE_LABELS[req.userType] || req.userType}`;

  if (status === "approved") {
    const admins = getUsers().filter(u => u.role === "admin" && u.districtId === req.districtId);
    admins.forEach(a => addNotification(req.districtId, { type: "access_approved", title: "Access Approved \u2013 Create User", message: `Request approved. Please create the user: ${requestData}`, fromDistrictId: req.districtId, requestId: req.id }));
    const devs = getUsers().filter(u => u.role === "devadmin");
    devs.forEach(d => addNotification(d.districtId, { type: "access_approved", title: "Access Approved \u2013 Create User", message: `Request approved. Please create the user: ${requestData}`, fromDistrictId: req.districtId, requestId: req.id }));
    toast("Access request approved! Admins notified to create user.", "success");
  } else {
    const devs = getUsers().filter(u => u.role === "devadmin");
    devs.forEach(d => addNotification(d.districtId, { type: "access_rejected", title: "Access Rejected", message: `Request for "${req.name}" was rejected.`, fromDistrictId: req.districtId, requestId: req.id }));
    toast("Access request rejected.", "error");
  }
  renderNotifications();
}

/* ==================== NAVIGATION ==================== */
function switchTab(name) {
  $$(".sidebar-link").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  $$(".view").forEach(v => v.classList.add("hidden"));
  const view = $("#view-" + name);
  if (view) view.classList.remove("hidden");
  if (name === "dashboard") __rtRenderFeed();
  try { render(); } catch (e) { console.error("render failed:", e); }
}

function render() {
  if (!currentUser) return; /* never render before login (2026.09.89) */
  if (!render.__healed) { render.__healed = true; __healStoredMojibake(); }
  renderDistrictSelector();
  renderDashboard();
  renderInventory();
  renderInspections();
  renderDemands();
  renderDistribution();
  renderMaintenance();
  const allocView = $("#view-allotments");
  if (allocView && !allocView.classList.contains("hidden")) renderAllotments();
  const invView = $("#view-inventory");
  if (invView && !invView.classList.contains("hidden") && __invTab === "stock") {
    __repopulateMultiCat($("#allocStockCat"));
    renderAllocStock();
  }
  renderReports();
  try { renderConsumables(); } catch (e) { console.error("renderConsumables failed:", e); }
  try { renderDevPagesTick(); } catch (e) { }
  try { applyTableHeaders(); } catch (e) { }
  const badge = $("#notifBadge");
  if (badge) {
    const count = getUnreadCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? "flex" : "none";
  }
}

/* ==================== RESPONSIVE TABLE HEADERS ====================
   A wide table on a phone is unusable: you scroll sideways and lose the column
   you are reading. On a narrow screen each row becomes a small card and every
   cell is labelled with its own column name, so nothing has to be remembered.

   The labels are copied from the table's own <thead>, which means this works for
   every table in the app - the static ones and the ones built by JavaScript -
   without a single hand-written data-th in the markup to fall out of date. */
function applyTableHeaders() {
  const tables = document.querySelectorAll("table");
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    if (!table || !table.querySelector) continue;
    const head = table.querySelector("thead");
    if (!head) continue;
    const ths = head.querySelectorAll("th") || [];
    if (!ths.length) continue;
    const rows = table.querySelectorAll("tbody tr") || [];
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].children || [];
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        if (cell.tagName !== "TD") continue;
        const th = ths[c];
        if (!th) continue;
        // an empty header cell means a spacer column, which needs no label
        const label = (th.textContent || "").replace(/\s+/g, " ").trim();
        if (label && !cell.getAttribute("data-th")) cell.setAttribute("data-th", label);
      }
    }
  }
}

/* Tables are rebuilt by many different render functions, and a MutationObserver
   catches all of them without any of them having to remember to call this. */
function watchTables() {
  const root = document.getElementById("appRoot") || document.body;
  if (!root || typeof MutationObserver === "undefined") return;
  let queued = false;
  const apply = () => {
    if (queued) return;
    queued = true;
    // wait for the browser to finish the batch of writes it is in the middle of
    requestAnimationFrame(() => {
      queued = false;
      try { applyTableHeaders(); } catch (e) { /* never let decoration break a page */ }
    });
  };
  new MutationObserver(apply).observe(root, { childList: true, subtree: true });
  apply();
}

/* ==================== DISTRICT SELECTOR ==================== */
function renderDistrictSelector() {
  const sel = $("#districtSelect");
  if (!sel) return;
  const all = getDistricts();
  // Only the districts this account is actually entitled to. userDistricts()
  // returns null for the Developer Admin, which means "every district", and the
  // exact list for everybody else - an Inspector General sees the districts of
  // their own IG Range and nothing beyond it. It used to list every district in
  // the state for everyone, so a District Admin or an IG was shown places they
  // can neither open nor switch to.
  const scope = userDistricts(currentUser);
  const districts = scope === null ? all : all.filter(d => scope.indexOf(d.id) >= 0);
  if (!districts.length) {
    sel.innerHTML = '<option value="">No district assigned</option>';
    return;
  }
  // The district in view can be one this account no longer holds - left over
  // from a previous login, or one the account was moved off. Falling back to
  // the first district it does hold beats showing a blank selector.
  if (!districts.some(d => d.id === activeDistrictId)) {
    activeDistrictId = districts[0].id;
    setActiveDistrict(districts[0].id);
  }
  sel.innerHTML = __byName(districts).map(d => `<option value="${d.id}" ${d.id === activeDistrictId ? "selected" : ""}>${esc(d.name)}</option>`).join("");
}

function switchDistrict(newId) {
  // An Inspector General moves between the districts of their own range, so the
  // selector has to work for them as well - applyRoleUI() already enables it for
  // them. Anyone else is not a district switcher at all.
  if (!isDevAdmin() && !isIg()) return;
  if (!inDistrictScope(newId)) return toast("That district is not in your IG Range.", "error");
  if (newId === activeDistrictId) return;
  activeDistrictId = newId;
  setActiveDistrict(newId);
  closeModals(); // per-district lists must not survive a district switch (2026.09.213)
  const panel = $("#notifPanel");
  if (panel) panel.classList.add("hidden");
  currentUser.districtId = newId;
  setAuth({ user: currentUser, token: getToken() });
  applyRoleUI();
  render();
}

/* ==================== DASHBOARD ==================== */
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function renderDashboard() {
  const __allMode = isDevAdmin();
  let items = getItems();
  if (__allMode) {
    const all = getAllItems();
    items = Object.keys(all).flatMap(k => all[k] || []);
  }
  const cats = getCategories();

  $("#statTotalItems").textContent = items.length;
  $("#statTotalQuantity").textContent = items.reduce((a, i) => a + i.quantity, 0).toLocaleString();
  $("#statLowStock").textContent = items.filter(i => i.quantity <= i.minStock).length;
  $("#statCategories").textContent = cats.length;
const condTotals = { good: 0, poor: 0, damaged: 0 };
  items.forEach(i => {
    const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 };
    condTotals.good += cc.good || 0;
    condTotals.poor += cc.poor || 0;
    condTotals.damaged += cc.damaged || 0;
  });
  $("#statDamaged").textContent = condTotals.damaged;
  $("#statPoor").textContent = condTotals.poor;
  $("#statGood").textContent = condTotals.good;

const lowItems = __sortRows("dashLow", items.filter(i => i.quantity <= i.minStock));
  const lowBody = $("#lowStockBody");
  // Item, Category and the one action worth having here. The quantity figures
  // that used to sit in this table - current, minimum, reorder - each already
  // have a home: the item's own page, and the stat cards above, which can be
  // opened to see the full list with all of them. A row on the dashboard is
  // for spotting what is short and then dealing with it, so that is all it
  // carries, and the button opens Add Stock already set to that item.
  if (lowItems.length) {
    lowBody.innerHTML = lowItems.map(i => {
      const cat = cats.find(c => c.id === i.categoryId);
      return `<tr><td class="item-name">${__ipLink(i)}</td><td><span class="cat-badge">${esc(cat ? cat.name : "")}</span></td><td class="cell-actions"><button type="button" class="btn btn-sm btn-outline" data-action="dash-add-stock" data-item-id="${esc(i.id)}">Add Stock</button></td></tr>`;
    }).join("");
  } else {
    lowBody.innerHTML = `<tr class="empty-row"><td colspan="3">All items well stocked.</td></tr>`;
  }

  renderCharts();
}

/* ==================== ROW COUNT ON EVERY TABLE ==================== */
/* Every list in the app gets a line at the bottom saying how many rows it is
   showing. There are thirty table bodies and each is filled by its own render
   function, so counting them one by one would mean thirty edits that any of
   them could quietly undo the next time that list is redrawn. Instead this
   watches the tables themselves and keeps the line in step: whenever rows are
   added or removed, the count is recalculated and the line is rewritten.

   The count is of the rows the user can actually see, so the count row itself
   and the "nothing here" row are both left out - otherwise an empty list would
   claim to have one row. A total that counts its own foot is a small lie that
   is easy to miss. */

const __ROWCOUNT_CLASS = "rowcount-row";

// True for a row that is not one of the data rows: the "nothing here" line, a
// subtotal or total, a group heading, or the count line itself. These are
// furniture laid under the data, so counting them would report a list as
// longer than the entries in it.
function __isFootRow(r) {
  if (!r) return true;
  const cls = String(r.className || "");
  if (r.dataset && (r.dataset.rowcount || r.dataset.totalRow)) return true;
  if (cls.indexOf("empty-row") >= 0) return true;
  if (cls.indexOf("rpt-total-row") >= 0) return true;
  if (cls.indexOf("subtotal") >= 0) return true;
  if (cls.indexOf("total-row") >= 0) return true;
  if (cls.indexOf("group-row") >= 0) return true;
  return false;
}

function __countDataRows(tbody) {
  const rows = Array.from(tbody.querySelectorAll("tr"));
  return rows.filter(r => !__isFootRow(r) && !r.dataset.rowcount).length;
}

// Re-entrancy flag. This does NOT stop the observer: its callback is a microtask,
// so by the time it runs the flag has already been cleared again. It only
// guards against a call arriving while the row is being written. The real
// protection against the observer redrawing for ever is that the row is only
// rewritten when the text has actually changed - see __updateRowCount.
let __rowCountBusy = false;

function __updateRowCount(tbody) {
  if (!tbody || __rowCountBusy) return;
  const table = tbody.closest("table");
  if (!table) return;
  // Some bodies hold a nested table per row (details panels). Only count the
  // rows of this body, which the code above already does.
  let old = tbody.querySelector("tr[data-rowcount]");
  const n = __countDataRows(tbody);
  // Columns come from the header so the cell spans the real width; a fixed
  // number would leave a gap in a table that is not the usual width.
  let span = 1;
  if (table.querySelector("thead tr")) {
    span = table.querySelector("thead tr").querySelectorAll("th").length || 1;
  }
  // The Hindi dict is applied by walking text nodes and matching their whole
  // text, so "5 rows" would never match a key. Looked up directly instead, and
  // falls back to the English form if the dict has no entry.
  const key = n === 1 ? "1 row" : n + " rows";
  const dict = (typeof __I18N !== "undefined" && __I18N) || null;
  const hit = dict && dict[key];
  const text = (window.__LANG === "hi" && hit) ? hit : key;
  __rowCountBusy = true;
  try {
    if (!old) {
      const tr = document.createElement("tr");
      tr.className = __ROWCOUNT_CLASS;
      tr.dataset.rowcount = "1";
      tbody.appendChild(tr);
      old = tr;
    }
    // The count sits in the first column, under the item name, rather than
    // stretched across the table and pushed to the far right. A count read off
    // the right-hand edge reads as a total for the columns to its left; in the
    // first column it sits with the names it is counting, where it belongs.
    // The remaining columns stay empty but are still spanned so the line lines
    // up with the width of the table.
    // Written only when the text actually differs. Assigning innerHTML always
    // reports a change to the observer even when the result is identical, and
    // an observer that redraws in response to its own write will do so for
    // ever - which is what hung the page. The previous value is kept on the
    // element, as an attribute, so the check itself changes nothing the
    // observer is watching (it only watches added and removed children).
    const hasSNo = table.querySelector("thead th:first-child") && /s\.?no/i.test((table.querySelector("thead th:first-child").textContent || "").trim());
    const rowMarkup = hasSNo
      ? `<td></td><td class="rowcount-cell">${esc(text)}</td>` + (span > 2 ? `<td class="rowcount-pad" colspan="${span - 2}"></td>` : "")
      : `<td class="rowcount-cell">${esc(text)}</td>` + (span > 1 ? `<td class="rowcount-pad" colspan="${span - 1}"></td>` : "");
    if (old.dataset.rowcountText !== key || old.dataset.rowcountSpan !== String(span) || old.dataset.rowcountSno !== (hasSNo ? "1" : "0")) {
      old.dataset.rowcountText = key;
      old.dataset.rowcountSpan = String(span);
      old.dataset.rowcountSno = hasSNo ? "1" : "0";
      old.innerHTML = rowMarkup;
    }
    // A table that has no rows at all is saying "nothing here"; a footer count of
    // "0 rows" under it is noise, so it is hidden rather than removed.
    old.style.display = n === 0 ? "none" : "";
  } finally {
    __rowCountBusy = false;
  }
}

// Binds one body, once. The flag is on the element because a body redrawn by
// innerHTML is a different object each time and would otherwise be counted
// twice over.
function __bindRowCount(tb) {
  if (!tb || !tb.dataset) return;
  if (tb.dataset.rowcountBound === "1") return;
  tb.dataset.rowcountBound = "1";
  __updateRowCount(tb);
}

// A list that is not a table at all: a stack of divs, one per entry, the way
// the admin pages draw locations, districts, users and categories. The rows are
// recognised by shape rather than by a class name - the direct children that
// are elements, minus the empty-message box - so a page gets counted without
// having been listed here, and a new one is covered as it is written.
const __CARDLIST_HINT = /-list$|-rows$|List$|Body$|Grid$/;
const __CARDLIST_SKIP = /empty|placeholder|loading|no-?data|nothing/i;

// True when a row is nothing but controls: every scrap of text in it belongs to
// a button or link, so there is no name, no figure and nothing to count. A
// category row has its name in a span, so it is still counted; a strip of bare
// buttons is not an entry in the list and must not be counted as one.
function __isButtonsOnly(el) {
  if (!el || !el.querySelectorAll) return false;
  const controls = el.querySelectorAll("button, a.btn, [role=button], input[type=button], input[type=submit]");
  if (!controls.length) return false;
  let text = "";
  try {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const p = n.parentElement;
        if (p && p.closest && p.closest("button, a.btn, [role=button]")) return NodeFilter.FILTER_REJECT;
        return (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const parts = [];
    while (walk.nextNode()) parts.push(walk.currentNode.nodeValue.trim());
    text = parts.join("");
  } catch (e) {
    return false;   // cannot tell; count it rather than lose the row
  }
  return text.trim() === "";
}

// Lists whose rows are known, so they are counted by name rather than by shape.
// Counting by shape means deciding what counts as an entry, and on these lists
// that judgement was getting it wrong - a row's own buttons were being taken
// for entries, and the count came out as the number of controls in the list.
// Naming the row element removes the judgement entirely: the button strip is
// never a row, so it cannot be counted as one.
const __LIST_ROWS = [
  { box: "#catList",        row: ".cat-list-row" },   // Manage Categories
  { box: "#consCatList",    row: ".cat-list-row" },   // Manage Categories (consumables)
  { box: "#locationList",   row: ".location-row" },
  { box: "#devLocList",     row: ".location-row" },
  { box: "#usersList",      row: ".user-row" }
];

function __knownRowSelector(box) {
  if (!box || !box.id) return null;
  for (const e of __LIST_ROWS) {
    if (e.box === "#" + box.id) return e.row;
  }
  return null;
}

function __cardListRows(box) {
  const known = __knownRowSelector(box);
  if (known) {
    // Only the named rows, and never the count line itself.
    return Array.from(box.querySelectorAll(known))
      .filter(el => !(el.dataset && el.dataset.cardcount));
  }
  const kids = Array.from(box.children).filter(el => el.tagName !== "SCRIPT" && el.tagName !== "STYLE");
  const real = kids.filter((el) => {
    if (el.dataset && el.dataset.cardcount) return false;      // our own foot
    // A child that is really a table in a wrapper - several of the admin pages
    // write a whole table into a div - is not one row. The table body inside it
    // is counted on its own and carries its own line, so counting the wrapper
    // as well reported a list of thirty as one.
    if (el.tagName === "TABLE" || (el.querySelector && el.querySelector("table"))) return false;
    const cls = String(el.className || "");
    const t = (el.textContent || "").trim();
    if (__CARDLIST_SKIP.test(cls)) return false;                // empty/loading
    if (!t) return false;
    // A row that is nothing but buttons is a control, not an entry.
    if (__isButtonsOnly(el)) return false;
    return true;
  });
  return real;
}

function __updateCardListCount(box) {
  if (!box || !box.dataset) return;
  let foot = box.querySelector(":scope > [data-cardcount]");
  const rows = __cardListRows(box);
  const n = rows.length;
  const key = n === 1 ? "1 row" : n + " rows";
  const dict = (typeof __I18N !== "undefined" && __I18N) || null;
  const hit = dict && dict[key];
  const text = (window.__LANG === "hi" && hit) ? hit : key;
  __rowCountBusy = true;
  try {
    if (!foot) {
      foot = document.createElement("div");
      foot.className = __ROWCOUNT_CLASS + " cardlist-count";
      foot.dataset.cardcount = "1";
      box.appendChild(foot);
    }
    // Same reason as the table version: writing the same text again would still
    // be seen as a change, and this one is what had the observer spinning.
    if (foot.textContent !== text) foot.textContent = text;
    foot.style.display = n === 0 ? "none" : "";
  } finally {
    __rowCountBusy = false;
  }
}

function __bindCardList(box) {
  if (!box || !box.dataset) return;
  if (box.dataset.cardcountBound === "1") return;
  box.dataset.cardcountBound = "1";
  __updateCardListCount(box);
}

// Whole class tokens only, never a fragment of one. The list classes are named
// so that a row's class contains the container's: the rows of the category list
// are "cat-list-row" and "cat-list-actions", inside a "cat-list". Matching on a
// substring found those two and treated every single row as a list of its own,
// so each row grew a count of its own children and the list filled up with
// "3 rows" and "2 rows" beside every category name.
const __CARDLIST_CLASSES = [
  "users-list", "districts-list", "location-list", "cat-list",
  "dev-cards", "dev-loc-list", "notif-list", "quick-login-list", "demo-list"
];

function __hasCardListClass(el) {
  const toks = String((el && el.className) || "").split(/\s+/);
  for (const t of toks) {
    if (__CARDLIST_CLASSES.indexOf(t) >= 0) return true;
  }
  return false;
}

function __looksLikeCardList(el) {
  if (!el || el.tagName === "TBODY" || el.tagName === "TABLE" || el.tagName === "TR") return false;
  // A row of a list is never a list, whatever else it is called.
  if (/(^|[\s-])(row|item|entry|card)($|[\s-])/i.test(String(el.className || ""))) return false;
  const id = el.id || "";
  if (__CARDLIST_HINT.test(id)) return true;
  return __hasCardListClass(el);
}

function __initRowCounts(root) {
  const scope = root || document;
  scope.querySelectorAll("tbody").forEach(__bindRowCount);
  if (scope === document) {
    document.querySelectorAll("*").forEach((el) => { if (__looksLikeCardList(el)) __bindCardList(el); });
  }
}

function __startRowCounter() {
  const apply = () => __initRowCounts(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
  // Render functions rewrite innerHTML wholesale, so a MutationObserver is what
  // catches the change; there is no single "table drawn" event to listen to.
  //
  // Rows arriving in an existing body are counted by looking at that body. A
  // whole table arriving is different: several of the admin pages build their
  // list as a table written into a div, so the tbody is new each time and did
  // not exist when the page loaded. Those are bound here as they appear, which
  // is what the Manage Locations list and its neighbours needed - they were
  // showing no count at all for exactly this reason.
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type !== "childList" || !m.target) continue;
      if (m.target.tagName === "TBODY") { __updateRowCount(m.target); continue; }
      for (const added of Array.from(m.addedNodes || [])) {
        if (added.nodeType !== 1) continue;
        if (added.tagName === "TBODY") {
          __bindRowCount(added);
        } else if (added.querySelectorAll) {
          added.querySelectorAll("tbody").forEach(__bindRowCount);
          // A div-list that is filled in after load, like the location list
          // behind its modal, is noticed here the first time it is drawn.
          if (__looksLikeCardList(added)) __bindCardList(added);
          added.querySelectorAll("*").forEach((el) => { if (__looksLikeCardList(el)) __bindCardList(el); });
        }
      }
      // Rows already in a bound div-list changed: recount the nearest one.
      if (m.target && m.target.nodeType === 1 && !__rowCountBusy) {
        const box = m.target.closest ? m.target.closest('[id$="List"], [id$="Body"], [id$="Grid"], .users-list, .districts-list, .location-list, .cat-list, .dev-cards, .dev-loc-list, .notif-list') : null;
        if (box && box.dataset && box.dataset.cardcountBound === "1") __updateCardListCount(box);
      }
    }
  });
  const start = () => {
    try {
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* older browser: the counts just will not appear */ }
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
}

/* ==================== DASHBOARD STAT DETAIL + EXPORT ==================== */
let __statDetail = { title: "", subtitle: "", cols: [], rows: [], fileName: "" };
let __statFilter = "";

function __statCurrentRows() {
  const d = __statDetail;
  const q = (__statFilter || "").toLowerCase();
  if (!q) return d.rows;
  return d.rows.filter(r => r.some(c => String(c).toLowerCase().includes(q)));
}

function xmlEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function __statConditionRows(cond) {
  const items = getItems();
  const cats = getCategories();
  const locs = getLocations();
  const label = cond === "loss" ? "Lost" : cond.charAt(0).toUpperCase() + cond.slice(1);
  const rows = items
    .filter(i => ((i.conditionCounts || {})[cond] || 0) > 0)
    .map(i => {
      const cc = i.conditionCounts || { good: 0, poor: 0, damaged: 0 };
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
      const status = i.quantity === 0 ? "Out" : i.quantity <= i.minStock ? "Low" : "OK";
      return [i.name, cat ? cat.name : "", loc ? loc.name : "", cc[cond] || 0, i.quantity, i.unit, status];
    });
  return { title: label + " Condition Items", cols: ["Item", "Category", "Location", label + " Qty", "Total Qty", "Unit", "Status"], rows };
}

const __STAT_BUILDERS = {
  total: () => {
    const items = getItems();
    const cats = getCategories();
    const locs = getLocations();
    const rows = items.map(i => {
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
      const status = i.quantity === 0 ? "Out" : i.quantity <= i.minStock ? "Low" : "OK";
      return [i.name, cat ? cat.name : "", loc ? loc.name : "", i.quantity, i.unit, i.minStock, status];
    });
    return { title: "Total Items", cols: ["Item", "Category", "Location", "Qty", "Unit", "Min", "Status"], rows };
  },
  stock: () => {
    const items = getItems();
    const cats = getCategories();
    const locs = getLocations();
    const rows = items.map(i => {
const cc = i.conditionCounts || { good: 0, poor: 0, damaged: 0 };
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
      const status = i.quantity === 0 ? "Out" : i.quantity <= i.minStock ? "Low" : "OK";
      return [i.name, cat ? cat.name : "", loc ? loc.name : "", i.quantity, i.unit, i.minStock, cc.good || 0, cc.poor || 0, cc.damaged || 0, status];
    });
    return { title: "Total Quantity", cols: ["Item", "Category", "Location", "Qty", "Unit", "Min", "Good", "Damaged", "Scrap", "Status"], rows };
  },
  low: () => {
    const items = getItems();
    const cats = getCategories();
    const locs = getLocations();
    const rows = items.filter(i => i.quantity <= i.minStock).map(i => {
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
      const status = i.quantity === 0 ? "Out" : "Low";
      return [i.name, cat ? cat.name : "", loc ? loc.name : "", i.quantity, i.minStock, status];
    });
    return { title: "Low Stock Alerts", cols: ["Item", "Category", "Location", "Current", "Min", "Status"], rows };
  },
  categories: () => {
    const items = getItems();
    const cats = getCategories();
    const rows = cats.map(c => {
      const list = items.filter(i => i.categoryId === c.id);
      return [c.name, list.length, list.reduce((a, i) => a + i.quantity, 0)];
    });
    return { title: "Categories", cols: ["Category", "No. of Items", "Total Qty"], rows };
  },
good: () => __statConditionRows("good"),
  poor: () => __statConditionRows("poor"),
  damaged: () => __statConditionRows("damaged")
};

function openStatDetail(key) {
  const def = __STAT_BUILDERS[key] ? __STAT_BUILDERS[key]() : null;
  if (!def) return;
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  const now = new Date().toLocaleString();
  __statDetail = {
    title: def.title,
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + now,
    cols: def.cols,
    rows: def.rows,
fileName: "dashboard-" + key.toLowerCase()
  };
  __statFilter = "";
  __pgReset("statDetail");
  $("#statDetailTitle").textContent = def.title;
  $("#statDetailSubtitle").textContent = __statDetail.subtitle;
  $("#statDetailHead").innerHTML = "<tr>" + def.cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const s = $("#statSearch");
  if (s) s.value = "";
  renderStatDetail("");
  openModal("#statDetailModal");
}

function __statTotalRow() {
  const d = __statDetail;
  const rows = __statCurrentRows();
  if (!rows.length) return null;
  const out = new Array(d.cols.length).fill("");
  let hasNum = false;
  for (let c = 0; c < d.cols.length; c++) {
    const vals = rows.map(r => r[c]);
    if (vals.length && vals.every(v => typeof v === "number" && isFinite(v))) {
      out[c] = vals.reduce((a, v) => a + v, 0);
      hasNum = true;
    }
  }
  return hasNum ? out : null;
}

function __statTableBody() {
  const rows = __statCurrentRows();
  const tr = __statTotalRow();
  if (tr) rows.push(tr);
  return rows;
}

function renderStatDetail(filter) {
  __statFilter = (filter || "").trim();
  const d = __statDetail;
  const rows = __statCurrentRows();
  const countEl = $("#statDetailCount");
  if (countEl) countEl.textContent = rows.length + (__statFilter ? " of " + d.rows.length : "") + " row" + (rows.length === 1 ? "" : "s");
  /* The head is written by several callers with plain <th>s - make it sortable. */
  const headEl = $("#statDetailHead");
  if (headEl && !headEl.querySelector("th[data-sort-col]")) headEl.innerHTML = __statHeadHtml(d.cols);
  const body = $("#statDetailBody");
  if (rows.length) {
    const pageRows = __pgRows("statDetail", rows);
    body.innerHTML = pageRows.map((r, idx) => `<tr class="${idx % 2 ? "row-alt" : ""}">${r.map((c, ci) => `<td>${colCellInline((d.cols || [])[ci], c)}</td>`).join("")}</tr>`).join("");
    const tr = __statTotalRow();
    if (tr) {
      const cells = tr.map((c, ci) => `<td class="stat-total-cell">${ci === 0 ? "Total" : c === "" ? "" : esc(c)}</td>`).join("");
      body.innerHTML += `<tr class="stat-total-row">${cells}</tr>`;
    }
  } else {
    body.innerHTML = `<tr class="empty-row"><td colspan="${d.cols.length}">${d.rows.length ? "No matching entries found." : "No data for this statistic."}</td></tr>`;
  }
  renderPager("statDetail", rows.length, () => renderStatDetail(__statFilter));
}

function downloadBlob(content, mime, fileName) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function printStatDetail() {
  const d = __statDetail;
  if (!d.title) return;
  const rows = __statCurrentRows();
  let rowsHtml = rows.length
    ? rows.map(r => `<tr>${r.map((c, ci) => `<td>${colCellInline((d.cols || [])[ci], c)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${d.cols.length}" style="text-align:center;color:#888">No data</td></tr>`;
  const tr = __statTotalRow();
  if (tr) {
    rowsHtml += `<tr style="font-weight:bold;background:#e8edf5">${tr.map((c, ci) => `<td style="border-top:2px solid #1e3a5f">${ci === 0 ? "Total" : c === "" ? "" : esc(c)}</td>`).join("")}</tr>`;
  }
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(d.title)}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h2{margin:0 0 4px;font-size:20px}
      .meta{font-size:12px;color:#555;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #1e3a5f}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#1e3a5f;color:#fff;text-align:left;padding:6px 8px}
      td{padding:6px 8px;border-bottom:1px solid #ccc}
      tr:nth-child(even){background:#f5f7fa}
    </style></head><body>
    <h2>${esc(d.title)}</h2>
    <div class="meta">${esc(d.subtitle)}</div>
    <table><thead><tr>${d.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${rowsHtml}</tbody></table>
    <script>window.onload=function(){window.print();};<\/script>
    </body></html>`);
  w.document.close();
}

function exportStatExcel() {
  const d = __statDetail;
  if (!d.title) return;
  const rows = __statCurrentRows();
  let x = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>\n';
  x += `<Row><Cell ss:MergeAcross="${d.cols.length - 1}"><Data ss:Type="String">${xmlEsc(d.title)}</Data></Cell></Row>\n`;
  x += `<Row><Cell ss:MergeAcross="${d.cols.length - 1}"><Data ss:Type="String">${xmlEsc(d.subtitle)}</Data></Cell></Row>\n`;
  x += "<Row>";
  d.cols.forEach(c => { x += `<Cell><Data ss:Type="String">${xmlEsc(c)}</Data></Cell>`; });
  x += "</Row>\n";
  if (!rows.length) {
    x += `<Row><Cell ss:MergeAcross="${d.cols.length - 1}"><Data ss:Type="String">No data</Data></Cell></Row>\n`;
  } else {
    rows.forEach(r => {
      x += "<Row>";
      r.forEach(c => {
        const isNum = typeof c === "number" && isFinite(c);
        x += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${isNum ? c : xmlEsc(c)}</Data></Cell>`;
      });
      x += "</Row>\n";
    });
  }
  const tr = __statTotalRow();
  if (tr) {
    x += "<Row>";
    tr.forEach((c, ci) => {
      if (ci === 0) { x += `<Cell><Data ss:Type="String">Total</Data></Cell>`; return; }
      const isNum = typeof c === "number" && isFinite(c);
      x += c === "" ? `<Cell/>` : `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${isNum ? c : xmlEsc(c)}</Data></Cell>`;
    });
    x += "</Row>\n";
  }
  x += "</Table></Worksheet></Workbook>";
  downloadBlob(x, "application/vnd.ms-excel", d.fileName + ".xls");
  toast("Excel exported.", "success");
}

function exportStatWord() {
  const d = __statDetail;
  if (!d.title) return;
  const rows = __statCurrentRows();
  let x = '<?xml version="1.0"?>\n<?mso-application progid="Word.Document"?>\n<w:wordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:body>\n';
  x += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="34"/></w:rPr><w:t>${xmlEsc(d.title)}</w:t></w:r></w:p>\n`;
  x += `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(d.subtitle)}</w:t></w:r></w:p>\n`;
  x += `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders></w:tblPr>\n`;
  x += "<w:tr>";
  d.cols.forEach(c => { x += `<w:tc><w:tcPr><w:shd w:fill="1E3A5F"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>${xmlEsc(c)}</w:t></w:r></w:p></w:tc>`; });
  x += "</w:tr>\n";
  if (!rows.length) {
    x += `<w:tr><w:tc><w:p><w:r><w:t>No data</w:t></w:r></w:p></w:tc></w:tr>`;
  } else {
    rows.forEach(r => {
      x += "<w:tr>";
      r.forEach(c => { x += `<w:tc><w:p><w:r><w:t xml:space="preserve">${xmlEsc(c)}</w:t></w:r></w:p></w:tc>`; });
      x += "</w:tr>\n";
    });
  }
  const tr = __statTotalRow();
  if (tr) {
    x += "<w:tr>";
    tr.forEach((c, ci) => {
      const isNum = typeof c === "number" && isFinite(c);
      x += `<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${ci === 0 ? "Total" : isNum ? c : c === "" ? "" : xmlEsc(c)}</w:t></w:r></w:p></w:tc>`;
    });
    x += "</w:tr>\n";
  }
  x += "</w:tbl>\n</w:body></w:wordDocument>";
  downloadBlob(x, "application/msword", d.fileName + ".doc");
  toast("Word document exported.", "success");
}

function exportStatPDF() {
  const d = __statDetail;
  if (!d.title) return;
  if (!window.jspdf || !window.jspdf.jsPDF) {
    toast("PDF library not loaded yet - use Print instead.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text(d.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(d.subtitle, 14, 22);
  const body = __statTableBody();
  const totalIdx = body.length - 1;
  const hasTotal = body.length > 0 && body[totalIdx][0] === "Total";
  doc.autoTable({
    head: [d.cols],
    body: body,
    startY: 27,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: data => {
      if (data.section === "body" && hasTotal && data.row.index === totalIdx) data.cell.styles.fontStyle = "bold";
    }
  });
  doc.save(d.fileName + ".pdf");
  toast("PDF exported.", "success");
}

/* ==================== INVENTORY ==================== */
function bindCombobox(inputId, menuId, selId) {
  const input = $("#" + inputId), menu = $("#" + menuId), sel = $("#" + selId);
  if (!input || !menu || !sel) return;

  const selectVal = (val) => {
    sel.value = val;
    syncLabel();
    hideMenu();
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const renderOpts = (filter) => {
    const q = (filter || "").toLowerCase();
    const opts = sel.options;
    let html = "";
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      const label = o.text;
      if (q && !label.toLowerCase().includes(q)) continue;
      if (!o.value && q) continue;
      html += `<button type="button" class="cb-opt${sel.value === o.value ? " cb-opt-sel" : ""}" data-val="${o.value}">${esc(label)}</button>`;
    }
    menu.innerHTML = html || `<div class="cb-empty">No matches${q ? ` for "${esc(q)}"` : ""}</div>`;
    Array.prototype.forEach.call(menu.querySelectorAll(".cb-opt"), b => b.addEventListener("mousedown", ev => {
      ev.preventDefault();
      selectVal(b.dataset.val);
    }));
  };

  const syncLabel = () => {
    const o = sel.selectedOptions && sel.selectedOptions[0];
    input.value = o ? o.text : "";
    input.classList.toggle("cb-has-value", !!(o && o.value));
  };

  const showMenu = (filter) => {
    renderOpts(filter || "");
    menu.classList.remove("hidden");
    input.classList.add("cb-open");
  };

  const hideMenu = () => {
    menu.classList.add("hidden");
    input.classList.remove("cb-open");
  };

  input.addEventListener("mousedown", () => {
    input.value = "";
    showMenu("");
  });
  input.addEventListener("focus", () => {
    if (!input.value) return;
    input.value = "";
    showMenu("");
  });
  input.addEventListener("input", () => { showMenu(input.value); });
  input.addEventListener("blur", () => setTimeout(() => { hideMenu(); syncLabel(); }, 160));
  input.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); hideMenu(); syncLabel(); }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = menu.querySelector(".cb-opt");
      if (opt) selectVal(opt.dataset.val); else { hideMenu(); syncLabel(); }
    }
  });
}

function bindItemSearch() {
  const input = $("#searchInput"), menu = $("#searchCbMenu");
  if (!input || !menu) return;
  const MAX = 40;
  let prevText = "";

  const selectItem = (name) => {
    input.value = name;
    hideMenu();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const renderOpts = (filter) => {
    const q = (filter || "").toLowerCase();
    const items = getItems()
      .filter(i => !i.isDeleted && (q ? i.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX);
    if (!items.length) {
      menu.innerHTML = `<div class="cb-empty">No items${q ? ` matching "${esc(q)}"` : ""}</div>`;
      return;
    }
    menu.innerHTML = items.map(i => `<button type="button" class="cb-opt" data-name="${i.id}">${esc(i.name)}</button>`).join("");
    Array.prototype.forEach.call(menu.querySelectorAll(".cb-opt"), b => b.addEventListener("mousedown", ev => {
      ev.preventDefault();
      selectItem(b.textContent.trim());
    }));
  };
  const showMenu = (f) => { renderOpts(f); menu.classList.remove("hidden"); };
  const hideMenu = () => menu.classList.add("hidden");
  const restore = () => { if (!input.value) input.value = prevText; };

  input.addEventListener("mousedown", () => { prevText = input.value; input.value = ""; showMenu(""); });
  input.addEventListener("focus", () => { if (!input.value) return; prevText = input.value; input.value = ""; showMenu(""); });
  input.addEventListener("input", () => { showMenu(input.value); });
  input.addEventListener("blur", () => setTimeout(() => { hideMenu(); restore(); }, 160));
  input.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); hideMenu(); restore(); }
    if (e.key === "Enter") {
      e.preventDefault();
      const o = menu.querySelector(".cb-opt");
      if (o) selectItem(o.textContent.trim()); else hideMenu();
    }
  });
}

function syncComboboxes() {
  // The category control is a multi-select (see bindMultiCombobox); it keeps its own
  // label and reads the ticked boxes, so it is left out of this single-value sync.
  [["#locationCbInput", "#locationFilter"], ["#conditionCbInput", "#conditionFilter"]].forEach(pair => {
    const input = $(pair[0]), selEl = $(pair[1]);
    if (!input || !selEl) return;
    const o = selEl.selectedOptions && selEl.selectedOptions[0];
    input.value = o ? o.text : "";
    input.classList.toggle("cb-has-value", !!(o && o.value));
  });
}

function __invFiltered() {
  const items = getItems();
  const q = ($("#searchInput") || {}).value || "";
  const catFilter = (typeof __msMatches === "function") ? __msMatches($("#categoryFilter")) : (($("#categoryFilter") || {}).value || "");
  const locFilter = ($("#locationFilter") || {}).value || "";
  const condFilter = ($("#conditionFilter") || {}).value || "";
  const dateFrom = ($("#itemDateFrom") || {}).value;
  const dateTo = ($("#itemDateTo") || {}).value;

  const rows = items.filter(i => {
    if (typeof catFilter === "function" ? !catFilter(i) : (catFilter && i.categoryId !== catFilter)) return false;
    if (locFilter && i.locationId !== locFilter) return false;
    if (condFilter) {
      if (i.isDeleted) return false;
      const cc = i.conditionCounts || {};
      if (!(cc[condFilter] > 0)) return false;
    }
    if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (dateFrom) {
      const d = i.createdAt || 0;
      if (!d || d < new Date(dateFrom + "T00:00:00").getTime()) return false;
    }
    if (dateTo) {
      const d = i.createdAt || 0;
      if (!d || d >= new Date(dateTo + "T00:00:00").getTime() + 86400000) return false;
    }
    return true;
  });
  rows.sort((a, b) => (__lastChangeAt(b) - __lastChangeAt(a)) || a.name.localeCompare(b.name));
  // Ticked categories form one block each, in the order they were ticked.
  if (typeof __msGrouped === "function") return __msGrouped(rows, $("#categoryFilter"), i => i.categoryId);
  return rows;
}
/* Recency helper: latest stock-change timestamp (history last entry), else updatedAt. Used to show the newest-changed item first in Stock History. */
function __lastChangeAt(item) {
  const h = item.history || [];
  const last = h[h.length - 1];
  return Number((last && last.at) || item.updatedAt || 0);
}

function actDD(items, forceDD) {
  if (!items || !items.length) return "";
  // Every item gets a base class. Before this, an item declared without a cls
  // of its own came out as class="" - an unstyled browser button that vanished
  // against the menu behind it and only appeared on hover.
  const itemBtn = it => `<button type="button" class="act-dd-item ${it.cls || ""}" ${it.attrs} ${it.disabled ? "disabled" : ""} ${it.title ? `title="${esc(it.title)}"` : ""}>${esc(it.label)}</button>`;
  if (!forceDD && items.length === 1) {
    return itemBtn(items[0]).replace('class="', 'class="btn btn-sm btn-outline ');
  }
  return `<div class="act-dd"><button type="button" class="act-dd-btn" data-act-dd>Actions <span class="ee-caret">&#9662;</span></button>` +
    `<div class="act-dd-menu hidden">${items.map(itemBtn).join("")}</div></div>`;
}

/* The Actions menu is absolutely positioned below its button, so on the last rows
   of a long list it used to open off the bottom of the window. Measure the room on
   each side and open upward when below is the worse option. */
function actDdFlip(wrap) {
  if (!wrap) return;
  const trig = wrap.querySelector("[data-act-dd]");
  const box = wrap.querySelector(".act-dd-menu");
  if (!trig || !box) return;
  wrap.classList.remove("drop-up");
  const t = trig.getBoundingClientRect();
  const below = window.innerHeight - t.bottom;
  const above = t.top;
  const need = box.getBoundingClientRect().height + 8;
  if (below < need && above > below) wrap.classList.add("drop-up");
}
/* Re-measure while a menu is open, so scrolling or resizing cannot strand it. */
function actDdReflow() {
  $$(".act-dd-menu:not(.hidden)").forEach(box => actDdFlip(box.parentElement));
}
window.addEventListener("resize", actDdReflow);
window.addEventListener("scroll", actDdReflow, true);

function renderInventory() {
  const items = getItems();
  const cats = getCategories();
  const locs = getLocations();
  const condFilter = ($("#conditionFilter") || {}).value || "";
  const catFilter = (typeof __msMatches === "function") ? __msMatches($("#categoryFilter")) : (($("#categoryFilter") || {}).value || "");
  const filtered = __invFiltered();

  const tbody = $("#inventoryBody");
  if (!tbody) return;

if (filtered.length) {
    let totalQty = 0;
    const pageRows = __pgRows("inv", filtered);
    tbody.innerHTML = pageRows.map(i => {
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 };
      const displayQty = condFilter ? (cc[condFilter] || 0) : i.quantity;
      totalQty += displayQty;
      const isDel = !!i.isDeleted;
      const cls = isDel ? "status-out" : (displayQty === 0 ? "status-out" : displayQty <= i.minStock ? "status-low" : "status-ok");
      const label = isDel ? "Deleted" : (displayQty === 0 ? "Out of Stock" : displayQty <= i.minStock ? "Low Stock" : "In Stock");
  const __chg = (() => { if (condFilter) return null; const h = i.history || []; const last = h[h.length - 1]; if (!last) return null; const q = Number(last.qty) || 0; const when = (last.date || "") + (last.time ? " " + last.time : ""); const parts = when.split(" "); return { q: q, when: when, nice: (parts[0] ? fmtDate(parts[0]) : "") + (parts[1] ? " " + parts[1] : ""), rem: last.remarks || "", photos: last.photos || null }; })();
const isDelItem = isDel || (__chg && (__chg.type === "ITEM_DELETED" || __chg.rem === "Deleted Item"));
const __chgCell = condFilter ? `<td class="qty-strong">${displayQty}</td>` : (isDelItem ? `<td class="qty-strong" style="color:var(--red)" title="${esc("Deleted: " + (__chg ? __chg.when : ""))}"><span class="status-badge status-out" style="font-size:0.75rem">Deleted Item</span></td>` : (__chg ? `<td class="qty-strong" style="color:var(--${__chg.q > 0 ? "green" : "red"})" title="${esc("Last update " + __chg.when + ": " + __chg.rem)}">${__chg.q > 0 ? "+" + __chg.q : __chg.q}${photoChipsHtml({ photos: __chg.photos })}</td>` : `<td class="qty-strong"><span class="muted">&mdash;</span></td>`));
      /* Actions column: record-level RBAC. Every row gets View; Edit/Delete
         only when the record belongs to the logged-in user's own unit.
         Developer Admin gets View only ? no Edit/Delete buttons at all.
         Other units under the district: Edit/Delete disabled with a tooltip.
         ("All Locations" evaluates this PER RECORD, never per filter.) */
      let btns;
      if (isDel) {
        btns = actDD([{ label: "View", attrs: `data-action="view" data-id="${i.id}"` }]);
      } else {
      const locFilterVal = ($("#locationFilter") || {}).value || "";
      const adminOwnSelected = currentUser.role !== "admin" || (locFilterVal === currentUser.locationId);
      if (!canViewItem(i)) btns = "";
      else if (isDevAdmin()) {
        btns = actDD([{ label: "View", attrs: `data-action="view" data-id="${i.id}"` }]);
      } else if (currentUser.role === "admin" && !adminOwnSelected) {
        /* District Admin: Edit/Delete ONLY when their own unit is selected
           in the location filter. "All Locations" or another unit = view only. */
        btns = actDD([{ label: "View", attrs: `data-action="view" data-id="${i.id}"` }]);
      } else if (itemOwnedByCurrentUser(i)) {
        btns = actDD([
          { label: "View", attrs: `data-action="view" data-id="${i.id}"` },
          ...(canEditItem(i) ? [
            { label: "Edit", attrs: `data-action="edit" data-id="${i.id}"` },
            { label: "Delete", attrs: `data-action="delete" data-id="${i.id}"` }
          ] : [])
        ]);
      } else {
        const lockTitle = __rbacLockMsg();
        btns = actDD([
          { label: "View", attrs: `data-action="view" data-id="${i.id}"` },
        ]);
      }
      }
      return `<tr data-item-id="${i.id}"><td class="item-name">${__ipLink(i)}${isDel ? ' <span class="status-badge status-out" style="font-size:.68rem;padding:1px 6px;margin-left:4px">Deleted</span>' : ''}</td>${__chgCell}<td>${esc(loc ? loc.name : "")}</td><td>${buildCondBar(cc)}</td><td><span class="status-badge ${cls}">${label}</span></td><td>${__chg ? esc(__chg.nice) : (i.updatedAt ? fmtDate(i.updatedAt) : "<span style='color:var(--muted)'>\u2014</span>")}</td><td class="actions-cell">${btns}</td></tr>`;
    }).join("");

    if (condFilter) {
      const condLabel = condFilter.charAt(0).toUpperCase() + condFilter.slice(1);
      let catTotalQty = 0;
      if (catFilter) {
        filtered.forEach(i => {
          const cc = i.conditionCounts || {};
          catTotalQty += (cc[condFilter] || 0);
        });
      }
      const allItems = getItems();
      let grandTotalQty = 0;
      allItems.forEach(i => {
        const cc = i.conditionCounts || {};
        grandTotalQty += (cc[condFilter] || 0);
      });
      const catName = catFilter ? (cats.find(c => c.id === catFilter) || {}).name : "";
      const summaryHtml = catFilter
        ? `<tr class="summary-row"><td colspan="2" style="font-weight:700;color:var(--primary)">${condLabel} Total (${esc(catName)})</td><td class="qty-strong" style="color:var(--primary)">${catTotalQty}</td><td colspan="4"></td></tr><tr class="summary-row summary-grand"><td colspan="2" style="font-weight:700;color:var(--primary)">${condLabel} Total (All Categories)</td><td class="qty-strong" style="color:var(--primary)">${grandTotalQty}</td><td colspan="4"></td></tr>`
        : `<tr class="summary-row summary-grand"><td colspan="2" style="font-weight:700;color:var(--primary)">${condLabel} Total (All Categories)</td><td class="qty-strong" style="color:var(--primary)">${grandTotalQty}</td><td colspan="4"></td></tr>`;
      tbody.innerHTML += summaryHtml;
    }

    tbody.innerHTML += condFilter
 ? `<tr class="rpt-total-row"><td>Total</td><td></td><td class="qty-strong">${totalQty}</td><td colspan="4"></td></tr>`
 : `<tr class="rpt-total-row"><td>Total</td><td></td><td class="qty-strong"><span class="muted">&mdash;</span></td><td colspan="4"></td></tr>`;
} else {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No items found. Try adjusting the filters.</td></tr>`;
  }
  renderPager("inv", filtered.length, renderInventory);
const __invTbl = document.querySelector("#inventoryBody") ? document.querySelector("#inventoryBody").closest("table") : null;
/* The Stock Change column is renamed to "Quantity" while a condition filter is on.
   It is found by name, not by data-sort-col: those numbers move whenever a column
   is added or removed, and pinning one here once made this rewrite the Location
   header instead. */
const __invQth = __invTbl ? [...__invTbl.querySelectorAll("thead th[data-sort-col]")].find(th => /^(stock change|quantity)$/i.test(th.textContent.trim())) : null;
if (__invQth) { const __arr = __invQth.querySelector(".sort-arrow"); const __gl = __arr ? __arr.textContent : ""; __invQth.innerHTML = (condFilter ? "Quantity" : "Stock Change") + ' <span class="sort-arrow">' + __gl + '</span>'; }
  rebuildDropdowns();
  syncComboboxes();
}

function __invExportData() {
  const cats = getCategories();
  const locs = getLocations();
const condKeys = ["good", "poor", "damaged"];
  const condLabels = ["Good", "Damaged", "Scrap"];
  const rows = __invFiltered().map(i => {
    const cat = cats.find(c => c.id === i.categoryId);
    const loc = locs.find(l => l.id === i.locationId);
    const cc = i.conditionCounts || {};
    const total = condKeys.reduce((s, k) => s + (cc[k] || 0), 0);
    const condTxt = condKeys.map((k, idx) => (cc[k] || 0) ? `${cc[k]} ${condLabels[idx]}` : null).filter(Boolean).join(", ") || "\u2014";
    const status = total === 0 ? "Out of Stock" : total <= i.minStock ? "Low Stock" : "In Stock";
    return [i.name, cat ? cat.name : "", total, i.unit, i.minStock, loc ? loc.name : "", condTxt, status, i.createdAt ? fmtDate(i.createdAt) : "\u2014"];
  });
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  return {
    title: "Inventory Report",
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " item" + (rows.length === 1 ? "" : "s") + ")",
    cols: ["Item Name", "Category", "Quantity", "Unit", "Min Stock", "Location", "Condition", "Status", "Date Added"],
    rows,
    fileName: "inventory-report"
  };
}

function printReport(d) {
  if (!d.title) return;
  const rowsHtml = d.rows.length
    ? d.rows.map(r => `<tr>${r.map((c, ci) => `<td>${colCellInline((d.cols || [])[ci], c)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${d.cols.length}" style="text-align:center;color:#888">No data</td></tr>`;
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(d.title)}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h2{margin:0 0 4px;font-size:20px}
      .meta{font-size:12px;color:#555;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #1e3a5f}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#1e3a5f;color:#fff;text-align:left;padding:6px 8px}
      td{padding:6px 8px;border-bottom:1px solid #ccc}
      tr:nth-child(even){background:#f5f7fa}
    </style></head><body>
    <h2>${esc(d.title)}</h2>
    <div class="meta">${esc(d.subtitle)}</div>
    <table><thead><tr>${d.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${rowsHtml}</tbody></table>
    <script>window.onload=function(){window.print();};<\/script>
    </body></html>`);
  w.document.close();
}

function excelReport(d) {
  if (!d.title) return;
  let x = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>\n';
  x += `<Row><Cell ss:MergeAcross="${d.cols.length - 1}"><Data ss:Type="String">${xmlEsc(d.title)}</Data></Cell></Row>\n`;
  x += `<Row><Cell ss:MergeAcross="${d.cols.length - 1}"><Data ss:Type="String">${xmlEsc(d.subtitle)}</Data></Cell></Row>\n`;
  x += "<Row>";
  d.cols.forEach(c => { x += `<Cell><Data ss:Type="String">${xmlEsc(c)}</Data></Cell>`; });
  x += "</Row>\n";
  if (!d.rows.length) {
    x += `<Row><Cell ss:MergeAcross="${d.cols.length - 1}"><Data ss:Type="String">No data</Data></Cell></Row>\n`;
  } else {
    d.rows.forEach(r => {
      x += "<Row>";
      r.forEach(c => {
        const isNum = typeof c === "number" && isFinite(c);
        x += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${isNum ? c : xmlEsc(c)}</Data></Cell>`;
      });
      x += "</Row>\n";
    });
  }
  x += "</Table></Worksheet></Workbook>";
  downloadBlob(x, "application/vnd.ms-excel", d.fileName + ".xls");
}

function wordReport(d) {
  if (!d.title) return;
  let x = '<?xml version="1.0"?>\n<?mso-application progid="Word.Document"?>\n<w:wordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:body>\n';
  x += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="34"/></w:rPr><w:t>${xmlEsc(d.title)}</w:t></w:r></w:p>\n`;
  x += `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(d.subtitle)}</w:t></w:r></w:p>\n`;
  x += `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders></w:tblPr>\n`;
  x += "<w:tr>";
  d.cols.forEach(c => { x += `<w:tc><w:tcPr><w:shd w:fill="1E3A5F"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>${xmlEsc(c)}</w:t></w:r></w:p></w:tc>`; });
  x += "</w:tr>\n";
  if (!d.rows.length) {
    x += `<w:tr><w:tc><w:p><w:r><w:t>No data</w:t></w:r></w:p></w:tc></w:tr>`;
  } else {
    d.rows.forEach(r => {
      x += "<w:tr>";
      r.forEach(c => { x += `<w:tc><w:p><w:r><w:t xml:space="preserve">${xmlEsc(c)}</w:t></w:r></w:p></w:tc>`; });
      x += "</w:tr>\n";
    });
  }
  x += "</w:tbl>\n</w:body></w:wordDocument>";
  downloadBlob(x, "application/msword", d.fileName + ".doc");
}

function pdfReport(d) {
  if (!d.title) return;
  if (!window.jspdf || !window.jspdf.jsPDF) {
    toast("PDF library not loaded yet - use Print instead.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text(d.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(d.subtitle, 14, 22);
  doc.autoTable({
    head: [d.cols],
    body: d.rows,
    startY: 27,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });
  doc.save(d.fileName + ".pdf");
}

function printInventoryReport() { printReport(__invExportData()); }
function exportInvExcel() { excelReport(__invExportData()); toast("Excel exported.", "success"); }
function exportInvWord() { wordReport(__invExportData()); toast("Word document exported.", "success"); }
function exportInvPDF() { pdfReport(__invExportData()); toast("PDF exported.", "success"); }

function rebuildDropdowns() {
  const cats = getCategories();
  const locs = getLocations();

  const populate = (sel, list, prev) => {
    if (!sel) return;
    sel.innerHTML = list;
    // A multiple select cannot be given a value: assigning one only works when
    // exactly one option is selected, so the chosen ids are re-ticked by hand.
    if (sel.multiple) {
      const keep = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      Array.prototype.forEach.call(sel.options, o => { o.selected = !!o.value && keep.indexOf(o.value) >= 0; });
    } else if (prev) {
      sel.value = prev;
    }
  };

  const catPrev = (typeof __msSelected === "function") ? __msSelected($("#categoryFilter")).map(o => o.value) : [($("#categoryFilter") || {}).value].filter(Boolean);
  populate($("#categoryFilter"), `<option value="">All Categories</option>` + cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""), catPrev);

  if (isDevAdmin()) {
    if ($("#locationFilter")) {
      $("#locationFilter").disabled = false;
      const locPrev = ($("#locationFilter") || {}).value;
      populate($("#locationFilter"), `<option value="">All Locations</option>` + locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join(""), locPrev);
    }
  } else if (isAdmin()) {
    if ($("#locationFilter")) {
      $("#locationFilter").disabled = false;
      const locPrev = ($("#locationFilter") || {}).value;
      populate($("#locationFilter"), `<option value="">All Locations in District</option>` + locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join(""), locPrev);
    }
  } else {
    if ($("#locationFilter")) {
      const myLoc = currentUser ? getLocations().find(l => l.id === currentUser.locationId) : null;
      $("#locationFilter").innerHTML = `<option value="${currentUser ? currentUser.locationId : ""}">${esc(myLoc ? myLoc.name : "")}</option>`;
      $("#locationFilter").disabled = true;
    }
  }

  populate($("#fCategory"), cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""));
  populate($("#fLocation"), locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join(""));
}

function buildAllLocationsDropdown() {
  const allLocs = getAllLocationsFlat();
  const districts = getDistricts();
  let html = "";
  districts.forEach(d => {
    const dLocs = allLocs.filter(l => l.districtId === d.id);
    if (dLocs.length) {
      html += `<optgroup label="${esc(d.name)} (${esc(d.code)})">`;
      dLocs.forEach(l => {
        html += `<option value="${l.id}">[${esc(l.type.toUpperCase())}] ${esc(l.name)}</option>`;
      });
      html += `</optgroup>`;
    }
  });
  return html;
}

function buildDistrictLocationsDropdown(districtId) {
  const locs = getLocationsForDistrict(districtId);
  let html = `<optgroup label="${esc(getDistricts().find(d => d.id === districtId)?.name || "")}">`;
  locs.forEach(l => {
    html += `<option value="${l.id}">[${esc(l.type.toUpperCase())}] ${esc(l.name)}</option>`;
  });
  html += `</optgroup>`;
  return html;
}

function buildAllDistrictsLocationsDropdown() {
  const districts = getDistricts();
  const all = getAllLocations();
  let html = "";
  districts.forEach(d => {
    const locs = all[d.id] || [];
    if (!locs.length) return;
    html += `<optgroup label="${esc(d.name)}">`;
    locs.forEach(l => {
      html += `<option value="${l.id}">[${esc(l.type.toUpperCase())}] ${esc(l.name)}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

function __populateItemNameList() {
  const input = $("#fItemName"), menu = $("#itemNameMenu");
  if (!input || !menu) return;
  const categoryId = ($("#fCategory") || {}).value || "";
  input.disabled = !categoryId;
  const ownNames = getItems().filter(i => i.categoryId === categoryId).map(i => (i.name || "").trim());
  const distNames = getAllDistrictItems().filter(i => i.categoryId === categoryId && !i.isDeleted).map(i => (i.name || "").trim());
  const allNames = [...new Set([...ownNames, ...distNames].filter(Boolean))];
  const q = input.value.trim().toLowerCase();
  const filtered = allNames.filter(n => !q || n.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b));
  const current = input.value.trim();
  if (current && !allNames.includes(current)) filtered.unshift(current);
  menu.innerHTML = filtered.length
    ? filtered.map(n => `<button type="button" class="cb-opt${n === current ? " cb-opt-sel" : ""}" data-name="${esc(n)}">${esc(n)}</button>`).join("")
    : `<div class="cb-empty">No items in this category yet — type a new name</div>`;
  Array.prototype.forEach.call(menu.querySelectorAll(".cb-opt"), b => b.addEventListener("mousedown", ev => {
    ev.preventDefault();
    input.value = b.dataset.name;
    __populateItemNameList();
    menu.classList.add("hidden");
  }));
  input.classList.toggle("cb-has-value", !!current);
}

function openItemModal(item) {
  if (isDevAdmin() && !item) return toast(__devRbacLockMsg(), "error"); // devadmin: may VIEW edit dialog, cannot Add; Save still blocked in saveItem
  if (item && !canManageItem(item)) return toast(__rbacLockMsg(), "error");
  $("#itemModalTitle").textContent = item ? "Edit Item" : "Add New Item";
  $("#itemSaveBtn").textContent = item ? "Update Item" : "Save Item";
  $("#fItemName").value = item ? item.name : "";
  $("#fCategory").value = item ? item.categoryId : "";
  __populateItemNameList();
  $("#fUnit").value = item ? item.unit : "pcs";
  $("#fMinStock").value = item ? item.minStock : 5;
  $("#fItemId").value = item ? item.id : "";
  $("#fDate").value = todayStr();
  $("#fTime").value = nowTimeStr();

const cc = item ? (item.conditionCounts || { good: 0, poor: 0, damaged: 0 }) : { good: 0, poor: 0, damaged: 0 };
  $("#fCondGood").value = cc.good || 0;
  $("#fCondPoor").value = cc.poor || 0;
  $("#fCondDamaged").value = cc.damaged || 0;
  $("#fQuantity").value = item ? (item.quantity || 0) : ((cc.good || 0) + (cc.poor || 0) + (cc.damaged || 0));
  const __qtyField = $("#fQuantity");
  if (__qtyField) __qtyField.title = item ? "Total Qty is locked during update \u2014 change it via Add Stock only" : "Auto-calculated from Good + Damaged + Scrap";
  __updateItemQtyHint((cc.good || 0) + (cc.poor || 0) + (cc.damaged || 0));

  const locSel = $("#fLocation");
  if (!isAdmin()) {
    const myLoc = getLocations().find(l => l.id === currentUser.locationId);
    locSel.innerHTML = `<option value="${currentUser.locationId}">${esc(myLoc ? myLoc.name : (currentUser.locationId || "Your Unit"))}</option>`;
    locSel.disabled = true;
    locSel.value = currentUser.locationId;
  } else {
    locSel.disabled = false;
    const locs = getLocations();
    locSel.innerHTML = `<option value="">Select location</option>` + __byName(locs).map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
    locSel.value = item ? item.locationId : (currentUser && currentUser.locationId ? currentUser.locationId : "");
  }
  openModal("#itemModal");
  setTimeout(() => { const focusEl = item ? $("#fItemName") : $("#fCategory"); if (focusEl) focusEl.focus(); }, 50);
}

/* Update dialog keeps Total Qty locked at the item's current total; only
   Good/Damaged/Scrap redistribution is allowed. Total Qty changes only via
   Add Stock (2026.09.182). */
function __updateItemQtyHint(sum) {
  const hint = $("#fQtyHint");
  if (!hint) return;
  const editing = ($("#fItemId") || {}).value || "";
  if (!editing) { hint.textContent = ""; return; }
  const orig = parseInt(($("#fQuantity") || {}).value, 10) || 0;
  if (sum === orig) {
    hint.textContent = "Good + Damaged + Scrap = " + sum + " \u2713 matches Total Qty";
    hint.style.color = "var(--green)";
  } else {
    hint.textContent = "Good + Damaged + Scrap = " + sum + " \u2014 must equal Total Qty (" + orig + "). Total Qty changes only via Add Stock.";
    hint.style.color = "var(--red)";
  }
}

/* Read-only View modal ? available to every role for every visible record. */
function openViewItem(item) {
  if (!item) return;
  const cat = getCategories().find(c => c.id === item.categoryId);
  const loc = getLocations().find(l => l.id === item.locationId);
  const cc = item.conditionCounts || { good: item.quantity || 0, poor: 0, damaged: 0 };
  const qty = item.quantity || 0;
  $("#viName").textContent = item.name || "";
  $("#viCategory").textContent = cat ? cat.name : "";
  $("#viUnit").textContent = item.unit || "";
  $("#viQuantity").textContent = qty;
  $("#viMinStock").textContent = item.minStock || 0;
  $("#viLocation").textContent = loc ? loc.name : (item.locationId || "");
  $("#viCondGood").textContent = cc.good || 0;
  $("#viCondPoor").textContent = cc.poor || 0;
  $("#viCondDamaged").textContent = cc.damaged || 0;
  const st = item.isDeleted ? ["Deleted", "status-out"] : (qty === 0 ? ["Out of Stock", "status-out"] : qty <= (item.minStock || 0) ? ["Low Stock", "status-low"] : ["In Stock", "status-ok"]);
  const stEl = $("#viStatus");
  stEl.textContent = st[0];
  stEl.className = "status-badge " + st[1];
  $("#viDate").textContent = item.createdAt ? fmtDate(item.createdAt) : "?";
  const hb = $("#viHistoryBody");
  if (hb) {
    const rows = __histWithBalances(item).slice().reverse();
    hb.innerHTML = rows.length
      ? rows.map(h => `<tr><td>` + esc(h.date || (h.at ? fmtDate(h.at) : "")) + `</td><td>` + esc(h.time || "") + `</td><td>` + esc(__hTypeLabel[h.type] || h.type) + `</td><td class="qty-strong" style="` + (h.qty < 0 ? "color:var(--red)" : "color:var(--green)") + `">` + (h.qty > 0 ? "+" + h.qty : h.qty) + `</td><td class="qty-strong">` + h.prev + `</td><td class="qty-strong">` + h.balance + `</td><td>` + esc(h.user || "") + photoChipsHtml(h) + `</td></tr>`).join("")
      : `<tr class="empty-row"><td colspan="7">No stock changes recorded yet.</td></tr>`;
  }
  openModal("#viewItemModal");
}

function saveItem(e) {
  e.preventDefault();
  const id = $("#fItemId").value;
  // RBAC: ownership & role are re-checked here (UI convenience only ? the
  // server independently enforces the same rules on every write).
  if (id) {
    if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
    const existing = getItems().find(i => i.id === id);
    if (!canManageItem(existing)) return toast(__rbacLockMsg(), "error");
} else if (isDevAdmin()) {
    return toast(__devRbacLockMsg(), "error");
  } else if (!canManageItems()) {
    return toast("You do not have permission to add items.", "error");
  }
  const name = $("#fItemName").value.trim();
  const categoryId = $("#fCategory").value;
  const unit = $("#fUnit").value;
  const minStock = parseInt($("#fMinStock").value, 10);
  const locationId = (!isAdmin() && currentUser && currentUser.locationId)
    ? currentUser.locationId
    : ($("#fLocation") ? $("#fLocation").value : "");
const good = parseInt($("#fCondGood").value, 10) || 0;
  const poor = parseInt($("#fCondPoor").value, 10) || 0;
  const damaged = parseInt($("#fCondDamaged").value, 10) || 0;
  const quantity = good + poor + damaged;
  const conditionCounts = { good, poor, damaged };
if (!name || !categoryId || !locationId) return toast("Please fill all required fields.", "error");
  if (quantity === 0) return toast("Total quantity cannot be 0. Enter at least one condition count.", "error");
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (currentUser && !isAdmin() && locationId !== currentUser.locationId) {
    return toast("You can only assign items to your own unit.", "error");
  }

  const items = getItems();
  if (id) {
    const item = items.find(i => i.id === id);
    if (item) {
      const __origQty = item.quantity || 0;
      if (quantity !== __origQty) return toast("Total quantity cannot be changed by Update. Adjust Good / Damaged / Scrap so their total equals " + __origQty + " \u2014 Total Qty changes only via Add Stock.", "error");
      const held = (item.allotted || 0) + (item.damagedReturned || 0) + (item.lostReturned || 0);
      if (quantity < held) return toast(`Total quantity cannot be less than currently issued/damaged/lost units (${held}).`, "error");
      const __prevQty = item.quantity || 0;
      const __delta = quantity - __prevQty;
      Object.assign(item, { name, categoryId, unit, quantity, minStock, locationId, conditionCounts, updatedAt: Date.now() });
      if (__delta !== 0) itemHistoryPush(item, { type: __delta > 0 ? "STOCK_IN" : "ADJUST", qty: __delta, person: "", ref: "", date: ($("#fDate") && $("#fDate").value) || todayStr(), time: ($("#fTime") && $("#fTime").value) || nowTimeStr(), remarks: "Stock updated from " + __prevQty + " to " + quantity + " (" + (__delta > 0 ? "+" : "") + __delta + " added/reduced)" });
      __audit("Item Updated", `"${name}" ? qty ${quantity} (${good}G/${poor}P/${damaged}D)`, { entity: "Item" });
    }
    toast("Item updated.", "success");
  } else {
    items.push({ id: uid(), name, categoryId, unit, quantity, minStock, locationId, conditionCounts, createdAt: Date.now(), updatedAt: Date.now() });
    __audit("Item Added", `"${name}" ? qty ${quantity} (${good}G/${poor}P/${damaged}D)`, { entity: "Item" });
    toast("Item added.", "success");
  }
  saveItems(items);
  closeModals();
  render();
}

/* ---- Add Stock: multi-item rows, condition buttons, photos ---- */
const STOCK_PHOTO_MAX = 4;
const STOCK_PHOTO_LIMIT = 4 * 1024 * 1024;
let __asSeq = 0;
let __asPhotos = {}; // rowKey -> [{ id, name, mime, size, dataUrl }]

// `preset` is optional: an item to start the single row on. The Low Stock table
// passes the row's own item, so "Add Stock" beside a short item opens with that
// item already chosen and the user only has to type how many arrived - instead
// of re-picking the category and name on a form that is about stock generally.
/* ==================== SEARCHABLE ROW COMBOBOX ====================
   Provides a searchable input alongside a dropdown list for Add Stock
   and Add Consumable Item rows.
   - User can type to search / filter options.
   - Typing DOES NOT auto-select; matching text is highlighted in the dropdown.
   - Selection only occurs upon clicking an option (or pressing Enter on it).
   ================================================================== */
function __makeRowCombo(selectEl, placeholder, onSelect) {
  if (!selectEl || selectEl.dataset.comboBound) return selectEl.__comboApi || null;
  selectEl.dataset.comboBound = "1";
  selectEl.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = "row-combo-wrap";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "row-combo-input";
  input.placeholder = placeholder || selectEl.getAttribute("placeholder") || "Select...";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.disabled = !!selectEl.disabled;

  const arrow = document.createElement("button");
  arrow.type = "button";
  arrow.className = "row-combo-arrow";
  arrow.tabIndex = -1;
  arrow.setAttribute("aria-label", "Toggle dropdown");
  arrow.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';

  const menu = document.createElement("div");
  menu.className = "row-combo-menu hidden";

  wrap.appendChild(input);
  wrap.appendChild(arrow);
  wrap.appendChild(menu);
  selectEl.parentNode.insertBefore(wrap, selectEl);

  let highlightedIdx = -1;
  let lastCommittedText = "";
  let lastTyped = "";

  function getOptions() {
    return Array.from(selectEl.options).filter(o => o.value !== "");
  }

  function sync() {
    input.disabled = !!selectEl.disabled;
    if (selectEl.disabled) {
      input.value = "";
      input.placeholder = "Select a category first...";
      lastCommittedText = "";
      lastTyped = "";
      closeMenu();
      return;
    }
    input.placeholder = placeholder || "Select...";
    const selOpt = selectEl.options[selectEl.selectedIndex];
    if (selOpt && selOpt.value !== "") {
      input.value = selOpt.textContent;
      lastCommittedText = selOpt.textContent;
    } else {
      input.value = "";
      lastCommittedText = "";
    }
  }

  function openMenu(filterQuery) {
    if (input.disabled) return;
    closeAllRowCombos();

    const row = wrap.closest(".as-item-row");
    if (row) { row.style.zIndex = "100"; row.style.position = "relative"; }

    const rect = wrap.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 230 && rect.top > 230) {
      menu.style.bottom = "calc(100% + 4px)";
      menu.style.top = "auto";
    } else {
      menu.style.top = "calc(100% + 4px)";
      menu.style.bottom = "auto";
    }

    renderMenu(filterQuery || "");
    menu.classList.remove("hidden");
    wrap.classList.add("is-open");
  }

  function closeMenu() {
    menu.classList.add("hidden");
    wrap.classList.remove("is-open");
    highlightedIdx = -1;
    const row = wrap.closest(".as-item-row");
    if (row && !row.querySelector(".row-combo-wrap.is-open")) {
      row.style.zIndex = "";
      row.style.position = "";
    }
  }

  function renderMenu(filterQuery) {
    const opts = getOptions();
    const q = (filterQuery || "").trim().toLowerCase();
    menu.innerHTML = "";
    highlightedIdx = -1;

    let visibleCount = 0;
    opts.forEach((o) => {
      const text = o.textContent;
      const lower = text.toLowerCase();
      const isNew = o.value === "__new__";
      const matches = !q || lower.includes(q) || isNew;

      if (!matches) return;

      const optEl = document.createElement("div");
      optEl.className = "row-combo-opt" + (isNew ? " is-new" : "") + (o.value === selectEl.value ? " is-selected" : "");
      optEl.dataset.val = o.value;

      optEl.textContent = text;
      if (q && lower.includes(q) && !isNew) {
        optEl.classList.add("is-match");
      }

      if (visibleCount === 0 && q) {
        optEl.classList.add("is-highlighted");
        highlightedIdx = 0;
      }

      optEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectOption(o.value, text);
      });

      menu.appendChild(optEl);
      visibleCount++;
    });

    if (visibleCount === 0) {
      const empty = document.createElement("div");
      empty.className = "row-combo-empty";
      empty.textContent = "No matches found";
      menu.appendChild(empty);
    }
  }

  function selectOption(val, label) {
    selectEl.value = val;
    input.value = label;
    lastCommittedText = label;
    closeMenu();
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    if (onSelect) onSelect(val, label);
  }

  function updateHighlight(items, newIdx) {
    if (!items.length) return;
    items.forEach(el => el.classList.remove("is-highlighted"));
    if (newIdx >= 0 && newIdx < items.length) {
      highlightedIdx = newIdx;
      items[newIdx].classList.add("is-highlighted");
      items[newIdx].scrollIntoView({ block: "nearest" });
    } else {
      highlightedIdx = -1;
    }
  }

  input.addEventListener("focus", () => {
    if (input.disabled) return;
    openMenu("");
  });

  input.addEventListener("input", () => {
    if (input.disabled) return;
    lastTyped = input.value.trim();
    openMenu(input.value);
  });

  arrow.addEventListener("click", (e) => {
    e.preventDefault();
    if (input.disabled) return;
    if (menu.classList.contains("hidden")) {
      input.focus();
      openMenu("");
    } else {
      closeMenu();
    }
  });

  input.addEventListener("keydown", (e) => {
    const items = Array.from(menu.querySelectorAll(".row-combo-opt"));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (menu.classList.contains("hidden")) {
        openMenu(input.value);
      } else {
        const next = highlightedIdx + 1 < items.length ? highlightedIdx + 1 : 0;
        updateHighlight(items, next);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!menu.classList.contains("hidden")) {
        const prev = highlightedIdx - 1 >= 0 ? highlightedIdx - 1 : items.length - 1;
        updateHighlight(items, prev);
      }
    } else if (e.key === "Enter") {
      if (!menu.classList.contains("hidden") && highlightedIdx >= 0 && items[highlightedIdx]) {
        e.preventDefault();
        const item = items[highlightedIdx];
        selectOption(item.dataset.val, item.textContent.trim());
      }
    } else if (e.key === "Escape") {
      closeMenu();
      input.value = lastCommittedText;
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      closeMenu();
      const selOpt = selectEl.options[selectEl.selectedIndex];
      if (selOpt && selOpt.value !== "") {
        input.value = selOpt.textContent;
      } else {
        input.value = "";
      }
    }, 180);
  });

  const api = { wrap, input, sync, closeMenu, get lastTyped() { return lastTyped; } };
  selectEl.__comboApi = api;
  sync();
  return api;
}

function closeAllRowCombos() {
  document.querySelectorAll(".row-combo-menu:not(.hidden)").forEach(m => {
    m.classList.add("hidden");
    const p = m.closest(".row-combo-wrap");
    if (p) p.classList.remove("is-open");
  });
  document.querySelectorAll(".as-item-row").forEach(r => {
    if (!r.querySelector(".row-combo-wrap.is-open")) {
      r.style.zIndex = "";
      r.style.position = "";
    }
  });
}

function __initRowCombos(row) {
  if (!row) return;
  const catSel = row.querySelector(".as-row-cat, .cons-row-cat");
  const itemSel = row.querySelector(".as-row-item, .cons-row-item");
  if (catSel && !row.__catCombo) {
    row.__catCombo = __makeRowCombo(catSel, "Category *");
  }
  if (itemSel && !row.__itemCombo) {
    row.__itemCombo = __makeRowCombo(itemSel, "Select item");
  }
}

function openAddStockModal(preset) {
  // devadmin may open to VIEW; saving is blocked inside saveAddStock.
  if (isDevAdmin()) { /* view-only open allowed */ }
  else
  if (!canManageItems()) return toast("You do not have permission to add stock.", "error");
  __asPhotos = {}; __asSeq = 0;
  $("#asRows").innerHTML = "";
  addAsRow();
  if (preset && preset.id) {
    const row = $("#asRows").querySelector(".as-item-row");
    const catSel = row && row.querySelector(".as-row-cat");
    const itemSel = row && row.querySelector(".as-row-item");
    // The item dropdown is built from the chosen category and lists names, not
    // ids, so the name is what has to be matched. An item whose category is not
    // selectable here simply leaves the row blank - the same as opening by hand.
    if (catSel && preset.categoryId) {
      catSel.value = preset.categoryId;
      __asPopulateRowItems(row);
      if (itemSel && !itemSel.disabled && preset.name) {
        const hit = Array.from(itemSel.options).find(o => o.value === preset.name);
        if (hit) itemSel.value = preset.name;
      }
      if (row.__catCombo) row.__catCombo.sync();
      if (row.__itemCombo) row.__itemCombo.sync();
    }
  }
  $("#asDate").value = todayStr();
  $("#asTime").value = nowTimeStr();
  $("#asRemarks").value = "";
  openModal("#addStockModal");
}
function addAsRow() {
  const box = $("#asRows"); if (!box) return;
  const key = "k" + (++__asSeq);
  box.insertAdjacentHTML("beforeend", __asRowHtml(key));
  const row = box.querySelector(`.as-item-row[data-key="${key}"]`);
  if (row) __initRowCombos(row);
}
function __asRowHtml(key) {
  const cats = getCategories();
  return `<div class="as-item-row" data-key="${key}">
    <div class="as-row-fields">
      <select class="as-row-cat"><option value="">Category *</option>${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <div class="as-item-wrap">
        <select class="as-row-item" disabled><option value="">Select a category first...</option></select>
        <input type="text" class="as-row-newname hidden" placeholder="New item name..." autocomplete="off">
      </div>
      <div class="as-cond-qtys">
        <span class="as-cq"><input type="number" class="as-row-qty-good" placeholder="Good" min="0" value="0"></span>
        <span class="as-cq"><input type="number" class="as-row-qty-poor" placeholder="Damaged" min="0" value="0"></span>
              </div>
      <button type="button" class="as-row-remove" data-action="as-row-remove" title="Remove item">&times;</button>
    </div>
    <div class="as-photo-bar">
      <div class="att-bar-actions">
        <label class="att-btn att-btn-upload" title="Attach photo or file (any format)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> Upload<input type="file" class="as-photo-input" multiple hidden></label>
        <button type="button" class="att-btn att-btn-cam" data-att-cam="as:${key}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Camera</button>
        <span class="att-count" data-as-count="${key}">0 files</span>
      </div>
      <div class="att-grid as-photo-thumbs"></div>
    </div>
  </div>`;
}
function __asRowOf(el) { return el ? el.closest(".as-item-row") : null; }
function __asPopulateRowItems(row) {
  if (!row) return;
  const catSel = row.querySelector(".as-row-cat");
  const itemSel = row.querySelector(".as-row-item");
  const newName = row.querySelector(".as-row-newname");
  const cid = (catSel || {}).value || "";
  newName.classList.add("hidden"); newName.value = "";
  if (!cid) {
    itemSel.disabled = true;
    itemSel.innerHTML = `<option value="">Select a category first...</option>`;
    if (row.__itemCombo) row.__itemCombo.sync();
    return;
  }
  const ownItems = getItems().filter(i => (!currentUser.locationId || i.locationId === currentUser.locationId) && i.categoryId === cid && !i.isDeleted);
  const distItems = getAllDistrictItems().filter(i => i.categoryId === cid && !i.isDeleted);
  const combined = [...new Set([...ownItems.map(i => i.name), ...distItems.map(i => i.name)].filter(Boolean))];
  const names = __byName(combined, x => x);
  itemSel.disabled = false;
  itemSel.innerHTML = `<option value="">Select item</option>` + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("") + `<option value="__new__">&#10133; New item...</option>`;
  if (row.__itemCombo) row.__itemCombo.sync();
}
function __asRenderThumbs(row) {
  const key = row.dataset.key;
  const box = row.querySelector(".as-photo-thumbs");
  const photos = __asPhotos[key] || [];
  const cnt = row.querySelector("[data-as-count]");
  if (cnt) cnt.textContent = photos.length + (photos.length === 1 ? " file" : " files");
  box.innerHTML = photos.map(p => { const isImg = String(p.mime || "").toLowerCase().startsWith("image/"); return `<div class="att-thumb att-thumb-sm" title="${esc(p.name)}">${isImg ? `<img src="${p.dataUrl}" alt="">` : `<div class="att-file-icon">&#128196;</div>`}<button type="button" class="att-thumb-x" data-action="as-photo-remove" data-pid="${p.id}">&times;</button></div>`; }).join("");
}
function __asReadPhotos(row, files) {
  const key = row.dataset.key;
  const list = __asPhotos[key] || [];
  for (const f of Array.from(files || [])) {
    const type = (f.type || "").toLowerCase();
    if (f.size > STOCK_PHOTO_LIMIT) { toast(`"${f.name}" is too large (max 4MB).`, "error"); continue; }
    if (list.some(p => p.name === f.name && p.size === f.size)) { toast(`"${f.name}" is already attached.`, "error"); continue; }
    const reader = new FileReader();
    reader.onload = () => { (__asPhotos[key] = __asPhotos[key] || []).push({ id: uid(), name: f.name, mime: f.type, size: f.size, dataUrl: String(reader.result) }); __asRenderThumbs(row); };
    reader.onerror = () => toast(`Could not read "${f.name}".`, "error");
    reader.readAsDataURL(f);
  }
}
function __asRowsClick(e) {
  const row = e.target.closest(".as-item-row"); if (!row) return;
  const rm = e.target.closest("[data-action=as-row-remove]");
  if (rm) {
    const rows = $$("#asRows .as-item-row");
    if (rows.length <= 1) return toast("At least one item row is required.", "error");
    delete __asPhotos[row.dataset.key];
    row.remove();
    return;
  }
  const px = e.target.closest("[data-action=as-photo-remove]");
  if (px) { __asPhotos[row.dataset.key] = (__asPhotos[row.dataset.key] || []).filter(p => p.id !== px.dataset.pid); __asRenderThumbs(row); return; }
}
function __asRowsChange(e) {
  const row = __asRowOf(e.target); if (!row) return;
  if (e.target.classList.contains("as-row-cat")) { __asPopulateRowItems(row); return; }
  if (e.target.classList.contains("as-row-item")) {
    const newName = row.querySelector(".as-row-newname");
    if ((e.target.value || "") === "__new__") {
      newName.classList.remove("hidden");
      if (row.__itemCombo && row.__itemCombo.lastTyped && row.__itemCombo.lastTyped !== "➕ New item...") {
        newName.value = row.__itemCombo.lastTyped;
      }
      newName.focus();
    }
    else { newName.classList.add("hidden"); newName.value = ""; }
    return;
  }
  if (e.target.classList.contains("as-photo-input")) { __asReadPhotos(row, e.target.files); e.target.value = ""; return; }
}
function __asBreakdown(p) {
  const parts = [];
  if (p.qg) parts.push("Good +" + p.qg);
  if (p.qp) parts.push("Damaged +" + p.qp);
  if (p.qd) parts.push("Scrap +" + p.qd);
  return parts.length ? " (" + parts.join(", ") + ")" : "";
}

async function saveAddStock(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canManageItems()) return toast("You do not have permission to add stock.", "error");
  const date = ($("#asDate").value || "").trim() || todayStr();
  const time = ($("#asTime").value || "").trim() || nowTimeStr();
  const remarks = ($("#asRemarks").value || "").trim();
  const rows = $$("#asRows .as-item-row");
  if (!rows.length) return toast("Add at least one item.", "error");
  const plan = [];
  for (const row of rows) {
    const categoryId = (row.querySelector(".as-row-cat") || {}).value || "";
    const itemSel = row.querySelector(".as-row-item");
    const newNameEl = row.querySelector(".as-row-newname");
    const v = (itemSel || {}).value || "";
    const name = (v === "__new__" ? (newNameEl.value || "") : v).trim();
    const qg = parseInt((row.querySelector(".as-row-qty-good") || {}).value, 10) || 0;
    const qp = parseInt((row.querySelector(".as-row-qty-poor") || {}).value, 10) || 0;
    const qd = parseInt((row.querySelector(".as-row-qty-damaged") || {}).value, 10) || 0;
    const qty = qg + qp + qd;
    if (!categoryId) return toast("Every row needs a category.", "error");
    if (!name) return toast(v === "__new__" ? "Enter the new item name." : "Select an item in every row (or choose \u2795 New item...).", "error");
    if (qty <= 0) return toast("Enter at least one quantity above 0 in every row.", "error");
    plan.push({ row, categoryId, name, qty, qg, qp, qd });
  }
  // Photos are uploaded separately from the item data (server scan-file store
  // in remote mode; a dedicated local store otherwise). Only lightweight
  // references (id, fileName, mimeType, fileSize) are kept on the history entry.
  for (const p of plan) {
    p.photoRefs = [];
    for (const ph of (__asPhotos[p.row.dataset.key] || [])) {
      if (!ph.dataUrl) continue;
      try { p.photoRefs.push(await __stockUploadPhoto(ph)); }
      catch (err) { toast(`Photo "${ph.name}" could not be uploaded. Please try again.`, "error"); return; }
    }
  }
  const items = getItems();
  let updated = 0, created = 0;
  for (const p of plan) {
    const histPhotos = p.photoRefs.length ? p.photoRefs : undefined;
    let item = items.find(i => i.locationId === currentUser.locationId && (i.name || "").toLowerCase() === p.name.toLowerCase());
    if (item) {
      item.conditionCounts = item.conditionCounts || { good: item.quantity || 0, poor: 0, damaged: 0 };
      item.conditionCounts.good = (item.conditionCounts.good || 0) + p.qg;
      item.conditionCounts.poor = (item.conditionCounts.poor || 0) + p.qp;
      item.conditionCounts.damaged = (item.conditionCounts.damaged || 0) + p.qd;
      item.quantity = (item.conditionCounts.good || 0) + (item.conditionCounts.poor || 0) + (item.conditionCounts.damaged || 0);
      item.updatedAt = Date.now();
      itemHistoryPush(item, { type: "STOCK_IN", qty: p.qty, person: "", ref: "", date, time, remarks: remarks || ("Stock added +" + p.qty + __asBreakdown(p)), photos: histPhotos });
      updated++;
    } else {
      const cc = { good: p.qg, poor: p.qp, damaged: p.qd };
      const distProto = getAllDistrictItems().find(i => (i.name || "").toLowerCase() === p.name.toLowerCase() && i.categoryId === p.categoryId);
      item = {
        id: uid(),
        name: p.name,
        categoryId: p.categoryId,
        unit: (distProto && distProto.unit) ? distProto.unit : "pcs",
        quantity: p.qty,
        minStock: (distProto && typeof distProto.minStock === "number") ? distProto.minStock : 5,
        locationId: currentUser.locationId,
        conditionCounts: cc,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: []
      };
      items.push(item);
      itemHistoryPush(item, { type: "STOCK_IN", qty: p.qty, person: "", ref: "", date, time, remarks: remarks || ("New item created with opening stock +" + p.qty + __asBreakdown(p)), photos: histPhotos });
      created++;
    }
    __audit("Stock Added", '"' + item.name + '" +' + p.qty + __asBreakdown(p) + ", total " + item.quantity, { entity: "Item" });
  }
  saveItems(items);
  closeModals();
  render();
  toast(created ? `Stock added: ${updated} updated, ${created} new item(s).` : `Stock added to ${updated} item(s).`, "success");
}
/* ---- Stock photo storage + viewer (separate from item data) ---- */
function __scanStoreLoad() { try { return loadData("scanfiles") || []; } catch (e) { return []; } }
function __scanStoreSave(arr) { try { saveData("scanfiles", arr); } catch (e) {} }
async function __stockUploadPhoto(p) {
  if (window.CONFIG && window.CONFIG.useRemote) {
    await __api("POST", "scanfile", { id: p.id, dataUrl: p.dataUrl });
    return { id: p.id, fileName: p.name, mimeType: p.mime, fileSize: p.size };
  }
  const arr = __scanStoreLoad();
  arr.push({ id: p.id, name: p.name, mime: p.mime, size: p.size, dataUrl: p.dataUrl, at: Date.now() });
  __scanStoreSave(arr);
  return { id: p.id, fileName: p.name, mimeType: p.mime, fileSize: p.size };
}
async function __viewStockPhoto(photoId) {
  if (!photoId) return;
  let dataUrl = null;
  const local = __scanStoreLoad().find(x => x.id === photoId);
  if (local && local.dataUrl) dataUrl = local.dataUrl;
  if (!dataUrl && window.CONFIG && window.CONFIG.useRemote) {
    try { const rr = await __api("GET", "scanfile/" + photoId); if (rr && rr.dataUrl) dataUrl = rr.dataUrl; } catch (e) {}
  }
  if (!dataUrl) { const ph = (__maintPhotos || []).find(p => p.id === photoId); if (ph) dataUrl = ph.dataUrl; }
  if (!dataUrl) return toast("Photo could not be loaded.", "error");
  return __openDataUrl(dataUrl, "photo");
}
function photoChipsHtml(h) {
  const ph = Array.isArray(h && h.photos) ? h.photos : [];
  if (!ph.length) return "";
  return ` <span class="hist-photos">${ph.map(x => `<button type="button" class="hist-photo-chip" data-stock-photo="${x.id}" title="${esc(x.fileName || "Photo")}">&#128247;</button>`).join("")}</span>`;
}function deleteItem(id) {
  const items = getItems();
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canManageItem(item)) return toast(__rbacLockMsg(), "error");
  const totalQty = (Number(item.quantity) || 0) + (Number(item.allotted) || 0);
  if (totalQty > 0) return toast("Cannot delete item with remaining stock. Total quantity must be 0.", "error");
  if (!confirm("Delete this item?")) return;
  item.isDeleted = true;
  item.deletedAt = Date.now();
  item.updatedAt = Date.now();
  if (!item.history) item.history = [];
  item.history.push({
    type: "ITEM_DELETED",
    qty: 0,
    prev: 0,
    balance: 0,
    at: Date.now(),
    date: todayStr(),
    time: nowTimeStr(),
    user: (currentUser && currentUser.name) || "",
    remarks: "Deleted Item"
  });
  saveItems(items);
  __audit("Item Deleted", `"${item.name || id}"`, { entity: "Item" });
  toast("Item deleted.", "success");
  render();
}


/* ==================== CATEGORIES ==================== */
function renderCatList() {
  const box = $("#catList");
  const cats = getCategories();
  const items = getAllDistrictItems();
  // The three buttons sit in the row itself, beside the name, rather than
  // behind one "Actions" menu. actDD() collapses anything longer than one
  // button into a dropdown, so reaching Edit or Delete on a category meant
  // two clicks through a menu that also had to open the right way up near the
  // bottom of the list. The data-* attributes are unchanged, so the delegated
  // click handler and startEditCat() - which swaps this very container for
  // Save/Cancel - keep working exactly as before.
  const row = (c, idx, count, prefix) => {
    const canDelete = count === 0;
    return `<div class="cat-list-row" data-idx="${idx}">` +
      `<span class="cat-list-name">${esc(c.name)}</span>` +
      `<span class="cat-list-count">${count} items</span>` +
      `<div class="cat-list-actions">` +
      `<button type="button" class="btn btn-sm btn-outline" data-${prefix}-items="${idx}">Items</button>` +
      `<button type="button" class="btn btn-sm btn-outline" data-${prefix}-edit="${idx}">Edit</button>` +
      `<button type="button" class="btn btn-sm btn-outline act-dd-del" data-${prefix}-del="${idx}"` +
      (canDelete ? "" : ` disabled title="Remove items first"`) + `>Delete</button>` +
      `</div></div>`;
  };
  box.innerHTML = cats.map((c, idx) => row(c, idx, items.filter(i => i.categoryId === c.id && !i.isDeleted).length, "cat")).join("");
}

function startEditCat(idx) {
  const cats = getCategories();
  const c = cats[idx];
  if (!c) return;
  const rows = $$(".cat-list-row");
  const row = rows[idx];
  if (!row) return;
  const nameSpan = row.querySelector(".cat-list-name");
  const actionsDiv = row.querySelector(".cat-list-actions");
  row.classList.add("editing");
  nameSpan.innerHTML = `<input class="cat-edit-input" id="catEditName" value="${esc(c.name)}">`;
  actionsDiv.innerHTML = `<button class="btn btn-sm btn-primary" data-cat-save="${idx}">Save</button><button class="btn btn-sm btn-outline" data-cat-cancel="${idx}">Cancel</button>`;
}

function saveEditCat(idx) {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const cats = getCategories();
  const name = ($("#catEditName") || {}).value.trim();
  if (!name) return toast("Enter a name.", "error");
  if (cats.some((c, i) => i !== idx && c.name.toLowerCase() === name.toLowerCase())) return toast("Already exists.", "error");
  cats[idx].name = name;
  saveCategories(cats); // per-district store (2026.09.213) — was clobbering the map with a flat array
  renderCatList();
  toast("Category updated.", "success");
}

document.addEventListener("click", e => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (!t.closest("#catItemsModal")) return;
  if (t.closest("[data-cit-edit]")) __citStartEdit(t.closest("[data-cit-edit]").dataset.citEdit);
  else if (t.closest("[data-cit-save]")) __citSave(t.closest("[data-cit-save]").dataset.citSave);
  else if (t.closest("[data-cit-cancel]")) { const __ci = getAllDistrictItems().find(function(i){ return i.id === t.closest("[data-cit-cancel]").dataset.citCancel; }); if (__ci) __renderCatItems(__ci.categoryId); }
  else if (t.closest("[data-cit-del]")) __citDelete(t.closest("[data-cit-del]").dataset.citDel);
  else if (t.closest("#citAddBtn")) __citAdd();
});

function openCatItems(idx) {
  const c = getCategories()[idx];
  if (!c) return;
  __citOpenCatId = c.id;
  $("#citTitle").textContent = c.name;
  $("#citSubtitle").textContent = "Items in this category - edit the name or delete an item";
  const addRow = $("#citAddRow");
  if (addRow) addRow.style.display = (canManageItems() && !isDevAdmin()) ? "" : "none";
  __renderCatItems(c.id);
  openModal("#catItemsModal");
}
let __citOpenCatId = null;
function __renderCatItems(cid) {
  const body = $("#citBody");
  if (!body) return;
  const items = getAllDistrictItems().filter(i => i.categoryId === cid && !i.isDeleted);
  body.innerHTML = items.length
    ? items.map(i => {
        const editable = itemOwnedByCurrentUser(i) && !isDevAdmin();
        const acts = editable
          ? `<button class="btn btn-sm btn-outline" data-cit-edit="${i.id}">Edit</button> <button class="btn btn-sm btn-outline" data-cit-del="${i.id}">Delete</button>`
          : `<span class="muted" title="${esc(__rbacLockMsg())}">View only</span>`;
        return `<tr data-cit-row="${i.id}"><td class="item-name"><span class="cit-name">${nameCell(i.name)}</span></td><td class="qty-strong">${i.quantity || 0}</td><td>${esc(i.unit || "")}</td><td class="actions-cell">${acts}</td></tr>`;
      }).join("")
    : `<tr class="empty-row"><td colspan="4">No items in this category yet.</td></tr>`;
}
function __citStartEdit(id) {
  const item = getAllDistrictItems().find(i => i.id === id);
  if (!item || !itemOwnedByCurrentUser(item) || isDevAdmin()) return toast(__rbacLockMsg(), "error");
  const row = document.querySelector('[data-cit-row="' + id + '"]');
  if (!row) return;
  row.querySelector(".item-name").innerHTML = `<input class="cat-edit-input" id="citEditName" value="${esc(item.name)}">`;
  row.querySelector(".actions-cell").innerHTML = `<button class="btn btn-sm btn-primary" data-cit-save="${id}">Save</button> <button class="btn btn-sm btn-outline" data-cit-cancel="${id}">Cancel</button>`;
  const inp = $("#citEditName");
  if (inp) { inp.focus(); inp.select(); }
}
function __citSave(id) {
  const items = getItems();
  const item = items.find(i => i.id === id);
  if (!item || !itemOwnedByCurrentUser(item) || isDevAdmin()) return toast(__rbacLockMsg(), "error");
  const name = (($("#citEditName") || {}).value || "").trim();
  if (!name) return toast("Enter a name.", "error");
  if (items.some(i => i.id !== id && i.locationId === currentUser.locationId && (i.name || "").toLowerCase() === name.toLowerCase())) return toast("An item with this name already exists in your unit.", "error");
  const old = item.name;
  item.name = name;
  item.updatedAt = Date.now();
  saveItems(items);
  __audit("Item Renamed", '"' + old + '" to "' + name + '"', { entity: "Item" });
  toast("Item renamed.", "success");
  __renderCatItems(item.categoryId);
  renderCatList();
  render();
}
function __citDelete(id) {
  const items = getItems();
  const item = items.find(i => i.id === id);
  if (!item || !canDeleteItem(item)) return toast(__rbacLockMsg(), "error");
  const totalQty = (Number(item.quantity) || 0) + (Number(item.allotted) || 0);
  if (totalQty > 0) return toast("Cannot delete item with remaining stock. Total quantity must be 0.", "error");
  if (!confirm("Delete this item from this category?")) return;
  item.isDeleted = true;
  item.deletedAt = Date.now();
  item.updatedAt = Date.now();
  if (!item.history) item.history = [];
  item.history.push({
    type: "ITEM_DELETED",
    qty: 0,
    prev: 0,
    balance: 0,
    at: Date.now(),
    date: todayStr(),
    time: nowTimeStr(),
    user: (currentUser && currentUser.name) || "",
    remarks: "Deleted Item"
  });
  saveItems(items);
  __audit("Item Deleted", '"' + (item.name || id) + '"', { entity: "Item" });
  toast("Item deleted.", "success");
  __renderCatItems(item.categoryId);
  renderCatList();
  render();
}

/* Quick add: name-only item creation from the Category Items modal (2026.09.195) */
function __citAdd() {
  const cid = __citOpenCatId;
  if (!cid) return;
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canManageItems()) return toast("You do not have permission to add items.", "error");
  if (!currentUser.locationId) return toast("No location assigned to your account.", "error");
  const name = (($("#citNewName") || {}).value || "").trim();
  if (!name) return toast("Enter an item name.", "error");
  const items = getItems();
  if (items.some(i => i.locationId === currentUser.locationId && (i.name || "").toLowerCase() === name.toLowerCase())) return toast("An item with this name already exists in your unit.", "error");
  items.push({ id: uid(), name, categoryId: cid, unit: "Pcs", quantity: 0, minStock: 0, locationId: currentUser.locationId, conditionCounts: { good: 0, poor: 0, damaged: 0 }, createdAt: Date.now(), updatedAt: Date.now() });
  saveItems(items);
  __audit("Item Added", `"${name}" (name-only quick add, qty 0)`, { entity: "Item" });
  toast("Item added.", "success");
  const inp = $("#citNewName"); if (inp) inp.value = "";
  __renderCatItems(cid);
  renderCatList();
  render();
}

function openCatModal() {
  renderCatList();
  $("#catInput").value = "";
  openModal("#catModal");
}

function addCategory() {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const name = ($("#catInput").value || "").trim();
  if (!name) return toast("Enter a name.", "error");
  const cats = getCategories();
  if (cats.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast("Already exists.", "error");
  cats.push({ id: uid(), name });
  saveCategories(cats); // per-district store (2026.09.213) — was clobbering the map with a flat array
  renderCatList();
  toast(`Added: ${name}`, "success");
  $("#catInput").value = "";
}

function deleteCategory(idx) {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const cats = getCategories();
  const cat = cats[idx];
  if (getAllDistrictItems().filter(i => i.categoryId === cat.id && !i.isDeleted).length > 0) return toast("Has items ? reassign first.", "error");
  cats.splice(idx, 1);
  saveCategories(cats); // per-district store (2026.09.213) — was clobbering the map with a flat array
  renderCatList();
  toast(`Deleted: ${cat.name}`, "success");
}

/* ==================== USERS ==================== */
function renderUsers() {
  const allUsers = getUsers();
  // A district admin sees their own district; an IG sees every district assigned
  // to it; only the Developer Admin sees the lot.
  const users = isDevAdmin()
    ? allUsers
    : isIg()
      ? allUsers.filter(u => inDistrictScope(u.districtId) && u.role !== "devadmin")
      : allUsers.filter(u => u.districtId === activeDistrictId && u.role !== "ig" && u.role !== "devadmin");
  const districts = getDistricts();
  const box = $("#usersList");
  box.innerHTML = users.map(u => {
    const dist = districts.find(d => d.id === u.districtId);
    const isSelf = currentUser && u.id === currentUser.id;
    const roleLabel = ROLE_LABELS[u.role] || u.role;
    const badgeColor = u.role === 'devadmin' ? '#7c3aed' : u.role === 'ig' ? 'var(--gold)' : u.role === 'admin' ? 'var(--primary)' : u.role === 'mhc' ? 'var(--gold)' : 'var(--green)';
    // Only the Developer Admin may create, edit or delete an IG account, so the
    // actions stay hidden on an IG row for everyone else.
    const canManage = isDevAdmin() ? true : (isAdmin() && u.role !== 'admin' && u.role !== 'devadmin' && u.role !== 'ig');
    // The last Developer Admin can be edited but never deleted, and an IG that
    // still answers for a district cannot be removed either - clear its scope
    // first. Both rules are enforced again on the server.
    const devCount = users.filter(x => x.role === 'devadmin').length;
    const lastDev = u.role === 'devadmin' && devCount <= 1;
    const igBusy = u.role === 'ig' && igDistrictsOf(u).length > 0;
    const items = [ { label: "Edit", attrs: `data-edit-user="${u.id}"` } ];
    if (lastDev) items.push({ label: "Last Developer Admin", cls: "act-dd-del act-dd-off", attrs: `title="The only Developer Admin cannot be deleted"` });
    else if (igBusy) items.push({ label: "Has " + igDistrictsOf(u).length + " district(s)", cls: "act-dd-del act-dd-off", attrs: `title="Clear this IG's districts before deleting it"` });
    else items.push({ label: "Delete", cls: "act-dd-del", attrs: `data-del-user="${u.id}"` });
    const actions = isSelf ? "" : (canManage ? actDD(items) : "");
        return `<div class="user-row"><div class="ur-info"><div class="ur-name">${esc(u.name)} ${isSelf ? '<span style="color:var(--amber);font-size:.7rem">(You)</span>' : ''}</div><div class="ur-detail">${esc(u.username)} ? ${esc(u.mobile)} ? ${esc(dist ? dist.name : "?")}</div></div><span class="ur-badge" style="background:${badgeColor};color:#fff">${roleLabel}</span><div class="ur-actions" style="display:flex;gap:4px">${actions}</div></div>`;
  }).join("");
  const distSel = $("#nuDistrict");
  if (distSel) {
    if (isDevAdmin()) {
      distSel.innerHTML = __byName(districts).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
      distSel.disabled = false;
    } else {
      const myDist = districts.find(d => d.id === activeDistrictId);
      distSel.innerHTML = `<option value="${activeDistrictId}">${esc(myDist ? myDist.name : "")}</option>`;
      distSel.disabled = true;
    }
  }
  updateUserLocationDropdown();
}

/* ---- the IG district picker: a searchable dropdown, not a wall of boxes ----
   One helper drives both copies of it (the IG form and the shared Add User
   form), keyed by prefix: 'igf' or 'nu'. The checkbox for each district lives
   next to its name in the column, so ticking is a single click. */
const __igDd = { igf: { list: "#igfDistricts", search: "#igfDistrictsSearch", summary: "#igfDistrictsSummary", panel: "#igfDistrictsPanel", trigger: "#igfDistrictsBtn" },
                  nu:  { list: "#nuIgDistricts", search: "#nuIgDistrictsSearch", summary: "#nuIgDistrictsSummary", panel: "#nuIgDistrictsPanel", trigger: "#nuIgDistrictsBtn" } };

/* The ticked set lives here, not in the DOM. Reading the boxes back is unsafe:
   searching filters rows out of the panel, and a filtered-out district has no
   checkbox left to read, so clearing the search would silently untick it.
   This model is the only truth, so filtering can never lose a selection. */
const __igDdSel = { igf: [], nu: [] };
const __igDdPending = { igf: [], nu: [] };

function __igDdRead(pre) {
  return (__igDdSel[pre] || []).slice();
}
function __igDdSync(pre) {
  const m = __igDd[pre];
  if (!m) return;
  const chosen = __igDdRead(pre);
  const box = $(m.summary);
  if (!box) return;
  if (!chosen.length) { box.textContent = "No district selected"; box.title = ""; return; }
  const names = chosen.map(function(id) { const d = getDistricts().find(x => x.id === id); return d ? d.name : id; });
  box.textContent = names.length <= 2 ? names.join(", ") : names.slice(0, 2).join(", ") + " +" + (names.length - 2) + " more";
  box.title = names.join(", ");
}
function __igDdRender(pre) {
  const m = __igDd[pre];
  if (!m) return;
  const box = $(m.list);
  if (!box) return;
  const q = (($(m.search) || {}).value || "").trim().toLowerCase();
  const all = getDistricts();
  const rows = q
    ? all.filter(d => (d.name || "").toLowerCase().indexOf(q) !== -1 || (d.code || "").toLowerCase().indexOf(q) !== -1 || (d.headquarters || "").toLowerCase().indexOf(q) !== -1)
    : all;
  if (!rows.length) {
    box.innerHTML = '<div class="ig-dd-empty">No district matches "' + esc(q) + '".</div>';
    return;
  }
  const chosen = __igDdPending[pre] && __igDdPending[pre].length ? __igDdPending[pre] : __igDdRead(pre);
  box.innerHTML = rows.map(function(d) {
    const on = chosen.indexOf(d.id) >= 0;
    return '<label class="ig-dd-row' + (on ? " is-on" : "") + '">' +
      '<input type="checkbox" value="' + esc(d.id) + '"' + (on ? " checked" : "") + '>' +
      '<span class="ig-dd-name">' + esc(d.name) + '</span>' +
      '<em>' + esc(d.code || "") + '</em>' +
    '</label>';
  }).join("");
  __igDdPending[pre] = [];
}
// a tick is the only thing that changes the model, so fold the panel back in
function __igDdAbsorb(pre) {
  const m = __igDd[pre];
  if (!m) return;
  const shown = $$(m.list + " input[type=checkbox]").map(c => c.value);
  const q = (($(m.search) || {}).value || "").trim().toLowerCase();
  const all = getDistricts();
  const visible = new Set(q
    ? all.filter(d => (d.name || "").toLowerCase().indexOf(q) !== -1 || (d.code || "").toLowerCase().indexOf(q) !== -1 || (d.headquarters || "").toLowerCase().indexOf(q) !== -1).map(d => d.id)
    : all.map(d => d.id));
  // districts hidden by the search keep whatever they had
  const next = __igDdRead(pre).filter(id => !visible.has(id));
  $$((m.list) + " input[type=checkbox]:checked").forEach(c => { if (next.indexOf(c.value) < 0) next.push(c.value); });
  __igDdSel[pre] = next;
  __igDdSync(pre);
}
function __igDdSet(pre, selected) {
  const m = __igDd[pre];
  if (!m) return;
  __igDdSel[pre] = (Array.isArray(selected) ? selected : []).slice();
  __igDdPending[pre] = __igDdSel[pre].slice();
  const s = $(m.search);
  if (s) s.value = "";
  __igDdRender(pre);
  __igDdSync(pre);
}

// Closing one panel must not re-enter itself, so the "close the others"
// step calls this directly instead of going through __igDdOpen.
function __igDdSetOpen(pre, open) {
  const m = __igDd[pre];
  if (!m) return;
  const panel = $(m.panel),
      trig = $(m.trigger);
  if (!panel) return;
  panel.classList.toggle("hidden", !open);
  if (trig) {
    trig.classList.toggle("is-open", open);
    trig.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (open) {
    __igDdRender(pre);
    const s = $(m.search);
    if (s) setTimeout(function() { s.focus(); }, 20);
  }
}
function __igDdOpen(pre, open) {
  // only one dropdown stays open at a time
  Object.keys(__igDd).forEach(function(k) { if (k !== pre) __igDdSetOpen(k, false); });
  __igDdSetOpen(pre, open);
}
/* ---- IG district picker: shown ONLY for the Inspector General role ---- */
function buildIgDistrictPicker(selected) {
  // one dropdown, shared with the IG form: prefill, redraw, refresh the label
  __igDdSet("nu", Array.isArray(selected) ? selected : []);
}
function syncIgRow() {
  const row = $("#nuIgRow");
  if (!row) return;
  const isIgRole = $("#nuRole") && $("#nuRole").value === "ig";
  row.classList.toggle("hidden", !isIgRole);
  if (!isIgRole) { __igDdOpen("nu", false); return; }
  if (!$("#nuIgDistricts").children.length) buildIgDistrictPicker([$("#nuDistrict").value]);
}
function readIgDistricts() {
  return __igDdRead("nu");
}
function updateUserLocationDropdown() {
  const distSel = $("#nuDistrict");
  const locSel = $("#nuLocation");
  if (!distSel || !locSel) return;
  syncIgRow();
  locSel.innerHTML = __byName(getLocationsForDistrict(distSel.value)).map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
}

function openUsersModal() {
  $("#usersModalTitle").textContent = "Manage Users";
  $("#userFormTitle").textContent = "Add New User";
  $("#userSubmitBtn").textContent = "Add User";
  $("#cancelUserEdit").style.display = "none";
  $("#nuEditId").value = "";
  $("#addUserForm").reset();
  buildIgDistrictPicker([]);
  syncIgRow();
  renderUsers();
  openModal("#usersModal");
}

function startEditUser(id) {
  const user = getUsers().find(u => u.id === id);
  if (!user) return;
  // An IG account can only be created, changed or removed by the Developer Admin.
  if (!isDevAdmin() && user.role === "ig") return toast("Only the Developer Admin can edit an Inspector General account.", "error");
  $("#usersModalTitle").textContent = "Edit User";
  $("#userFormTitle").textContent = "Edit User";
  $("#userSubmitBtn").textContent = "Update User";
  $("#cancelUserEdit").style.display = "";
  $("#nuEditId").value = id;
  $("#nuUsername").value = user.username;
  $("#nuPassword").value = "";
  $("#nuName").value = user.name;
  $("#nuMobile").value = user.mobile;
  $("#nuRole").value = user.role;
  $("#nuDistrict").value = user.districtId;
  buildIgDistrictPicker(Array.isArray(user.districtIds) ? user.districtIds : []);
  updateUserLocationDropdown();
  syncIgRow();
  setTimeout(() => { $("#nuLocation").value = user.locationId; }, 50);
}

function cancelUserEdit() {
  $("#userFormTitle").textContent = "Add New User";
  $("#userSubmitBtn").textContent = "Add User";
  $("#cancelUserEdit").style.display = "none";
  $("#nuEditId").value = "";
  $("#addUserForm").reset();
  buildIgDistrictPicker([]);
  syncIgRow();
}

function addUser(e) {
  e.preventDefault();
  const editId = $("#nuEditId").value;
  const username = $("#nuUsername").value.trim();
  const password = $("#nuPassword").value;
  const name = $("#nuName").value.trim();
  const mobile = $("#nuMobile").value.trim();
  const role = $("#nuRole").value;
  const districtId = $("#nuDistrict").value;
  const locationId = $("#nuLocation").value;
  // The district column only exists for an IG; every other role keeps exactly
  // one district, so the list is cleared for them rather than left stale.
  const igDistricts = role === "ig" ? readIgDistricts() : [];
  if (!username || !name || !mobile) return toast("Fill all required fields.", "error");
  if (role === "ig" && !igDistricts.length) return toast("An Inspector General must be given at least one district.", "error");
  if (!isDevAdmin() && districtId !== activeDistrictId) return toast("You can only create users in your district.", "error");
  if (!isDevAdmin() && (role === "admin" || role === "devadmin" || role === "ig")) return toast("You cannot assign admin roles.", "error");
  const users = getUsers();
  if (editId) {
    const user = users.find(u => u.id === editId);
    if (!user) return toast("User not found.", "error");
    if (users.some(u => u.username === username && u.id !== editId)) return toast("Username already taken.", "error");
    user.username = username;
    if (password) user.password = password;
    user.name = name;
    user.mobile = mobile;
    user.role = role;
    user.districtId = districtId;
    user.locationId = locationId;
    if (role === "ig") user.districtIds = igDistricts.slice();
    else delete user.districtIds;
    toast("User updated.", "success");
  } else {
    if (!password) return toast("Password is required.", "error");
    if (users.some(u => u.username === username)) return toast("Username already exists.", "error");
    const rec = { id: uid(), username, password, role, name, mobile, districtId, locationId, createdAt: Date.now() };
    if (role === "ig") rec.districtIds = igDistricts.slice();
    users.push(rec);
    toast("User added.", "success");
  }
saveUsers(users);
  __audit(editId ? "User Updated" : "User Created", `${name} (${ROLE_LABELS[role] || role})`, { entity: "User" });
  cancelUserEdit();
  renderUsers();
}

function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  const user = getUsers().find(u => u.id === id);
  if (!isDevAdmin() && user && user.districtId !== activeDistrictId) return toast("You can only delete users in your district.", "error");
  if (!isDevAdmin() && user && (user.role === "admin" || user.role === "devadmin" || user.role === "ig")) return toast("You cannot delete admin or Inspector General users.", "error");
  saveUsers(getUsers().filter(u => u.id !== id));
  __audit("User Deleted", `${user ? user.name : id} (${user ? user.role : "?"})`, { entity: "User" });
  toast("User deleted.", "success");
  renderUsers();
}

/* ==================== INSPECTIONS ==================== */
function getInspections() {
  if (!activeDistrictId) return [];
  return loadData(`inspections_${activeDistrictId}`) || [];
}

function saveInspections(list) {
  if (!activeDistrictId) return;
  saveData(`inspections_${activeDistrictId}`, list);
}

function seedInspections(districtId) {
  const items = getItemsForDistrict(districtId);
  const locs = getLocationsForDistrict(districtId);
  const users = getUsers().filter(u => u.districtId === districtId);
  const inspectors = ["Inspector Rajesh Kumar", "SI Pooja Sharma", "Inspector Vikram Singh", "ASI Mohan Lal", "Inspector Neelam Devi"];
  const findingsSamples = [
    "All items accounted for in good condition. Minor wear on some equipment.",
    "Found 2 items missing from inventory. Investigation recommended.",
    "Stock levels adequate. Some items need replacement due to wear.",
    "Complete audit done. Everything matches the records.",
    "Found damaged items that need immediate replacement.",
    "Routine check completed. No issues found.",
    "Inventory partially updated. Some records need correction.",
    "Equipment in good working condition. Regular maintenance required."
  ];
  const recoSamples = [
    "Replace worn-out items within 2 weeks.",
    "Conduct surprise audit next month.",
    "Update inventory records immediately.",
    "Request new stock for low-quantity items.",
    "No action required at this time.",
    "Schedule maintenance for vehicle fleet.",
    "Train staff on proper inventory handling.",
    "Report discrepancy to senior officer."
  ];
  const types = ["routine", "special", "annual"];
  const statuses = ["completed", "completed", "completed", "pending", "overdue"];
  const txns = [];
  for (let i = 0; i < 8; i++) {
    const item = items[Math.floor(Math.random() * items.length)];
    const loc = locs[Math.floor(Math.random() * locs.length)];
    const inspector = inspectors[Math.floor(Math.random() * inspectors.length)];
    const daysAgo = Math.floor(Math.random() * 90);
    txns.push({
      id: uid(),
      itemName: item ? item.name : "General Stock",
      inspectedBy: inspector,
      type: types[Math.floor(Math.random() * types.length)],
      date: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
      locationId: loc ? loc.id : (locs[0] || {}).id || "",
      findings: findingsSamples[Math.floor(Math.random() * findingsSamples.length)],
      recommendations: recoSamples[Math.floor(Math.random() * recoSamples.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: Date.now() - daysAgo * 86400000,
    });
  }
  saveData(`inspections_${districtId}`, txns);
}

function __visibleInspections() {
  if (!activeDistrictId) return [];
  if (isDevAdmin()) {
    const out = [];
    getDistricts().forEach(d => { (loadData(`inspections_${d.id}`) || []).forEach(i => out.push(i)); });
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  const list = getInspections();
  const locId = getVisibleLocationId();
  if (!locId) return list;
  return list.filter(i => i.locationId === locId);
}

function __inspFiltered() {
  const q = ($("#inspSearch") || {}).value || "";
  const typeFilter = ($("#inspTypeFilter") || {}).value || "";
  const statusFilter = ($("#inspStatusFilter") || {}).value || "";
  return __visibleInspections().filter(ins => {
    if (typeFilter && ins.type !== typeFilter) return false;
    if (statusFilter && ins.status !== statusFilter) return false;
    if (q && !ins.itemName.toLowerCase().includes(q.toLowerCase()) && !ins.inspectedBy.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function __inspExportData() {
  const locs = getAllLocationsFlat();
  const rows = __inspFiltered().map(ins => {
    const loc = locs.find(l => l.id === ins.locationId);
    const typeLabel = ins.type ? ins.type.charAt(0).toUpperCase() + ins.type.slice(1) : "Unknown";
    const statusLabel = ins.status ? ins.status.charAt(0).toUpperCase() + ins.status.slice(1) : "Unknown";
    return [ins.date, ins.itemName, ins.inspectedBy, typeLabel, loc ? loc.name : "\u2014", ins.findings || "\u2014", ins.recommendations || "\u2014", statusLabel];
  });
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  return {
    title: "Inspections Report",
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " inspection" + (rows.length === 1 ? "" : "s") + ")",
    cols: ["Date", "Item / Asset", "Inspected By", "Type", "Location", "Findings", "Recommendations", "Status"],
    rows,
    fileName: "inspections-report"
  };
}

function printInspReport() { printReport(__inspExportData()); }
function exportInspExcel() { excelReport(__inspExportData()); toast("Excel exported.", "success"); }
function exportInspWord() { wordReport(__inspExportData()); toast("Word document exported.", "success"); }
function exportInspPDF() { pdfReport(__inspExportData()); toast("PDF exported.", "success"); }

const __INSP_COLS = ["Date", "Item / Asset", "Inspected By", "Type", "Location", "Findings", "Recommendations", "Status"];

function __inspRows(list) {
  const locs = getAllLocationsFlat();
  return list.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(ins => {
    const loc = locs.find(l => l.id === ins.locationId);
    const typeLabel = ins.type ? ins.type.charAt(0).toUpperCase() + ins.type.slice(1) : "Unknown";
    const statusLabel = ins.status ? ins.status.charAt(0).toUpperCase() + ins.status.slice(1) : "Unknown";
    return [ins.date, ins.itemName, ins.inspectedBy, typeLabel, loc ? loc.name : "", ins.findings || "\u2014", ins.recommendations || "\u2014", statusLabel];
  });
}

const __INSP_STAT_BUILDERS = {
  total: () => ({ title: "Total Inspections", cols: __INSP_COLS, rows: __inspRows(__visibleInspections()) }),
  completed: () => ({ title: "Completed Inspections", cols: __INSP_COLS, rows: __inspRows(__visibleInspections().filter(i => i.status === "completed")) }),
  pending: () => ({ title: "Pending Inspections", cols: __INSP_COLS, rows: __inspRows(__visibleInspections().filter(i => i.status === "pending")) }),
  overdue: () => ({ title: "Overdue Inspections", cols: __INSP_COLS, rows: __inspRows(__visibleInspections().filter(i => i.status === "overdue")) })
};

function openInspStatDetail(key) {
  const def = __INSP_STAT_BUILDERS[key] ? __INSP_STAT_BUILDERS[key]() : null;
  if (!def) return;
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  __statDetail = {
    title: def.title,
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + def.rows.length + " inspection" + (def.rows.length === 1 ? "" : "s") + ")",
    cols: def.cols,
    rows: def.rows,
    fileName: "inspections-" + key
  };
  __statFilter = "";
  $("#statDetailTitle").textContent = def.title;
  $("#statDetailSubtitle").textContent = __statDetail.subtitle;
  $("#statDetailHead").innerHTML = "<tr>" + def.cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const s = $("#statSearch");
  if (s) s.value = "";
  renderStatDetail("");
  openModal("#statDetailModal");
}

function renderInspections() {
  const inspections = __visibleInspections();
  const locs = getAllLocationsFlat();

  const filtered = __inspFiltered();

  const tbody = $("#inspBody");
  if (!tbody) return;

if (filtered.length) {
    const pageRows = __pgRows("insp", filtered);
    tbody.innerHTML = pageRows.map(ins => {
      const loc = locs.find(l => l.id === ins.locationId);
      const typeCls = { routine: "cat-badge", special: "status-badge status-low", annual: "status-badge status-ok" }[ins.type] || "cat-badge";
      const statusCls = { completed: "status-badge status-ok", pending: "status-badge status-low", overdue: "status-badge status-out" }[ins.status] || "cat-badge";
      const statusLabel = ins.status ? ins.status.charAt(0).toUpperCase() + ins.status.slice(1) : "Unknown";
      const typeLabel = ins.type ? ins.type.charAt(0).toUpperCase() + ins.type.slice(1) : "Unknown";
      return `<tr><td>${esc(ins.date)}</td><td class="item-name">${nameCell(ins.itemName)}</td><td>${esc(ins.inspectedBy)}</td><td><span class="${typeCls}">${typeLabel}</span></td><td>${esc(loc ? loc.name : "")}</td><td><span class="${statusCls}">${statusLabel}</span></td><td><button type="button" class="btn btn-sm btn-loc" data-insp-view="${esc(ins.id)}">View</button></td></tr>`;
    }).join("");
} else {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No inspections found. Click "+ New Inspection" to add one.</td></tr>`;
  }
  renderPager("insp", filtered.length, renderInspections);

  const stats = { total: inspections.length, completed: 0, pending: 0, overdue: 0 };
  inspections.forEach(ins => { if (stats[ins.status] !== undefined) stats[ins.status]++; });
  $("#statTotalInspections").textContent = stats.total;
  $("#statCompleted").textContent = stats.completed;
  $("#statPending").textContent = stats.pending;
  $("#statOverdue").textContent = stats.overdue;
}

function openInspectionModal(insp) {
  $("#inspectionModalTitle").textContent = insp ? "Edit Inspection" : "Add New Inspection";
  $("#inspectionSaveBtn").textContent = insp ? "Update Inspection" : "Save Inspection";
  $("#fiItem").value = insp ? insp.itemName : "";
  $("#fiInspectedBy").value = insp ? insp.inspectedBy : "";
  $("#fiType").value = insp ? insp.type : "routine";
  $("#fiDate").value = insp ? insp.date : new Date().toISOString().slice(0, 10);
  $("#fiFindings").value = insp ? (insp.findings || "") : "";
  $("#fiRecommendations").value = insp ? (insp.recommendations || "") : "";
  $("#fiStatus").value = insp ? (insp.status || "completed") : "completed";
  $("#fiInspectionId").value = insp ? insp.id : "";
  __attStore.inspect = []; __attRender("inspect");

  const locSel = $("#fiLocation");
  if (!canSeeAllLocations()) {
    locSel.innerHTML = `<option value="${currentUser.locationId}">${esc(getLocations().find(l => l.id === currentUser.locationId)?.name || "")}</option>`;
    locSel.disabled = true;
  } else {
    locSel.disabled = false;
    const locs = getLocations();
    locSel.innerHTML = `<option value="">Select location</option>` + __byName(locs).map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
  }
  locSel.value = insp ? insp.locationId : (canSeeAllLocations() ? "" : currentUser.locationId);
  openModal("#inspectionModal");
  setTimeout(() => $("#fiItem").focus(), 50);
}

async function saveInspection(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const id = $("#fiInspectionId").value;
  const itemName = $("#fiItem").value.trim();
  const inspectedBy = $("#fiInspectedBy").value.trim();
  const type = $("#fiType").value;
  const date = $("#fiDate").value;
  const locationId = $("#fiLocation").value;
  const findings = $("#fiFindings").value.trim();
  const recommendations = $("#fiRecommendations").value.trim();
  const status = $("#fiStatus").value;
  if (!itemName || !inspectedBy || !date || !locationId) return toast("Please fill all required fields.", "error");

  let __inspectAtts = [];
  if ((__attStore.inspect || []).length) { try { __inspectAtts = await __attUploadAll("inspect"); } catch (e) { return; } }

  const inspections = getInspections();
  if (id) {
    const insp = inspections.find(i => i.id === id);
    if (insp) Object.assign(insp, { itemName, inspectedBy, type, date, locationId, findings, recommendations, status, updatedAt: Date.now() });
    if (insp && __inspectAtts.length) insp.attachments = (insp.attachments || []).concat(__inspectAtts);
    toast("Inspection updated.", "success");
  } else {
    inspections.push({ id: uid(), itemName, inspectedBy, type, date, locationId, findings, recommendations, status, attachments: __inspectAtts, createdAt: Date.now() });
    toast("Inspection added.", "success");
  }
saveInspections(inspections);
  __attStore.inspect = []; __attRender("inspect");
  __audit(id ? "Inspection Updated" : "Inspection Added", `"${itemName}" ? ${type} ? ${status}`, { entity: "Inspection" });
  closeModals();
  render();
}

/* ---- Inspection view dialog + export (2026.09.201) ---- */
let __inspViewId = null;
function openInspectionView(id) {
  const ins = getInspections().find(i => i.id === id);
  if (!ins) return toast("Inspection record not found.", "error");
  __inspViewId = id;
  const loc = getAllLocationsFlat().find(l => l.id === ins.locationId);
  const typeLabel = ins.type ? ins.type.charAt(0).toUpperCase() + ins.type.slice(1) : "Unknown";
  const statusLabel = ins.status ? ins.status.charAt(0).toUpperCase() + ins.status.slice(1) : "Unknown";
  const atts = Array.isArray(ins.attachments) ? ins.attachments : [];
  const box = $("#inspViewBody");
  if (!box) return;
  box.innerHTML =
    '<div class="demand-detail-grid">' +
    '<div><span class="stat-label">Date</span><b>' + esc(ins.date || "-") + '</b></div>' +
    '<div><span class="stat-label">Item / Asset</span><b>' + esc(ins.itemName || "-") + '</b></div>' +
    '<div><span class="stat-label">Inspected By</span><b>' + esc(ins.inspectedBy || "-") + '</b></div>' +
    '<div><span class="stat-label">Type</span><b>' + esc(typeLabel) + '</b></div>' +
    '<div><span class="stat-label">Location</span><b>' + esc(loc ? loc.name : (ins.locationId || "-")) + '</b></div>' +
    '<div><span class="stat-label">Status</span><b>' + esc(statusLabel) + '</b></div>' +
    '<div style="grid-column:1/-1"><span class="stat-label">Findings</span><div>' + esc(ins.findings || "No findings recorded.") + '</div></div>' +
    '<div style="grid-column:1/-1"><span class="stat-label">Recommendations</span><div>' + esc(ins.recommendations || "No recommendations recorded.") + '</div></div>' +
    (atts.length ? '<div style="grid-column:1/-1"><span class="stat-label">Attachments</span><div>' + atts.map(a => '<span class="cons-badge cons-b-gray" style="margin-right:6px">' + esc(a.fileName || a.name || "file") + '</span>').join("") + '</div></div>' : "") +
    '</div>';
  openModal("#inspViewModal");
}
function __inspData() {
  const ins = getInspections().find(i => i.id === __inspViewId);
  if (!ins) { toast("Inspection record not found.", "error"); return null; }
  const loc = getAllLocationsFlat().find(l => l.id === ins.locationId);
  return {
    Date: ins.date || "-",
    "Item / Asset": ins.itemName || "-",
    "Inspected By": ins.inspectedBy || "-",
    Type: (ins.type || "").charAt(0).toUpperCase() + (ins.type || "").slice(1),
    Location: loc ? loc.name : (ins.locationId || "-"),
    Status: (ins.status || "").charAt(0).toUpperCase() + (ins.status || "").slice(1),
    Findings: ins.findings || "",
    Recommendations: ins.recommendations || ""
  };
}
function __inspExportExcel() {
  const d = __inspData(); if (!d) return;
  if (typeof XLSX === "undefined") return toast("Excel library not loaded.", "error");
  const cols = Object.keys(d);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols, cols.map(k => d[k])]), "Inspection");
  XLSX.writeFile(wb, "inspection-" + (__inspViewId || "record") + ".xlsx");
  toast("Excel downloaded.", "success");
}
function __inspExportWord() {
  const d = __inspData(); if (!d) return;
  const rows = Object.keys(d).map(k => '<tr><th style="text-align:left;padding:6px 10px;border:1px solid #333;background:#eef2f7">' + esc(k) + '</th><td style="padding:6px 10px;border:1px solid #333">' + colCellInline(k, String(d[k] || "-")) + '</td></tr>').join("");
  const html = '<html><head><meta charset="utf-8"><title>Inspection Record</title></head><body><h2>Inspection Record</h2><table style="border-collapse:collapse;width:100%">' + rows + '</table></body></html>';
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "inspection-" + (__inspViewId || "record") + ".doc";
  a.click(); URL.revokeObjectURL(a.href);
  toast("Word document downloaded.", "success");
}
function __inspExportPdf() {
  const d = __inspData(); if (!d) return;
  const rows = Object.keys(d).map(k => '<tr><th style="text-align:left;padding:6px 10px;border:1px solid #333;background:#eef2f7">' + esc(k) + '</th><td style="padding:6px 10px;border:1px solid #333">' + colCellInline(k, String(d[k] || "-")) + '</td></tr>').join("");
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return toast("Allow pop-ups to download PDF.", "error");
  w.document.write('<html><head><title>Inspection Record</title><style>body{font-family:Segoe UI,Arial;padding:24px}h2{margin-top:0}</style></head><body><h2>Inspection Record</h2><table style="border-collapse:collapse;width:100%">' + rows + '</table><script>setTimeout(function(){window.print()},300)<' + '/script></body></html>');
  w.document.close();
  toast("Use the print dialog to Save as PDF.", "success");
}
function deleteInspection(id) {
  if (!confirm("Delete this inspection record?")) return;
  const it = getInspections().find(i => i.id === id);
  saveInspections(getInspections().filter(i => i.id !== id));
  __audit("Inspection Deleted", `"${it ? it.itemName : id}"`, { entity: "Inspection" });
  toast("Inspection deleted.", "success");
  render();
}

/* ==================== DEMANDS ==================== */
function getDemands() {
  if (!activeDistrictId) return [];
  return loadData(`demands_${activeDistrictId}`) || [];
}

function __demandsInStore(districtId) {
  return (loadData(`demands_${districtId}`) || []).map(x => ({ ...x, __storeId: districtId }));
}

function __allVisibleDemands() {
  if (!activeDistrictId) return [];
  const combined = __demandsInStore(activeDistrictId);
  getDistricts().forEach(d => {
    if (d.id === activeDistrictId) return;
    __demandsInStore(d.id).forEach(x => { if (x.demandToDistrict === activeDistrictId) combined.push(x); });
  });
  const locId = getVisibleLocationId();
  if (!locId) return combined;
  return combined.filter(d => (d.requestedFromLocation && d.requestedFromLocation === locId) || d.demandToLocation === locId);
}

function saveDemands(list) {
  if (!activeDistrictId) return;
  saveData(`demands_${activeDistrictId}`, list);
}

function getAllDemandsAcrossDistricts() {
  const all = {};
  getDistricts().forEach(d => {
    all[d.id] = loadData(`demands_${d.id}`) || [];
  });
  return all;
}

function seedDemands(districtId) {
  const items = getItemsForDistrict(districtId);
  const districts = getDistricts().filter(d => d.id !== districtId);
  const cats = getCategoriesForDistrict(districtId); // per-district map (2026.09.213)
  if (!districts.length || !items.length) return;

  const reasons = [
    "Operational requirement for upcoming deployment",
    "Replacement of damaged/unserviceable equipment",
    "New unit formation requires inventory",
    "Training exercise requirements",
    "Annual restocking mandate",
    "Emergency operational need"
  ];
  const remarks = [
    "Please process at earliest",
    "Required before next month",
    "As per HQ directive",
    "Budget approved for this quarter",
    "Priority item for field operations"
  ];
  const statuses = ["pending", "pending", "approved", "approved", "rejected"];
  const demands = [];

  for (let i = 0; i < 6; i++) {
    const item = items[Math.floor(Math.random() * items.length)];
    const cat = cats.find(c => c.id === item.categoryId);
    const toDist = districts[Math.floor(Math.random() * districts.length)];
    const toLocs = getLocationsForDistrict(toDist.id);
    const toLoc = toLocs.length ? toLocs[Math.floor(Math.random() * toLocs.length)] : null;
    const daysAgo = Math.floor(Math.random() * 30);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    demands.push({
      id: uid(),
      demandNo: nextDemandNo(),
      itemName: item.name,
      quantity: Math.floor(Math.random() * 20) + 1,
      categoryId: item.categoryId,
      categoryName: cat ? cat.name : "Other",
      condition: ["any", "good", "poor", "damaged"][Math.floor(Math.random() * 4)],
      urgency: ["normal", "urgent", "critical"][Math.floor(Math.random() * 3)],
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      remarks: remarks[Math.floor(Math.random() * remarks.length)],
requestedBy: currentUser ? currentUser.name : "Admin",
    requestedById: currentUser ? currentUser.id : null,
      requestedFromDistrict: districtId,
      demandToDistrict: toDist.id,
      demandToDistrictName: toDist.name,
      demandToLocation: toLoc ? toLoc.id : "",
      demandToLocationName: toLoc ? toLoc.name : "",
      status: status,
      actionRemarks: status !== "pending" ? remarks[Math.floor(Math.random() * remarks.length)] : "",
      rejectionReason: status === "rejected" ? "Item not available in sufficient quantity at this time." : "",
      processing: [],
      createdAt: Date.now() - daysAgo * 86400000,
      updatedAt: status !== "pending" ? Date.now() - (daysAgo - 1) * 86400000 : null,
    });
  }
  saveData(`demands_${districtId}`, demands);
}

/* ---- Demand item / status helpers (multi-item workflow) ---- */
function __demandItems(d) {
  if (d && Array.isArray(d.demandItems) && d.demandItems.length) return d.demandItems;
  if (!d) return [];
  const legacyCompleted = d.status === "approved";
  const legacyRejected = d.status === "rejected";
  return [{
    key: "i0",
    itemName: d.itemName || "Item",
    quantity: Number(d.quantity) || 0,
    approvedQuantity: legacyCompleted ? (Number(d.quantity) || 0) : 0,
    remainingQuantity: legacyCompleted ? 0 : (Number(d.quantity) || 0),
    categoryId: d.categoryId || "",
    categoryName: d.categoryName || "",
    condition: d.condition || "any",
    status: legacyRejected ? "rejected" : legacyCompleted ? "completed" : "pending",
    remark: d.actionRemarks || "",
    rejectionReason: d.rejectionReason || "",
    processedBy: d.approvedByName || "",
    processedAt: d.updatedAt || null,
  }];
}

function __demandOverallStatus(d) {
  const items = __demandItems(d);
  if (items.some(i => i.reviewStatus === "pending")) return "pending_review";
  const sts = items.map(i => i.status);
  if (!sts.length) return "pending";
  if (sts.every(s => s === "completed")) return "completed";
  if (sts.every(s => s === "rejected")) return "rejected";
  if (sts.every(s => s === "partial")) return "partially_completed";
  if (sts.some(s => s === "pending")) return "in_progress";
  return "mixed";
}

/* ============================================================
   DISTRIBUTION MODULE
   Items distributed to own-district units and (for admins) to
   other district admins. Stored per-sender-district like demands.
   ============================================================ */
function getDistributions() {
  if (!activeDistrictId) return [];
  return loadData(`distributions_${activeDistrictId}`) || [];
}

function __distributionsInStore(districtId) {
  return (loadData(`distributions_${districtId}`) || []).map(x => ({ ...x, __storeId: districtId }));
}

function __allVisibleDistributions() {
  if (!activeDistrictId) return [];
  const combined = __distributionsInStore(activeDistrictId);
  getDistricts().forEach(d => {
    if (d.id === activeDistrictId) return;
    __distributionsInStore(d.id).forEach(x => { if (x.toDistrictId === activeDistrictId) combined.push(x); });
  });
  const locId = getVisibleLocationId();
  if (!locId) return combined;
  return combined.filter(x => x.fromLocationId === locId || x.toLocationId === locId);
}

function saveDistributions(list) {
  if (!activeDistrictId) return;
  saveData(`distributions_${activeDistrictId}`, list);
}

function __saveDistributionsFor(districtId, list) {
  if (!districtId) return;
  saveData(`distributions_${districtId}`, list);
}

function nextDistNo() {
  let seq = Number(loadData("distSeq")) || 0;
  seq += 1;
  saveData("distSeq", seq);
  return "DIST-" + String(seq).padStart(6, "0");
}

function __distHQLocation(districtId) {
  const locs = getLocationsForDistrict(districtId);
  return locs.find(l => l.type === "district") || locs[0] || null;
}

function __distReceiverOptions() {
  if (!currentUser) return [];
  const opts = [];
  const myLocId = getVisibleLocationId() || currentUser.locationId;
  const isAdminUser = isAdmin();
  // Own-district units (excluding own unit + the HQ/admin unit, which is
  // offered as the "[ADMIN]" option below instead).
  getLocationsForDistrict(activeDistrictId).forEach(l => {
    if (l.id === myLocId) return;
    if (l.type === "district") return;
    opts.push({ type: "unit", districtId: activeDistrictId, locationId: l.id, label: "[UNIT] " + l.name });
  });
  if (isAdminUser) {
    // District admin: other district admins only (their own district is
    // represented by the unit list above).
    getDistricts().forEach(d => {
      if (d.id === activeDistrictId) return;
      const hq = __distHQLocation(d.id);
      opts.push({ type: "admin", districtId: d.id, locationId: hq ? hq.id : "", label: "[ADMIN] " + d.name + " (District Admin)" });
    });
  } else {
    // Unit user: their own district's admin.
    const hq = __distHQLocation(activeDistrictId);
    const ownDist = getDistricts().find(d => d.id === activeDistrictId);
    opts.push({ type: "admin", districtId: activeDistrictId, locationId: hq ? hq.id : "", label: "[ADMIN] " + (ownDist ? ownDist.name : "") + " (District Admin)" });
  }
  return opts;
}

function __distReceiverName(d) {
  if (!d) return "—";
  if (d.toName) return d.toName;
  if (d.toType === "admin") return d.toDistrictName ? d.toDistrictName + " (Admin)" : "District Admin";
  return d.toLocationName || d.toDistrictName || "—";
}

function __distStatusMeta(s) {
  const map = {
    pending: { label: "Pending", cls: "status-badge status-low" },
    completed: { label: "Completed", cls: "status-badge status-ok" },
    rejected: { label: "Rejected", cls: "status-badge status-out" },
  };
  return map[s] || { label: (s || "Pending").replace(/^./, c => c.toUpperCase()), cls: "cat-badge" };
}

function __distActionableBy(d) {
  if (!d || !currentUser || d.status !== "pending") return false;
  if (isDevAdmin()) return true;
  if (d.toDistrictId !== activeDistrictId) return false;
  if (d.toType === "admin") return currentUser.role === "admin" && currentUser.districtId === d.toDistrictId;
  if (d.toUserId && currentUser.id === d.toUserId) return true;
  if (d.toLocationId && currentUser.locationId === d.toLocationId) return true;
  const loc = getLocationsForDistrict(d.toDistrictId).find(l => l.id === d.toLocationId);
  if (loc && loc.type === "district" && currentUser.districtId === d.toDistrictId) return true;
  if (isAdmin() && currentUser.districtId === d.toDistrictId) {
    const candidates = unitUserCandidates(d.toDistrictId, d.toLocationId);
    if (!candidates.autoId) return true;
  }
  return false;
}

function __distItemRowObjects(list) {
  const out = [];
  list.forEach(d => {
    const items = (d.items && d.items.length)
      ? d.items
      : [{ key: "i0", itemName: d.itemName || "Item", qty: Number(d.quantity) || 0, categoryName: d.categoryName || "", condition: d.condition || "any" }];
    items.forEach((it, i) => out.push({ d, it, key: d.id + ":" + (it.key || ("i" + i)) }));
  });
  return out;
}

function __distType() {
  const c = $("#distTypeCons");
  return (c && c.checked) ? "cons" : "stock";
}
function __distResetRowsForType() {
  const body = $("#distItemsBody");
  if (!body) return;
  body.innerHTML = "";
  __distRowSeq = 0;
  addDistRow();
}
function __distType() {
  const c = $("#distTypeCons");
  return (c && c.checked) ? "cons" : "stock";
}
function __distResetRowsForType() {
  const body = $("#distItemsBody");
  if (!body) return;
  body.innerHTML = "";
  __distRowSeq = 0;
  addDistRow();
}
let __distRowSeq = 0;
function __distRowHtml(key) {
  const cats = __distType() === "cons" ? getConsCats() : getCategories();
  return `<div class="fd-item-row dist-item-row" data-key="${key}" data-dtype="${__distType()}">
    <select class="fd-row-cat"><option value="">Category *</option>${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
    <div class="fd-name-wrap">
      <select class="fd-row-item" disabled><option value="">Select a category first...</option></select>
      <input type="text" class="fd-row-newname hidden" placeholder="New item name..." autocomplete="off">
    </div>
    <div class="dist-stock-info"></div>
    <div class="as-cond-qtys dist-cond-qtys">
      <span class="as-cq"><label>Good</label><input type="number" class="fd-row-qty-good" min="0" value="0"></span>
      <span class="as-cq"><label>Damaged</label><input type="number" class="fd-row-qty-poor" min="0" value="0"></span>
      
    </div>
    <button type="button" class="fd-row-remove" data-action="dist-row-remove" title="Remove item">&times;</button>
  </div>`;
}

function __distPopulateRowItems(row) {
  if (!row) return;
  const catSel = row.querySelector(".fd-row-cat");
  const itemSel = row.querySelector(".fd-row-item");
  const newName = row.querySelector(".fd-row-newname");
  const cid = (catSel || {}).value || "";
  newName.classList.add("hidden"); newName.value = "";
  if (!cid) {
    itemSel.disabled = true;
    itemSel.innerHTML = `<option value="">Select a category first...</option>`;
    __distUpdateRowInfo(row);
    return;
  }
  if (__distType() === "cons") {
    const names = __byName([...new Set(getConsItems().filter(i => i.categoryId === cid && !i.isDeleted).map(i => i.name))].filter(Boolean), x => x);
    itemSel.disabled = false;
    itemSel.innerHTML = `<option value="">Select item</option>` + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    __distUpdateRowInfo(row);
    return;
  }
  const names = __byName([...new Set(getItemsForDistrict(activeDistrictId).filter(i => i.categoryId === cid && !i.isDeleted).map(i => i.name))].filter(Boolean), x => x);
  itemSel.disabled = false;
  itemSel.innerHTML = `<option value="">Select item</option>` + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("") + `<option value="__new__">&#10133; New item...</option>`;
  __distUpdateRowInfo(row);
}

function __distUpdateRowInfo(row) {
  const info = row.querySelector(".dist-stock-info");
  if (!info) return;
  const sel = row.querySelector(".fd-row-item");
  const v = sel ? sel.value : "";
  if (!v) { info.innerHTML = ""; return; }
  if (__distType() === "cons") {
    const ci = getConsItems().find(i => i.name.toLowerCase() === v.toLowerCase());
    if (!ci) { info.innerHTML = `<small style="color:var(--muted)">Consumable item info not found.</small>`; return; }
    const q = __consQty(ci.id);
    info.innerHTML = `<small>Available <b>${q.available}</b> &middot; Pending <b>${q.pending}</b> &middot; Distributed <b>${q.distributed}</b></small>`;
    return;
  }
  if (v === "__new__") { info.innerHTML = `<small style="color:var(--muted)">New item — stock will be created at 0 here.</small>`; return; }
  const it = getItemsForDistrict(activeDistrictId).find(i => i.name.toLowerCase() === v.toLowerCase());
  const cc = it ? (it.conditionCounts || { good: it.quantity || 0, poor: 0, damaged: 0 }) : { good: 0, poor: 0, damaged: 0 };
  const total = Math.max(0, cc.good || 0) + Math.max(0, cc.poor || 0) + Math.max(0, cc.damaged || 0);
  info.innerHTML = `<small>Total <b>${total}</b> &middot; Good <b>${cc.good || 0}</b> &middot; Damaged <b>${cc.poor || 0}</b> &middot; Scrap <b>${cc.damaged || 0}</b></small>`;
}

function addDistRow() {
  const body = $("#distItemsBody");
  if (!body) return;
  body.insertAdjacentHTML("beforeend", __distRowHtml("k" + (++__distRowSeq)));
  const n = body.querySelector(".fd-item-row:last-child .fd-row-cat");
  if (n) n.focus();
}

const __distToChecked = new Set(); // indices into __distReceiverOptions()
function __distRenderChecks(query) {
  const box = $("#distToChecksList");
  if (!box) return;
  const opts = __distReceiverOptions();
  const val = (query || "").trim().toLowerCase();
  const shown = opts.map((o, i) => ({ o, i })).filter(x => !val || x.o.label.toLowerCase().includes(val));
  box.innerHTML = `<label class="dist-check-item"><input type="checkbox" class="dist-check-all"> <b>All</b></label>` +
    `<label class="dist-check-item"><input type="checkbox" class="dist-check-none"> <b>All Deselect</b></label>` +
    shown.map(x => `<label class="dist-check-item"><input type="checkbox" class="dist-check-one" value="${x.i}"${__distToChecked.has(x.i) ? " checked" : ""}> ${esc(x.o.label)}</label>`).join("");
}

function __distUpdateToLabel() {
  const btn = $("#distToDropBtn");
  if (!btn) return;
  const opts = __distReceiverOptions();
  const names = [...__distToChecked].sort((a, b) => a - b).map(i => ((opts[i] || {}).label || "").replace(/^\[(UNIT|ADMIN)\] /, "")).filter(Boolean);
  btn.textContent = !names.length ? "Select recipients..." : (names.length <= 2 ? names.join(", ") : names.length + " selected");
}

function __distSelectedTargets() {
  const opts = __distReceiverOptions();
  return [...__distToChecked].sort((a, b) => a - b).map(i => opts[i]).filter(Boolean);
}

function openDistributionModal() {
  if (!currentUser) return toast("Please login first.", "error");
  // devadmin may open to VIEW; saving is blocked inside saveDistribution.
  __distToChecked.clear();
  __distRenderChecks("");
  const ddSearch = $("#distToSearch");
  if (ddSearch) ddSearch.value = "";
  __distUpdateToLabel();
  const ddPanel = $("#distToChecks");
  if (ddPanel) ddPanel.classList.add("hidden");
  const rm = $("#distRemarks");
  if (rm) rm.value = "";
  const body = $("#distItemsBody");
  if (body) body.innerHTML = "";
  addDistRow();
  openModal("#distributionModal");
}

function __distFindFromItem(d, it) {
  const items = getItemsForDistrict(d.fromDistrictId);
  let found = it.fromItemId ? items.find(i => i.id === it.fromItemId) : null;
  if (found && found.name.toLowerCase() !== it.itemName.toLowerCase()) found = null;
  if (!found) {
    found = items.find(i => i.locationId === it.fromLocationId && i.name.toLowerCase() === it.itemName.toLowerCase())
      || items.find(i => i.name.toLowerCase() === it.itemName.toLowerCase());
  }
  return found || null;
}

function __distHasStock(item, condition, qty) {
  if (!item) return 0;
  const cc = item.conditionCounts || { good: item.quantity || 0, poor: 0, damaged: 0 };
  if (condition === "good" || condition === "poor" || condition === "damaged") return Math.max(0, cc[condition] || 0);
  return Math.max(0, (cc.good || 0)) + Math.max(0, (cc.poor || 0)) + Math.max(0, (cc.damaged || 0));
}

/* Dry-run availability check across every item in a distribution. */
function __distSimulate(d) {
  for (const it of (d.items || [])) {
    const q = Number(it.qty) || 0;
    if (q <= 0) return `Quantity must be above 0 for "${it.itemName}".`;
    const src = __distFindFromItem(d, it);
    if (!src) return `Source item "${it.itemName}" could not be found in the sender district.`;
    const avail = __distHasStock(src, it.condition, q);
    if (avail < q) return `Only ${avail} unit(s) of "${it.itemName}" available at the sender; cannot distribute ${q}.`;
  }
  return null;
}

/* Execute the stock transfer: deduct from sender, add (find-or-create) to receiver. */
function __distApplyTransfer(d, items) {
  for (const it of (d.items || [])) {
    const q = Number(it.qty) || 0;
    const src = __distFindFromItem(d, it);
    if (!src) return false;
    let cc = src.conditionCounts || { good: src.quantity || 0, poor: 0, damaged: 0 };
    let remaining = q;
    const order = it.condition === "good" || it.condition === "poor" || it.condition === "damaged" ? [it.condition] : ["good", "poor", "damaged"];
    for (const c of order) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, cc[c] || 0);
      cc[c] = (cc[c] || 0) - take;
      remaining -= take;
    }
    if (remaining > 0) return false;
    src.conditionCounts = cc;
    src.quantity = Math.max(0, (cc.good || 0)) + Math.max(0, (cc.poor || 0)) + Math.max(0, (cc.damaged || 0));
    src.updatedAt = Date.now();

    const toList = getItemsForDistrict(d.toDistrictId);
    let dst = toList.find(i => i.name.toLowerCase() === String(it.itemName).toLowerCase() && (!d.toLocationId || i.locationId === d.toLocationId));
    if (!dst) {
      dst = {
        id: uid(), name: it.itemName, categoryId: it.categoryId || "", unit: it.unit || "pcs",
        quantity: 0, minStock: 0, locationId: d.toLocationId || "",
        conditionCounts: { good: 0, poor: 0, damaged: 0 }, createdAt: Date.now(),
      };
      toList.push(dst);
    }
    const dcc = dst.conditionCounts || { good: 0, poor: 0, damaged: 0 };
    const targetCond = it.condition === "good" || it.condition === "poor" || it.condition === "damaged" ? it.condition : "good";
    dcc[targetCond] = (dcc[targetCond] || 0) + q;
    dst.conditionCounts = dcc;
    dst.quantity = Math.max(0, (dcc.good || 0)) + Math.max(0, (dcc.poor || 0)) + Math.max(0, (dcc.damaged || 0));
    dst.updatedAt = Date.now();
    it.toItemId = dst.id;
  }
  const all = getAllItems();
  all[d.fromDistrictId] = getItemsForDistrict(d.fromDistrictId);
  all[d.toDistrictId] = getItemsForDistrict(d.toDistrictId);
  saveAllItems(all);
  return true;
}

async function saveDistribution(e) {
  e.preventDefault();
  if (!currentUser) return toast("Please login first.", "error");
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const targets = __distSelectedTargets();
  if (!targets.length) return toast("Tick at least one unit / district admin in Distributed To.", "error");
  const body = $("#distItemsBody");
  const rows = body ? Array.from(body.querySelectorAll(".fd-item-row")) : [];
  const cleanRows = rows.filter(r => {
    const sel = r.querySelector(".fd-row-item");
    const newName = r.querySelector(".fd-row-newname");
    const name = (((sel || {}).value || "") === "__new__" ? (newName ? newName.value : "") : ((sel || {}).value || "")).trim();
    const qg = parseInt((r.querySelector(".fd-row-qty-good") || {}).value, 10) || 0;
    const qp = parseInt((r.querySelector(".fd-row-qty-poor") || {}).value, 10) || 0;
    const qd = parseInt((r.querySelector(".fd-row-qty-damaged") || {}).value, 10) || 0;
    return name || qg || qp || qd;
  });
  if (!cleanRows.length) return toast("Add at least one item to distribute.", "error");

  const consMode = (__distType() === "cons");
  const cats = consMode ? getConsCats() : getCategories();
  const planned = [];
  let warn = "";
  const need = {};
  cleanRows.forEach(r => {
    const catId = (r.querySelector(".fd-row-cat") || {}).value || "";
    const sel = r.querySelector(".fd-row-item");
    const newName = r.querySelector(".fd-row-newname");
    const selV = (sel || {}).value || "";
    const name = (selV === "__new__" ? (newName ? newName.value : "") : selV).trim();
    const qg = parseInt((r.querySelector(".fd-row-qty-good") || {}).value, 10) || 0;
    const qp = parseInt((r.querySelector(".fd-row-qty-poor") || {}).value, 10) || 0;
    const qd = parseInt((r.querySelector(".fd-row-qty-damaged") || {}).value, 10) || 0;
    const cat = cats.find(c => c.id === catId);
    if (!name || !catId || qg + qp + qd <= 0) { warn = "__bad__"; return; }
    const fromItem = consMode ? null : getItemsForDistrict(activeDistrictId).find(i => i.name.toLowerCase() === name.toLowerCase());
    const rowTotal = qg + qp + qd;
    need[name] = (need[name] || 0) + rowTotal * targets.length;
    const avail = consMode ? 999999 : (fromItem ? __distHasStock(fromItem, "any", rowTotal) : 0);
    if (avail < need[name]) warn += `"${name}": available ${avail}, total requested ${need[name]} (${targets.length} recipient(s)).\n`;
    planned.push({ row: r, catId, cat, name, qg, qp, qd, fromItem });
  });
  if (warn === "__bad__") return toast("Har item ke liye category, item name aur kam se kam ek quantity above 0 chahiye.", "error");
  if (warn && !confirm("Available stock check:\n" + warn + "\nSubmit anyway?")) return;

  const fromDist = getDistricts().find(dd => dd.id === activeDistrictId);
  const fromLocId = getVisibleLocationId() || (currentUser ? currentUser.locationId : "");
  const fromLoc = getLocations().find(l => l.id === fromLocId);
  const remarks = $("#distRemarks") ? $("#distRemarks").value.trim() : "";

  // Newly typed item that has no record yet: create a catalog entry (zero
  // stock) in the sender district so it shows up in the item list next time.
  let catalogAdded = 0;
  planned.forEach(p => {
    if (p.fromItem) return;
    const existing = getItemsForDistrict(activeDistrictId).find(i => i.name.toLowerCase() === p.name.toLowerCase());
    if (existing) { p.fromItem = existing; return; }
    const created = {
      id: uid(), name: p.name, categoryId: p.catId, unit: "pcs",
      quantity: 0, minStock: 0, locationId: fromLocId,
      conditionCounts: { good: 0, poor: 0, damaged: 0 }, createdAt: Date.now(),
    };
    getItemsForDistrict(activeDistrictId).push(created);
    p.fromItem = created;
    catalogAdded++;
  });
  if (catalogAdded) saveAllItems(getAllItems());

  let __distAtts = [];
  if ((__attStore.dist || []).length) { try { __distAtts = await __attUploadAll("dist"); } catch (e) { return; } }
  const list = getDistributions();
  let created = 0;
  for (const target of targets) {
    const items = [];
    planned.forEach(p => {
      [["good", p.qg], ["poor", p.qp], ["damaged", p.qd]].forEach(([cond, q]) => {
        if (q <= 0) return;
        items.push({
          key: "i" + items.length,
          itemName: p.name, qty: q, condition: cond,
          categoryId: p.catId, categoryName: p.cat ? p.cat.name : "Other",
          unit: p.fromItem ? p.fromItem.unit : "pcs",
          fromItemId: p.fromItem ? p.fromItem.id : "",
          fromLocationId: p.fromItem ? p.fromItem.locationId : "",
          toItemId: null,
        });
      });
    });
    const targetDist = getDistricts().find(dd => dd.id === target.districtId);
    const targetLoc = getLocationsForDistrict(target.districtId).find(l => l.id === target.locationId);
    let receiver = null;
    if (target.type === "unit") {
      const res = resolveUnitAssignee(target.districtId, target.locationId);
      receiver = getUsers().find(u => u.id === res.autoId) || null;
    } else {
      receiver = getUsers().find(u => u.districtId === target.districtId && u.role === "admin") || null;
    }
    const d = {
      id: uid(),
      distNo: nextDistNo(),
      remarks,
      fromDistrictId: activeDistrictId,
      fromDistrictName: fromDist ? fromDist.name : "",
      fromLocationId: fromLocId,
      fromLocationName: fromLoc ? fromLoc.name : "",
      fromUserId: currentUser ? currentUser.id : null,
      fromUserName: currentUser ? currentUser.name : "User",
      toType: target.type,
      toDistrictId: target.districtId,
      toDistrictName: targetDist ? targetDist.name : "",
      toName: target.type === "admin" ? (targetDist ? targetDist.name : "") + " (Admin)" : (targetLoc ? targetLoc.name : ""),
      toLocationId: target.locationId,
      toLocationName: targetLoc ? targetLoc.name : "",
      toUserId: receiver ? receiver.id : null,
      toUserName: receiver ? receiver.name : "",
      items,
      attachments: __distAtts,
      status: "pending",
      approveRemark: "", approvedBy: "", approvedAt: null,
      rejectRemark: "", rejectedBy: "", rejectedAt: null,
      createdAt: Date.now(),
      updatedAt: null,
    };
    list.push(d);
    created++;
    const itemSummary = items.map(x => x.qty + " x " + x.itemName + " (" + x.condition + ")").join(", ");
    __audit("Distribution Created", `${itemSummary} to ${__distReceiverName(d)}`, { entity: "Distribution" });
    addNotification(d.toDistrictId, {
      type: "distribution_received",
      title: "New Distribution",
      message: `${d.fromUserName} distributed ${itemSummary} to ${__distReceiverName(d)}.`,
      fromDistrictId: activeDistrictId,
      distributionId: d.id,
      targetUserId: d.toUserId || null,
      targetLocId: d.toLocationId || null,
    });
  }
  saveDistributions(list);
  __attStore.dist = []; __attRender("dist");

  toast(`Distribution submitted for ${created} recipient(s).`, "success");
  closeModals();
  render();
}

let __actDistStoreId = null;
let __actDistId = null;

function __setActDist(id) {
  const d = (window.__distSnapshot || {})[id] || __allVisibleDistributions().find(x => x.id === id);
  if (d) { __actDistStoreId = d.__storeId || d.fromDistrictId || activeDistrictId; __actDistId = d.id; return d; }
  return null;
}

function __getActDistribution() {
  const storeId = __actDistStoreId || activeDistrictId;
  const list = (loadData(`distributions_${storeId}`) || []);
  const d = list.find(x => x.id === __actDistId);
  if (d) d.__storeId = storeId;
  return d;
}

function __distSummaryHtml(d) {
  const meta = __distStatusMeta(d.status);
  return `<div class="demand-detail-grid">
    <div class="demand-detail-item"><span class="dd-label">Distribution No</span><span class="dd-value">${esc(d.distNo || "DIST-")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Distributed By</span><span class="dd-value">${esc(d.fromUserName || "—")}${d.fromLocationName ? ' <span style="color:var(--muted);font-size:.75rem">(' + esc(d.fromLocationName) + ")</span>" : ""}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Distributed To</span><span class="dd-value">${esc(__distReceiverName(d))}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Status</span><span class="dd-value"><span class="${meta.cls}">${meta.label}</span></span></div>
    <div class="demand-detail-item"><span class="dd-label">Date</span><span class="dd-value">${new Date(d.createdAt).toLocaleString("en-IN")}</span></div>
    ${d.remarks ? `<div class="demand-detail-item dd-full"><span class="dd-label">Sender Remark</span><span class="dd-value">${esc(d.remarks)}</span></div>` : ""}
  </div>`;
}

function __distItemsSummaryHtml(d) {
  return `<div class="table-wrap" style="margin-top:4px">
    <table>
      <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Condition</th></tr></thead>
      <tbody>${(d.items || []).map(it => `<tr><td>${__ipLinkByName(it.itemName)}</td><td>${esc(it.categoryName || "—")}</td><td>${it.qty}</td><td>${esc(it.condition)}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function openDistApprove(id) {
  let d = __getActDistribution();
  if (!d || d.id !== id) d = __setActDist(id);
  if (!d) return toast("Distribution record could not be found.", "error");
  if (!__distActionableBy(d)) return toast("You are not authorised to approve this distribution.", "error");
  if (d.status !== "pending") return toast("This distribution is no longer pending.", "error");
  const rm = $("#distApproveRemark");
  if (rm) rm.value = "";
  $("#distApproveSummary").innerHTML = __distSummaryHtml(d) + __distItemsSummaryHtml(d);
  openModal("#distApproveModal");
}

function approveDistribution() {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const d = __getActDistribution();
  if (!d) return toast("Distribution record could not be found.", "error");
  if (!__distActionableBy(d)) return toast("You are not authorised to approve this distribution.", "error");
  if (d.status !== "pending") return toast("This distribution is no longer pending.", "error");
  const stockIssue = __distSimulate(d);
  if (stockIssue) return toast(stockIssue, "error");
  const remarkEl = $("#distApproveRemark");
  const remark = remarkEl ? remarkEl.value.trim() : "";
  const reviewer = currentUser ? currentUser.name : "Receiver";

  const storeId = d.__storeId || d.fromDistrictId || activeDistrictId;
  const list = (loadData(`distributions_${storeId}`) || []);
  const fresh = list.find(x => x.id === d.id);
  if (!fresh || fresh.status !== "pending") { __actDistStoreId = null; __actDistId = null; return toast("This distribution is no longer pending.", "error"); }

  const ok = __distApplyTransfer(fresh, getAllItems());
  if (!ok) return toast("Stock transfer could not be completed. No changes were saved.", "error");

  fresh.status = "completed";
  fresh.approveRemark = remark;
  fresh.approvedBy = reviewer;
  fresh.approvedAt = Date.now();
  fresh.updatedAt = Date.now();
  __saveDistributionsFor(storeId, list);

  const itemSummary = (fresh.items || []).map(x => x.qty + " x " + x.itemName).join(", ");
  __audit("Distribution Approved", `${itemSummary} by ${__distReceiverName(fresh)}`, { entity: "Distribution" });
  addNotification(fresh.fromDistrictId, {
    type: "distribution_approved",
    title: "Distribution Approved",
    message: `${fresh.toUserName || reviewer} approved ${itemSummary}${remark ? " - " + remark : ""}.`,
    fromDistrictId: activeDistrictId,
    distributionId: fresh.id,
    targetUserId: fresh.fromUserId || null,
    targetLocId: fresh.fromLocationId || null,
  });
  toast("Distribution approved. Stock has been transferred.", "success");
  closeModals();
  __actDistStoreId = null;
  __actDistId = null;
  render();
}

function openDistReject(id) {
  let d = __getActDistribution();
  if (!d || d.id !== id) d = __setActDist(id);
  if (!d) return toast("Distribution record could not be found.", "error");
  if (!__distActionableBy(d)) return toast("You are not authorised to reject this distribution.", "error");
  if (d.status !== "pending") return toast("This distribution is no longer pending.", "error");
  const rm = $("#distRejectRemark");
  if (rm) rm.value = "";
  $("#distRejectSummary").innerHTML = __distSummaryHtml(d) + __distItemsSummaryHtml(d);
  const btn = $("#distRejectSubmitBtn");
  if (btn) btn.disabled = true;
  openModal("#distRejectModal");
}

function doDistReject(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const d = __getActDistribution();
  if (!d) return toast("Distribution record could not be found.", "error");
  if (!__distActionableBy(d)) return toast("You are not authorised to reject this distribution.", "error");
  if (d.status !== "pending") return toast("This distribution is no longer pending.", "error");
  const remarkEl = $("#distRejectRemark");
  const remark = remarkEl ? remarkEl.value.trim() : "";
  if (!remark) return toast("Rejection remark is required.", "error");
  const reviewer = currentUser ? currentUser.name : "Receiver";

  const storeId = d.__storeId || d.fromDistrictId || activeDistrictId;
  const list = (loadData(`distributions_${storeId}`) || []);
  const fresh = list.find(x => x.id === d.id);
  if (!fresh || fresh.status !== "pending") { __actDistStoreId = null; __actDistId = null; return toast("This distribution is no longer pending.", "error"); }

  fresh.status = "rejected";
  fresh.rejectRemark = remark;
  fresh.rejectedBy = reviewer;
  fresh.rejectedAt = Date.now();
  fresh.updatedAt = Date.now();
  __saveDistributionsFor(storeId, list);

  const itemSummary = (fresh.items || []).map(x => x.qty + " x " + x.itemName).join(", ");
  __audit("Distribution Rejected", `${itemSummary} by ${__distReceiverName(fresh)} - ${remark}`, { entity: "Distribution" });
  addNotification(fresh.fromDistrictId, {
    type: "distribution_rejected",
    title: "Distribution Rejected",
    message: `${fresh.toUserName || reviewer} rejected ${itemSummary}. Reason: ${remark}`,
    fromDistrictId: activeDistrictId,
    distributionId: fresh.id,
    targetUserId: fresh.fromUserId || null,
    targetLocId: fresh.fromLocationId || null,
  });
  toast("Distribution rejected.", "success");
  closeModals();
  __actDistStoreId = null;
  __actDistId = null;
  render();
}

function openDistributionDetail(id) {
  let d = __getActDistribution();
  if (!d || d.id !== id) d = __setActDist(id);
  if (!d) return toast("Distribution record could not be found.", "error");
  $("#distDetailTitle").textContent = "Distribution Details - " + (d.distNo || "DIST-");
  $("#distDetailInfo").innerHTML = __distSummaryHtml(d) + attachmentChipsHtml(d);
  $("#distDetailItems").innerHTML = (d.items || []).map(it =>
    `<tr><td>${__ipLinkByName(it.itemName)}</td><td>${esc(it.categoryName || "—")}</td><td>${it.qty}</td><td>${esc(it.condition)}</td><td>${it.fromLocationId ? esc((getLocations().find(l => l.id === it.fromLocationId) || {}).name || it.fromLocationId) : "—"}</td></tr>`
  ).join("") || `<tr class="empty-row"><td colspan="5">No items.</td></tr>`;
  const dec = [];
  if (d.approvedAt) dec.push(`<div class="dd-item"><div class="dd-item-head">Approved by ${esc(d.approvedBy || "—")} on ${new Date(d.approvedAt).toLocaleString("en-IN")}</div>${d.approveRemark ? `<div class="dd-item-body">Note: ${esc(d.approveRemark)}</div>` : ""}</div>`);
  if (d.rejectedAt) dec.push(`<div class="dd-item"><div class="dd-item-head">Rejected by ${esc(d.rejectedBy || "—")} on ${new Date(d.rejectedAt).toLocaleString("en-IN")}</div><div class="dd-item-body">Reason: ${esc(d.rejectRemark || "—")}</div></div>`);
  if (!dec.length) dec.push(`<div class="dd-item"><div class="dd-item-body">No decision yet.</div></div>`);
  $("#distDetailDecisions").innerHTML = dec.join("");
  openModal("#distDetailModal");
}

function __distFiltered() {
  const all = __allVisibleDistributions();
  const q = ($("#distSearch") || {}).value || "";
  const statusFilter = ($("#distStatusFilter") || {}).value || "";
  const dateFrom = ($("#distDateFrom") || {}).value;
  const dateTo = ($("#distDateTo") || {}).value;
  return __distItemRowObjects(all).filter(r => {
    const d = r.d, it = r.it;
    if (statusFilter && d.status !== statusFilter) return false;
    if (q) {
      const hay = [it.itemName, it.categoryName, d.distNo || "DIST-", d.fromUserName, __distReceiverName(d)].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (dateFrom && d.createdAt < new Date(dateFrom).getTime()) return false;
    if (dateTo && d.createdAt >= new Date(dateTo).getTime() + 86400000) return false;
    return true;
  }).sort((a, b) => b.d.createdAt - a.d.createdAt);
}

function renderDistribution() {
  const filtered = __distFiltered();
  const tbody = $("#distBody");
  if (!tbody) return;
  const snap = {};
  filtered.forEach(r => { snap[r.d.id] = r.d; });
  window.__distSnapshot = snap;

  if (filtered.length) {
    const page = __pgPage("dist", filtered.length);
    const start = page * PAGE_SIZE;
    const rows = __pgRows("dist", filtered);
    tbody.innerHTML = rows.map((r, idx) => {
      const d = r.d, it = r.it;
      const meta = __distStatusMeta(d.status);
      const sender = d.fromUserName + (d.fromLocationName ? ' <span style="display:block;color:var(--muted);font-size:.72rem">' + esc(d.fromLocationName) + "</span>" : "");
      const receiver = __distReceiverName(d);
      const actionable = d.status === "pending" && __distActionableBy(d);
      let btns = "";
      if (actionable) {
        btns = `<button type="button" class="btn btn-sm btn-green" data-action="dist-approve" data-id="${d.id}">Approve</button> <button type="button" class="btn btn-sm btn-red" data-action="dist-reject" data-id="${d.id}">Reject</button>`;
      } else if (d.status === "pending") {
        btns = `<span style="font-size:.72rem;color:var(--amber)">Awaiting recipient</span>`;
      }
      btns += ` <button type="button" class="btn btn-sm btn-outline" data-action="dist-details" data-id="${d.id}">Details</button>`;
      return `<tr data-dist-id="${d.id}"><td>${start + idx + 1}</td><td class="item-name">${nameCell(it.itemName)}</td><td>${esc(it.categoryName || "—")}</td><td class="qty-strong">${it.qty}</td><td>${sender}</td><td>${esc(receiver)}</td><td><span class="${meta.cls}">${meta.label}</span></td><td>${new Date(d.createdAt).toLocaleDateString("en-IN")}</td><td class="actions-cell">${btns}</td></tr>`;
    }).join("");
  } else {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No distributions found. Click "+ Distribute Items" to distribute stock.</td></tr>`;
  }
  renderPager("dist", filtered.length, renderDistribution);
  const counts = { total: 0, pending: 0, completed: 0, rejected: 0 };
  __allVisibleDistributions().forEach(d => {
    counts.total++;
    if (d.status === "completed") counts.completed++;
    else if (d.status === "pending") counts.pending++;
    else if (d.status === "rejected") counts.rejected++;
  });
  const setTxt = (id, v) => { const el = $("#" + id); if (el) el.textContent = v; };
  setTxt("statTotalDist", counts.total);
  setTxt("statCompletedDist", counts.completed);
  setTxt("statPendingDist", counts.pending);
  setTxt("statRejectedDist", counts.rejected);
  updateDistDot();
}

function __distExportData() {
  const rows = __distFiltered().map(r => {
    const d = r.d, it = r.it;
    const meta = __distStatusMeta(d.status);
    const remark = d.status === "rejected" ? d.rejectRemark : d.status === "completed" ? d.approveRemark : d.remarks || "";
    return [
      d.distNo || "",
      it.itemName,
      it.categoryName || "",
      it.qty,
      it.condition || "any",
      d.fromUserName + (d.fromLocationName ? " (" + d.fromLocationName + ")" : ""),
      __distReceiverName(d),
      meta.label,
      new Date(d.createdAt).toLocaleDateString("en-IN"),
      remark,
    ];
  });
  const dist = getDistricts().find(dd => dd.id === activeDistrictId);
  return {
    title: "Distribution Report",
    subtitle: (dist ? dist.name + " - " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " row" + (rows.length === 1 ? "" : "s") + ")",
    cols: ["Dist No", "Item", "Category", "Qty", "Condition", "Distributed By", "Distributed To", "Status", "Date", "Remark"],
    rows,
    fileName: "distribution-report"
  };
}

function printDistributionReport() { printReport(__distExportData()); }
function exportDistExcel() { excelReport(__distExportData()); toast("Excel exported.", "success"); }
function exportDistWord() { wordReport(__distExportData()); toast("Word document exported.", "success"); }
function exportDistPDF() { pdfReport(__distExportData()); toast("PDF exported.", "success"); }

/* ---- Distribution stat cards (mirror the dashboard stat detail pattern) ---- */
const __DIST_STAT_COLS = ["Dist No", "Item", "Category", "Qty", "Condition", "Distributed By", "Distributed To", "Status", "Date", "Remark"];

function __distStatRows(list) {
  return __distItemRowObjects(list).map(r => {
    const d = r.d, it = r.it;
    const meta = __distStatusMeta(d.status);
    const remark = d.status === "rejected" ? d.rejectRemark : d.status === "completed" ? d.approveRemark : d.remarks || "";
    return [
      d.distNo || "",
      it.itemName,
      it.categoryName || "",
      it.qty,
      it.condition || "any",
      d.fromUserName + (d.fromLocationName ? " (" + d.fromLocationName + ")" : ""),
      __distReceiverName(d),
      meta.label,
      new Date(d.createdAt).toLocaleDateString("en-IN"),
      remark,
    ];
  });
}

const __DIST_STAT_BUILDERS = {
  total: () => {
    const list = __allVisibleDistributions();
    return { title: "All Distributions", cols: __DIST_STAT_COLS, rows: __distStatRows(list) };
  },
  completed: () => {
    const list = __allVisibleDistributions().filter(d => d.status === "completed");
    return { title: "Completed Distributions", cols: __DIST_STAT_COLS, rows: __distStatRows(list) };
  },
  pending: () => {
    const list = __allVisibleDistributions().filter(d => d.status === "pending");
    return { title: "Pending Distributions", cols: __DIST_STAT_COLS, rows: __distStatRows(list) };
  },
  rejected: () => {
    const list = __allVisibleDistributions().filter(d => d.status === "rejected");
    return { title: "Rejected Distributions", cols: __DIST_STAT_COLS, rows: __distStatRows(list) };
  },
};

function openDistStatDetail(key) {
  const def = __DIST_STAT_BUILDERS[key] ? __DIST_STAT_BUILDERS[key]() : null;
  if (!def) return;
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  __statDetail = {
    title: def.title,
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + def.rows.length + " distribution" + (def.rows.length === 1 ? "" : "s") + ")",
    cols: def.cols,
    rows: def.rows,
    fileName: "distributions-" + key
  };
  __statFilter = "";
  $("#statDetailTitle").textContent = def.title;
  $("#statDetailSubtitle").textContent = __statDetail.subtitle;
  $("#statDetailHead").innerHTML = "<tr>" + def.cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const s = $("#statSearch");
  if (s) s.value = "";
  renderStatDetail("");
  openModal("#statDetailModal");
}

function getDistDotCount() {
  if (!activeDistrictId || !currentUser) return 0;
  let n = 0;
  __allVisibleDistributions().forEach(d => { if (__distActionableBy(d)) n++; });
  return n;
}

function updateDistDot() {
  const dot = $("#distDot");
  if (!dot) return;
  const n = getDistDotCount();
  dot.style.display = n > 0 ? "inline-block" : "none";
  dot.textContent = n > 9 ? "9+" : n;
}

/* ==================== MAINTENANCE MODULE ==================== */
const MAINT_TYPE_LABELS = {
  plumber: "Plumber",
  electrician: "Electrician",
  carpenter: "Carpenter",
  mason: "Mason / Civil Work",
  computer_it: "Computer / IT",
  vehicle: "Vehicle",
  other: "Other",
};

function __maintRouteTarget(typeVal) {
  const role = typeVal === "computer_it" ? "itstaff" : typeVal === "vehicle" ? "mtostaff" : null;
  if (!role) return null;
  return getUsers().find(u => u.role === role && u.districtId === activeDistrictId) || null;
}

function __maintUpdateRequestTo() {
  const typeVal = ($("#maintType") || {}).value || "";
  const admin = getUsers().find(u => u.districtId === activeDistrictId && u.role === "admin");
  const routed = __maintRouteTarget(typeVal);
  const rt = $("#maintRequestTo");
  if (rt) rt.value = routed
    ? (routed.name || routed.username) + (routed.role === "itstaff" ? " (Computer/IT Staff)" : " (MTO Staff)")
    : (admin ? "District Admin \u2014 " + (admin.name || admin.username) : "\u2014");
}

function __maintTypeLabel(r) {
  if (!r) return "—";
  if (r.maintenanceType === "other" && r.customType) return r.customType;
  return MAINT_TYPE_LABELS[r.maintenanceType] || r.customType || r.maintenanceType || "Other";
}

function __maintDateLabel(d) {
  if (!d) return "—";
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return d; }
}

function __maintTimeLabel(t) {
  if (!t) return "—";
  try {
    const parts = String(t).split(":");
    const d = new Date();
    d.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return t; }
}

function __maintStatusMeta(s) {
  const map = {
    pending: { label: "Pending", cls: "status-badge status-low" },
    under_process: { label: "Under Process", cls: "status-badge status-info" },
    completed: { label: "Completed", cls: "status-badge status-ok" },
  };
  return map[s] || { label: (s || "Pending").replace(/^./, c => c.toUpperCase()).replace(/_/g, " "), cls: "cat-badge" };
}

function getMaintenance() {
  if (!activeDistrictId) return [];
  return loadData(`maintenance_${activeDistrictId}`) || [];
}

function __maintenanceInStore(districtId) {
  if (!districtId) return [];
  return (loadData(`maintenance_${districtId}`) || []).map(x => ({ ...x, __storeId: districtId }));
}

function __allVisibleMaintenance() {
  if (!activeDistrictId) return [];
  if (currentUser && (currentUser.role === "itstaff" || currentUser.role === "mtostaff")) {
    return __maintenanceInStore(currentUser.districtId || activeDistrictId).filter(x => x.requestToUserId === currentUser.id || x.requestingUserId === currentUser.id);
  }
  const list = __maintenanceInStore(activeDistrictId);
  const locId = getVisibleLocationId();
  if (!locId) return list;
  return list.filter(x => x.requestingUnitId === locId);
}

function saveMaintenance(list) {
  if (!activeDistrictId) return;
  saveData(`maintenance_${activeDistrictId}`, list);
}

function __saveMaintenanceFor(districtId, list) {
  if (!districtId) return;
  saveData(`maintenance_${districtId}`, list);
}

function nextMaintNo() {
  let seq = Number(loadData("maintSeq")) || 0;
  seq += 1;
  saveData("maintSeq", seq);
  return "MR-" + String(seq).padStart(6, "0");
}

function __maintCanCreate() {
  // Every signed-in role can raise maintenance requests (units, District
  // Admin, Computer/IT Staff, MTO Staff). Routing decides who receives them.
  return !!currentUser;
}

function __maintActionableBy(r) {
  if (!r || !currentUser) return false;
  if (isDevAdmin()) return true;
  if ((currentUser.role === "itstaff" || currentUser.role === "mtostaff") && r.status === "pending") {
    return r.districtId === currentUser.districtId && r.requestToUserId === currentUser.id;
  }
  if (r.status === "pending") {
    return currentUser.role === "admin" && r.requestToDistrictAdminId === currentUser.id;
  }
  if (r.status === "under_process") {
    return r.requestingUnitId === (getVisibleLocationId() || currentUser.locationId) && r.districtId === activeDistrictId;
  }
  return false;
}

function __maintActionableLabel(r) {
  return r && r.status === "completed" ? "Mark as Completed" : (r && r.status === "pending" ? "Process" : "Approve");
}

/* ---- create form + photos ---- */
const MAINT_PHOTO_MAX = 4;
const MAINT_PHOTO_LIMIT = 4 * 1024 * 1024;
let __maintPhotos = []; // {id, name, mime, size, dataUrl}

/* The full, unrestricted list of maintenance types, kept in code as well as in
   the markup. __maintApplyTypeOptions() re-renders the dropdown from this when
   the list has to be narrowed, so the options never have to be parsed back out
   of the DOM and the two copies cannot drift apart. */
const __MAINT_TYPE_OPTIONS_HTML = '<option value="">Select type...</option>'
  + '<option value="plumber">Plumber</option>'
  + '<option value="electrician">Electrician</option>'
  + '<option value="carpenter">Carpenter</option>'
  + '<option value="mason">Mason / Civil Work</option>'
  + '<option value="computer_it">Computer / IT</option>'
  + '<option value="vehicle">Vehicle</option>'
  + '<option value="other">Other</option>';


/* Which maintenance types this account may raise.
   A request is routed by type: Computer/IT goes to the district's IT staff
   account and Vehicle to its MTO staff account. Every other type falls back to
   the District Admin - so for a District Admin it would be a request sent to
   themselves, sitting in their own queue with nobody able to act on it. They
   are therefore limited to the two types that actually reach somebody.
   Everyone else - units, IT staff, MTO staff - raises from their own unit and
   keeps the full list. The server enforces the same rule; this only keeps the
   form from offering a choice that is going to be refused. */
const __MAINT_ADMIN_TYPES = ["computer_it", "vehicle"];
function __maintAllowedTypes() {
  return currentUser && currentUser.role === "admin" ? __MAINT_ADMIN_TYPES : null;
}
function __maintTypeAllowed(type) {
  const allowed = __maintAllowedTypes();
  return !allowed || !type || allowed.indexOf(type) >= 0;
}
function __maintTypeRefusal(type) {
  const shown = type === "other" && ($("#maintTypeOther") || {}).value
    ? '"' + String($("#maintTypeOther").value).trim() + '"'
    : (type ? '"' + type + '"' : "that type");
  return "A District Admin can only raise a Computer/IT or a Vehicle maintenance request, "
    + "because any other type is routed back to the District Admin themselves. "
    + "Please raise " + shown + " from the requesting unit instead, or change the type.";
}
// Narrows the type dropdown to exactly what this account may pick. For a
// District Admin the other types are not shown at all rather than shown and
// greyed out: a list of choices that cannot be chosen is a worse answer than a
// short list. The dropdown is restored to the full list for everyone else, so
// signing in as a different role in the same tab does not leave it short.
function __maintApplyTypeOptions() {
  const sel = $("#maintType");
  if (!sel) return;
  const allowed = __maintAllowedTypes();
  if (!allowed) {
    if (sel.dataset.narrowed === "1") {
      sel.innerHTML = __MAINT_TYPE_OPTIONS_HTML;
      delete sel.dataset.narrowed;
    }
    return;
  }
  // The labels are read out of the full list rather than typed again here, so
  // renaming a type in one place renames it in both.
  const label = (v) => {
    const m = __MAINT_TYPE_OPTIONS_HTML.match(new RegExp('<option value="' + v + '">([^<]*)</option>'));
    return m ? m[1] : v;
  };
  sel.dataset.narrowed = "1";
  sel.innerHTML = '<option value="">Select type...</option>'
    + allowed.map(v => '<option value="' + v + '">' + label(v) + '</option>').join("");
  sel.value = "";
}

function openMaintenanceModal() {
  if (!currentUser) return toast("Please login first.", "error");
  if (!__maintCanCreate()) return toast("Only requesting units can raise maintenance requests.", "error");
  const admin = getUsers().find(u => u.districtId === activeDistrictId && u.role === "admin");
  if (!admin) return toast("No District Admin is configured for this district yet. Contact the Developer Admin.", "error");
  const locId = getVisibleLocationId() || currentUser.locationId;
  const loc = getLocations().find(l => l.id === locId);
  if (!loc) return toast("Your unit location could not be found. Contact the Developer Admin.", "error");
  const rt = $("#maintRequestTo"), rb = $("#maintRequestingBy");
  const type = $("#maintType");
  __maintApplyTypeOptions();
  if (type) type.value = "";
  __maintUpdateRequestTo();
  if (rb) rb.value = (currentUser.name || currentUser.username) + (loc ? " \u2014 " + loc.name : "");
      const $maintTypeOtherField = document.getElementById("maintTypeOther");
      if ($maintTypeOtherField) { $maintTypeOtherField.classList.add("hidden"); $maintTypeOtherField.value = ""; }
  $("#maintTypeOtherWrap")?.classList.add("hidden");
  const d = $("#maintDesc"); if (d) d.value = "";
  __maintPhotos = [];
  __maintRenderPhotoPreviews();
  openModal("#maintenanceModal");
  setTimeout(() => { if (type) type.focus(); }, 60);
}

function __maintRenderPhotoPreviews() {
  const box = $("#maintPhotoPreview");
  if (!box) return;
  const cnt = document.getElementById("attCount_maint");
  if (cnt) cnt.textContent = __maintPhotos.length + (__maintPhotos.length === 1 ? " file" : " files");
  box.innerHTML = __maintPhotos.map(p => {
    const isImg = String(p.mime || "").toLowerCase().startsWith("image/");
    return `<div class="att-thumb" title="${esc(p.name)}">` +
      (isImg ? `<img src="${p.dataUrl}" alt="">` : `<div class="att-file-icon">&#128196;</div><div class="att-thumb-name">${esc(p.name)}</div>`) +
      `<button type="button" class="att-thumb-x" data-maint-photo-remove="${p.id}" title="Remove">&times;</button></div>`;
  }).join("");
}

function __maintReadPhotoFiles(files) {
  if (!files || !files.length) return;
  for (const f of Array.from(files)) {
    const type = (f.type || "").toLowerCase();
    if (!type.startsWith("image/")) { toast(`"${f.name}" is not an image file. Only photos can be attached.`, "error"); continue; }
    if (f.size > MAINT_PHOTO_LIMIT) { toast(`"${f.name}" is too large (max 4MB).`, "error"); continue; }
    if (__maintPhotos.some(p => p.name === f.name && p.size === f.size)) { toast(`"${f.name}" is already attached.`, "error"); continue; }
    const reader = new FileReader();
    reader.onload = () => {
      __maintPhotos.push({ id: uid(), name: f.name, mime: f.type, size: f.size, dataUrl: String(reader.result) });
      __maintRenderPhotoPreviews();
    };
    reader.onerror = () => toast(`Could not read "${f.name}".`, "error");
    reader.readAsDataURL(f);
  }
}

function __maintRemovePhoto(id) {
  __maintPhotos = __maintPhotos.filter(p => p.id !== id);
  __maintRenderPhotoPreviews();
}

/* ---- Attachments (any format): Raise Demand / Distribute / Issue / Add Stock ---- */
const ATT_MAX = 4;
const ATT_LIMIT = 4 * 1024 * 1024;
const __attStore = { demand: [], dist: [], issue: [], stock: [] };
let __attCtx = "";
function __attRender(ctx) {
  const box = document.getElementById("attPreview_" + ctx);
  if (!box) return;
  const list = __attStore[ctx] || [];
  const cnt = document.getElementById("attCount_" + ctx);
  if (cnt) cnt.textContent = list.length + (list.length === 1 ? " file" : " files");
  box.innerHTML = list.map(p => {
    const isImg = String(p.mime || "").toLowerCase().startsWith("image/");
    return `<div class="att-thumb" data-att-view="${p.id}" data-att-name="${esc(p.name)}" title="${esc(p.name)}">` +
      (isImg ? `<img src="${p.dataUrl}" alt="">` : `<div class="att-file-icon">&#128196;</div><div class="att-thumb-name">${esc(p.name)}</div>`) +
      `<button type="button" class="att-thumb-x" data-att-remove="${p.id}" data-att-ctx="${ctx}" title="Remove">&times;</button></div>`;
  }).join("");
}
function __attPick(ctx, files) {
  if (!__attStore[ctx]) __attStore[ctx] = [];
  for (const f of Array.from(files || [])) {
    if (f.size > ATT_LIMIT) { toast(`"${f.name}" is too large (max 4MB).`, "error"); continue; }
    if (__attStore[ctx].some(p => p.name === f.name && p.size === f.size)) { toast(`"${f.name}" is already attached.`, "error"); continue; }
    const reader = new FileReader();
    reader.onload = () => { __attStore[ctx].push({ id: uid(), name: f.name, mime: f.type || "application/octet-stream", size: f.size, dataUrl: String(reader.result) }); __attRender(ctx); };
    reader.onerror = () => toast(`Could not read "${f.name}".`, "error");
    reader.readAsDataURL(f);
  }
}
async function __attUploadAll(ctx) {
  const out = [];
  for (const p of (__attStore[ctx] || [])) {
    if (!p.dataUrl) continue;
    try { out.push(await __stockUploadPhoto(p)); }
    catch (e) { toast(`"${p.name}" could not be uploaded. Please try again.`, "error"); throw e; }
  }
  return out;
}
function __dataUrlMime(u) { const m = /^data:([^;,]+)/.exec(u || ""); return m ? m[1].toLowerCase() : ""; }
async function __openDataUrl(u, name) {
  if (!u) return toast("Attachment could not be loaded.", "error");
  if (__dataUrlMime(u).startsWith("image/")) {
    $("#maintLightboxImg").src = u;
    $("#maintLightbox").classList.remove("hidden");
    return;
  }
  try {
    const blob = await (await fetch(u)).blob();
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) { const a = document.createElement("a"); a.href = url; a.download = name || "attachment"; a.click(); }
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
  } catch (e) { toast("Attachment could not be opened.", "error"); }
}
let __camStream = null, __camCtx = "", __camFacing = "environment";
function __attTargetPush(ctx, photo) {
  if (ctx === "maint") { __maintPhotos.push(photo); __maintRenderPhotoPreviews(); return; }
  if (ctx === "as" || ctx.indexOf("as:") === 0) {
    const key = ctx.slice(3);
    (__asPhotos[key] = __asPhotos[key] || []).push(photo);
    const row = document.querySelector(`.as-item-row[data-key="${key}"]`);
    if (row) __asRenderThumbs(row);
    return;
  }
  if (ctx.indexOf("cons:") === 0) {
    const key = ctx.slice(5);
    (__consRowPhotos[key] = __consRowPhotos[key] || []).push(photo);
    const row = document.querySelector(`.cons-item-row[data-key="` + key + `"]`);
    if (row) __consRenderThumbs(row);
    return;
  }
  if (!__attStore[ctx]) __attStore[ctx] = [];
  __attStore[ctx].push(photo);
  __attRender(ctx);
}
async function openCam(ctx) {
  __camCtx = ctx;
  __camFacing = "environment";
  openModal("#camModal");
  const hint = $("#camHint");
  hint.textContent = "Starting camera…";
  hint.classList.remove("hidden");
  try {
    __camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: __camFacing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    $("#camVideo").srcObject = __camStream;
    hint.classList.add("hidden");
  } catch (e) {
    hint.textContent = "Camera not available — choose a file instead.";
    closeCamOnly();
    const fi = document.getElementById("camFallbackInput");
    if (fi) fi.click();
  }
}
function closeCamOnly() {
  if (__camStream) { try { __camStream.getTracks().forEach(t => t.stop()); } catch (e) {} __camStream = null; }
  const v = $("#camVideo");
  if (v) v.srcObject = null;
}
function snapCam() {
  const v = $("#camVideo");
  if (!v || !v.videoWidth) return toast("Camera is not ready yet.", "error");
  const c = document.createElement("canvas");
  const scale = Math.min(1, 1600 / v.videoWidth);
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.88);
  __attTargetPush(__camCtx, { id: uid(), name: "camera-" + Date.now() + ".jpg", mime: "image/jpeg", size: Math.round(dataUrl.length * 0.75), dataUrl });
  const fl = $("#camFlash");
  if (fl) { fl.classList.remove("cam-flash-go"); void fl.offsetWidth; fl.classList.add("cam-flash-go"); }
  toast("Photo captured.", "success");
}
document.addEventListener("click", (e) => {
  const camBtn = e.target.closest("[data-att-cam]");
  if (camBtn) { openCam(camBtn.dataset.attCam); return; }
  if (e.target.closest("#camCaptureBtn")) { snapCam(); return; }
  if (e.target.closest("#camDoneBtn") || e.target.closest("#camCloseBtn")) { closeCamOnly(); $("#camModal").classList.add("hidden"); return; }
  if (e.target.closest("#camSwitchBtn")) { __camFacing = __camFacing === "environment" ? "user" : "environment"; closeCamOnly(); openCam(__camCtx); return; }
});
document.addEventListener("change", (e) => {
  const fi = e.target.closest("#camFallbackInput");
  if (fi && fi.files && fi.files[0]) {
    const f = fi.files[0];
    const reader = new FileReader();
    reader.onload = () => { __attTargetPush(__camCtx, { id: uid(), name: f.name, mime: f.type || "image/jpeg", size: f.size, dataUrl: String(reader.result) }); toast("Photo added.", "success"); };
    reader.readAsDataURL(f);
    fi.value = "";
  }
});
async function openAttView(id, name) {
  let dataUrl = null;
  const local = __scanStoreLoad().find(x => x.id === id);
  if (local && local.dataUrl) dataUrl = local.dataUrl;
  if (!dataUrl && window.CONFIG && window.CONFIG.useRemote) {
    try { const rr = await __api("GET", "scanfile/" + id); if (rr && rr.dataUrl) dataUrl = rr.dataUrl; } catch (e) {}
  }
  if (!dataUrl) {
    for (const k of Object.keys(__attStore)) {
      const p = (__attStore[k] || []).find(x => x.id === id);
      if (p && p.dataUrl) { dataUrl = p.dataUrl; break; }
    }
  }
  if (!dataUrl) return toast("Attachment could not be loaded.", "error");
  return __openDataUrl(dataUrl, name);
}
function attachmentChipsHtml(rec) {
  const atts = Array.isArray(rec && rec.attachments) ? rec.attachments : [];
  if (!atts.length) return "";
  return `<div class="demand-detail-item dd-full" style="margin-top:6px"><span class="dd-label">Attachments</span><span class="dd-value">${atts.map(a => `<button type="button" class="hist-photo-chip" data-att-view="${a.id}" data-att-name="${esc(a.fileName || "file")}" title="${esc(a.fileName || "Attachment")}">&#128206; ${esc(a.fileName || "file")}</button>`).join(" ")}</span></div>`;
}
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-att-add]");
  if (add) { __attCtx = add.dataset.attAdd; const i = document.getElementById("attFileInput"); if (i) i.click(); return; }
  const rm = e.target.closest("[data-att-remove]");
  if (rm) { const ctx = rm.dataset.attCtx, id = rm.dataset.attRemove; __attStore[ctx] = (__attStore[ctx] || []).filter(p => p.id !== id); __attRender(ctx); return; }
  const vw = e.target.closest("[data-att-view]");
  if (vw) { openAttView(vw.dataset.attView, vw.dataset.attName || "attachment"); }
});
document.addEventListener("change", (e) => {
  const input = e.target.closest("#attFileInput");
  if (input) { __attPick(__attCtx, input.files); input.value = ""; }
});

async function saveMaintenanceRequest(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!currentUser) return toast("Please login first.", "error");
  if (!__maintCanCreate()) return toast("You are not authorised to create maintenance requests.", "error");
  const typeVal = ($("#maintType") || {}).value || "";
  const customType = typeVal === "other" ? (($("#maintTypeOther") || {}).value || "").trim() : "";
  const desc = (($("#maintDesc") || {}).value || "").trim();
  const date = "";
  const time = "";
  const remark = "";

  const admin = getUsers().find(u => u.districtId === activeDistrictId && u.role === "admin");
  if (!admin) return toast("District Admin for this district not configured.", "error");
  const routed = __maintRouteTarget(typeVal);
  const locId = getVisibleLocationId() || currentUser.locationId;
  const loc = getLocations().find(l => l.id === locId);
  if (!loc) return toast("Your unit location could not be found.", "error");
  if (!typeVal) return toast("Please select a maintenance type.", "error");
  // Checked here as well as in the dropdown, because the dropdown only stops a
  // type being picked - it cannot stop a form that was already open when the
  // account changed, or a value put there by anything else.
  if (!__maintTypeAllowed(typeVal)) return toast(__maintTypeRefusal(typeVal), "error");
  if (typeVal === "other" && !customType) return toast('Please specify the maintenance type under "Other".', "error");
  if (!desc) return toast("Please describe the maintenance required.", "error");
  if (desc.length < 10) return toast("Description should be at least 10 characters long.", "error");
  if (__maintPhotos.length > MAINT_PHOTO_MAX) return toast("Maximum " + MAINT_PHOTO_MAX + " photos allowed.", "error");

  const btn = $("#maintSubmitBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Submitting..."; }
  try {
    const storedPhotos = [];
    for (const p of __maintPhotos) {
      if (!p.dataUrl) continue;
      if (window.CONFIG && window.CONFIG.useRemote) {
        try {
          await __api("POST", "scanfile", { id: p.id, dataUrl: p.dataUrl });
        } catch (err) {
          toast(`Photo "${p.name}" could not be uploaded. Please try again.`, "error");
          throw new Error("photo-upload-failed");
        }
      }
      storedPhotos.push({ id: p.id, fileName: p.name, mimeType: p.mime, fileSize: p.size });
    }

    const now = Date.now();
    const r = {
      id: uid(),
      mntNo: nextMaintNo(),
      districtId: activeDistrictId,
      districtName: (getDistricts().find(dd => dd.id === activeDistrictId) || {}).name || "",
      requestingUnitId: locId,
      requestingUnitName: loc.name,
      requestingUserId: currentUser.id,
      requestingUserName: currentUser.name || currentUser.username,
      requestToDistrictAdminId: admin.id,
      requestToDistrictAdminName: admin.name || admin.username,
      requestToUserId: routed ? routed.id : admin.id,
      requestToUserName: routed ? (routed.name || routed.username) : (admin.name || admin.username),
      requestToUserRole: routed ? routed.role : "admin",
      maintenanceType: typeVal,
      customType: typeVal === "other" ? customType : "",
      description: desc,
      requestedDate: date,
      requestedTime: time,
      remark,
      photos: storedPhotos,
      status: "pending",
      processedBy: "", processedAt: null,
      completedBy: "", completedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [{ action: "created", by: currentUser.name || currentUser.username, byId: currentUser.id, at: now, oldStatus: null, newStatus: "pending", remark: "" }],
    };

    getMaintenance().push(r);
    saveMaintenance(getMaintenance());

    __audit("Maintenance Request Created", `${r.mntNo} \u2014 ${__maintTypeLabel(r)} (${r.requestingUnitName}) to ${r.requestToUserName || r.requestToDistrictAdminName}`, { entity: "Maintenance" });
    addNotification(r.districtId, {
      type: "maintenance_received",
      title: "New Maintenance Request",
      message: `New maintenance request ${r.mntNo} from ${r.requestingUnitName}: ${__maintTypeLabel(r)} on ${__maintDateLabel(date)} at ${__maintTimeLabel(time)}.`,
      fromDistrictId: r.districtId,
      maintenanceId: r.id,
      targetUserId: r.requestToUserId || r.requestToDistrictAdminId,
      targetLocId: null,
    });

    toast("Maintenance request submitted successfully!", "success");
    closeModals();
    __maintPhotos = [];
    render();
  } catch (err) {
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Submit Request"; }
  }
}

/* ---- process / approve transitions ---- */
let __actMaintStoreId = null;
let __actMaintId = null;

function __setActMaint(id) {
  const r = (window.__maintSnapshot || {})[id] || __allVisibleMaintenance().find(x => x.id === id);
  if (r) { __actMaintStoreId = r.__storeId || r.districtId || activeDistrictId; __actMaintId = r.id; return r; }
  return null;
}

function __getActMaintenance() {
  const storeId = __actMaintStoreId || activeDistrictId;
  const list = (loadData(`maintenance_${storeId}`) || []);
  const r = list.find(x => x.id === __actMaintId);
  if (r) r.__storeId = storeId;
  return r;
}

function __maintSnapshotClear() { __actMaintStoreId = null; __actMaintId = null; }

function __maintSummaryHtml(r) {
  const meta = __maintStatusMeta(r.status);
  const tz = (ts) => ts ? new Date(ts).toLocaleString("en-IN") : "\u2014";
  return `<div class="demand-detail-grid">
    <div class="demand-detail-item"><span class="dd-label">Request ID</span><span class="dd-value">${esc(r.mntNo || "MR-")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Request To</span><span class="dd-value">${esc(r.requestToUserName || r.requestToDistrictAdminName || "\u2014")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Requesting Unit</span><span class="dd-value">${esc(r.requestingUnitName || "\u2014")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Requested By</span><span class="dd-value">${esc(r.requestingUserName || "\u2014")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Maintenance Type</span><span class="dd-value">${esc(__maintTypeLabel(r))}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Status</span><span class="dd-value"><span class="${meta.cls}">${meta.label}</span></span></div>
    <div class="demand-detail-item"><span class="dd-label">Requested Date</span><span class="dd-value">${__maintDateLabel(r.requestedDate)}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Requested Time</span><span class="dd-value">${__maintTimeLabel(r.requestedTime)}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Created At</span><span class="dd-value">${tz(r.createdAt)}</span></div>
    ${r.processedAt ? `<div class="demand-detail-item"><span class="dd-label">Processed At</span><span class="dd-value">${esc(r.processedBy || "")} \u00b7 ${tz(r.processedAt)}</span></div>` : ""}
    ${r.completedAt ? `<div class="demand-detail-item"><span class="dd-label">Completed At</span><span class="dd-value">${esc(r.completedBy || "")} \u00b7 ${tz(r.completedAt)}</span></div>` : ""}
    <div class="demand-detail-item dd-full"><span class="dd-label">Description</span><span class="dd-value">${esc(r.description || "\u2014")}</span></div>
    ${r.remark ? `<div class="demand-detail-item dd-full"><span class="dd-label">Remark</span><span class="dd-value">${esc(r.remark)}</span></div>` : ""}
  </div>`;
}

const __MAINT_PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="10" fill="#e2e8f0"/><text x="60" y="60" font-family="Arial" font-size="12" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Loading\u2026</text></svg>');

function __maintThumbsHtml(r, clickable) {
  const photos = Array.isArray(r.photos) ? r.photos : [];
  if (!photos.length) return `<span class="maint-photo-empty">No photos attached.</span>`;
  return photos.map((p, i) =>
    `<div class="maint-photo-thumb" data-maint-photo-view="${p.id}" ${clickable ? 'style="cursor:zoom-in"' : ""}>
      <img src="${__MAINT_PLACEHOLDER}" alt="${esc(p.fileName || "Photo")}" data-photo-id="${p.id}">
      <span class="maint-photo-name">${esc(p.fileName || ("Photo " + (i + 1)))}</span>
    </div>`).join("");
}

function __maintBindPhotoLoads(scope) {
  const root = typeof scope === "string" ? $(scope) : (scope || document);
  if (!root) return;
  root.querySelectorAll("img[data-photo-id]").forEach(img => {
    const pid = img.dataset.photoId;
    if (!pid || img.dataset.loaded) return;
    img.dataset.loaded = "1";
    let done = false;
    if (window.CONFIG && window.CONFIG.useRemote) {
      __api("GET", "scanfile/" + pid).then(rr => {
        if (rr && rr.dataUrl) { img.src = rr.dataUrl; done = true; }
      }).catch(() => {});
    }
    setTimeout(() => {
      if (!done) {
        const ph = __maintPhotos.find(p => p.id === pid);
        if (ph && ph.dataUrl) img.src = ph.dataUrl;
      }
    }, 400);
  });
}

async function openMaintPhotoView(photoId) {
  if (!photoId) return;
  let dataUrl = null;
  if (window.CONFIG && window.CONFIG.useRemote) {
    try {
      const rr = await __api("GET", "scanfile/" + photoId);
      if (rr && rr.dataUrl) dataUrl = rr.dataUrl;
    } catch (e) { /* fall through */ }
  }
  const ph = __maintPhotos.find(p => p.id === photoId);
  if (!dataUrl && ph) dataUrl = ph.dataUrl;
  if (!dataUrl) return toast("Photo could not be loaded.", "error");
  return __openDataUrl(dataUrl, "photo");
}

function closeMaintLightbox() {
  const lb = $("#maintLightbox");
  if (lb) lb.classList.add("hidden");
  const img = $("#maintLightboxImg");
  if (img) img.src = "";
}

function openMaintProcess(id) {
  let r = __getActMaintenance();
  if (!r || r.id !== id) r = __setActMaint(id);
  if (!r) return toast("Maintenance request could not be found.", "error");
  if (!__maintActionableBy(r)) return toast("You are not authorised to process this request.", "error");
  if (r.status !== "pending") return toast("This request is no longer pending.", "error");
  const rm = $("#maintProcessRemark");
  if (rm) rm.value = "";
  $("#maintProcessSummary").innerHTML = __maintSummaryHtml(r);
  $("#maintProcessPhotos").innerHTML = __maintThumbsHtml(r, true);
  openModal("#maintProcessModal");
  setTimeout(() => __maintBindPhotoLoads("#maintProcessPhotos"), 50);
}

function submitMaintProcess(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const r = __getActMaintenance();
  if (!r) return toast("Maintenance request could not be found.", "error");
  if (!__maintActionableBy(r)) return toast("You are not authorised to process this request.", "error");
  if (r.status !== "pending") return toast("This request is no longer pending.", "error");
  const remark = (($("#maintProcessRemark") || {}).value || "").trim();
  const storeId = r.__storeId || r.districtId || activeDistrictId;
  const list = (loadData(`maintenance_${storeId}`) || []);
  const fresh = list.find(x => x.id === r.id);
  if (!fresh || fresh.status !== "pending") { __maintSnapshotClear(); return toast("This request is no longer pending.", "error"); }
  const now = Date.now();
  fresh.status = "under_process";
  fresh.remark = remark || fresh.remark || "";
  fresh.processedBy = currentUser ? currentUser.name : "Admin";
  fresh.processedAt = now;
  fresh.updatedAt = now;
  if (!Array.isArray(fresh.history)) fresh.history = [];
  fresh.history.push({ action: "processed", by: currentUser ? currentUser.name : "Admin", byId: currentUser ? currentUser.id : null, at: now, oldStatus: "pending", newStatus: "under_process", remark });
  __saveMaintenanceFor(storeId, list);
  __audit("Maintenance Request Processed", `${fresh.mntNo} \u2014 ${fresh.requestingUnitName} marked under process by ${fresh.processedBy}.`, { entity: "Maintenance" });
  addNotification(fresh.districtId, {
    type: "maintenance_processed",
    title: "Maintenance Under Process",
    message: `Maintenance request ${fresh.mntNo} (${fresh.requestingUnitName}) is now under process by ${fresh.processedBy}.`,
    fromDistrictId: fresh.districtId,
    maintenanceId: fresh.id,
    targetUserId: null,
    targetLocId: fresh.requestingUnitId,
  });
  toast("Maintenance request marked as under process.", "success");
  closeModals();
  __maintSnapshotClear();
  render();
}

function openMaintApprove(id) {
  let r = __getActMaintenance();
  if (!r || r.id !== id) r = __setActMaint(id);
  if (!r) return toast("Maintenance request could not be found.", "error");
  if (!__maintActionableBy(r)) return toast("You are not authorised to approve this request.", "error");
  if (r.status !== "under_process") return toast("This request is not under process.", "error");
  const rm = $("#maintApproveRemark");
  if (rm) rm.value = "";
  $("#maintApproveSummary").innerHTML = __maintSummaryHtml(r);
  $("#maintApprovePhotos").innerHTML = __maintThumbsHtml(r, true);
  openModal("#maintApproveModal");
  setTimeout(() => __maintBindPhotoLoads("#maintApprovePhotos"), 50);
}

function submitMaintApprove(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const r = __getActMaintenance();
  if (!r) return toast("Maintenance request could not be found.", "error");
  if (!__maintActionableBy(r)) return toast("You are not authorised to approve this request.", "error");
  if (r.status !== "under_process") return toast("This request is not under process.", "error");
  const remark = (($("#maintApproveRemark") || {}).value || "").trim();
  const storeId = r.__storeId || r.districtId || activeDistrictId;
  const list = (loadData(`maintenance_${storeId}`) || []);
  const fresh = list.find(x => x.id === r.id);
  if (!fresh || fresh.status !== "under_process") { __maintSnapshotClear(); return toast("This request is no longer under process.", "error"); }
  const now = Date.now();
  fresh.status = "completed";
  fresh.completedBy = currentUser ? currentUser.name : "Unit";
  fresh.completedAt = now;
  fresh.updatedAt = now;
  if (!Array.isArray(fresh.history)) fresh.history = [];
  fresh.history.push({ action: "completed", by: currentUser ? currentUser.name : "Unit", byId: currentUser ? currentUser.id : null, at: now, oldStatus: "under_process", newStatus: "completed", remark });
  __saveMaintenanceFor(storeId, list);
  __audit("Maintenance Request Completed", `${fresh.mntNo} \u2014 completed by ${fresh.completedBy}.`, { entity: "Maintenance" });
  addNotification(fresh.districtId, {
    type: "maintenance_completed",
    title: "Maintenance Completed",
    message: `Maintenance request ${fresh.mntNo} (${fresh.requestingUnitName}) has been completed by ${fresh.completedBy}.`,
    fromDistrictId: fresh.districtId,
    maintenanceId: fresh.id,
    targetUserId: fresh.requestToUserId || fresh.requestToDistrictAdminId,
    targetLocId: null,
  });
  toast("Maintenance request marked as completed.", "success");
  closeModals();
  __maintSnapshotClear();
  render();
}

/* ---- details + timeline ---- */
function __maintTimelineHtml(r) {
  const hist = (Array.isArray(r.history) && r.history.length) ? [...r.history].reverse() : [];
  if (!hist.length) return `<div class="dd-history-empty">No activity recorded yet.</div>`;
  return hist.map(h => {
    const label = String(h.action || "update").charAt(0).toUpperCase() + String(h.action || "update").slice(1);
    const arrow = h.oldStatus ? __maintStatusMeta(h.oldStatus).label + " \u2192 " + __maintStatusMeta(h.newStatus).label : "";
    const note = [arrow, h.remark].filter(Boolean).join(h.oldStatus ? " \u00b7 " : "");
    return `<div class="dd-history-item">
      <span class="dd-history-ts">${new Date(h.at).toLocaleString("en-IN")}</span>
      <span class="dd-history-action">${esc(label)}</span>
      <span class="dd-history-text">${esc(note)} ${esc(h.by || "")}</span>
    </div>`;
  }).join("");
}

function openMaintenanceDetail(id) {
  let r = __getActMaintenance();
  if (!r || r.id !== id) r = __setActMaint(id);
  if (!r) return toast("Maintenance request could not be found.", "error");
  $("#maintDetailTitle").textContent = "Maintenance Request Details - " + (r.mntNo || "MR-");
  $("#maintDetailInfo").innerHTML = __maintSummaryHtml(r);
  $("#maintDetailPhotos").innerHTML = (Array.isArray(r.photos) && r.photos.length)
    ? r.photos.map((p, i) =>
        `<div class="maint-detail-photo" data-maint-photo-view="${p.id}" title="View photo">
          <img src="${__MAINT_PLACEHOLDER}" alt="${esc(p.fileName || "Photo")}" data-photo-id="${p.id}">
          <span class="maint-detail-photo-name">${esc(p.fileName || ("Photo " + (i + 1)))}</span>
        </div>`).join("")
    : `<div class="maint-photo-empty">No photos attached.</div>`;
  $("#maintDetailTimeline").innerHTML = __maintTimelineHtml(r);
  openModal("#maintDetailModal");
  setTimeout(() => __maintBindPhotoLoads("#maintDetailPhotos"), 50);
}

/* ---- filtering + rendering ---- */
function __maintFiltered() {
  const all = __allVisibleMaintenance();
  const q = ($("#maintSearch") || {}).value || "";
  const statusFilter = ($("#maintStatusFilter") || {}).value || "";
  const typeFilter = ($("#maintTypeFilter") || {}).value || "";
  const dateFrom = ($("#maintDateFrom") || {}).value;
  const dateTo = ($("#maintDateTo") || {}).value;
  return all.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter && r.maintenanceType !== typeFilter) return false;
    if (q) {
      const hay = [r.mntNo || "MR-", r.requestingUnitName, __maintTypeLabel(r), r.description, r.requestToUserName || r.requestToDistrictAdminName, r.requestingUserName, r.requestedDate].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (dateFrom && r.createdAt < new Date(dateFrom).getTime()) return false;
    if (dateTo && r.createdAt >= new Date(dateTo).getTime() + 86400000) return false;
    return true;
  }).sort((a, b) => b.createdAt - a.createdAt);
}

function renderMaintenance() {
const filtered = __maintFiltered();
const tbody = $("#maintBody");
if (!tbody) return;
// Every signed-in role gets "+ New Request" (units, District Admin, Computer/IT + MTO staff).
const addMaintBtn = document.getElementById("addMaintenanceBtn");
if (addMaintBtn) {
  if (__maintCanCreate()) addMaintBtn.classList.remove("hidden");
  else addMaintBtn.classList.add("hidden");
}
  const snap = {};
  filtered.forEach(r => { snap[r.id] = r; });
  window.__maintSnapshot = snap;

  if (filtered.length) {
    const rows = __pgRows("maint", filtered);
    tbody.innerHTML = rows.map(r => {
      const meta = __maintStatusMeta(r.status);
      let btns = "";
      if (__maintActionableBy(r)) {
        btns = r.status === "pending"
          ? `<button type="button" class="btn btn-sm btn-primary" data-action="maint-process" data-id="${r.id}">Process</button>`
          : `<button type="button" class="btn btn-sm btn-green" data-action="maint-approve" data-id="${r.id}">Approve</button>`;
      } else if (r.status === "pending") {
        btns = `<span style="font-size:.72rem;color:var(--amber)">Awaiting admin</span>`;
      } else if (r.status === "under_process") {
        btns = `<span style="font-size:.72rem;color:var(--primary)">In progress</span>`;
      }
      btns += ` <button type="button" class="btn btn-sm btn-outline" data-action="maint-details" data-id="${r.id}">Details</button>`;
      return `<tr data-maint-id="${r.id}">
        <td class="item-name"><span style="font-weight:700">${esc(r.mntNo || "MR-")}</span><br><span style="font-size:.72rem;color:var(--muted)">by ${esc(r.requestingUserName || "\u2014")}</span></td>
        <td>${esc(r.requestToUserName || r.requestToDistrictAdminName || "\u2014")}</td>
        <td>${esc(r.requestingUnitName || "\u2014")}</td>
        <td>${esc(__maintTypeLabel(r))}</td>
        <td class="item-name"><span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(r.description)}</span></td>
        <td><span class="${meta.cls}">${meta.label}</span></td>
        <td>${fmtDate(r.createdAt)}</td>
        <td class="actions-cell">${btns}</td>
      </tr>`;
    }).join("");
  } else {
    const unitOnly = !!getVisibleLocationId();
    const emptyText = unitOnly
      ? "No Maintenance Requests found yet. Click \u201c+ New Request\u201d to submit one for your unit."
      : "No Maintenance Requests Received yet.";
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${emptyText}</td></tr>`;
  }
  renderPager("maint", filtered.length, renderMaintenance);
  updateMaintDot();
}

/* ---- export ---- */
function __maintExportData() {
  const rows = __maintFiltered().map(r => {
    const meta = __maintStatusMeta(r.status);
    return [
      r.mntNo || "",
      r.requestToUserName || r.requestToDistrictAdminName || "",
      r.requestingUnitName || "",
      __maintTypeLabel(r),
      r.description,
      meta.label,
      fmtDate(r.createdAt),
      r.remark || "",
    ];
  });
  const dist = getDistricts().find(dd => dd.id === activeDistrictId);
  return {
    title: "Maintenance Requests Report",
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " request" + (rows.length === 1 ? "" : "s") + ")",
    cols: ["Request ID", "Request To", "Requesting Unit", "Request Type", "Description", "Status", "Created At", "Remark"],
    rows,
    fileName: "maintenance-requests"
  };
}

function printMaintReport() { printReport(__maintExportData()); }
function exportMaintExcel() { excelReport(__maintExportData()); toast("Excel exported.", "success"); }
function exportMaintWord() { wordReport(__maintExportData()); toast("Word document exported.", "success"); }
function exportMaintPDF() { pdfReport(__maintExportData()); toast("PDF exported.", "success"); }

function getMaintDotCount() {
  if (!activeDistrictId || !currentUser) return 0;
  let n = 0;
  __allVisibleMaintenance().forEach(r => { if (__maintActionableBy(r)) n++; });
  return n;
}

function updateMaintDot() {
  const dot = $("#maintDot");
  if (!dot) return;
  const n = getMaintDotCount();
  dot.style.display = n > 0 ? "inline-block" : "none";
  dot.textContent = n > 9 ? "9+" : n;
}

function seedDistributions(districtId) {
  const items = getItemsForDistrict(districtId);
  const districts = getDistricts();
  const myLocs = getLocationsForDistrict(districtId);
  const other = districts.find(dd => dd.id !== districtId) || null;
  if (!items.length || !myLocs.length || !other) return;
  const cats = getCategoriesForDistrict(districtId); // per-district map (2026.09.213)
  const fromUser = getUsers().find(u => u.districtId === districtId && u.role === "admin") || getUsers().find(u => u.districtId === districtId) || null;
  const hq = __distHQLocation(districtId);
  const unitLoc = myLocs.find(l => l.type !== "district") || myLocs[0];
  const unitUser = resolveUnitAssignee(districtId, unitLoc.id);
  const pick = () => items[Math.floor(Math.random() * items.length)];
  const daysAgo = n => Date.now() - n * 86400000;

  const mkItem = (it, condition, qty) => ({
    key: "i" + Math.random().toString(36).slice(2, 7),
    itemName: it.name, qty, condition,
    categoryId: it.categoryId, categoryName: (cats.find(c => c.id === it.categoryId) || {}).name || "Other",
    unit: it.unit || "pcs", fromItemId: it.id, fromLocationId: it.locationId, toItemId: null,
  });

  const list = [];
  const itA = pick();
  list.push({
    id: uid(), distNo: nextDistNo(), remarks: "Quarterly deployment distribution.",
    fromDistrictId: districtId, fromDistrictName: (districts.find(dd => dd.id === districtId) || {}).name || "",
    fromLocationId: hq ? hq.id : "", fromLocationName: hq ? hq.name : "",
    fromUserId: fromUser ? fromUser.id : null, fromUserName: fromUser ? fromUser.name : "Admin",
    toType: "unit", toDistrictId: districtId, toDistrictName: (districts.find(dd => dd.id === districtId) || {}).name || "",
    toName: unitLoc.name,
    toLocationId: unitLoc.id, toLocationName: unitLoc.name,
    toUserId: unitUser.autoId, toUserName: unitUser.users.find(u => u.id === unitUser.autoId) ? unitUser.users.find(u => u.id === unitUser.autoId).name : "",
    items: [mkItem(itA, "good", 3)],
    status: "completed",
    approveRemark: "Received in good condition.", approvedBy: unitUser.users.find(u => u.id === unitUser.autoId) ? unitUser.users.find(u => u.id === unitUser.autoId).name : "Unit", approvedAt: daysAgo(6),
    rejectRemark: "", rejectedBy: "", rejectedAt: null,
    createdAt: daysAgo(9), updatedAt: daysAgo(6),
  });

  const itB = pick();
  const partnerAdminUser = getUsers().find(u => u.districtId === other.id && u.role === "admin");
  list.push({
    id: uid(), distNo: nextDistNo(), remarks: "Awaiting acceptance from the unit.",
    fromDistrictId: districtId, fromDistrictName: list[0].fromDistrictName,
    fromLocationId: hq ? hq.id : "", fromLocationName: hq ? hq.name : "",
    fromUserId: fromUser ? fromUser.id : null, fromUserName: fromUser ? fromUser.name : "Admin",
    toType: "admin", toDistrictId: other.id, toDistrictName: (districts.find(dd => dd.id === other.id) || {}).name || "",
    toName: (districts.find(dd => dd.id === other.id) || {}).name + " (Admin)",
    toLocationId: (__distHQLocation(other.id) || { id: "" }).id, toLocationName: (__distHQLocation(other.id) || { name: "" }).name,
    toUserId: partnerAdminUser ? partnerAdminUser.id : null, toUserName: partnerAdminUser ? partnerAdminUser.name : "",
    items: [mkItem(itB, "any", 2)],
    status: "pending",
    approveRemark: "", approvedBy: "", approvedAt: null,
    rejectRemark: "", rejectedBy: "", rejectedAt: null,
    createdAt: daysAgo(1), updatedAt: null,
  });
  saveData(`distributions_${districtId}`, list);

  // For the very first district, plant an INCOMING pending + rejected pair in
  // the partner store so this district can demo Approve/Reject.
  if (districtId === districts[0].id) {
    const partner = other;
    const partnerAdmin = getUsers().find(u => u.districtId === partner.id && u.role === "admin");
    const ownerAdmin = fromUser;
    const cur = loadData(`distributions_${partner.id}`) || [];
    if (!cur.some(x => x.toDistrictId === districtId)) {
      const partnerItems = getItemsForDistrict(partner.id);
      const itC = (partnerItems && partnerItems.length ? partnerItems[Math.floor(Math.random() * partnerItems.length)] : items[0]) || items[0];
      const itD = (partnerItems && partnerItems.length ? partnerItems[Math.floor(Math.random() * partnerItems.length)] : items[0]) || items[0];
      cur.push({
        id: uid(), distNo: nextDistNo(), remarks: "Emergency covering placement.",
        fromDistrictId: partner.id, fromDistrictName: (districts.find(dd => dd.id === partner.id) || {}).name || "",
        fromLocationId: (__distHQLocation(partner.id) || { id: "" }).id, fromLocationName: (__distHQLocation(partner.id) || { name: "" }).name,
        fromUserId: partnerAdmin ? partnerAdmin.id : null, fromUserName: partnerAdmin ? partnerAdmin.name : "Admin",
        toType: "admin", toDistrictId: districtId, toDistrictName: (districts.find(dd => dd.id === districtId) || {}).name || "",
        toName: (districts.find(dd => dd.id === districtId) || {}).name + " (Admin)",
        toLocationId: hq ? hq.id : "", toLocationName: hq ? hq.name : "",
        toUserId: ownerAdmin ? ownerAdmin.id : null, toUserName: ownerAdmin ? ownerAdmin.name : "",
        items: [mkItem(itC, "good", 1)],
        status: "pending",
        approveRemark: "", approvedBy: "", approvedAt: null,
        rejectRemark: "", rejectedBy: "", rejectedAt: null,
        createdAt: daysAgo(2), updatedAt: null,
      });
      cur.push({
        id: uid(), distNo: nextDistNo(), remarks: "",
        fromDistrictId: partner.id, fromDistrictName: (districts.find(dd => dd.id === partner.id) || {}).name || "",
        fromLocationId: (__distHQLocation(partner.id) || { id: "" }).id, fromLocationName: (__distHQLocation(partner.id) || { name: "" }).name,
        fromUserId: partnerAdmin ? partnerAdmin.id : null, fromUserName: partnerAdmin ? partnerAdmin.name : "Admin",
        toType: "admin", toDistrictId: districtId, toDistrictName: (districts.find(dd => dd.id === districtId) || {}).name || "",
        toName: (districts.find(dd => dd.id === districtId) || {}).name + " (Admin)",
        toLocationId: hq ? hq.id : "", toLocationName: hq ? hq.name : "",
        toUserId: ownerAdmin ? ownerAdmin.id : null, toUserName: ownerAdmin ? ownerAdmin.name : "",
        items: [mkItem(itD, "good", 2)],
        status: "rejected",
        approveRemark: "", approvedBy: "", approvedAt: null,
        rejectRemark: "Insufficient storage space at the moment.", rejectedBy: ownerAdmin ? ownerAdmin.name : "District", rejectedAt: daysAgo(4),
        createdAt: daysAgo(5), updatedAt: daysAgo(4),
      });
      saveData(`distributions_${partner.id}`, cur);
    }
  }
}

function __demandStatusMeta(s) {
  const map = {
    pending: { label: "Pending", cls: "status-badge status-low" },
    in_progress: { label: "In Progress", cls: "status-badge status-low" },
    pending_review: { label: "Pending for Review", cls: "status-badge status-warn" },
    partially_completed: { label: "Partial", cls: "status-badge status-warn" },
    completed: { label: "Completed", cls: "status-badge status-ok" },
    rejected: { label: "Rejected", cls: "status-badge status-out" },
    mixed: { label: "Mixed", cls: "status-badge status-warn" },
  };
  return map[s] || { label: s ? s.charAt(0).toUpperCase() + s.slice(1) : "Pending", cls: "cat-badge" };
}

function __itemDisplayMeta(it) {
  if (it && it.reviewStatus === "pending") return { label: "Pending for Review", cls: "status-badge status-warn" };
  return __demandStatusMeta(it.status);
}

function __isRequester(d) {
  if (!d || !currentUser) return false;
  if (d.requestedById && d.requestedById === currentUser.id) return true;
  if (d.requestedFromDistrict === activeDistrictId && d.requestedBy && currentUser.name && d.requestedBy === currentUser.name) return true;
  return false;
}

function __itemActionable(d, it) {
  if (!__demandActionableBy(d)) return false;
  if (it && it.reviewStatus === "pending") return false;
  if (it.status === "pending") return true;
  if (it.status === "partial" && (Number(it.remainingQuantity) || 0) > 0) return true;
  return false;
}

function __demandRowObjects(list) {
  const out = [];
  list.forEach(d => __demandItems(d).forEach((it, i) => out.push({ d, it, key: d.id + ":" + (it.key || ("i" + i)) })));
  return out;
}

function nextDemandNo() {
  let seq = Number(loadData("demandSeq")) || 0;
  seq += 1;
  saveData("demandSeq", seq);
  return "DEM-" + String(seq).padStart(6, "0");
}

function __demandFiltered() {
  const demands = __allVisibleDemands();
  const q = ($("#demandSearch") || {}).value || "";
  const statusFilter = ($("#demandStatusFilter") || {}).value || "";
  const dateFrom = ($("#demandDateFrom") || {}).value;
  const dateTo = ($("#demandDateTo") || {}).value;
  const rows = __demandRowObjects(demands);
  return rows.filter(r => {
    const d = r.d, it = r.it;
    if (statusFilter) {
      if (statusFilter === "in_progress") { if (__demandOverallStatus(d) !== "in_progress") return false; }
      else if (statusFilter === "pending_review") { if (it.reviewStatus !== "pending") return false; }
      else if (it.status !== statusFilter) return false;
    }
    if (q) {
      const hay = [d.itemName, it.itemName, d.demandNo || "DEM-", d.reason || ""].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (dateFrom && d.createdAt < new Date(dateFrom).getTime()) return false;
    if (dateTo && d.createdAt >= new Date(dateTo).getTime() + 86400000) return false;
    return true;
  }).sort((a, b) => b.d.createdAt - a.d.createdAt);
}

function __demandExportData() {
  const dists = getDistricts();
  const rows = __demandFiltered().map(r => {
    const d = r.d, it = r.it;
    const toDist = dists.find(x => x.id === d.demandToDistrict);
    const meta = __itemDisplayMeta(it);
    const toName = (d.assigneeName || (toDist ? toDist.name : d.demandToDistrictName || "\u2014")) + (d.demandToLocationName ? " (" + d.demandToLocationName + ")" : "");
    return [
      d.demandNo || "",
      d.requestedBy,
      toName,
      it.itemName + (it.categoryName ? " [" + it.categoryName + "]" : ""),
      it.quantity,
      meta.label,
      new Date(d.createdAt).toLocaleDateString("en-IN"),
      it.remark || (it.status === "rejected" ? it.rejectionReason : ""),
    ];
  });
  const dist = getDistricts().find(dd => dd.id === activeDistrictId);
  return {
    title: "Demands Report",
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " demand item" + (rows.length === 1 ? "" : "s") + ")",
    cols: ["Demand No", "Requested By", "Requested To", "Item", "Qty", "Status", "Date", "Remark"],
    rows,
    fileName: "demands-report"
  };
}

function printDemandReport() { printReport(__demandExportData()); }
function exportDemandExcel() { excelReport(__demandExportData()); toast("Excel exported.", "success"); }
function exportDemandWord() { wordReport(__demandExportData()); toast("Word document exported.", "success"); }
function exportDemandPDF() { pdfReport(__demandExportData()); toast("PDF exported.", "success"); }

const __DEMAND_COLS = ["Demand No", "Requested By", "Requested To", "Item", "Qty", "Status", "Date"];

function __demandRows(list) {
  const dists = getDistricts();
  const rows = __demandRowObjects(list).sort((a, b) => b.d.createdAt - a.d.createdAt);
  return rows.map(r => {
    const d = r.d, it = r.it;
    const toDist = dists.find(x => x.id === d.demandToDistrict);
    const meta = __itemDisplayMeta(it);
    const to = (d.assigneeName || (toDist ? toDist.name : d.demandToDistrictName || "\u2014")) + (d.demandToLocationName ? " (" + d.demandToLocationName + ")" : "");
    return [d.demandNo || "", d.requestedBy, to, it.itemName, it.quantity, meta.label, new Date(d.createdAt).toLocaleDateString("en-IN")];
  });
}

const __DEMAND_STAT_BUILDERS = {
  total: () => {
    const list = __allVisibleDemands();
    return { title: "Total Demands", cols: __DEMAND_COLS, rows: __demandRows(list) };
  },
  pending: () => {
    const list = __allVisibleDemands().filter(d => { const s = __demandOverallStatus(d); return s === "in_progress" || s === "pending_review"; });
    return { title: "Pending Demands", cols: __DEMAND_COLS, rows: __demandRows(list) };
  },
  approved: () => {
    const list = __allVisibleDemands().filter(d => { const s = __demandOverallStatus(d); return s === "completed" || s === "partially_completed"; });
    return { title: "Approved Demands", cols: __DEMAND_COLS, rows: __demandRows(list) };
  },
  rejected: () => {
    const list = __allVisibleDemands().filter(d => __demandOverallStatus(d) === "rejected");
    return { title: "Rejected Demands", cols: __DEMAND_COLS, rows: __demandRows(list) };
  }
};

function openDemandStatDetail(key) {
  const def = __DEMAND_STAT_BUILDERS[key] ? __DEMAND_STAT_BUILDERS[key]() : null;
  if (!def) return;
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  __statDetail = {
    title: def.title,
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + def.rows.length + " demand" + (def.rows.length === 1 ? "" : "s") + ")",
    cols: def.cols,
    rows: def.rows,
    fileName: "demands-" + key
  };
  __statFilter = "";
  $("#statDetailTitle").textContent = def.title;
  $("#statDetailSubtitle").textContent = __statDetail.subtitle;
  $("#statDetailHead").innerHTML = "<tr>" + def.cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const s = $("#statSearch");
  if (s) s.value = "";
  renderStatDetail("");
  openModal("#statDetailModal");
}

function __demandActionableBy(d) {
  if (!d || !currentUser) return false;
  if (d.demandToDistrict !== activeDistrictId) return false;
  if (d.assigneeId && currentUser.id !== d.assigneeId) return false;
  if (!d.assigneeId && !canEdit()) return false;
  return __demandItems(d).some(it => {
    if (it.reviewStatus === "pending") return false;
    return it.status === "pending" || (it.status === "partial" && (Number(it.remainingQuantity) || 0) > 0);
  });
}

function renderDemands() {
  const demands = __allVisibleDemands();

  const filtered = __demandFiltered();

  const tbody = $("#demandBody");
  if (!tbody) return;
  const snap = {};
  filtered.forEach(r => { snap[r.d.id] = r.d; });
  window.__demandSnapshot = snap;

  if (filtered.length) {
    const pageRows = __pgRows("dem", filtered);
    tbody.innerHTML = pageRows.map(r => {
      const d = r.d, it = r.it;
      const meta = __itemDisplayMeta(it);
      const reqTo = (d.demandToDistrictName || d.demandToLocationName || "");
      const rfName = d.assigneeName || d.requestedBy || "?";
      let btns = "";
      if (it && it.reviewStatus === "pending") {
        if (__isRequester(d)) {
          btns = `<button type="button" class="btn btn-sm btn-outline" data-action="review-demand" data-id="${d.id}" data-item="${esc(it.key)}">Review</button>`;
        } else {
          btns = `<span style="font-size:.72rem;color:var(--amber)">Awaiting requester review</span>`;
        }
      } else if (__itemActionable(d, it)) {
        btns = `<button type="button" class="btn btn-sm btn-outline" data-action="process-demand" data-id="${d.id}">Process</button>`;
      } else {
        const noteTxt = it.status === "rejected" ? (it.rejectionReason || it.remark) : it.remark;
        btns = `<span style="font-size:.72rem;color:${it.status === "rejected" ? "var(--red)" : "var(--muted)"}">${noteTxt ? esc(noteTxt.slice(0, 30)) : "&mdash;"}</span>`;
      }
      btns += ` <button type="button" class="btn btn-sm btn-outline" data-action="view-demand" data-id="${d.id}">Details</button>`;
      const approvedNote = (Number(it.approvedQuantity) || 0) > 0 ? `<span style="display:block;color:var(--green);font-size:.72rem">${it.approvedQuantity} done${(Number(it.remainingQuantity) || 0) > 0 ? ", " + it.remainingQuantity + " left" : ""}</span>` : "";
      return `<tr data-demand-id="${d.id}"><td class="demand-no">${esc(d.demandNo || "")}</td><td>${esc(d.requestedBy)}</td><td>${esc(rfName)}${reqTo && d.demandToLocationName ? `<span style="display:block;color:var(--muted);font-size:.72rem">${esc(reqTo)}</span>` : ""}</td><td class="item-name">${__ipLinkByName(it.itemName)}${it.categoryName ? `<span style="display:block;color:var(--muted);font-size:.72rem">${esc(it.categoryName)}</span>` : ""}</td><td class="qty-strong">${it.quantity}${approvedNote}</td><td><span class="${meta.cls}">${meta.label}</span></td><td>${new Date(d.createdAt).toLocaleDateString("en-IN")}</td><td class="actions-cell">${btns}</td></tr>`;
    }).join("");
  } else {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No demands found. Click "+ Raise Demand" to submit one.</td></tr>`;
  }
  renderPager("dem", filtered.length, renderDemands);

  const stats = { total: demands.length, pending: 0, approved: 0, rejected: 0 };
  demands.forEach(d => {
    const s = __demandOverallStatus(d);
    if (s === "in_progress" || s === "pending_review") stats.pending++;
    else if (s === "completed" || s === "partially_completed") stats.approved++;
    else if (s === "rejected") stats.rejected++;
  });
  $("#statTotalDemands").textContent = stats.total;
  $("#statPendingDemands").textContent = stats.pending;
  $("#statApprovedDemands").textContent = stats.approved;
  $("#statRejectedDemands").textContent = stats.rejected;
  updateDemandDot();
}

function getDemandDotCount() {
  if (!activeDistrictId || !currentUser) return 0;
  let n = 0;
  (loadData(`demands_${activeDistrictId}`) || []).forEach(d => {
    if (d.demandToDistrict !== activeDistrictId) return;
    __demandItems(d).forEach(it => { if (it.reviewStatus === "pending") return; if (it.status === "pending" || (it.status === "partial" && (Number(it.remainingQuantity) || 0) > 0)) n++; });
  });
  return n;
}

function updateDemandDot() {
  const dot = $("#demandDot");
  if (!dot) return;
  const n = getDemandDotCount();
  dot.style.display = n ? "inline-flex" : "none";
  dot.textContent = n ? String(n) : "";
}

function buildAssigneeOptions(districtId, locationId) {
  const { html, users } = resolveUnitAssignee(districtId, locationId);
  return html;
}

function unitUserCandidates(districtId, locationId) {
  const loc = getLocationsForDistrict(districtId).find(l => l.id === locationId);
  let users = getUsers().filter(u => u.districtId === districtId && (!locationId || u.locationId === locationId));
  if (!users.length && locationId) {
    users = getUsers().filter(u => u.districtId === districtId && u.role === "admin");
  }
  const unitRoles = ["station", "mhc", "post", "tsi", "staff"];
  const isHQ = loc && loc.type === "district";
  let best = null;
  if (isHQ) best = users.find(u => u.role === "admin") || users.find(u => u.role === "devadmin");
  if (!best) best = users.find(u => unitRoles.includes(u.role));
  if (!best) best = users.find(u => u.role === "admin");
  if (!best) best = users[0] || null;
  return { autoId: best ? best.id : null, users, isHQ };
}

function resolveUnitAssignee(districtId, locationId) {
  const { autoId, users } = unitUserCandidates(districtId, locationId);
  if (!users.length) return { autoId: null, html: `<option value="">No users found</option>`, users };
  const html = `<option value="">Select user</option>` + users.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.role)})</option>`).join("");
  return { autoId, html, users };
}

function __fdAssigneeInfo() {
  const el = $("#fdAssigneeInfo");
  if (!el) return;
  const distId = $("#fdDemandTo") ? $("#fdDemandTo").value : "";
  const locId = $("#fdDemandToLocation") ? $("#fdDemandToLocation").value : "";
  if (!distId || !locId) { el.textContent = "Select destination location/unit."; return; }
  const r = resolveUnitAssignee(distId, locId);
  const u = r.users.find(x => x.id === r.autoId);
  if (!u) { el.innerHTML = `<span style="color:var(--red)">No user found at this unit. Add a user there or choose another unit.</span>`; return; }
  el.innerHTML = `<b>${esc(u.name)}</b> <span style="color:var(--muted)">(${esc(u.role)})</span> → notification will be sent to this user.`;
}

function __fdLocOptions(distId) {
  const locs = getLocationsForDistrict(distId);
  const hq = locs.find(l => l.type === 'district');
  const units = locs.filter(l => l.type !== 'district');
  const own = distId === activeDistrictId;
  const unitOpts = units.map(l => `<option value="${l.id}">[${esc(l.type.toUpperCase())}] ${esc(l.name)}</option>`).join("");
  const adminOpt = hq ? `<option value="${hq.id}">[ADMIN] District Admin</option>` : "";
  if (isAdmin()) {
    if (own) return `<option value="">Select location</option>` + unitOpts;
    return `<option value="">Select location</option>` + adminOpt;
  }
  return `<option value="">Select location</option>` + adminOpt + unitOpts;
}

function openDemandModal() {
  $("#demandModalTitle").textContent = "Raise New Demand";
  $("#demandSaveBtn").textContent = "Submit Demand";
  $("#fdReason").value = "";
  const __u = $("#fdUrgency"); if (__u) __u.value = "normal";
  $("#fdDemandId").value = "";

  const toSel = $("#fdDemandTo");
  const toLocSel = $("#fdDemandToLocation");
  const allDistricts = getDistricts();
  toSel.innerHTML = `<option value="">Select district</option>` + allDistricts.map(d => `<option value="${d.id}" ${d.id === activeDistrictId ? 'selected' : ''}>${esc(d.name)}${d.id === activeDistrictId ? ' (Your District)' : ''}</option>`).join("");
  if (!isAdmin()) {
    const myDist = allDistricts.find(d => d.id === activeDistrictId);
    toSel.innerHTML = `<option value="${activeDistrictId || ""}">${esc(myDist ? myDist.name : "My District")}</option>`;
    toSel.disabled = true;
  } else {
    toSel.disabled = false;
  }
  toLocSel.innerHTML = __fdLocOptions(activeDistrictId);
  toLocSel.disabled = false;

  __fdAssigneeInfo();

  const __fdTs = $("#fdTypeStock"); const __fdTc = $("#fdTypeCons"); if (__fdTs) __fdTs.checked = true; if (__fdTc) __fdTc.checked = false;
  const body = $("#fdItemsBody");
  if (body) {
    body.innerHTML = "";
    addFdRow();
  }
  openModal("#demandModal");
  setTimeout(() => { const n = body ? body.querySelector(".fd-row-name") : null; if (n) n.focus(); }, 60);
}

let __fdRowSeq = 0;
function __fdRowHtml(key) {
  const cats = __fdType() === "cons" ? getConsCats() : getCategories();
  return `<div class="fd-item-row" data-key="${key}">
    <select class="fd-row-cat"><option value="">Category *</option>${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
    <div class="fd-name-wrap">
      <input type="text" class="fd-row-name" placeholder="Type item name..." autocomplete="off">
      <div class="fd-suggest hidden"></div>
    </div>
    <input type="number" class="fd-row-qty" min="1" value="1">
    <select class="fd-row-cond"><option value="any">Any</option><option value="good">Good</option><option value="poor">Damaged</option></select>
    <button type="button" class="fd-row-remove" data-action="fd-row-remove" title="Remove item">&times;</button>
  </div>`;
}

function addFdRow() {
  const body = $("#fdItemsBody");
  if (!body) return;
  body.insertAdjacentHTML("beforeend", __fdRowHtml("k" + (++__fdRowSeq)));
}

function __fdSuggest(inputEl) {
  const wrap = inputEl.closest(".fd-name-wrap");
  if (!wrap) return;
  const menu = wrap.querySelector(".fd-suggest");
  const row = wrap.closest(".fd-item-row");
  const catId = row ? row.querySelector(".fd-row-cat").value : "";
  const val = inputEl.value.trim().toLowerCase();
  const names = [];
  (__fdType() === "cons" ? getConsItems() : getItems()).forEach(i => { if (!catId || i.categoryId === catId) names.push(i.name); });
  __allVisibleDemands().forEach(d => __demandItems(d).forEach(it => { if (!catId || it.categoryId === catId) names.push(it.itemName); }));
  const uniq = [...new Set(names)].filter(n => !val || n.toLowerCase().includes(val)).slice(0, 30);
  if (!uniq.length) { menu.classList.add("hidden"); return; }
  menu.innerHTML = uniq.map(n => `<div class="fd-suggest-item" data-name="${esc(n)}">${esc(n)}</div>`).join("");
  menu.classList.remove("hidden");
}

async function saveDemand(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const demandToDistrict = $("#fdDemandTo").value;
  const demandToLocation = $("#fdDemandToLocation").value;
  const urgency = $("#fdUrgency").value;
  const reason = $("#fdReason").value.trim();
  const remarks = "";
  if (!demandToDistrict || !demandToLocation || !reason) return toast("Please fill all required fields.", "error");

  const assigneeRes = resolveUnitAssignee(demandToDistrict, demandToLocation);
  const assigneeId = assigneeRes.autoId;
  const assignee = getUsers().find(u => u.id === assigneeId);
  if (!assigneeId) return toast("No user is available at the selected location/unit. Choose another unit or add a user there.", "error");

  const body = $("#fdItemsBody");
  const rows = body ? Array.from(body.querySelectorAll(".fd-item-row")) : [];
  if (!rows.length) return toast("Add at least one demand item.", "error");

  const consMode = __fdType() === "cons";
  const cats = consMode ? getConsCats() : getCategories();
  const toDist = getDistricts().find(dd => dd.id === demandToDistrict);
  const toLoc = getLocationsForDistrict(demandToDistrict).find(l => l.id === demandToLocation);

  const demandItems = [];
  let warn = "";
  let bad = false;
  rows.forEach((r, i) => {
    const catId = r.querySelector(".fd-row-cat").value;
    const name = r.querySelector(".fd-row-name").value.trim();
    const qty = parseInt(r.querySelector(".fd-row-qty").value, 10) || 0;
    const cond = r.querySelector(".fd-row-cond").value;
    const cat = cats.find(c => c.id === catId);
    if (!name && !qty) return;
    if (!name || !catId || qty <= 0) { bad = true; return; }
    const avail = consMode ? 999999 : __demandTargetAvail(name, cond, demandToDistrict, demandToLocation);
    if (avail < qty) warn += `"${name}" ? requested ${qty}, only ${avail} available at destination.\n`;
    demandItems.push({
      key: "i" + i,
      itemType: consMode ? "cons" : "stock",
      itemName: name,
      quantity: qty,
      approvedQuantity: 0,
      remainingQuantity: qty,
      categoryId: catId,
      categoryName: cat ? cat.name : "Other",
      condition: cond,
      status: "pending",
      remark: "",
      rejectionReason: "",
      processedBy: "",
      processedAt: null,
      approvedAt: null,
    });
  });
  if (bad) return toast("Each demand item needs a category, item name and quantity above 0.", "error");
  if (!demandItems.length) return toast("Add at least one demand item.", "error");
  if (warn && !confirm("Available stock at the destination:\n" + warn + "Submit anyway?")) return;

  const d = {
    id: uid(),
    demandNo: nextDemandNo(),
    reason, remarks, urgency,
    requestedBy: currentUser ? currentUser.name : "Admin",
    requestedById: currentUser ? currentUser.id : null,
    assigneeId,
    assigneeName: assignee ? assignee.name : "",
    requestedFromDistrict: activeDistrictId,
    requestedFromLocation: getVisibleLocationId() || "",
    demandToDistrict,
    demandToDistrictName: toDist ? toDist.name : "",
    demandToLocation,
    demandToLocationName: toLoc ? toLoc.name : "",
    status: "pending",
    itemType: consMode ? "cons" : "stock",
    demandItems,
    processing: [],
    createdAt: Date.now(),
    updatedAt: null,
  };
  d.itemName = demandItems[0].itemName;
  d.quantity = demandItems[0].quantity;
  d.categoryId = demandItems[0].categoryId;
  d.categoryName = demandItems[0].categoryName;
  d.condition = demandItems[0].condition;
  d.actionRemarks = "";
  d.rejectionReason = "";
  let __demandAtts = [];
  if ((__attStore.demand || []).length) { try { __demandAtts = await __attUploadAll("demand"); } catch (e) { return; } }
  d.attachments = __demandAtts;

  const demands = getDemands();
  demands.push(d);
  saveDemands(demands);
  __attStore.demand = []; __attRender("demand");
  __audit("Demand Raised", `${demandItems.length} item(s) — ${toLoc ? toLoc.name : toDist ? toDist.name : "another district"}`, { entity: "Demand" });

  const itemSummary = demandItems.map(x => `${x.quantity} x ${x.itemName}`).join(", ");
  addNotification(demandToDistrict, {
    type: "demand_assigned",
    title: "New Demand Received",
    message: `${d.requestedBy} has demanded ${itemSummary} from ${toLoc ? toLoc.name : toDist ? toDist.name : "your district"}.`,
    fromDistrictId: activeDistrictId,
    targetUserId: assigneeId || null,
    demandId: d.id,
    targetLocId: demandToLocation || null,
  });

  toast("Demand submitted successfully!", "success");
  closeModals();
  render();
}

let __currentDemandStoreId = null;
let __actDemandId = null;
let __actItemKey = null;
let __demandBusy = false;

function __getActDemand() {
  const storeId = __currentDemandStoreId || activeDistrictId;
  const demands = loadData(`demands_${storeId}`) || [];
  const d = demands.find(x => x.id === __actDemandId);
  if (d) d.__storeId = storeId;
  return d;
}

function buildDemandSummaryHtml(d) {
  const fromDist = getDistricts().find(x => x.id === d.requestedFromDistrict);
  const toDist = getDistricts().find(x => x.id === d.demandToDistrict);
  const urgencyStyle = d.urgency === "critical" ? "color:var(--red);font-weight:700" : d.urgency === "urgent" ? "color:var(--amber);font-weight:600" : "";
  const meta = __demandStatusMeta(__demandOverallStatus(d));
  return `<div class="demand-detail-grid">
    <div class="demand-detail-item"><span class="dd-label">Demand No</span><span class="dd-value">${esc(d.demandNo || "DEM-")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Requested By</span><span class="dd-value">${esc(d.requestedBy)}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Requested From</span><span class="dd-value">${esc(fromDist ? fromDist.name : d.requestedFromDistrict)}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Demand To</span><span class="dd-value">${esc(toDist ? toDist.name : d.demandToDistrictName || "\u2014")}${d.demandToLocationName ? ' <span style="color:var(--muted);font-size:.75rem">(' + esc(d.demandToLocationName) + ')</span>' : ""}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Assigned To (User)</span><span class="dd-value">${esc(d.assigneeName || "\u2014")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Urgency</span><span class="dd-value" style="${urgencyStyle}">${d.urgency ? d.urgency.charAt(0).toUpperCase() + d.urgency.slice(1) : "Normal"}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Date</span><span class="dd-value">${new Date(d.createdAt).toLocaleString("en-IN")}</span></div>
    <div class="demand-detail-item"><span class="dd-label">Status</span><span class="dd-value"><span class="${meta.cls}">${meta.label}</span></span></div>
    <div class="demand-detail-item dd-full"><span class="dd-label">Reason</span><span class="dd-value">${esc(d.reason || "\u2014")}</span></div>
    ${d.remarks ? `<div class="demand-detail-item dd-full"><span class="dd-label">Remarks</span><span class="dd-value">${esc(d.remarks)}</span></div>` : ""}
  </div>`;
}

function openDemandAction(id) {
  let d = (window.__demandSnapshot && window.__demandSnapshot[id]);
  if (!d) d = __allVisibleDemands().find(x => x.id === id);
  if (!d) {
    getDistricts().forEach(ds => {
      if (d) return;
      d = __demandsInStore(ds.id).find(x => x.id === id);
    });
  }
  if (!d) return toast("Demand record could not be found. It may have been edited or removed.", "error");
  if (!__demandActionableBy(d)) return toast("Only the assigned user can process this demand.", "error");
  try {
    __currentDemandStoreId = d.__storeId || activeDistrictId;
    __actDemandId = d.id;
    __actItemKey = null;

    $("#demandActionTitle").textContent = "Process Demand ? " + (d.demandNo || "DEM");
    $("#demandActionSummary").innerHTML = buildDemandSummaryHtml(d);

    const items = __demandItems(d);
    const tbody = $("#demandActionItems");
    tbody.innerHTML = items.map(it => {
      const remaining = Number(it.remainingQuantity) || 0;
      const completed = Number(it.approvedQuantity) || 0;
      const avail = __demandTargetAvail(it.itemName, it.condition, d.demandToDistrict, d.demandToLocation);
      const meta = __itemDisplayMeta(it);
      let actionCell;
      if (__itemActionable(d, it)) {
        actionCell = `<div class="dd-item-actions">
          <button type="button" class="btn btn-sm btn-primary" data-action="demand-open-fulfill" data-item="${esc(it.key)}">Approve</button>
          <button type="button" class="btn btn-sm btn-red" data-action="demand-reject-item" data-item="${esc(it.key)}">Reject</button>
        </div>`;
      } else {
        actionCell = `<span style="font-size:.72rem;color:var(--muted)">${meta.label}</span>`;
      }
      return `<tr><td class="item-name">${__ipLinkByName(it.itemName)}${it.categoryName ? `<span style="display:block;color:var(--muted);font-size:.72rem">${esc(it.categoryName)}</span>` : ""}</td><td class="qty-strong">${it.quantity}</td><td>${completed}</td><td class="qty-strong">${remaining}</td><td>${avail}</td><td><span class="${meta.cls}">${meta.label}</span></td><td class="actions-cell">${actionCell}</td></tr>`;
    }).join("");
    openModal("#demandActionModal");
  } catch (err) {
    console.error("openDemandAction failed:", err);
    toast("Could not open demand: " + (err && err.message ? err.message : String(err)), "error");
  }
}

function openDemandFulfill(itemKey) {
  const d = __getActDemand();
  if (!d) return toast("Demand record could not be found.", "error");
  const it = __demandItems(d).find(x => x.key === itemKey);
  if (!it) return toast("Demand item could not be found.", "error");
  if (!__itemActionable(d, it)) return toast("This item cannot be processed.", "error");
  __actItemKey = itemKey;
  const remaining = Number(it.remainingQuantity) || 0;
  const avail = __demandTargetAvail(it.itemName, it.condition, d.demandToDistrict, d.demandToLocation);
  $("#fulfillTitle").textContent = "Approve & Fulfill ? " + (it.itemName || "");
  $("#fulfillSummary").innerHTML = `<div class="dd-info-line">Requested: <b>${it.quantity}</b> &nbsp;?&nbsp; Already completed: <b>${Number(it.approvedQuantity) || 0}</b> &nbsp;?&nbsp; Remaining: <b>${remaining}</b></div><div class="dd-info-line">Available at ${esc(d.demandToLocationName || "destination unit")}: <b>${avail}</b></div>`;
  $("#fulfillWarn").innerHTML = avail <= 0
    ? `<div class="fd-avail fd-avail-warn">No stock of this item is currently available at the destination unit.</div>`
    : "";
  closeModals();
  openModal("#demandFulfillModal");
}

function completeDemandItem() {
  __commitDemandItem(__actDemandId, __actItemKey, "complete", 0, "");
}

function openDemandPartial() {
  const d = __getActDemand();
  if (!d) return;
  const it = __demandItems(d).find(x => x.key === __actItemKey);
  if (!it) return toast("Demand item could not be found.", "error");
  const remaining = Number(it.remainingQuantity) || 0;
  const avail = __demandTargetAvail(it.itemName, it.condition, d.demandToDistrict, d.demandToLocation);
  $("#dpmSummary").innerHTML = `<div class="dd-info-line">Item: <b>${esc(it.itemName)}</b> &nbsp;?&nbsp; Remaining: <b>${remaining}</b> &nbsp;?&nbsp; Available: <b>${avail}</b></div>`;
  const qty = $("#dpmQty");
  if (qty) { qty.value = ""; qty.max = Math.min(remaining, avail); }
  const rm = $("#dpmRemark");
  if (rm) rm.value = "";
  closeModals();
  openModal("#demandPartialModal");
  setTimeout(() => { if (qty) qty.focus(); }, 60);
}

function submitDemandPartial(e) {
  e.preventDefault();
  const qty = parseInt($("#dpmQty").value, 10) || 0;
  const remark = $("#dpmRemark").value.trim();
  __commitDemandItem(__actDemandId, __actItemKey, "partial", qty, remark);
}

function openDemandReject(itemKey) {
  const d = __getActDemand();
  if (!d) return;
  const it = __demandItems(d).find(x => x.key === itemKey);
  if (!it) return toast("Demand item could not be found.", "error");
  if (!__itemActionable(d, it)) return toast("This item cannot be processed.", "error");
  __actItemKey = itemKey;
  $("#drmSummary").innerHTML = `<div class="dd-info-line">Item: <b>${esc(it.itemName)}</b> &nbsp;?&nbsp; Requested: <b>${it.quantity}</b></div>`;
  const rm = $("#drmReason");
  if (rm) rm.value = "";
  closeModals();
  openModal("#demandRejectModal");
  setTimeout(() => { if (rm) rm.focus(); }, 60);
}

function submitDemandReject(e) {
  e.preventDefault();
  const reason = $("#drmReason").value.trim();
  __commitDemandItem(__actDemandId, __actItemKey, "reject", 0, reason);
}

function __deductDemandStock(itemName, condition, distId, locId, qty) {
  if (!distId || !locId || !qty) return false;
  const items = getItemsForDistrict(distId);
  const matches = items.filter(i => i.name.toLowerCase() === String(itemName).toLowerCase() && (!i.locationId || i.locationId === locId));
  if (!matches.length) return false;
  let remainingQty = qty;
  const order = condition === "good" || condition === "poor" || condition === "damaged" ? [condition] : ["good", "poor", "damaged"];
  for (const it of matches) {
    if (remainingQty <= 0) break;
    const cc = it.conditionCounts || { good: Number(it.quantity) || 0, poor: 0, damaged: 0 };
    for (const c of order) {
      if (remainingQty <= 0) break;
      const take = Math.min(remainingQty, cc[c] || 0);
      if (take > 0) { cc[c] -= take; remainingQty -= take; }
    }
    it.conditionCounts = cc;
    it.quantity = Math.max(0, (cc.good || 0)) + Math.max(0, (cc.poor || 0)) + Math.max(0, (cc.damaged || 0));
    it.updatedAt = Date.now();
  }
  if (remainingQty > 0) return false;
  const all = getAllItems();
  all[distId] = items;
  saveAllItems(all);
  return true;
}

function __commitDemandItem(demandId, itemKey, action, qty, remark) {
  if (__demandBusy) return toast("Another demand action is being processed. Please wait.", "error");
  const storeId = __currentDemandStoreId || activeDistrictId;
  const demands = loadData(`demands_${storeId}`) || [];
  const d = demands.find(x => x.id === demandId);
  if (!d) return toast("Demand record could not be found.", "error");
  if (!__demandActionableBy(d)) return toast("You are not authorised to act on this demand.", "error");
  const items = __demandItems(d);
  const it = items.find(x => x.key === itemKey);
  if (!it) return toast("Demand item could not be found.", "error");

  if (action === "reject") {
    if (it.status === "rejected") return toast("This item is already rejected.", "error");
    if (!remark || !remark.trim()) return toast("Rejection reason is required.", "error");
  } else {
    if (it.status === "completed") return toast("This item is already completed.", "error");
    const remaining = Number(it.remainingQuantity) || 0;
    if (remaining <= 0) return toast("This item has nothing pending.", "error");
    const avail = __demandTargetAvail(it.itemName, it.condition, d.demandToDistrict, d.demandToLocation);
    if (action === "complete") {
      if (avail < remaining) return toast(`Only ${avail} unit(s) available; cannot complete ${remaining}. Use Partial Complete instead.`, "error");
      qty = remaining;
    } else {
      qty = parseInt(qty, 10) || 0;
      if (qty <= 0 || qty > remaining) return toast(`Quantity must be between 1 and ${remaining}.`, "error");
      if (qty > avail) return toast(`Only ${avail} unit(s) available at the destination unit.`, "error");
      if (!remark || !remark.trim()) return toast("Remark is required for partial completion.", "error");
    }
  }

  __demandBusy = true;
  let stockOk = true;
  if (action !== "reject") {
    try {
      stockOk = __deductDemandStock(it.itemName, it.condition, d.demandToDistrict, d.demandToLocation, qty);
    } catch (err) {
      console.error("stock deduction failed:", err);
      stockOk = false;
    }
  }
  if (!stockOk) {
    __demandBusy = false;
    return toast("Could not deduct stock at the destination unit. No changes were saved.", "error");
  }

  const processedByName = currentUser ? currentUser.name : "System";
  const processedAt = Date.now();
  let notifType, notifTitle, notifMessage, auditLabel;
  if (action === "reject") {
    it.status = "rejected";
    it.rejectionReason = remark;
    it.remark = "";
    it.processedBy = processedByName;
    it.processedAt = processedAt;
    notifType = "demand_rejected";
    notifTitle = "Demand Item Rejected";
    notifMessage = `Your demand ${d.demandNo || ""} for ${it.itemName} was rejected by ${d.demandToDistrictName || "the destination unit"}. Reason: ${remark}`;
    auditLabel = "Demand Item Rejected";
  } else {
    it.approvedQuantity = (Number(it.approvedQuantity) || 0) + qty;
    it.remainingQuantity = (Number(it.remainingQuantity) || Number(it.quantity) || 0) - qty;
    it.status = it.remainingQuantity <= 0 ? "completed" : "partial";
    it.remark = (remark || "").trim();
    it.processedBy = processedByName;
    it.processedAt = processedAt;
    it.approvedAt = it.approvedAt || processedAt;
    it.reviewStatus = "pending";
    it.lastFulfillQty = qty;
    it.reviewedBy = "";
    it.reviewedAt = null;
    it.reviewRemark = "";
    if (it.status === "completed") {
      notifType = "demand_review_pending";
      notifTitle = "Awaiting Your Review";
      notifMessage = `Your demand ${d.demandNo || ""} for ${it.itemName} has been fully supplied (${qty} unit${qty === 1 ? "" : "s"}) by ${d.demandToDistrictName || "the destination unit"}. Please review and confirm.`;
      auditLabel = "Demand Item Fulfilled";
    } else {
      notifType = "demand_review_pending";
      notifTitle = "Awaiting Your Review";
      notifMessage = `${qty} of ${it.quantity} requested ${it.itemName} supplied; ${it.remainingQuantity} still pending. Please review and confirm. Note: ${(remark || "").trim()}`;
      auditLabel = "Demand Item Fulfilled (Partial)";
    }
  }

  d.demandItems = items;
  d.status = __demandOverallStatus(d);
  d.updatedAt = processedAt;
  if (!Array.isArray(d.processing)) d.processing = [];
  d.processing.unshift({ at: processedAt, by: processedByName, role: currentUser ? currentUser.role : "", action, item: it.itemName, qty: action === "reject" ? 0 : qty, remark: (remark || "").trim() });

  saveData(`demands_${storeId}`, demands);
  __audit(auditLabel, `${action === "reject" ? it.itemName : qty + " x " + it.itemName} for ${d.requestedBy || ""}`, { entity: "Demand" });
  addNotification(d.requestedFromDistrict, {
    type: notifType,
    title: notifTitle,
    message: notifMessage,
    fromDistrictId: activeDistrictId,
    demandId: d.id,
    targetLocId: d.requestedFromLocation || null,
  });
  __demandBusy = false;
  toast(action === "reject" ? "Item rejected." : it.status === "completed" ? "Item fulfilled, awaiting requester review." : "Partial fulfillment saved, awaiting requester review.", action === "reject" ? "error" : "success");
  closeModals();
  render();
}

function __findDemandRecord(id) {
  let d = (window.__demandSnapshot && window.__demandSnapshot[id]);
  if (!d) d = __allVisibleDemands().find(x => x.id === id);
  if (!d) {
    getDistricts().forEach(ds => { if (d) return; d = __demandsInStore(ds.id).find(x => x.id === id); });
  }
  return d;
}

function __addDemandStock(itemName, condition, distId, locId, qty) {
  if (!distId || !locId || !qty) return false;
  const items = getItemsForDistrict(distId);
  const matches = items.filter(i => i.name.toLowerCase() === String(itemName).toLowerCase() && (!i.locationId || i.locationId === locId));
  if (!matches.length) return false;
  let remainingQty = qty;
  const order = condition === "good" || condition === "poor" || condition === "damaged" ? [condition] : ["good", "poor", "damaged"];
  for (const it of matches) {
    if (remainingQty <= 0) break;
    const cc = it.conditionCounts || { good: Number(it.quantity) || 0, poor: 0, damaged: 0 };
    for (const c of order) {
      if (remainingQty <= 0) break;
      const add = Math.min(remainingQty, qty);
      cc[c] = (cc[c] || 0) + add;
      remainingQty -= add;
      break;
    }
    it.conditionCounts = cc;
    it.quantity = Math.max(0, (cc.good || 0)) + Math.max(0, (cc.poor || 0)) + Math.max(0, (cc.damaged || 0));
    it.updatedAt = Date.now();
  }
  if (remainingQty > 0) return false;
  const all = getAllItems();
  all[distId] = items;
  saveAllItems(all);
  return true;
}

let __reviewDemandStoreId = null;
let __reviewDemandId = null;
let __reviewItemKey = null;

function openDemandReview(id, itemKey) {
  const d = __findDemandRecord(id);
  if (!d) return toast("Demand record could not be found.", "error");
  if (!__isRequester(d)) return toast("Only the person who requested this demand can review the supply.", "error");
  const it = __demandItems(d).find(x => x.key === itemKey);
  if (!it) return toast("Demand item could not be found.", "error");
  if (it.reviewStatus !== "pending") return toast("This item is not awaiting review.", "error");
  try {
    __reviewDemandStoreId = d.__storeId || activeDistrictId;
    __reviewDemandId = d.id;
    __reviewItemKey = it.key;
    $("#demandReviewTitle").textContent = "Review Supply ? " + (d.demandNo || "DEM");
    const supplied = Number(it.approvedQuantity) || 0;
    const remaining = Number(it.remainingQuantity) || 0;
    $("#demandReviewSummary").innerHTML = `<div class="demand-detail-grid">
      <div class="demand-detail-item"><span class="dd-label">Item</span><span class="dd-value">${esc(it.itemName)}${it.categoryName ? ` <span style="color:var(--muted);font-size:.75rem">(${esc(it.categoryName)})</span>` : ""}</span></div>
      <div class="demand-detail-item"><span class="dd-label">Requested</span><span class="dd-value">${it.quantity}</span></div>
      <div class="demand-detail-item"><span class="dd-label">Supplied</span><span class="dd-value" style="color:var(--green);font-weight:600">${supplied}</span></div>
      <div class="demand-detail-item"><span class="dd-label">Remaining</span><span class="dd-value">${remaining}</span></div>
      <div class="demand-detail-item"><span class="dd-label">Supplied By</span><span class="dd-value">${esc(it.processedBy || "\u2014")}${it.processedAt ? " ? " + new Date(it.processedAt).toLocaleString("en-IN") : ""}</span></div>
      <div class="demand-detail-item dd-full"><span class="dd-label">Supplier Remark</span><span class="dd-value">${esc(it.remark || "\u2014")}</span></div>
      <div class="demand-detail-item dd-full" style="color:var(--muted);font-size:.8rem">Approve karein to supplied quantity final rahegi. Reject karne par item wapas In Progress chala jayega aur supplied stock return ho jayega.</div>
    </div>`;
    const rm = $("#demandReviewRemark");
    if (rm) rm.value = "";
    openModal("#demandReviewModal");
  } catch (err) {
    console.error("openDemandReview failed:", err);
    toast("Could not open review: " + (err && err.message ? err.message : String(err)), "error");
  }
}

function approveDemandReview() {
  __commitDemandReview("approve");
}

function rejectDemandReview() {
  const d = __findDemandRecord(__reviewDemandId);
  const it = d ? __demandItems(d).find(x => x.key === __reviewItemKey) : null;
  const restore = it ? (Number(it.lastFulfillQty) || 0) : 0;
  const msg = "Supply reject karne par " + restore + " unit ka stock destination unit ko wapas milega aur item In Progress ho jayega. Reject karein?";
  if (restore <= 0 || confirm(msg)) __commitDemandReview("reject");
}

function __commitDemandReview(action) {
  const storeId = __reviewDemandStoreId || activeDistrictId;
  const demands = loadData(`demands_${storeId}`) || [];
  const d = demands.find(x => x.id === __reviewDemandId);
  if (!d) return toast("Demand record could not be found.", "error");
  if (!__isRequester(d)) return toast("Only the person who requested this demand can review it.", "error");
  const it = __demandItems(d).find(x => x.key === __reviewItemKey);
  if (!it) return toast("Demand item could not be found.", "error");
  if (it.reviewStatus !== "pending") return toast("This item is not awaiting review.", "error");
  const rmEl = $("#demandReviewRemark");
  const remark = rmEl ? rmEl.value.trim() : "";
  const reviewer = currentUser ? currentUser.name : "System";
  const at = Date.now();
  __demandBusy = true;
  try {
    if (action === "approve") {
      it.reviewStatus = "approved";
      it.reviewedBy = reviewer;
      it.reviewedAt = at;
      it.reviewRemark = remark;
      it.lastFulfillQty = 0;
      addNotification(d.demandToDistrict, {
        type: "demand_review_approved",
        title: "Demand Review Approved",
        message: `${reviewer} accepted your supply of ${it.approvedQuantity} x ${it.itemName} for ${d.demandNo || ""}.${remark ? " Note: " + remark : ""}`,
        fromDistrictId: activeDistrictId,
        demandId: d.id,
        targetUserId: d.assigneeId || null,
        targetLocId: d.demandToLocation || null,
      });
      __audit("Demand Review Approved", `${it.approvedQuantity} x ${it.itemName} for ${d.requestedBy || ""}`, { entity: "Demand" });
      toast("Supply approved.", "success");
    } else {
      const restore = Number(it.lastFulfillQty) || 0;
      it.approvedQuantity = Math.max(0, (Number(it.approvedQuantity) || 0) - restore);
      it.remainingQuantity = (Number(it.remainingQuantity) || 0) + restore;
      it.reviewStatus = "rejected";
      it.reviewedBy = reviewer;
      it.reviewedAt = at;
      it.reviewRemark = remark;
      it.lastFulfillQty = 0;
      it.status = (Number(it.approvedQuantity) || 0) > 0 ? "partial" : "pending";
      let returned = 0;
      if (restore > 0) {
        try { returned = __addDemandStock(it.itemName, it.condition, d.demandToDistrict, d.demandToLocation, restore) ? restore : 0; }
        catch (err) { console.error("stock return failed:", err); returned = 0; }
      }
      addNotification(d.demandToDistrict, {
        type: "demand_review_rejected",
        title: "Demand Review Rejected",
        message: `${reviewer} did not accept the supply of ${restore} x ${it.itemName} for ${d.demandNo || ""}. Item is back In Progress and stock was ${returned ? "returned to " + (d.demandToDistrictName || "your unit") + "." : "not returned."}${remark ? " Reason: " + remark : ""}`,
        fromDistrictId: activeDistrictId,
        demandId: d.id,
        targetUserId: d.assigneeId || null,
        targetLocId: d.demandToLocation || null,
      });
      __audit("Demand Review Rejected", `${restore} x ${it.itemName} for ${d.requestedBy || ""}${returned ? " (stock returned)" : ""}`, { entity: "Demand" });
      toast("Supply rejected; item is back In Progress.", "error");
    }
    if (!Array.isArray(d.processing)) d.processing = [];
    d.processing.unshift({ at, by: reviewer, role: currentUser ? currentUser.role : "", action: "review_" + action, item: it.itemName, qty: action === "approve" ? it.approvedQuantity : 0, remark });
    d.demandItems = __demandItems(d);
    d.status = __demandOverallStatus(d);
    d.updatedAt = at;
    saveData(`demands_${storeId}`, demands);
    closeModals();
    render();
  } catch (err) {
    console.error("review commit failed:", err);
    toast("Could not save review: " + (err && err.message ? err.message : String(err)), "error");
  } finally {
    __demandBusy = false;
  }
}

function openDemandDetails(id) {
  let d = (window.__demandSnapshot && window.__demandSnapshot[id]);
  if (!d) d = __allVisibleDemands().find(x => x.id === id);
  if (!d) {
    getDistricts().forEach(ds => { if (d) return; d = __demandsInStore(ds.id).find(x => x.id === id); });
  }
  if (!d) return toast("Demand record could not be found.", "error");
  const items = __demandItems(d);
  $("#demandDetailsTitle").textContent = "Demand Details ? " + (d.demandNo || "DEM");
  $("#demandDetailsInfo").innerHTML = buildDemandSummaryHtml(d) + attachmentChipsHtml(d);
  const itBody = $("#demandDetailsItems");
  itBody.innerHTML = items.map(it => {
    const meta = __itemDisplayMeta(it);
    const remark = it.status === "rejected" ? it.rejectionReason : it.remark;
    return `<tr><td class="item-name">${__ipLinkByName(it.itemName)}${it.categoryName ? `<span style="display:block;color:var(--muted);font-size:.72rem">${esc(it.categoryName)}</span>` : ""}</td><td class="qty-strong">${it.quantity}</td><td>${Number(it.approvedQuantity) || 0}</td><td>${Number(it.remainingQuantity) || 0}</td><td><span class="${meta.cls}">${meta.label}</span></td><td>${esc(it.processedBy || "\u2014")}</td><td>${it.processedAt ? new Date(it.processedAt).toLocaleString("en-IN") : "\u2014"}</td><td style="max-width:220px">${esc(remark || "\u2014")}</td></tr>`;
  }).join("");
  const hist = Array.isArray(d.processing) ? d.processing : [];
  const histEl = $("#demandDetailsHistory");
  histEl.innerHTML = hist.length
    ? hist.map(h => `<div class="dd-history-item"><span class="dd-history-ts">${new Date(h.at).toLocaleString("en-IN")}</span><span class="dd-history-action">${esc(String(h.action).replace(/_/g, " "))}</span><span class="dd-history-text">${esc(h.item || "")} ${h.qty ? "(" + h.qty + ")" : ""} ? by ${esc(h.by || "")}${h.remark ? " ? " + esc(h.remark) : ""}</span></div>`).join("")
    : `<div class="dd-history-empty">No processing actions yet.</div>`;
  openModal("#demandDetailsModal");
}

/* ==================== DISTRICTS ==================== */
let editingDistId = null;
let selectedDistForLocations = null;

/* The Inspector Generals that cover a district, i.e. the IG accounts whose
   assigned-district list includes it. An IG row is a claim to authority, so it is
   read from the user records rather than stored twice on the district. */
function igsForDistrict(districtId) {
  return getUsers().filter(u => u.role === "ig" && (Array.isArray(u.districtIds) ? u.districtIds : [u.districtId]).indexOf(districtId) >= 0);
}

function renderDistricts() {
  const allDistricts = getDistricts();
  const districts = (isDevAdmin() || isIg()) ? allDistricts.filter(d => isDevAdmin() || inDistrictScope(d.id)) : allDistricts.filter(d => d.id === activeDistrictId);
  const allLocations = getAllLocations();
  const allItems = getAllItems();
  const box = $("#districtsList");
  box.innerHTML = districts.map(d => {
    const locs = allLocations[d.id] || [];
    const items = allItems[d.id] || [];
    const isActive = d.id === activeDistrictId;
    // Name the IG sitting above this district, so it is obvious at a glance which
    // Inspector General answers for it.
    const igs = igsForDistrict(d.id);
    const igLine = igs.length
      ? `<div class="dr-ig"><span class="dr-ig-label">IG</span>${igs.map(u => `<span class="dr-ig-name" title="${esc(u.username)}">${esc(u.name)}</span>`).join("")}</div>`
      : `<div class="dr-ig dr-ig-none"><span class="dr-ig-label">IG</span><span class="dr-ig-name">Not assigned</span></div>`;
    return `<div class="district-row${isActive ? " active" : ""}" data-dist-id="${d.id}">
      <div class="dr-info"><div class="dr-name">${esc(d.name)}</div><div class="dr-detail">${esc(d.headquarters)}  ?  ${locs.length} locations  ?  ${items.length} items</div>${igLine}</div>
      <span class="dr-code">${esc(d.code)}</span>
      <button class="btn btn-sm btn-outline" data-dist-locs="${d.id}">Locations</button>
      ${isDevAdmin() ? `<button class="btn btn-sm btn-outline" data-dist-edit="${d.id}">Edit</button><button class="btn btn-sm btn-outline" data-dist-del="${d.id}">Delete</button>` : ""}
    </div>`;
  }).join("");
  renderLocationList();
}

function renderLocationList() {
  const box = $("#locationList");
  if (!box) return;
  if (!selectedDistForLocations) { box.innerHTML = `<div style="padding:12px;color:var(--muted);font-size:.85rem">Select a district's "Locations" button above.</div>`; return; }
  const locs = getLocationsForDistrict(selectedDistForLocations);
  const items = getItemsForDistrict(selectedDistForLocations);
  const counts = {};
  items.forEach(i => { counts[i.locationId] = (counts[i.locationId] || 0) + 1; });
  if (!locs.length) { box.innerHTML = `<div style="padding:12px;color:var(--muted);font-size:.85rem">No locations. Add one above.</div>`; return; }
  box.innerHTML = locs.map(l => {
    const count = counts[l.id] || 0;
    return `<div class="location-row"><span class="loc-name">${esc(l.name)}</span><span class="loc-type">${esc(l.type)}</span><span class="loc-items">${count} items</span><button class="btn btn-sm btn-outline" data-loc-del="${l.id}" ${count > 0 ? "disabled title='Has items'" : ""}>Remove</button></div>`;
  }).join("");
}

function openDistrictsModal() {
  editingDistId = null;
  selectedDistForLocations = null;
  $("#distFormTitle").textContent = "Add New District";
  $("#distSubmitBtn").textContent = "Add District";
  $("#cancelDistEdit").style.display = "none";
  $("#ndEditId").value = "";
  $("#addDistrictForm").reset();
  renderDistricts();
  openModal("#districtsModal");
}

function startEditDistrict(id) {
  if (!isDevAdmin()) return toast("Only developer admin can edit districts.", "error");
  const dist = getDistricts().find(d => d.id === id);
  if (!dist) return;
  editingDistId = id;
  $("#distFormTitle").textContent = "Edit District";
  $("#distSubmitBtn").textContent = "Update District";
  $("#cancelDistEdit").style.display = "";
  $("#ndEditId").value = id;
  $("#ndName").value = dist.name;
  $("#ndCode").value = dist.code;
  $("#ndHQ").value = dist.headquarters;
}

function cancelDistEdit() {
  editingDistId = null;
  $("#distFormTitle").textContent = "Add New District";
  $("#distSubmitBtn").textContent = "Add District";
  $("#cancelDistEdit").style.display = "none";
  $("#ndEditId").value = "";
  $("#addDistrictForm").reset();
}

function addDistrict(e) {
  e.preventDefault();
  if (!isDevAdmin()) return toast("Only developer admin can manage districts.", "error");
  const editId = $("#ndEditId").value;
  const name = $("#ndName").value.trim();
  const code = $("#ndCode").value.trim().toUpperCase();
  const headquarters = $("#ndHQ").value.trim();
  if (!name || !code || !headquarters) return toast("Fill all fields.", "error");
  const districts = getDistricts();
  const allLocations = getAllLocations();
  const allItems = getAllItems();
  if (editId) {
    const dist = districts.find(d => d.id === editId);
    if (!dist) return toast("Not found.", "error");
    if (districts.some(d => d.code === code && d.id !== editId)) return toast("Code already taken.", "error");
    dist.name = name; dist.code = code; dist.headquarters = headquarters;
    toast("District updated.", "success");
  } else {
    if (districts.some(d => d.code === code)) return toast("Code already exists.", "error");
    const newId = "dist_" + uid();
    districts.push({ id: newId, name, code, headquarters, createdAt: Date.now() });
    allLocations[newId] = []; allItems[newId] = [];
    saveAllLocations(allLocations); saveAllItems(allItems);
    toast("District added.", "success");
  }
  saveDistricts(districts);
  cancelDistEdit();
  renderDistricts();
  renderDistrictSelector();
}

function deleteDistrict(id) {
  if (!isDevAdmin()) return toast("Only developer admin can delete districts.", "error");
  const districts = getDistricts();
  const items = getItemsForDistrict(id);
  const users = getUsers().filter(u => u.districtId === id);
  if (items.length > 0) return toast("District has items. Remove them first.", "error");
  if (users.length > 0) return toast("District has users. Remove them first.", "error");
  if (districts.length <= 1) return toast("Cannot delete the last district.", "error");
  if (!confirm("Delete this district?")) return;
  const allLocations = getAllLocations();
  const allItems = getAllItems();
  delete allLocations[id]; delete allItems[id];
  saveAllLocations(allLocations); saveAllItems(allItems);
  saveDistricts(districts.filter(d => d.id !== id));
  if (activeDistrictId === id) {
    const remaining = getDistricts();
    if (remaining.length) switchDistrict(remaining[0].id);
  }
  toast("District deleted.", "success");
  renderDistricts();
  renderDistrictSelector();
}

function showLocations(districtId) { selectedDistForLocations = districtId; renderLocationList(); }

function addLocation() {
  if (!selectedDistForLocations) return toast("Select a district first.", "error");
  if (!isDevAdmin() && selectedDistForLocations !== activeDistrictId) return toast("You can only manage locations in your district.", "error");
  const name = ($("#nlName").value || "").trim();
  const type = ($("#nlType") || {}).value;
  if (!name) return toast("Enter location name.", "error");
  const allLocations = getAllLocations();
  const locs = allLocations[selectedDistForLocations] || [];
  if (locs.some(l => l.name.toLowerCase() === name.toLowerCase())) return toast("Location already exists.", "error");
  locs.push({ id: uid(), name, type, districtId: selectedDistForLocations });
  allLocations[selectedDistForLocations] = locs;
  saveAllLocations(allLocations);
  $("#nlName").value = "";
  toast("Location added.", "success");
  renderLocationList();
}

function deleteLocation(id) {
  if (!isDevAdmin() && selectedDistForLocations !== activeDistrictId) return toast("You can only manage locations in your district.", "error");
  const items = getItemsForDistrict(selectedDistForLocations);
  if (items.some(i => i.locationId === id)) return toast("Location has items. Reassign first.", "error");
  const allLocations = getAllLocations();
  allLocations[selectedDistForLocations] = (allLocations[selectedDistForLocations] || []).filter(l => l.id !== id);
  saveAllLocations(allLocations);
  toast("Location removed.", "success");
  renderLocationList();
}

/* ==================== REPORTS ==================== */
function renderReports() {
  renderMergedReport();
  __rptRenderColsMenu();
  __rptBindCols();
  __rptBindDrag();
}

// ---- report search + sort state ----
let __rptSearch = "";
let __rptSortKey = "";
let __rptSortDir = 1;

function __rptReportId() {
  return "mergedReport";
}

function __rptFilterSort(rows) {
  const q = __rptSearch.trim().toLowerCase();
  const out = q ? rows.filter(r => Object.keys(r).some(k => {
    if (k.charAt(0) === "_") return false;
    return String(r[k]).toLowerCase().includes(q);
  })) : rows.slice();
  if (__rptSortKey) {
    const key = __rptSortKey;
    const dir = __rptSortDir;
    out.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }
  return out;
}

function __rptSortHeader(key, label) {
  const ind = __rptSortKey === key ? (__rptSortDir === 1 ? " \u25B2" : " \u25BC") : "";
  return `<th class="sortable" draggable="true" data-rpt-col="${key}" data-sort-key="${key}">${label}${ind ? `<span class="sort-ind">${ind}</span>` : ""}</th>`;
}

function __rptBindSort() {
  $$("#reportContent th.sortable").forEach(th =>
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (__rptSortKey === key) __rptSortDir = -__rptSortDir;
      else { __rptSortKey = key; __rptSortDir = 1; }
      renderReports();
    })
  );
}

function __rptBindSummary() {
  $$(".rpt-summary-card[data-rpt-stat]").forEach(card =>
    card.addEventListener("click", () => {
      const key = card.dataset.rptStat;
      if (key) openRptStatDetail(key);
    })
  );
}

function __rptCondRows(cond, label) {
  const items = getItems();
  const cats = getCategories();
  const locs = getLocations();
  const rows = items
    .filter(i => ((i.conditionCounts || {})[cond] || 0) > 0)
    .map(i => {
      const cc = i.conditionCounts || {};
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
      return [i.name, cat ? cat.name : "", loc ? loc.name : "", cc[cond] || 0, i.quantity, i.unit];
    });
  return { title: label, cols: ["Item", "Category", "Location", label + " Qty", "Total Qty", "Unit"], rows };
}

const __RPT_BUILDERS = {
  total: () => {
    const items = getItems();
    const cats = getCategories();
    const locs = getLocations();
    const rows = items.map(i => {
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = locs.find(l => l.id === i.locationId);
      const status = i.quantity === 0 ? "Out" : i.quantity <= i.minStock ? "Low" : "OK";
      return [i.name, cat ? cat.name : "", loc ? loc.name : "", i.quantity, i.unit, i.minStock, status];
    });
    return { title: "Total Items", cols: ["Item", "Category", "Location", "Qty", "Unit", "Min", "Status"], rows };
  },
  instock: () => __rptStockRows(i => i.quantity > i.minStock, "In Stock Items"),
  lowstock: () => __rptStockRows(i => i.quantity > 0 && i.quantity <= i.minStock, "Low Stock Items"),
  outofstock: () => __rptStockRows(i => i.quantity === 0, "Out of Stock Items"),
good: () => __rptCondRows("good", "Good Units"),
  poor: () => __rptCondRows("poor", "Damaged Units"),
  damaged: () => __rptCondRows("damaged", "Scrap Units")
};

function __rptStockRows(pred, label) {
  const items = getItems().filter(pred);
  const cats = getCategories();
  const locs = getLocations();
  const rows = items.map(i => {
    const cat = cats.find(c => c.id === i.categoryId);
    const loc = locs.find(l => l.id === i.locationId);
    const status = i.quantity === 0 ? "Out" : i.quantity <= i.minStock ? "Low" : "OK";
    return [i.name, cat ? cat.name : "", loc ? loc.name : "", i.quantity, i.unit, i.minStock, status];
  });
  return { title: label, cols: ["Item", "Category", "Location", "Qty", "Unit", "Min", "Status"], rows };
}

function openRptStatDetail(key) {
  const def = __RPT_BUILDERS[key] ? __RPT_BUILDERS[key]() : null;
  if (!def) return;
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  __statDetail = {
    title: def.title,
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString(),
    cols: def.cols,
    rows: def.rows,
    fileName: "stock-report-" + key.toLowerCase()
  };
  __statFilter = "";
  $("#statDetailTitle").textContent = def.title;
  $("#statDetailSubtitle").textContent = __statDetail.subtitle;
  $("#statDetailHead").innerHTML = "<tr>" + def.cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const s = $("#statSearch");
  if (s) s.value = "";
  renderStatDetail("");
  openModal("#statDetailModal");
}

const __rptHidden = { mergedReport: { "Item Code": true, "Recovered": true } };
function __rptAllCols(tab) {
  return ["Item", "Item Code", "Category", "Location", "Unit", "Total Qty", "Available", "Issued", "Good", "Damaged", "Scrap", "Lost", "Recovered", "Min Stock", "Status"];
}
function __rptRenderColsMenu() {
  const tab = __rptReportId();
  const order = __rptOrder[tab] = __rptOrder[tab] || __rptAllCols(tab);
  const hidden = __rptHidden[tab] || {};
  const vis = order.filter(c => !hidden[c]).length;
  const menu = $("#rptColsMenu");
  if (menu) menu.innerHTML = `<div class="rpt-cols-note">${vis} of ${order.length} columns shown \u00b7 drag a column header to reorder</div>` + order.map(c =>
    `<label class="rpt-col-item"><input type="checkbox" class="rpt-col-check" data-col="${esc(c)}"${hidden[c] ? "" : " checked"}> ${esc(c)}</label>`
  ).join("");
}
function __rptBindCols() {
  const btn = $("#rptColsBtn");
  if (btn) btn.onclick = () => $("#rptColsMenu")?.classList.toggle("hidden");
  $$("#rptColsMenu .rpt-col-check").forEach(cb => cb.addEventListener("change", () => {
    const tab = __rptReportId();
    const col = cb.dataset.col;
    const all = __rptAllCols(tab);
    const h = __rptHidden[tab] = __rptHidden[tab] || {};
    if (!cb.checked) {
      const visCount = all.filter(c => !h[c]).length;
      if (visCount <= 1) { cb.checked = true; toast("At least one column must stay visible.", "error"); return; }
      h[col] = true;
    } else delete h[col];
    __rptRenderColsMenu();
    renderReports();
  }));
}
const __rptOrder = {};
function __rptVisCols(tab) {
  const order = __rptOrder[tab] = __rptOrder[tab] || __rptAllCols(tab);
  const hidden = __rptHidden[tab] || {};
  return order.filter(c => !hidden[c]);
}
function __rptBindDrag() {
  $$("#reportContent thead th").forEach(th => {
    th.setAttribute("draggable", "true");
    th.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", th.dataset.rptCol || "");
      e.dataTransfer.effectAllowed = "move";
      th.classList.add("rpt-dragging");
    });
    th.addEventListener("dragend", () => th.classList.remove("rpt-dragging"));
    th.addEventListener("dragover", e => { if (th.dataset.rptCol) { e.preventDefault(); th.classList.add("rpt-drag-over"); } });
    th.addEventListener("dragleave", () => th.classList.remove("rpt-drag-over"));
    th.addEventListener("drop", e => {
      e.preventDefault(); e.stopPropagation();
      th.classList.remove("rpt-drag-over");
      const tab = __rptReportId();
      const src = e.dataTransfer.getData("text/plain");
      const dst = th.dataset.rptCol;
      const order = __rptOrder[tab] = __rptOrder[tab] || __rptAllCols(tab);
      const si = order.indexOf(src), di = order.indexOf(dst);
      if (si === -1 || di === -1 || si === di) return;
      order.splice(si, 1);
      const di2 = order.indexOf(dst);
      order.splice(si < di ? di2 + 1 : di2, 0, src);
      renderReports();
    });
  });
}
const __RPT_STOCK_HEAD = {
  "Item": () => __rptSortHeader("Item", "Item"),
  "Category": () => __rptSortHeader("Category", "Category"),
  "Qty": () => __rptSortHeader("Qty", "Qty"),
  "Min": () => __rptSortHeader("Min", "Min"),
  "Condition Breakdown": () => `<th draggable="true" data-rpt-col="Condition Breakdown">Condition Breakdown</th>`,
  "Status": () => __rptSortHeader("Status", "Status"),
  "Health": () => `<th draggable="true" data-rpt-col="Health">Health</th>`
};
const __RPT_MERGED_HEAD = {
  "Item": () => __rptSortHeader("Item", "Item"),
  "Item Code": () => __rptSortHeader("Item Code", "Item Code"),
  "Category": () => __rptSortHeader("Category", "Category"),
  "Location": () => __rptSortHeader("Location", "Location"),
  "Unit": () => __rptSortHeader("Unit", "Unit"),
  "Total Qty": () => __rptSortHeader("Total Qty", "Total Qty"),
  "Available": () => __rptSortHeader("Available", "Available"),
  "Issued": () => __rptSortHeader("Issued", "Issued"),
  "Good": () => __rptSortHeader("Good", "Good"),
  "Damaged": () => __rptSortHeader("Damaged", "Damaged"),
  "Scrap": () => __rptSortHeader("Scrap", "Scrap"),
  "Lost": () => __rptSortHeader("Lost", "Lost"),
  "Recovered": () => __rptSortHeader("Recovered", "Recovered"),
  "Min Stock": () => __rptSortHeader("Min Stock", "Min Stock"),
  "Status": () => __rptSortHeader("Status", "Status")
};
function __rptMergedRows() {
  const cats = getCategories();
  const locs = getLocations();
  return getItems().map(i => {
    const cat = cats.find(c => c.id === i.categoryId);
    const loc = locs.find(l => l.id === i.locationId);
    const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 };
    const recovered = (i.history || []).filter(h => h.type === "RECOVERED").reduce((a, h) => a + (h.qty || 0), 0);
    const status = (i.quantity || 0) === 0 ? "Out" : (i.quantity || 0) <= (i.minStock || 0) ? "Low" : "OK";
    return {
      "Item": i.name,
      "Item Code": i.code || i.sku || ("ITM-" + String(i.id || "").slice(-6).toUpperCase()),
      "Category": cat ? cat.name : "",
      "Location": loc ? loc.name : "",
      "Unit": i.unit || "pcs",
      "Total Qty": i.quantity || 0,
      "Available": availableQty(i),
      "Issued": i.allotted || 0,
      "Good": cc.good || 0,
      "Damaged": cc.poor || 0,
      "Scrap": cc.damaged || 0,
      "Lost": i.lostReturned || 0,
      "Recovered": recovered,
      "Min Stock": i.minStock || 0,
      "Status": status,
      _item: i
    };
  });
}
function renderMergedReport() {
  const items = getItems();
  const total = items.length;
  const inStock = items.filter(i => i.quantity > i.minStock).length;
  const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= i.minStock).length;
  const outOfStock = items.filter(i => i.quantity === 0).length;
  const goodUnits = items.reduce((sum, i) => sum + ((i.conditionCounts || {}).good || 0), 0);
  const poorUnits = items.reduce((sum, i) => sum + ((i.conditionCounts || {}).poor || 0), 0);
  const damagedUnits = items.reduce((sum, i) => sum + ((i.conditionCounts || {}).damaged || 0), 0);
  const vis = __rptVisCols("mergedReport");
  const nCols = vis.length || 1;
  let html = `<div class="rpt-summary"><div class="rpt-summary-card" data-rpt-stat="total" title="Click for details & export"><div class="rpt-s-label">Total Items</div><div class="rpt-s-value">${total}</div></div><div class="rpt-summary-card" data-rpt-stat="instock" title="Click for details & export"><div class="rpt-s-label">In Stock</div><div class="rpt-s-value" style="color:var(--green)">${inStock}</div></div><div class="rpt-summary-card" data-rpt-stat="lowstock" title="Click for details & export"><div class="rpt-s-label">Low Stock</div><div class="rpt-s-value" style="color:var(--amber)">${lowStock}</div></div><div class="rpt-summary-card" data-rpt-stat="outofstock" title="Click for details & export"><div class="rpt-s-label">Out of Stock</div><div class="rpt-s-value" style="color:var(--red)">${outOfStock}</div></div><div class="rpt-summary-card" data-rpt-stat="good" title="Click for details & export"><div class="rpt-s-label">Good Units</div><div class="rpt-s-value" style="color:var(--green)">${goodUnits}</div></div><div class="rpt-summary-card" data-rpt-stat="poor" title="Click for details & export"><div class="rpt-s-label">Damaged Units</div><div class="rpt-s-value" style="color:var(--amber)">${poorUnits}</div></div><div class="rpt-summary-card" data-rpt-stat="damaged" title="Click for details & export"><div class="rpt-s-label">Scrap Units</div><div class="rpt-s-value" style="color:var(--red)">${damagedUnits}</div></div></div>`;
  html += `<div class="table-wrap"><table data-sortable="false"><thead><tr>${vis.map(c => (__RPT_MERGED_HEAD[c] || (() => "<th></th>"))()).join("")}</tr></thead><tbody>`;
  const rows = __rptFilterSort(__rptMergedRows());
  if (!rows.length) {
    html += `<tr><td colspan="${nCols}" style="text-align:center;color:var(--muted)">No matching items.</td></tr></tbody></table></div>`;
    html += `<div class="pager" id="pager_rptStock"></div>`;
    $("#reportContent").innerHTML = html;
    __rptBindSort();
    __rptBindSummary();
    renderPager("rptStock", 0, renderMergedReport);
    return;
  }
  const pageRows = __pgRows("rptStock", rows);
  pageRows.forEach(r => {
    const cls = r.Status === "Out" ? "status-out" : r.Status === "Low" ? "status-low" : "status-ok";
    const cells = {
      "Item": `<td class="item-name">${__ipLink ? __ipLink(r._item) : esc(r.Item)}</td>`,
      "Item Code": `<td>${esc(r["Item Code"])}</td>`,
      "Category": `<td><span class="cat-badge">${esc(r.Category)}</span></td>`,
      "Location": `<td>${esc(r.Location)}</td>`,
      "Unit": `<td>${esc(r.Unit)}</td>`,
      "Total Qty": `<td class="qty-strong">${r["Total Qty"]}</td>`,
      "Available": `<td class="qty-strong" style="color:var(--green)">${r["Available"]}</td>`,
      "Issued": `<td>${r["Issued"]}</td>`,
      "Good": `<td style="color:var(--green)">${r["Good"]}</td>`,
      "Damaged": `<td style="color:var(--amber)">${r["Damaged"]}</td>`,
      "Scrap": `<td style="color:var(--red)">${r["Scrap"]}</td>`,
      "Lost": `<td style="color:var(--red)">${r["Lost"]}</td>`,
      "Recovered": `<td style="color:var(--green)">${r["Recovered"]}</td>`,
      "Min Stock": `<td>${r["Min Stock"]}</td>`,
      "Status": `<td><span class="status-badge ${cls}">${r["Status"]}</span></td>`
    };
    html += `<tr>${vis.map(c => cells[c] || "<td></td>").join("")}</tr>`;
  });
  const numCols = ["Total Qty", "Available", "Issued", "Good", "Damaged", "Scrap", "Lost", "Recovered", "Min Stock"];
  const tcells = {};
  vis.forEach(c => {
    if (c === "Item") tcells[c] = `<td>Total</td>`;
    else if (numCols.includes(c)) tcells[c] = `<td class="qty-strong">${rows.reduce((a, r) => a + (r[c] || 0), 0)}</td>`;
    else tcells[c] = `<td></td>`;
  });
  html += `<tr class="rpt-total-row">${vis.map(c => tcells[c] || "<td></td>").join("")}</tr>`;
  html += `</tbody></table></div>`;
  html += `<div class="pager" id="pager_rptStock"></div>`;
  $("#reportContent").innerHTML = html;
  __rptBindSort();
  __rptBindSummary();
  renderPager("rptStock", rows.length, renderMergedReport);
}

function __rptExportData() {
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  const vis = __rptVisCols("mergedReport");
  const rows = __rptFilterSort(__rptMergedRows()).map(r => vis.map(c => r[c]));
  return {
    title: "Inventory Report",
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " row" + (rows.length === 1 ? "" : "s") + ")",
    cols: vis,
    rows,
    fileName: "inventory-report"
  };
}
function printRptReport() { printReport(__rptExportData()); }
function exportRptPDF() { pdfReport(__rptExportData()); toast("PDF exported.", "success"); }
function exportRptExcel() { excelReport(__rptExportData()); toast("Excel exported.", "success"); }
function exportRptWord() { wordReport(__rptExportData()); toast("Word document exported.", "success"); }

/* ==================== ALLOTMENTS ==================== */
function getPersons() { return loadData("persons") || []; }
function savePersons(persons) { saveData("persons", persons); }
function getAllotments() { return loadData("allotments") || []; }
function saveAllotments(allotments) { saveData("allotments", allotments); }

function getVisibleAllotments() {
  let all = getAllotments();
  if (activeDistrictId) all = all.filter(a => a.districtId === activeDistrictId);
  const locId = getVisibleLocationId();
  if (locId) all = all.filter(a => a.locationId === locId);
  return all;
}

function allocTotals(item) {
  return {
    allotted: item.allotted || 0,
    damaged: item.damagedReturned || 0,
    lost: item.lostReturned || 0
  };
}

function availableQty(item) {
  const t = allocTotals(item);
  const __dmg = (item.conditionCounts || {}).damaged || 0;
  return Math.max(0, (item.quantity || 0) - t.allotted - t.damaged - t.lost - __dmg);
}

function allocStatusOfItem(item) {
  const avail = availableQty(item);
  if (avail <= 0) {
    const t = allocTotals(item);
    if (t.allotted > 0 || t.damaged > 0 || t.lost > 0) return { cls: "status-out", label: "Fully Issued" };
    return { cls: "status-out", label: "Out of Stock" };
  }
  if (avail <= (item.minStock || 0)) return { cls: "status-low", label: "Low" };
  return { cls: "status-ok", label: "Available" };
}

function allocLost(a) { return Math.max(0, a.qtyLost || 0); }
function allocRecovered(a) { return Math.max(0, a.qtyRecovered || 0); }
function allocRecoverable(a) { return Math.max(0, allocLost(a) - allocRecovered(a)); }
function allocOutstanding(a) { return Math.max(0, (a.qtyAllotted || 0) - (a.qtyReturned || 0) - allocLost(a)); }
function allocRemaining(a) { return allocOutstanding(a); }

function __allocMobileOf(a) {
  if (a.mobile) return a.mobile;
  const p = getPersons().find(x => (x.beltNo || "").toUpperCase() === (a.beltNo || "").toUpperCase() && x.mobile);
  return p ? p.mobile : "\u2014";
}

function allocStatusOf(a) {
  if (a.status === "CANCELLED") return "CANCELLED";
  const out = allocOutstanding(a);
  const recoverable = allocRecoverable(a);
  if (out <= 0 && recoverable <= 0) {
    if (a.status === "DAMAGED") return "DAMAGED";
    if (a.status === "LOST" && allocLost(a) === 0 && allocRecovered(a) === 0) return "LOST";
    return "RETURNED";
  }
  if (recoverable > 0) {
    if (allocRecovered(a) > 0) return "PARTIALLY_RECOVERED";
    return "LOST";
  }
  if ((a.qtyReturned || 0) > 0) return "PARTIALLY_RETURNED";
  return "ALLOTTED";
}

function allocStatusBadge(st) {
  const map = {
    ALLOTTED: { cls: "status-ok", label: "Issued" },
    PARTIALLY_RETURNED: { cls: "status-low", label: "Partially Returned" },
    RETURNED: { cls: "status-neutral", label: "Returned" },
    DAMAGED: { cls: "status-low", label: "Scrap" },
    PARTIALLY_RECOVERED: { cls: "status-warn", label: "Partially Recovered" },
    LOST: { cls: "status-out", label: "Lost" },
    CANCELLED: { cls: "status-neutral", label: "Cancelled" }
  };
  const m = map[st] || { cls: "status-neutral", label: st };
  return `<span class="status-badge ${m.cls}">${m.label}</span>`;
}

function itemHistoryPush(item, ev) {
  if (!item.history) item.history = [];
  const entry = {
    type: ev.type,
    qty: ev.qty || 0,
    person: ev.person || "",
    ref: ev.ref || "",
    date: ev.date || "",
    time: ev.time || "",
    remarks: ev.remarks || "",
    user: ev.user || (currentUser ? (currentUser.name || currentUser.username || "") : ""),
    at: Date.now()
  };
  if (Array.isArray(ev.photos) && ev.photos.length) entry.photos = ev.photos;
  item.history.push(entry);
}

function __histWithBalances(item) {
  const h = (item.history || []).slice();
  let run = (item.quantity || 0) - h.reduce((s, x) => s + (Number(x.qty) || 0), 0);
  return h.map(x => { const prev = run; run += (Number(x.qty) || 0); return Object.assign({}, x, { prev: prev, balance: run }); });
}
const __hTypeLabel = { STOCK_IN: "Stock Added", ADJUST: "Stock Adjustment", WRITEOFF: "Write-off", DAMAGE: "Marked Scrap", LOSS: "Marked Lost", RETURN: "Returned", RECOVERED: "Recovered", CANCELLED: "Issue Cancelled", ITEM_DELETED: "Item Deleted" };
function persistAlloc(items, allotments, persons) {
  // RBAC choke-point for the allotment workflows (allot / return / cancel /
  // scan import). These flows legitimately persist the whole district item
  // array (which may contain other units' records) but only mutate the
  // allotted/damaged/lost COUNTERS ? the server's inventory-RBAC diff
  // deliberately treats counter-only changes as no-ops, so these saves pass.
  // Real record-content writes are guarded at their own entry points
  // (openItemModal/saveItem/deleteItem/saveAdjust) and re-verified by the
  // server. Developer Admin is read-only for inventory, so its counter
  // changes are blocked here.
  if (currentUser && isDevAdmin()) { toast(__devRbacLockMsg(), "error"); return; }
  saveItems(items);
  saveAllotments(allotments);
  if (persons) savePersons(persons);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTimeStr() { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

let __allocTab = "allotted"; // stock tab moved to Inventory
let __invTab = "stock"; // Inventory sub-tab: "stock" = Item Stock, "history" = Stock History
let __invStockLoc = "all"; // Item Stock location scope for admins: "all" = all locations (default), or a specific location id

// Rebuilding the category list must not throw away the boxes the user ticked,
// so the chosen ids are read back and re-selected afterwards.
// ms: the bound multiselect instance to re-render, so its label and boxes pick
  // up the rebuilt option list. Without it the panel would still show the old
  // categories until something else touched it.
/* One collator for every dropdown list, so ordering is consistent and, more
   importantly, reproducible: names that differ only in case or by an accent
   land together instead of splitting across the list. numeric:true keeps
   "Belt 2" ahead of "Belt 10". Falls back to a plain lowercased compare on the
   rare runtime without Intl.Collator. */
const __listCollator = (typeof Intl !== "undefined" && Intl.Collator)
  ? new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
  : null;
// Returns a NEW array; the caller's array is never mutated, so sorting here
// cannot reorder the live store that the next render reads from.
function __byName(list, nameOf) {
  const key = nameOf || (x => (x && x.name) || "");
  return (list || []).slice().sort((a, b) => __listCollator
    ? __listCollator.compare(String(key(a) || ""), String(key(b) || ""))
    : String(key(a) || "").toLowerCase().localeCompare(String(key(b) || "").toLowerCase()));
}
function __sortedCategories() { return __byName(getCategories()); }
function __repopulateMultiCat(sel, ms) {
  if (!sel) return;
  const keep = (typeof __msSelected === "function" ? __msSelected(sel) : []).map(o => o.value);
  sel.innerHTML = `<option value="">All Categories</option>` + __sortedCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  Array.prototype.forEach.call(sel.options, o => { if (o.value && keep.indexOf(o.value) >= 0) o.selected = true; });
  const inst = ms || (sel.id === "allocCatFilter" ? window.__msCatAI : window.__msCatIS);
  if (inst && inst.refresh) inst.refresh();
}
function renderAllotments() {
  __repopulateMultiCat($("#allocStockCat"));
  renderAllocStockFilters();
  if (__allocTab === "stock") renderAllocStock();
  else if (__allocTab === "allotted") renderAllottedList();
  else renderReturnHistory();
}

function renderAllocStockFilters() {
  const acts = getVisibleAllotments();
  const items = getItems();
  // Repopulated through the multiselect helper so ticked boxes survive and the
  // panel label is rewritten with the new option list.
  __repopulateMultiCat($("#allocCatFilter"));
  const itemF = $("#allocItemFilter");
  if (itemF) itemF.innerHTML = `<option value="">All Items</option>` + items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
  const rankF = $("#allocRankFilter");
  if (rankF) {
    const ranks = [...new Set(acts.map(a => a.rank).filter(Boolean))].sort();
    rankF.innerHTML = `<option value="">All Ranks</option>` + ranks.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  }
}

let __allocStockSort = { key: "name", dir: 1 };
let __allocStockType = "all";

function setStockType(type) {
  __allocStockType = type;
  const sel = $("#allocStockType");
  if (sel && sel.value !== type) sel.value = type;
  renderAllocStock();
}

function setStockSort(key) {
  if (__allocStockSort.key === key) __allocStockSort.dir *= -1;
  else __allocStockSort = { key, dir: 1 };
  updateStockSortHeader();
  renderAllocStock();
}

function updateStockSortHeader() {
  document.querySelectorAll("#allocStockTable thead .sortable").forEach(th => {
    const arrow = th.querySelector(".sort-arrow");
    if (!arrow) return;
    arrow.textContent = th.dataset.sort === __allocStockSort.key ? (__allocStockSort.dir > 0 ? "\u25B2" : "\u25BC") : "";
  });
}

function __allocStockSorted(rows) {
  const cats = getCategories();
  const { key, dir } = __allocStockSort;
  const catName = i => (cats.find(c => c.id === i.categoryId) || {}).name || "";
  rows.sort((a, b) => {
    let av, bv;
    if (key === "name") { av = a.name; bv = b.name; }
    else if (key === "category") { av = catName(a); bv = catName(b); }
    else if (key === "total") { av = a.quantity || 0; bv = b.quantity || 0; }
    else if (key === "available") { av = availableQty(a); bv = availableQty(b); }
    else if (key === "allotted") { av = a.allotted || 0; bv = b.allotted || 0; }
    else if (key === "loss") { av = a.lostReturned || 0; bv = b.lostReturned || 0; }
    else if (key === "damaged") { av = (a.conditionCounts || {}).poor || 0; bv = (b.conditionCounts || {}).poor || 0; }
    else if (key === "scrap") { av = (a.conditionCounts || {}).damaged || 0; bv = (b.conditionCounts || {}).damaged || 0; }
    else if (key === "status") { av = allocStatusOfItem(a).label; bv = allocStatusOfItem(b).label; }
    if (typeof av === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
  // Ticked categories form one block each, in the order they were ticked.
  if (typeof __msGrouped === "function") return __msGrouped(rows, $("#allocStockCat"), i => i.categoryId);
  return rows;
}

function __allocStockFiltered() {
  const cats = getCategories();
  const locations = getLocations();
  const q = (($("#allocStockSearch") || {}).value || "").toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const catF = (typeof __msMatches === "function") ? __msMatches($("#allocStockCat")) : (($("#allocStockCat") || {}).value || "");
  let pool = getItems().filter(i => !i.isDeleted);
  if (isAdmin() && currentUser) {
    if (__invStockLoc === "own") pool = pool.filter(i => i.locationId === currentUser.locationId);
    else if (__invStockLoc !== "all") pool = pool.filter(i => i.locationId === __invStockLoc);
  }
  return pool.filter(i => {
    if (typeof catF === "function" ? !catF(i) : (catF && i.categoryId !== catF)) return false;
    if (terms.length) {
      const cat = cats.find(c => c.id === i.categoryId);
      const loc = i.locationId ? locations.find(l => l.id === i.locationId) : null;
      const hay = [i.name, cat ? cat.name : "", i.unit || "", loc ? loc.name : ""].join(" ").toLowerCase();
      if (!terms.every(t => hay.includes(t))) return false;
    }
    if (__allocStockType === "allotted" && !(i.allotted > 0)) return false;
    if (__allocStockType === "available" && !(availableQty(i) > 0)) return false;
    return true;
  });
}

const __STOCK_HEAD_STD = '<tr><th style="width:54px">S.No</th><th class="sortable" data-sort="name">Item Name <span class="sort-arrow"></span></th><th class="sortable" data-sort="total">Total Qty <span class="sort-arrow"></span></th><th class="sortable" data-sort="available">Available <span class="sort-arrow"></span></th><th class="sortable" data-sort="allotted">Issued <span class="sort-arrow"></span></th><th class="sortable" data-sort="loss">Lost <span class="sort-arrow"></span></th><th class="sortable" data-sort="damaged">Damaged <span class="sort-arrow"></span></th><th class="sortable" data-sort="scrap">Scrap <span class="sort-arrow"></span></th><th class="sortable" data-sort="status">Status <span class="sort-arrow"></span></th><th>Actions</th></tr>';
const __STOCK_HEAD_ALL = '<tr><th style="width:54px">S.No</th><th class="sortable" data-sort="name">Item Name <span class="sort-arrow"></span></th><th>Unit</th><th class="sortable" data-sort="total">Total Qty <span class="sort-arrow"></span></th><th class="sortable" data-sort="available">Available <span class="sort-arrow"></span></th><th class="sortable" data-sort="allotted">Issued <span class="sort-arrow"></span></th><th class="sortable" data-sort="loss">Lost <span class="sort-arrow"></span></th><th class="sortable" data-sort="damaged">Damaged <span class="sort-arrow"></span></th><th class="sortable" data-sort="scrap">Scrap <span class="sort-arrow"></span></th><th class="sortable" data-sort="status">Status <span class="sort-arrow"></span></th><th>Actions</th></tr>';
function renderStockLocToggle() {
  const seg = $("#allocStockLocToggle");
  if (!seg) return;
  seg.classList.toggle("hidden", !isAdmin());
  const own = $("#locOwnBtn"), sel = $("#locAllSel");
  if (own) { own.classList.toggle("btn-primary", __invStockLoc === "own"); own.classList.toggle("btn-outline", __invStockLoc !== "own"); }
  if (sel) {
    sel.innerHTML = `<option value="all">All Locations</option>` + __byName(getLocations()).map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
    if (__invStockLoc !== "own" && ![...sel.options].some(o => o.value === __invStockLoc)) __invStockLoc = "all";
    if (__invStockLoc !== "own") sel.value = __invStockLoc;
  }
}
function setInvStockLoc(mode) {
  if (!isAdmin()) return;
  __invStockLoc = mode === "all" ? "all" : (mode === "own" ? "own" : String(mode));
  renderStockLocToggle();
  renderAllocStock();
}

function renderAllocStock() {
  const body = $("#allocStockBody");
  if (!body) return;
  const cats = getCategories();
  renderStockLocToggle();
  const allMode = isAdmin() && __invStockLoc !== "own";
  const locations = getLocations();
  const head = document.querySelector("#allocStockTable thead");
  if (head) head.innerHTML = allMode ? __STOCK_HEAD_ALL : __STOCK_HEAD_STD;
  const rows = __allocStockSorted(__allocStockFiltered());
  updateStockSortHeader();
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="${allMode ? 12 : 11}">No items found.</td></tr>`; renderPager("allocStock", 0, renderAllocStock); return; }
  let ttotal = 0, tavailable = 0, tallot = 0, tloss = 0, tdamaged = 0, tscrap = 0;
  rows.forEach(i => {
    ttotal += i.quantity || 0;
    tallot += i.allotted || 0;
    tavailable += availableQty(i);
    tloss += i.lostReturned || 0;
    const __cc = i.conditionCounts || {};
    tdamaged += __cc.poor || 0;
    tscrap += __cc.damaged || 0;
  });
  const baseNo = __pgPage("allocStock", rows.length) * PAGE_SIZE;
  body.innerHTML = __pgRows("allocStock", rows).map((i, idx) => {
    const cat = cats.find(c => c.id === i.categoryId);
    const st = allocStatusOfItem(i);
    const loc = i.locationId ? locations.find(l => l.id === i.locationId) : null;
    const unitCell = allMode ? "<td>" + esc(loc ? loc.name : "") + "</td>" : "";
    const acts = actDD([
      { label: "View", attrs: `data-alloc-action="view" data-id="${i.id}"` },
      ...(canEditItem(i) ? [
        { label: "Update", attrs: `data-alloc-action="edit" data-id="${i.id}"` }
      ] : [])
    ]);
    return `<tr><td>${baseNo + idx + 1}</td><td class="item-name">${__ipLink(i)}</td>${unitCell}<td class="qty-strong">${i.quantity || 0}</td><td class="qty-strong" style="color:var(--green)">${availableQty(i)}</td><td class="qty-strong" style="color:var(--primary)">${i.allotted || 0}</td><td class="qty-strong" style="color:var(--red)">${i.lostReturned || 0}</td><td class="qty-strong" style="color:var(--amber)">${(i.conditionCounts || {}).poor || 0}</td><td class="qty-strong" style="color:var(--red)">${(i.conditionCounts || {}).damaged || 0}</td><td><span class="status-badge ${st.cls}">${st.label}</span></td><td class="actions-cell">${acts}</td></tr>`;
  }).join("") +
    `<tr class="rpt-total-row"><td></td><td class="rpt-total-label">Total</td>${allMode ? "<td></td>" : ""}<td class="qty-strong">${ttotal}</td><td class="qty-strong">${tavailable}</td><td class="qty-strong">${tallot}</td><td class="qty-strong">${tloss}</td><td class="qty-strong">${tdamaged}</td><td class="qty-strong">${tscrap}</td><td colspan="2"></td></tr>`;
  renderPager("allocStock", rows.length, renderAllocStock);
}

function __allocListFiltered() {
  const cats = getCategories();
  const q = (($("#allocSearch") || {}).value || "").toLowerCase();
  // Category is a multi-select now, so this is either null (show all) or a
  // predicate on the row, not a single id to compare against.
  const catF = (typeof __msMatches === "function") ? __msMatches($("#allocCatFilter")) : (($("#allocCatFilter") || {}).value || "");
  const itemF = (($("#allocItemFilter") || {}).value || "");
  const postF = (($("#allocPostingFilter") || {}).value || "").toLowerCase();
  const rankF = (($("#allocRankFilter") || {}).value || "");
  // Status is a multi-select as well, so the picked values become a Set and an
  // empty Set means "show every status". __msMatches is category-specific
  // (it reads row.categoryId), hence __msSelected here rather than it.
  const statusSel = $("#allocStatusFilter");
  const statusSet = (typeof __msSelected === "function")
    ? new Set(__msSelected(statusSel).map(o => o.value))
    : new Set([((statusSel || {}).value || "")].filter(Boolean));
  const dateFrom = (($("#allocDateFrom") || {}).value || "");
  const dateTo = (($("#allocDateTo") || {}).value || "");

  return getVisibleAllotments().filter(a => {
    if (catF && a.categoryId && !catF(a)) return false;
    if (itemF && a.itemId !== itemF) return false;
    if (rankF && a.rank !== rankF) return false;
    if (statusSet.size && !statusSet.has(allocStatusOf(a))) return false;
    if (postF && ((a.posting || "").toLowerCase()).indexOf(postF) === -1) return false;
    if (q) {
      const hay = [a.name, a.beltNo, a.itemName, a.posting, a.rank, a.categoryName, a.mobile || ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (dateFrom) {
      const d = a.createdAt || 0;
      if (!d || d < new Date(dateFrom + "T00:00:00").getTime()) return false;
    }
    if (dateTo) {
      const d = a.createdAt || 0;
      if (!d || d >= new Date(dateTo + "T00:00:00").getTime() + 86400000) return false;
    }
    return true;
  }).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
}

function renderAllottedList() {
  const body = $("#allocBody");
  if (!body) return;
  const cats = getCategories();
  const rows = __allocListFiltered();
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="10">No issued items found.</td></tr>`; renderPager("alloc", 0, renderAllottedList); return; }
  const baseNo = __pgPage("alloc", rows.length) * PAGE_SIZE;
  body.innerHTML = __pgRows("alloc", rows).map((a, idx) => {
    const st = allocStatusOf(a);
    const outstanding = allocOutstanding(a);
    const recoverable = allocRecoverable(a);
    const acts = actDD([
      { label: "View", attrs: `data-alloc-action="view" data-id="${a.id}"` },
      ...(canEdit() && outstanding > 0 ? [
        { label: "Edit", attrs: `data-alloc-action="edit" data-id="${a.id}"` },
        { label: "Return", attrs: `data-alloc-action="return" data-id="${a.id}"` }
      ] : []),
      ...(canEdit() && outstanding > 0 ? [
        { label: "Lost", cls: "act-dd-del", attrs: `data-alloc-action="loss" data-id="${a.id}"` }
      ] : []),
      ...(canEdit() && recoverable > 0 ? [
        { label: "Recovery", attrs: `data-alloc-action="recovery" data-id="${a.id}"` }
      ] : [])
    ]);
    const d = a.createdAt || 0;
    return `<tr><td>${baseNo + idx + 1}</td><td><a href="javascript:void(0)" class="person-link" data-alloc-action="person" data-belt="${esc(a.beltNo)}">${esc(a.name)}</a></td><td>${esc(a.beltNo || "")}</td><td>${esc(__allocMobileOf(a))}</td><td class="item-name">${__ipLink({ id: a.itemId, name: a.itemName })}</td><td class="qty-strong">${outstanding}</td><td class="qty-strong" style="color:var(--red)">${allocRecoverable(a)}</td><td>${d ? fmtDate(d) : "&mdash;"}</td><td>${esc(a.time || "") || "&mdash;"}</td><td class="actions-cell">${acts}</td></tr>`;
  }).join("");
  renderPager("alloc", rows.length, renderAllottedList);
}

function __allocReturns() {
  const rows = [];
  const q = (($("#allocRetSearch") || {}).value || "").toLowerCase();
  getVisibleAllotments().forEach(a => {
    (a.returns || []).forEach(r => {
      if (r.condition === "cancelled") return;
      const row = { a, r };
      const hay = [a.name, a.beltNo, a.itemName, r.condition, r.receivedBy || "", r.remarks || ""].join(" ").toLowerCase();
      if (q && !hay.includes(q)) return;
      rows.push(row);
    });
  });
  return rows.sort((x, y) => (y.r.at || 0) - (x.r.at || 0));
}

function renderReturnHistory() {
  const body = $("#allocRetBody");
  if (!body) return;
  const rows = __allocReturns();
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="10">No return history found.</td></tr>`; renderPager("allocRet", 0, renderReturnHistory); return; }
  const condLabels = { good: "Good", poor: "Damaged", damaged: "Scrap", lost: "Lost", other: "Other" };
  const baseNo = __pgPage("allocRet", rows.length) * PAGE_SIZE;
  body.innerHTML = __pgRows("allocRet", rows).map(({ a, r }, idx) => {
    const cond = (r.condition === "damaged" || r.condition === "lost") ? `<span class="status-badge ${r.condition === "lost" ? "status-out" : "status-low"}">${condLabels[r.condition] || r.condition}</span>` : `<span class="status-badge status-neutral">${condLabels[r.condition] || r.condition}</span>`;
    return `<tr><td>${baseNo + idx + 1}</td><td class="item-name">${__ppLink(a)}</td><td>${esc(a.beltNo || "")}</td><td class="item-name">${__ipLink({ id: a.itemId, name: a.itemName })}</td><td class="qty-strong">${r.qty}</td><td>${cond}</td><td>${esc(r.date || "")}</td><td>${esc(r.time || "")}</td><td>${esc(r.receivedBy || "")}</td><td>${esc(r.remarks || "") || "&mdash;"}</td></tr>`;
  }).join("");
  renderPager("allocRet", rows.length, renderReturnHistory);
}

/* ---- Person suggestions ---- */
/* Privacy: the Search Person dropdown shows only the current user's own persons. Admins see their district's persons; units/staff see only persons of their own unit/staff. */
function getVisiblePersons() {
  const all = getPersons();
  if (!currentUser) return [];
  if (currentUser.role === "admin" || currentUser.role === "devadmin") {
    return all.filter(p => !p.districtId || p.districtId === activeDistrictId || p.districtId === currentUser.districtId);
  }
  return all.filter(p => String(p.locationId || "") === String(currentUser.locationId || ""));
}
function bindPersonSuggest() {
  const input = $("#alPerson");
  const box = $("#alPersonSuggest");
  if (!input || !box) return;
  const personRow = (p) => `<button type="button" class="suggest-item" data-belt="${esc(p.beltNo)}"><span class="suggest-name">${esc(p.name)}</span><span class="suggest-sub">${esc(p.beltNo)}</span>${isAdmin() ? '<span class="suggest-del" data-del-belt="' + esc(p.beltNo) + '" title="Remove person">&times;</span>' : ""}</button>`;
  input.addEventListener("focus", () => {
    const persons = getVisiblePersons().slice(0, 8);
    if (!persons.length) return;
    box.innerHTML = persons.map(personRow).join("");
    box.classList.remove("hidden");
  });
  input.addEventListener("input", () => {
    const raw = input.value.trim();
    const q = raw.toLowerCase();
    if (!q) { box.classList.add("hidden"); return; }
    const persons = getVisiblePersons().filter(p => (p.name + " " + (p.rank || "") + " " + p.beltNo).toLowerCase().includes(q)).slice(0, 8);
    const exact = getVisiblePersons().some(p => (p.name || "").toLowerCase() === q);
    const rows = persons.map(personRow).join("");
    const newBtn = exact ? "" : `<button type="button" class="suggest-item suggest-new" data-new="1"><span class="suggest-name">+ New Person</span><span class="suggest-sub">Add "${esc(raw)}" \u2014 fill details manually</span></button>`;
    if (!rows && !newBtn) { box.classList.add("hidden"); return; }
    box.innerHTML = rows + newBtn;
    box.classList.remove("hidden");
  });
  box.addEventListener("click", e => {
    const del = e.target.closest(".suggest-del");
    if (del) {
      if (!isAdmin()) return toast("You do not have permission to remove persons.", "error");
      const belt = del.dataset.delBelt || "";
      const p = getPersons().find(x => x.beltNo === belt);
      if (!p) return;
      const active = getVisibleAllotments().filter(a => (a.beltNo || "").toUpperCase() === String(p.beltNo || "").toUpperCase() && allocOutstanding(a) > 0);
      if (active.length) return toast("Cannot remove \u2014 this person has active issued items. Settle them first.", "error");
      if (!confirm("Remove \"" + p.name + "\" (BELT: " + (p.beltNo || "") + ") from the person list?\nPast issue records will remain in history.")) return;
      const persons = getPersons();
      const idx = persons.findIndex(x => x.id === p.id);
      if (idx < 0) return;
      persons.splice(idx, 1);
      savePersons(persons);
      try { __audit("Person Removed", p.name + " (BELT: " + (p.beltNo || "") + ")", { entity: "Person" }); } catch (e2) {}
      toast("Person removed.", "success");
      const row = del.closest(".suggest-item");
      if (row) row.remove();
      if (!box.querySelector(".suggest-item")) box.classList.add("hidden");
      return;
    }
    const it = e.target.closest(".suggest-item");
    if (!it) return;
    if (it.dataset.new) {
      box.classList.add("hidden");
      const bk = $("#alBelt"); if (bk) bk.focus();
      return;
    }
    const p = getPersons().find(x => x.beltNo === it.dataset.belt);
    if (!p) return;
    input.value = p.name;
    $("#alRank").value = p.rank || "";
    $("#alBelt").value = p.beltNo || "";
    $("#alPosting").value = p.posting || "";
    const __amSug = $("#alMobile"); if (__amSug) { __amSug.value = p.mobile || ""; __alMobileValidate(false); }
    box.classList.add("hidden");
  });
  document.addEventListener("click", e => { if (!e.target.closest("#alpPersonGroup")) box.classList.add("hidden"); });
}

/* ---- Issue Items: mobile must be exactly 10 digits (live red feedback) ---- */
function __alMobileValidate(forceCheck) {
  const el = $("#alMobile");
  if (!el) return;
  const err = $("#alMobileErr");
  const v = (el.value || "").trim();
  let bad = false, msg = "";
  if (v !== "" || forceCheck) {
    if (!/^\d{10}$/.test(v)) { bad = true; msg = v === "" ? "Mobile number is required." : "Exactly 10 digits required" + (v.length ? " (" + v.replace(/\D/g, "").length + " entered)" : "") + "."; }
  }
  el.classList.toggle("input-error", bad);
  if (err) { err.textContent = bad ? msg : ""; err.classList.toggle("hidden", !bad); }
}
function bindAllotMobileValidation() {
  const el = $("#alMobile");
  if (!el) return;
  const group = el.closest(".form-group");
  if (group && !$("#alMobileErr")) {
    const hint = document.createElement("div");
    hint.id = "alMobileErr"; hint.className = "field-err hidden";
    group.appendChild(hint);
  }
  el.setAttribute("inputmode", "numeric");
  el.addEventListener("input", () => __alMobileValidate(false));
  el.addEventListener("blur", () => __alMobileValidate(false));
}

/* ---- Allot modal (multi-item) ---- */
let __alItemRows = [];
let __alRowSeq = 0;
function __alType() { const c = $("#alTypeCons"); return (c && c.checked) ? "cons" : "stock"; }
function __fdType() { const c = $("#fdTypeCons"); return (c && c.checked) ? "cons" : "stock"; }

function allocRowTemplate(r) {
  return `<div class="alloc-item-row" data-row="${r.key}">
    <div class="form-group" style="flex:1.4">
      <label>Category</label>
      <select class="al-row-cats" data-row="${r.key}" required><option value="">Select category</option></select>
    </div>
    <div class="form-group" style="flex:2.4">
      <label>Item</label>
      <select class="al-row-items" data-row="${r.key}" disabled required><option value="">Select category first</option></select>
    </div>
    <div class="form-group" style="flex:0.8">
      <label>Qty</label>
      <input type="number" class="al-row-qty" data-row="${r.key}" min="1" value="1" required />
    </div>
    <div class="form-group al-cond-group" style="flex:0.9">
      <label>Condition</label>
      <select class="al-row-cond" data-row="${r.key}"><option value="good">Good</option><option value="poor">Damaged</option></select>
    </div>
    <div class="alloc-row-del" data-row="${r.key}" title="Remove item">&times;</div>
    <div class="stock-balance al-row-balance" data-row="${r.key}"></div>
  </div>`;
}
function addAllotItemRow(prefillItemId) {
  const container = $("#alItems");
  if (!container) return;
  const rowKey = ++__alRowSeq;
  const r = { key: rowKey, categoryId: "", itemId: prefillItemId || "", qty: 1, cond: "good" };
  __alItemRows.push(r);
  container.insertAdjacentHTML("beforeend", allocRowTemplate(r));
  const catSel = container.querySelector(`.al-row-cats[data-row="${rowKey}"]`);
  if (catSel) {
    catSel.innerHTML = `<option value="">Select category</option>` + __byName(__alType() === "cons" ? getConsCats() : getCategories()).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  }
  if (r.itemId) {
    const it = getItems().find(i => i.id === r.itemId);
    if (it) {
      r.categoryId = it.categoryId;
      if (catSel) catSel.value = it.categoryId;
    }
  }
  renderRowItemOptions(r);
  refreshAllotRowBalances();
  refreshAllotSummary();
}

function removeAllotItemRow(key) {
  const el = document.querySelector(`.alloc-item-row[data-row="${key}"]`);
  if (el) el.remove();
  __alItemRows = __alItemRows.filter(r => r.key != key);
  refreshAllotRowOptions();
  refreshAllotSummary();
}

function renderRowItemOptions(r) {
  const sel = document.querySelector(`.al-row-items[data-row="${r.key}"]`);
  if (!sel) return;
  if (!r.categoryId) {
    sel.innerHTML = `<option value="">Select category first</option>`;
    sel.disabled = true;
    r.itemId = "";
    return;
  }
  const isCons = __alType() === "cons";
  const used = new Set(__alItemRows.filter(x => x.key !== r.key).map(x => x.itemId).filter(Boolean));
  const opts = (isCons ? getConsItems() : getItems()).filter(i => i.categoryId === r.categoryId && !used.has(i.id));
  sel.disabled = false;
  const cur = r.itemId && opts.some(o => o.id === r.itemId) ? r.itemId : "";
  sel.innerHTML = `<option value="">Select item</option>` + opts.map(o => `<option value="${o.id}" ${o.id === cur ? "selected" : ""}>${esc(o.name)} (Avail: ${isCons ? __consQty(o.id).available : availableQty(o)})</option>`).join("");
  sel.value = cur;
  r.itemId = cur;
  return cur;
}

function refreshAllotRowOptions() {
  __alItemRows.forEach(r => renderRowItemOptions(r));
}

function refreshAllotRowBalances() {
  __alItemRows.forEach(r => {
    const box = document.querySelector(`.al-row-balance[data-row="${r.key}"]`);
    if (!box) return;
    if (__alType() === "cons") {
      const ci = r.itemId ? getConsItems().find(i => i.id === r.itemId) : null;
      if (!ci) { box.innerHTML = ""; return; }
      const q = __consQty(ci.id);
      box.innerHTML = `<span class="bal-chip bal-total">Available: <b>${q.available}</b></span><span class="bal-chip bal-pend">Pending: <b>${q.pending}</b></span>`;
      return;
    }
    const item = r.itemId ? getItems().find(i => i.id === r.itemId) : null;
    if (!item) { box.innerHTML = ""; return; }
    const t = allocTotals(item);
    box.innerHTML = `<span class="bal-chip bal-total">Total: <b>${item.quantity || 0}</b></span><span class="bal-chip bal-avail">Available: <b>${availableQty(item)}</b></span><span class="bal-chip bal-allot">Allotted: <b>${t.allotted}</b></span><span class="bal-chip bal-dmg">Damaged: <b>${t.damaged}</b></span><span class="bal-chip bal-lost">Lost: <b>${t.lost}</b></span>`;

  });
}


function refreshAllotSummary() {
  const sum = $("#alItemsSummary");
  if (!sum) return;
  const valid = __alItemRows.filter(r => r.itemId);
  const totalQty = valid.reduce((s, r) => s + (r.qty > 0 ? r.qty : 0), 0);
  sum.textContent = valid.length ? `${valid.length} item(s) \u00b7 total quantity ${totalQty}` : "";
}

function bindAllotRowEvents() {
  const container = $("#alItems");
  if (!container || container.dataset.bound) return;
  container.dataset.bound = "1";
  container.addEventListener("change", e => {
    const catSel = e.target.closest(".al-row-cats");
    if (catSel) {
      const key = catSel.dataset.row;
      const r = __alItemRows.find(x => x.key == key);
      if (r) {
        r.categoryId = catSel.value || "";
        r.itemId = "";
        r.qty = parseInt((container.querySelector(`.al-row-qty[data-row="${key}"]`) || {}).value, 10) || 1;
        renderRowItemOptions(r);
        refreshAllotRowBalances();
        refreshAllotSummary();
      }
      return;
    }
    const sel = e.target.closest(".al-row-items");
    if (sel) {
      const key = sel.dataset.row;
      const r = __alItemRows.find(x => x.key == key);
      if (r) {
        r.itemId = sel.value || "";
        r.qty = parseInt((container.querySelector(`.al-row-qty[data-row="${key}"]`) || {}).value, 10) || 1;
        refreshAllotRowOptions();
        refreshAllotRowBalances();
        refreshAllotSummary();
      }
      return;
    }
    const qtyEl = e.target.closest(".al-row-qty");
    if (qtyEl) {
      const key = qtyEl.dataset.row;
      const r = __alItemRows.find(x => x.key == key);
      if (r) r.qty = parseInt(qtyEl.value, 10) || 0;
      refreshAllotSummary();
    }
  });
  container.addEventListener("click", e => {
    const del = e.target.closest(".alloc-row-del");
    if (del) removeAllotItemRow(Number(del.dataset.row));
  });
}

function openAllotModal() {
  $("#allotModalTitle").textContent = "Allot Items";
  $("#alSubmitBtn").textContent = "Allot Items";
  $("#alEditId").value = "";
  $("#alPerson").value = ""; $("#alRank").value = ""; $("#alBelt").value = ""; $("#alPosting").value = "";
  const alMob = $("#alMobile"); if (alMob) alMob.value = "";
  $("#alRemarks").value = "";
  ["alPerson", "alRank", "alBelt", "alPosting", "alDate", "alTime", "alRemarks"].forEach(id => { const el = $("#" + id); if (el) { el.disabled = false; el.style.opacity = ""; } });
  $("#alDate").value = todayStr();
  $("#alTime").value = nowTimeStr();
  const addBtn = $("#alAddItemRow");
  if (addBtn) addBtn.style.display = "";
  const ts = $("#alTypeStock"); const tc = $("#alTypeCons");
  if (ts) ts.checked = true;
  if (tc) tc.checked = false;
  __attStore.issue = []; __attRender("issue");
  __alItemRows = [];
  const container = $("#alItems");
  if (container) container.innerHTML = "";
  bindAllotRowEvents();
  addAllotItemRow();
  refreshAllotSummary();
  openModal("#allotModal");
  setTimeout(() => $("#alPerson").focus(), 50);
}

async function saveAllotment(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canEdit()) return toast("You do not have permission to issue items.", "error");
  const editId = $("#alEditId").value;
  if (editId) { saveEditedAllotment(e, editId); return; }

  const name = $("#alPerson").value.trim();
  let rank = ($("#alRank") ? $("#alRank").value.trim() : "");
  const belt = $("#alBelt").value.trim().toUpperCase();
  let posting = ($("#alPosting") ? $("#alPosting").value.trim() : "");
  const mobile = ($("#alMobile") ? $("#alMobile").value.trim() : "");
  if (!mobile) return toast("Mobile number is required.", "error");
  if (!/^\d{10}$/.test(mobile)) { __alMobileValidate(true); return toast("Mobile number must be exactly 10 digits.", "error"); }
  const date = $("#alDate").value || todayStr();
  const time = $("#alTime").value || nowTimeStr();
  const remarks = $("#alRemarks").value.trim();
  if (!name || !belt) return toast("Fill all person details.", "error");
  /* Rank/Post + Posting inputs removed from dialog (2026.09.187) — auto-fill
     from person master by BELT so stored issue records stay complete. */
  if (!rank || !posting) {
    const __pm = getPersons().find(x => (x.beltNo || "").toUpperCase() === belt);
    if (__pm) { rank = rank || __pm.rank || ""; posting = posting || __pm.posting || ""; }
  }

  const rows = __alItemRows.filter(r => r.itemId);
  if (!rows.length) return toast("Add at least one item with a quantity.", "error");
  for (const r of rows) {
    if (!r.qty || r.qty < 1) return toast("Enter a valid quantity for every row.", "error");
  }

  if (__alType() === "cons") {
    const consItems = getConsItems();
    const consRows = [];
    for (const r of __alItemRows.filter(x => x.itemId)) {
      const ci = consItems.find(i => i.id === r.itemId);
      if (!ci) return toast("Select a valid consume item in every row.", "error");
      if (!r.qty || r.qty < 1) return toast("Enter a valid quantity for every row.", "error");
      const q = __consQty(ci.id);
      if (r.qty > q.availForNew) return toast("Insufficient available quantity for \"" + ci.name + "\". Available: " + q.availForNew, "error");
      consRows.push({ ci, qty: r.qty });
    }
    if (!consRows.length) return toast("Add at least one item with a quantity.", "error");
    let persons2 = getPersons();
    let person2 = persons2.find(p => p.beltNo === belt);
    if (!person2) {
      person2 = { id: uid(), name, rank, beltNo: belt, posting, mobile: mobile || "", districtId: activeDistrictId, locationId: (getVisibleLocationId() || (currentUser ? currentUser.locationId : "")), createdAt: Date.now() };
      persons2.push(person2);
    }
    if (mobile) person2.mobile = mobile;
    savePersons(persons2);
    const __alPhoto = (__attStore.issue || [])[0];
    const __alUser = getUsers().find(u => (u.name || "").toLowerCase() === name.toLowerCase() && u.districtId === activeDistrictId);
    let __alTo;
    if (__alUser) __alTo = { type: "staff", id: __alUser.id, name };
    else {
      const __alLocId = getVisibleLocationId() || (currentUser ? currentUser.locationId : "");
      const __alLoc = getLocations().find(l => l.id === __alLocId);
      if (!__alLoc) return toast("Consume items need a valid unit or registered staff recipient.", "error");
      __alTo = { type: "unit", id: __alLoc.id, name: __alLoc.name };
    }
    const __alRem = __alUser ? remarks : ("Issued to " + name + " (BELT: " + belt + ")" + (remarks ? " | " + remarks : ""));
    const txns = getConsTxns();
    for (const cr of consRows) {
      const t1 = __consCommit("DISTRIBUTION_REQUEST", cr.ci, cr.qty, __alTo, null, __alRem, __alPhoto ? __alPhoto.dataUrl : "");
      t1.date = date; t1.time = time;
      txns.unshift(t1);
    }
    saveConsTxns(txns);
    __attStore.issue = []; __attRender("issue");
    closeModals(); __alItemRows = []; render();
    __audit("Consumable Items Issued", consRows.length + " consume item(s) to " + __alTo.name + " (BELT: " + belt + ")", { entity: "Consumable" });
    toast(consRows.length + " consume item(s) issue request sent to " + __alTo.name + ".", "success");
    return;
  }


  const items = getItems();
  for (const r of rows) {
    const item = items.find(i => i.id === r.itemId);
    if (!item) return toast("Item not found.", "error");
    if (r.qty > availableQty(item)) return toast(`Insufficient stock for "${item.name}". Only ${availableQty(item)} units available.`, "error");
  }

  let persons = getPersons();
  let person = persons.find(p => p.beltNo === belt);
  if (!person) {
    person = { id: uid(), name, rank, beltNo: belt, posting, mobile: mobile || "", districtId: activeDistrictId, locationId: (getVisibleLocationId() || (currentUser && currentUser.locationId) || null), createdAt: Date.now() };
    persons.push(person);
  }
  if (mobile) person.mobile = mobile;

  let __issueAtts = [];
  if ((__attStore.issue || []).length) { try { __issueAtts = await __attUploadAll("issue"); } catch (e) { return; } }
  const allotments = getAllotments();
  const issueId = uid();
  const now = Date.now();
  rows.forEach(r => {
    const item = items.find(i => i.id === r.itemId);
    const qty = r.qty;
    item.allotted = (item.allotted || 0) + qty;
    itemHistoryPush(item, { type: "ALLOTMENT", qty: -qty, person: name, ref: belt, date, time, remarks: "Issued " + qty + " " + (item.unit || "pcs") + " to " + name, photos: __issueAtts.length ? __issueAtts : undefined });
    const cat = getCategories().find(c => c.id === item.categoryId);
    allotments.unshift({
      id: uid(),
      issueId,
      personId: person.id,
      name, rank, beltNo: belt, posting, mobile,
      districtId: activeDistrictId,
      locationId: person.locationId || item.locationId,
      itemId: item.id, itemName: item.name, categoryId: item.categoryId, categoryName: cat ? cat.name : "",
      condition: r.cond || "good", qtyAllotted: qty, qtyReturned: 0, status: "ALLOTTED",
      date, time, remarks,
      attachments: __issueAtts,
      createdBy: currentUser ? (currentUser.name || currentUser.username) : "",
      createdAt: now, returns: []
});
  });

  persistAlloc(items, allotments, persons);
  __attStore.issue = []; __attRender("issue");
  closeModals();
  __alItemRows = [];
  render();
  __audit("Item Issued", `${rows.length} item(s) — ${name} (BELT: ${belt})`, { entity: "Allotment" });
  toast(`${rows.length} item(s) issued to ${name}.`, "success");
}

function openEditAllotment(id) {
  const a = getAllotments().find(x => x.id === id);
  if (!a) return;
  $("#allotModalTitle").textContent = "Edit Issue";
  $("#alSubmitBtn").textContent = "Update Quantity";
  $("#alEditId").value = a.id;
  $("#alPerson").value = a.name;
  $("#alRank").value = a.rank || "";
  $("#alBelt").value = a.beltNo || "";
  $("#alPosting").value = a.posting || "";
  const __amEdt = $("#alMobile"); if (__amEdt) __amEdt.value = a.mobile || "";
  $("#alDate").value = a.date || todayStr();
  $("#alTime").value = a.time || nowTimeStr();
  $("#alRemarks").value = a.remarks || "";
  ["alPerson", "alRank", "alBelt", "alPosting", "alMobile", "alDate", "alTime", "alRemarks"].forEach(id => { const el = $("#" + id); if (el) { el.disabled = true; el.style.opacity = "0.65"; } });
  const addBtn = $("#alAddItemRow");
  if (addBtn) addBtn.style.display = "none";
  __alItemRows = [];
  const container = $("#alItems");
  if (container) container.innerHTML = "";
  const rowKey = ++__alRowSeq;
  const r = { key: rowKey, itemId: a.itemId, qty: a.qtyAllotted, cond: a.condition || "good" };
  __alItemRows.push(r);
  container.insertAdjacentHTML("beforeend", `<div class="alloc-item-row" data-row="${rowKey}">
    <div class="form-group" style="flex:2.4"><label>Item (locked)</label><input type="text" class="al-row-itemname" data-row="${rowKey}" value="${esc(a.itemName)}" readonly /></div>
    <div class="form-group" style="flex:1.4"><label>Category (locked)</label><input type="text" class="al-row-cat" data-row="${rowKey}" value="${esc(a.categoryName || "")}" readonly /></div>
    <div class="form-group" style="flex:0.8"><label>Edit Quantity</label><input type="number" class="al-row-qty" data-row="${rowKey}" min="1" value="${a.qtyAllotted}" required /></div>
    <div class="stock-balance al-row-balance" data-row="${rowKey}"></div>
  </div>`);
  refreshAllotRowBalances();
  const note = $("#alItemsSummary");
  if (note) note.textContent = `Committed so far: returned ${a.qtyReturned || 0} + lost ${allocLost(a)}. Quantity cannot go below that. All other fields are locked.`;
  openModal("#allotModal");
  setTimeout(() => { const q = document.querySelector(`.al-row-qty[data-row="${rowKey}"]`); if (q) q.focus(); }, 50);
}

function saveEditedAllotment(e, id) {
  const allotments = getAllotments();
  const a = allotments.find(x => x.id === id);
  if (!a) return;
  const first = __alItemRows.find(r => r.itemId === a.itemId) || __alItemRows[0];
  const qEl = first ? document.querySelector(`.al-row-qty[data-row="${first.key}"]`) : null;
  const newQty = qEl ? parseInt(qEl.value, 10) : 0;
  if (!newQty || newQty < 1) return toast("Enter a valid quantity.", "error");
  const committed = (a.qtyReturned || 0) + allocLost(a);
  if (newQty < committed) return toast(`Quantity cannot be less than the already committed amount (${committed} = returned ${a.qtyReturned || 0} + lost ${allocLost(a)}).`, "error");

  const items = getItems();
  const item = items.find(i => i.id === a.itemId);
  if (!item) return toast("Item not found.", "error");
  const delta = newQty - (a.qtyAllotted || 0);
  if (delta > 0 && delta > availableQty(item)) return toast(`Insufficient stock. Only ${availableQty(item)} units are currently available.`, "error");

  a.qtyAllotted = newQty;
  item.allotted = Math.max(0, (item.allotted || 0) + delta);
  if (delta !== 0) itemHistoryPush(item, { type: "ADJUST", qty: -delta, person: a.name, ref: a.beltNo, date: a.date, time: a.time, remarks: "Issued quantity changed by " + (delta > 0 ? "+" : "") + delta });
a.status = allocStatusOf(a);
  persistAlloc(items, allotments, null);
  closeModals();
  __alItemRows = [];
  render();
  __audit("Issue Quantity Updated", `${a.itemName} ? ${newQty} for ${a.name} (BELT: ${a.beltNo})`, { entity: "Allotment" });
  toast("Issue updated.", "success");
}

/* ---- Return ---- */
let __returnAllotId = null;

function openReturnModal(id) {
  const a = getAllotments().find(x => x.id === id);
  if (!a) return;
  __returnAllotId = a.id;
  const rem = allocRemaining(a);
  $("#rtSummary").innerHTML = `<div class="return-summary-row"><span>Person:</span><b>${esc(a.name)} (BELT: ${esc(a.beltNo)})</b></div><div class="return-summary-row"><span>Item:</span><b>${esc(a.itemName)}</b></div><div class="return-summary-row"><span>Issued:</span><b>${a.qtyAllotted}</b></div><div class="return-summary-row"><span>Remaining to return:</span><b style="color:var(--primary)">${rem}</b></div>`;
  $("#rtQty").value = rem;
  $("#rtQty").max = rem;
  if (rem <= 1) $("#rtQty").min = 1;
  $("#rtDate").value = todayStr();
  $("#rtTime").value = nowTimeStr();
  $("#rtCondition").value = "good";
  $("#rtRemarks").value = "";
  openModal("#returnModal");
}

function saveReturn(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canEdit()) return toast("You do not have permission to process returns.", "error");
  const id = __returnAllotId;
  const qty = parseInt($("#rtQty").value, 10);
  const date = $("#rtDate").value || todayStr();
  const time = $("#rtTime").value || nowTimeStr();
  const condition = $("#rtCondition").value;
  const remarks = $("#rtRemarks").value.trim();
  if (!qty || qty < 1) return toast("Enter a valid return quantity.", "error");

  const allotments = getAllotments();
  const a = allotments.find(x => x.id === id);
  if (!a) return toast("Issue record not found.", "error");
  const rem = allocRemaining(a);
  if (qty > rem) return toast(`Return quantity cannot be more than the remaining issued quantity (${rem}).`, "error");

  const items = getItems();
  const item = items.find(i => i.id === a.itemId);
  if (!item) return toast("Item not found.", "error");

  a.qtyReturned = (a.qtyReturned || 0) + qty;
  (a.returns || (a.returns = [])).push({ qty, date, time, condition, remarks, receivedBy: currentUser ? (currentUser.name || currentUser.username) : "", at: Date.now() });

  item.allotted = Math.max(0, (item.allotted || 0) - qty);
  if (condition === "damaged") item.damagedReturned = (item.damagedReturned || 0) + qty;
  else if (condition === "lost") item.lostReturned = (item.lostReturned || 0) + qty;

  a.status = allocStatusOf(a);

  const typeMap = { good: "RETURN", poor: "RETURN", other: "RETURN", damaged: "DAMAGE", lost: "LOSS" };
  const condText = condition === "damaged" ? "Returned as damaged" : condition === "poor" ? "Returned in poor condition" : condition === "lost" ? "Reported lost" : "Returned in good condition";
  itemHistoryPush(item, { type: typeMap[condition] || "RETURN", qty, person: a.name, ref: a.beltNo, date, time, remarks: condText });

persistAlloc(items, allotments, null);
  closeModals();
  render();
  __audit("Return Processed", `${qty} x ${a.itemName} from ${a.name} (${condition})`, { entity: "Allotment" });
  toast("Item return recorded. Stock updated.", "success");
}

/* ---- Cancel allotment ---- */
function cancelAllotment(id) {
  const a = getAllotments().find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Cancel this issue to "${a.name}"? Remaining units (${allocRemaining(a)}) will be returned to stock.`)) return;
  const items = getItems();
  const item = items.find(i => i.id === a.itemId);
  const rem = allocRemaining(a);
  if (rem > 0 && item) item.allotted = Math.max(0, (item.allotted || 0) - rem);
  if (item) itemHistoryPush(item, { type: "CANCELLED", qty: rem, person: a.name, ref: a.beltNo, date: todayStr(), time: nowTimeStr(), remarks: "Issue cancelled, stock restored" });
  (a.returns || (a.returns = [])).push({ qty: rem, date: todayStr(), time: nowTimeStr(), condition: "cancelled", remarks: "Issue cancelled", receivedBy: currentUser ? (currentUser.name || currentUser.username) : "", at: Date.now() });
a.status = "CANCELLED";
  a.statusNote = "Cancelled by " + (currentUser ? (currentUser.name || currentUser.username) : "");
  persistAlloc(items, getAllotments(), null);
  render();
  __audit("Issue Cancelled", `${a.itemName} ? ${a.name} (BELT: ${a.beltNo})`, { entity: "Allotment" });
  toast("Issue cancelled. Stock restored.", "success");
}

/* ---- Report Item Loss ---- */
let __allocLossId = null;

function openLossModal(id) {
  const a = getAllotments().find(x => x.id === id);
  if (!a) return;
  if (!canEdit()) return toast("You do not have permission to report item loss.", "error");
  const outstanding = allocOutstanding(a);
  if (outstanding <= 0) return toast("No quantity eligible for loss.", "error");
  __allocLossId = a.id;
  const item = getItems().find(i => i.id === a.itemId);
  const code = item ? (item.code || item.sku || "") : "";
  $("#lsSummary").innerHTML =
    `<div class="return-summary-row"><span>Person:</span><b>${esc(a.name)} (BELT: ${esc(a.beltNo)})</b></div>` +
    `<div class="return-summary-row"><span>Category:</span><b>${esc(a.categoryName || "")}</b></div>` +
    `<div class="return-summary-row"><span>Item:</span><b>${esc(a.itemName)}</b></div>` +
    (code ? `<div class="return-summary-row"><span>Item Code/SKU:</span><b>${esc(code)}</b></div>` : "") +
    `<div class="return-summary-row"><span>Outstanding (eligible for loss):</span><b style="color:var(--red)">${outstanding}</b></div>` +
    `<div class="return-summary-row"><span>Lost so far:</span><b>${allocLost(a)}</b></div>` +
    `<div class="return-summary-row"><span>Quantity currently available:</span><b>${item ? availableQty(item) : 0}</b></div>`;
  const qtyEl = $("#lsQty");
  qtyEl.value = outstanding;
  qtyEl.max = outstanding;
  qtyEl.min = 1;
  $("#lsQtyHint").textContent = "Max " + outstanding + " — remaining stays as issued and remains returnable.";
  $("#lsReason").value = "";
  $("#lsError").textContent = "";
  $("#lsError").classList.add("hidden");
  $("#lsSubmitBtn").disabled = false;
  openModal("#lossModal");
  setTimeout(() => $("#lsReason").focus(), 50);
}

function __allocFieldErr(el, msg) { if (el) { el.textContent = msg; el.classList.remove("hidden"); } toast(msg, "error"); }

function submitLoss(e) {
  e.preventDefault();
  const btn = $("#lsSubmitBtn");
  if (btn) btn.disabled = true;
  try {
    if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
    if (!canEdit()) return toast("You do not have permission to report item loss.", "error");
    const reason = ($("#lsReason").value || "").trim();
    if (!reason) {
      __allocFieldErr($("#lsError"), "Lost reason is required.");
      return;
    }
    const qty = parseInt($("#lsQty").value, 10);
    if (!qty || qty < 1) return __allocFieldErr($("#lsError"), "Lost quantity is required.");
    const a = getAllotments().find(x => x.id === __allocLossId);
    if (!a) return toast("Issue record not found.", "error");
    const outstanding = allocOutstanding(a);
    if (outstanding <= 0) return toast("No quantity eligible for loss.", "error");
    if (qty > outstanding) return __allocFieldErr($("#lsError"), "Lost quantity cannot exceed the quantity eligible for loss.");
    const items = getItems();
    const item = items.find(i => i.id === a.itemId);
    if (!item) return toast("Item not found.", "error");

    const date = todayStr();
    const time = nowTimeStr();
    const by = currentUser ? (currentUser.name || currentUser.username) : "";
    a.qtyLost = allocLost(a) + qty;
    a.qtyRecovered = a.qtyRecovered || 0;
    (a.losses || (a.losses = [])).push({ id: uid(), qty, reason, by, date, time, at: Date.now() });
    item.allotted = Math.max(0, (item.allotted || 0) - qty);
    item.lostReturned = (item.lostReturned || 0) + qty;
    itemHistoryPush(item, { type: "LOSS", qty, person: a.name, ref: a.beltNo, date, time, remarks: reason });
    a.status = allocStatusOf(a);
    persistAlloc(items, getAllotments(), null);
    closeModals();
    render();
    __audit("Item Lost Reported", `${qty} x ${a.itemName} lost from ${a.name} (BELT: ${a.beltNo}) \u2014 ${reason}`, { entity: "Allotment" });
    toast("Item loss recorded successfully.", "success");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---- Item Recovery ---- */
let __allocRecoveryId = null;

function openRecoveryModal(id) {
  const a = getAllotments().find(x => x.id === id);
  if (!a) return;
  if (!canEdit()) return toast("You do not have permission to process item recovery.", "error");
  const recoverable = allocRecoverable(a);
  if (recoverable <= 0) return toast("No recoverable loss quantity exists for this issue.", "error");
  __allocRecoveryId = a.id;
  const cats = getCategories();
  const item = getItems().find(i => i.id === a.itemId);
  const catSel = $("#rcCategory");
  catSel.innerHTML = cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  catSel.value = a.categoryId || "";
  const itemSel = $("#rcItem");
  itemSel.innerHTML = `<option value="${a.itemId}">${esc(a.itemName)}</option>`;
  itemSel.value = a.itemId;
  const qtyEl = $("#rcQty");
  qtyEl.value = 1;
  qtyEl.max = recoverable;
  $("#rcMode").value = "";
  $("#rcDate").value = todayStr();
  $("#rcTime").value = nowTimeStr();
  $("#rcRemarks").value = "";
  $("#rcError").textContent = "";
  $("#rcError").classList.add("hidden");
  $("#rcSubmitBtn").disabled = false;
  $("#rcSummary").innerHTML =
    `<div class="return-summary-row"><span>Person:</span><b>${esc(a.name)} (BELT: ${esc(a.beltNo)})</b></div>` +
    `<div class="return-summary-row"><span>Category:</span><b>${esc(a.categoryName || "")}</b></div>` +
    `<div class="return-summary-row"><span>Item:</span><b>${esc(a.itemName)}</b></div>` +
    `<div class="return-summary-row"><span>Lost quantity:</span><b style="color:var(--red)">${allocLost(a)}</b></div>` +
    `<div class="return-summary-row"><span>Recovered so far:</span><b>${allocRecovered(a)}</b></div>` +
    `<div class="return-summary-row"><span>Recoverable qty:</span><b style="color:var(--green)">${recoverable}</b></div>` +
    `<div class="return-summary-row"><span>Quantity currently available:</span><b>${item ? availableQty(item) : 0}</b></div>`;
  openModal("#recoveryModal");
}

function submitRecovery(e) {
  e.preventDefault();
  const btn = $("#rcSubmitBtn");
  if (btn) btn.disabled = true;
  try {
    if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
    if (!canEdit()) return toast("You do not have permission to process item recovery.", "error");
    const err = $("#rcError");
    const categoryId = ($("#rcCategory").value || "").trim();
    if (!categoryId) return __allocFieldErr(err, "Category is required.");
    const itemId = ($("#rcItem").value || "").trim();
    if (!itemId) return __allocFieldErr(err, "Item is required.");
    const qty = parseInt($("#rcQty").value, 10);
    if (!qty || qty < 1) return __allocFieldErr(err, "Recovery quantity is required.");
    const mode = ($("#rcMode").value || "").trim();
    if (!mode) return __allocFieldErr(err, "Mode of recovery is required.");
    const date = ($("#rcDate").value || "").trim();
    if (!date) return __allocFieldErr(err, "Date is required.");
    const time = ($("#rcTime").value || "").trim();
    if (!time) return __allocFieldErr(err, "Time is required.");

    const a = getAllotments().find(x => x.id === __allocRecoveryId);
    if (!a) return toast("Issue record not found.", "error");
    const recoverable = allocRecoverable(a);
    if (recoverable <= 0) return toast("No recoverable loss quantity exists for this issue.", "error");
    if (qty > recoverable) return __allocFieldErr(err, "Recovery quantity cannot exceed the recoverable loss quantity.");

    const items = getItems();
    const item = items.find(i => i.id === a.itemId);
    if (!item) return toast("Item not found.", "error");
    if (qty > (item.lostReturned || 0)) return toast("Recovery quantity cannot exceed the recorded loss quantity.", "error");

    const remarks = ($("#rcRemarks").value || "").trim();
    const by = currentUser ? (currentUser.name || currentUser.username) : "";
    a.qtyRecovered = allocRecovered(a) + qty;
    (a.recoveries || (a.recoveries = [])).push({ id: uid(), qty, mode, date, time, remarks, by, at: Date.now() });
    item.lostReturned = Math.max(0, (item.lostReturned || 0) - qty);
    itemHistoryPush(item, { type: "RECOVERED", qty, person: a.name, ref: a.beltNo, date, time, remarks: "Recovered via " + mode + (remarks ? " ? " + remarks : "") });
    a.status = allocStatusOf(a);
    persistAlloc(items, getAllotments(), null);
    closeModals();
    render();
    __audit("Item Recovery", `${qty} x ${a.itemName} recovered for ${a.name} (BELT: ${a.beltNo}) ? Mode: ${mode}`, { entity: "Allotment" });
    toast("Item recovery recorded successfully.", "success");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---- Adjust stock ---- */
function openAdjustStock(presetItemId) {
  const items = getItems().slice().sort((a, b) => a.name.localeCompare(b.name));
  const itemSel = $("#ajItem");
  itemSel.innerHTML = items.map(i => `<option value="${i.id}">${esc(i.name)} (Available: ${availableQty(i)})</option>`).join("");
  itemSel.value = presetItemId || "";
  $("#ajType").value = "add";
  $("#ajQtyGroup").classList.remove("hidden");
  $("#ajTotalGroup").classList.add("hidden");
  $("#ajQty").value = 1;
  $("#ajTotal").value = "";
  $("#ajRemarks").value = "";
  $("#ajDate").value = todayStr();
  $("#ajTime").value = nowTimeStr();
  openModal("#adjustModal");
}

function saveAdjust(e) {
  e.preventDefault();
  if (!canEdit()) return toast("You do not have permission to adjust stock.", "error");
  const itemId = $("#ajItem").value;
  const type = $("#ajType").value;
  const qty = parseInt($("#ajQty").value, 10);
  const total = parseInt($("#ajTotal").value, 10);
  const date = $("#ajDate").value || todayStr();
  const time = $("#ajTime").value || nowTimeStr();
  const remarks = $("#ajRemarks").value.trim();
  if (!itemId) return toast("Select an item.", "error");

  const items = getItems();
  const item = items.find(i => i.id === itemId);
  if (!item) return toast("Item not found.", "error");
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!itemOwnedByCurrentUser(item)) return toast(__rbacLockMsg(), "error");
  const held = (item.allotted || 0) + (item.damagedReturned || 0) + (item.lostReturned || 0);

  if (type === "correction") {
    if (!(total >= 0) || isNaN(total)) return toast("Enter the corrected total quantity.", "error");
    if (total < held) return toast(`Corrected total cannot be less than currently held units (issued+damaged+lost = ${held}).`, "error");
    const delta = total - (item.quantity || 0);
    item.quantity = total;
    itemHistoryPush(item, { type: "ADJUST", qty: delta, person: "", ref: "", date, time, remarks: remarks || ("Stock correction (set to " + total + ")") });
persistAlloc(items, getAllotments(), null);
    closeModals(); render();
    __audit("Stock Correction", `${item.name} — set to ${total}`, { entity: "Inventory" });
    toast("Stock corrected to " + total + ".", "success");
    return;
  }

  if (!qty || qty < 1) return toast("Enter a valid quantity.", "error");
  if (type === "add") {
    item.quantity = (item.quantity || 0) + qty;
    itemHistoryPush(item, { type: "STOCK_IN", qty, person: "", ref: "", date, time, remarks: remarks || "Stock added" });
  } else if (type === "writeoff") {
    if (qty > availableQty(item)) return toast(`Cannot write off more than available quantity (${availableQty(item)}).`, "error");
    item.quantity = Math.max(0, (item.quantity || 0) - qty);
    itemHistoryPush(item, { type: "WRITEOFF", qty: -qty, person: "", ref: "", date, time, remarks: remarks || "Written off" });
  } else if (type === "damage") {
    if (qty > availableQty(item)) return toast(`Cannot mark more than available quantity (${availableQty(item)}) as damaged.`, "error");
    item.quantity = Math.max(0, (item.quantity || 0) - qty);
    item.damagedReturned = (item.damagedReturned || 0) + qty;
    itemHistoryPush(item, { type: "DAMAGE", qty, person: "", ref: "", date, time, remarks: remarks || "Marked damaged" });
  } else if (type === "loss") {
    if (qty > availableQty(item)) return toast(`Cannot mark more than available quantity (${availableQty(item)}) as lost.`, "error");
    item.quantity = Math.max(0, (item.quantity || 0) - qty);
    item.lostReturned = (item.lostReturned || 0) + qty;
    itemHistoryPush(item, { type: "LOSS", qty, person: "", ref: "", date, time, remarks: remarks || "Marked lost" });
  }
persistAlloc(items, getAllotments(), null);
  closeModals();
  render();
  __audit("Stock Adjusted", `${item.name} — ${type}${qty ? " — " + qty : total >= 0 ? " — total " + total : ""}`, { entity: "Inventory" });
  toast("Stock adjusted.", "success");
}

/* ---- Detail modals ---- */
function openAllocItemDetail(id) {
  const item = getItems().find(i => i.id === id);
  if (!item) return;
  const cat = getCategories().find(c => c.id === item.categoryId);
  $("#aidTitle").textContent = item.name;
  $("#aidSubtitle").textContent = (cat ? cat.name + " \u00b7 " : "") + "Total: " + (item.quantity || 0) + " | Available: " + availableQty(item) + " | Issued: " + (item.allotted || 0) + " | Damaged: " + (item.damagedReturned || 0) + " | Lost: " + (item.lostReturned || 0);

  const active = getVisibleAllotments().filter(a => a.itemId === item.id && allocOutstanding(a) > 0);
  const aBody = $("#aidAllottedBody");
  aBody.innerHTML = active.length
    ? active.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.beltNo || "")}</td><td>${esc(__allocMobileOf(a))}</td><td>${esc(a.posting || "")}</td><td class="qty-strong">${allocRemaining(a)}</td><td>${a.createdAt ? fmtDate(a.createdAt) : "&mdash;"}</td><td>${allocStatusBadge(allocStatusOf(a))}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="6">No active issues for this item.</td></tr>`;

  const hist = __histWithBalances(item).slice().reverse();
  const hBody = $("#aidHistoryBody");
  hBody.innerHTML = hist.length
    ? hist.map(h => `<tr><td>${esc(h.date || (h.at ? fmtDate(h.at) : ""))}</td><td>${esc(h.time || "")}</td><td>${esc(__hTypeLabel[h.type] || h.type)}</td><td class="qty-strong" style="${h.qty < 0 ? "color:var(--red)" : "color:var(--green)"}">${h.qty > 0 ? "+" + h.qty : h.qty}</td><td class="qty-strong">${h.prev}</td><td class="qty-strong">${h.balance}</td><td>${esc(h.person || "")}</td><td>${esc(h.remarks || "")}</td><td>${esc(h.user || "")}${photoChipsHtml(h)}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="9">No transaction history.</td></tr>`;

  openModal("#allocItemDetailModal");
}

function openAllocPersonDetail(beltNo) {
  const p = getPersons().find(x => x.beltNo === beltNo);
  $("#apdTitle").textContent = (p ? p.name : "Person") + (p && p.rank ? " (" + p.rank + ")" : "");
  $("#apdSubtitle").textContent = "BELT No.: " + (beltNo || "") + (p && p.posting ? " \u00b7 " + p.posting : "");

  const mine = getVisibleAllotments().filter(a => (a.beltNo || "").toUpperCase() === String(beltNo).toUpperCase());
  const active = mine.filter(a => allocOutstanding(a) > 0);
  const aBody = $("#apdAllottedBody");
  aBody.innerHTML = active.length
    ? active.map(a => `<tr><td class="item-name">${nameCell(a.itemName)}</td><td><span class="cat-badge">${esc(a.categoryName)}</span></td><td class="qty-strong">${allocRemaining(a)}</td><td class="qty-strong" style="color:var(--red)">${allocLost(a)}</td><td>${a.createdAt ? fmtDate(a.createdAt) : "&mdash;"}</td><td>${allocStatusBadge(allocStatusOf(a))}</td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="6">No active issues.</td></tr>`;

  const done = mine.filter(a => allocOutstanding(a) <= 0);
  const condLabels = { good: "Good", poor: "Damaged", damaged: "Scrap", lost: "Lost", other: "Other", cancelled: "Cancelled" };
  const rBody = $("#apdReturnedBody");
  rBody.innerHTML = done.length
    ? done.map(a => {
        const lastReturn = (a.returns && a.returns.length) ? a.returns[a.returns.length - 1] : null;
        const condTxt = lastReturn ? (condLabels[lastReturn.condition] || lastReturn.condition) : "&mdash;";
        const retDate = lastReturn ? (lastReturn.date || fmtDate(lastReturn.at)) : "&mdash;";
        return `<tr><td class="item-name">${nameCell(a.itemName)}</td><td class="qty-strong">${a.qtyReturned || 0}</td><td>${esc(condTxt)}</td><td>${a.createdAt ? fmtDate(a.createdAt) : "&mdash;"}</td><td>${esc(retDate)}</td><td>${allocStatusBadge(allocStatusOf(a))}</td></tr>`;
      }).join("")
    : `<tr class="empty-row"><td colspan="6">No settled issues.</td></tr>`;

  openModal("#allocPersonDetailModal");
}

/* ---- Exports ---- */
function __allocStockExportData() {
  const cats = getCategories();
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  const rows = __allocStockFiltered().map(i => {
    const cat = cats.find(c => c.id === i.categoryId);
    const st = allocStatusOfItem(i);
    return [i.name, cat ? cat.name : "", i.quantity || 0, availableQty(i), i.allotted || 0, i.lostReturned || 0, (i.damagedReturned || 0), st.label];
  });
  const ttotal = rows.reduce((a, r) => a + (r[2] || 0), 0);
  const tavail = rows.reduce((a, r) => a + (r[3] || 0), 0);
  const tallot = rows.reduce((a, r) => a + (r[4] || 0), 0);
  const tloss = rows.reduce((a, r) => a + (r[5] || 0), 0);
  const tdamaged = rows.reduce((a, r) => a + (r[6] || 0), 0);
  rows.push(["Total", "", ttotal, tavail, tallot, tloss, tdamaged, ""]);
  return { title: "Issued Items \u2014 Item Stock Report", subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString(), cols: ["Item Name", "Category", "Total Qty", "Available", "Issued", "Loss", "Damaged", "Status"], rows, fileName: "allotment-item-stock" };
}

function __allocListExportData() {
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  const rows = __allocListFiltered().map(a => {
    const st = allocStatusOf(a);
    const labelMap = { ALLOTTED: "Issued", PARTIALLY_RETURNED: "Partially Returned", PARTIALLY_RECOVERED: "Partially Recovered", RETURNED: "Returned", DAMAGED: "Scrap", LOST: "Lost", CANCELLED: "Cancelled" };
    return [a.name, a.rank || "", a.beltNo || "", __allocMobileOf(a), a.posting || "", a.itemName || "", a.categoryName || "", allocRemaining(a), allocLost(a), a.date || "", a.time || "", labelMap[st] || st];
  });
  return { title: "Issue Register", subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString(), cols: ["Name", "Post/Rank", "BELT No.", "Mobile No.", "Posting", "Item", "Category", "Qty (Remaining)", "Lost", "Date", "Time", "Status"], rows, fileName: "allotment-register" };
}

function __allocReturnsExportData() {
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  const condLabels = { good: "Good", damaged: "Scrap", lost: "Lost", other: "Other" };
  const rows = __allocReturns().map(({ a, r }) => [a.name, a.beltNo || "", a.itemName || "", r.qty, condLabels[r.condition] || r.condition, r.date || "", r.time || "", r.receivedBy || "", r.remarks || ""]);
  return { title: "Return History Report", subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString(), cols: ["Person", "BELT No.", "Item", "Qty Returned", "Condition", "Return Date", "Return Time", "Received By", "Remarks"], rows, fileName: "return-history" };
}

function printAllocStock() { printReport(__allocStockExportData()); }
function exportAllocStockPDF() { pdfReport(__allocStockExportData()); toast("PDF exported.", "success"); }
function exportAllocStockExcel() { excelReport(__allocStockExportData()); toast("Excel exported.", "success"); }
function exportAllocStockWord() { wordReport(__allocStockExportData()); toast("Word document exported.", "success"); }

function printAllocList() { printReport(__allocListExportData()); }
function exportAllocListPDF() { pdfReport(__allocListExportData()); toast("PDF exported.", "success"); }
function exportAllocListExcel() { excelReport(__allocListExportData()); toast("Excel exported.", "success"); }
function exportAllocListWord() { wordReport(__allocListExportData()); toast("Word document exported.", "success"); }

function printAllocReturns() { printReport(__allocReturnsExportData()); }
function exportAllocReturnsPDF() { pdfReport(__allocReturnsExportData()); toast("PDF exported.", "success"); }
function exportAllocReturnsExcel() { excelReport(__allocReturnsExportData()); toast("Excel exported.", "success"); }
function exportAllocReturnsWord() { wordReport(__allocReturnsExportData()); toast("Word document exported.", "success"); }

/* ==================== SCAN & IMPORT (OCR) ==================== */
let __scanFile = null;      // { file, dataUrl, name, type }
let __scanText = "";
let __scanPeople = [];      // reviewed people { key, name, rank, belt, posting, rows: [{key, itemId, qty}] }
let __scanRowSeq = 0;
let __scanPersonSeq = 0;

function getScans() { return loadData("scans") || []; }
function saveScans(scans) { saveData("scans", scans); }

function __scanLibs() {
  return !!(window.Tesseract && window.pdfjsLib && window.mammoth && window.XLSX);
}

function __scanShow(step) {
  ["scanStepInput", "scanStepProgress", "scanStepReview"].forEach(id => $("#" + id).classList.toggle("hidden", id !== "scanStep" + step));
}

function __scanProgress(text) {
  const el = $("#scanProgressText");
  if (el) el.textContent = text;
}

function openScanModal() {
  __scanFile = null; __scanText = ""; __scanPeople = []; __scanRowSeq = 0; __scanPersonSeq = 0;
  const container = $("#scanPeople");
  if (container) container.innerHTML = "";
  const input = $("#scanFileInput");
  if (input) input.value = "";
  $("#scanChosenFile").classList.add("hidden");
  $("#scanExtractBtn").disabled = true;
  __scanShow("Input");
  openModal("#scanModal");
}

function __scanFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function bindScanEvents() {
  const zone = $("#scanDropZone");
  const input = $("#scanFileInput");
  if (!zone || !input) return;
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("scan-drop-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("scan-drop-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("scan-drop-over");
    if (e.dataTransfer.files && e.dataTransfer.files.length) __scanPickFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => { if (input.files && input.files.length) __scanPickFile(input.files[0]); });
  $("#scanFileClear")?.addEventListener("click", () => {
    __scanFile = null;
    input.value = "";
    $("#scanChosenFile").classList.add("hidden");
    $("#scanExtractBtn").disabled = true;
  });
  $("#scanExtractBtn")?.addEventListener("click", scanExtract);
  $("#scanRescanBtn")?.addEventListener("click", openScanModal);
  $("#scanCommitBtn")?.addEventListener("click", scanCommit);
  $("#scanAddPersonBtn")?.addEventListener("click", () => {
    __scanPersonSeq++;
    const p = { key: __scanPersonSeq, name: "", rank: "", belt: "", posting: "", rows: [] };
    __scanPeople.push(p);
    __renderScanPerson(p, true);
    addScanItemRow(p.key, "", 1);
  });

  const container = $("#scanPeople");
  if (container && !container.dataset.bound) {
    container.dataset.bound = "1";
    container.addEventListener("change", e => {
      const sel = e.target.closest(".sc-row-items");
      const qtyEl = e.target.closest(".sc-row-qty");
      if (sel) {
        const row = __scanFindRow(sel.dataset.srow);
        if (row) {
          row.itemId = sel.value || "";
          const it = row.itemId ? getItems().find(i => i.id === row.itemId) : null;
          const cat = it ? (getCategories().find(c => c.id === it.categoryId) || {}) : {};
          const inp = container.querySelector(`.sc-row-cat[data-srow="${sel.dataset.srow}"]`);
          if (inp) inp.value = it ? (cat.name || "") : "";
          if (!it) row.qty = 1;
          __scanRefreshSummary();
        }
      } else if (qtyEl) {
        const row = __scanFindRow(qtyEl.dataset.srow);
        if (row) {
          row.qty = parseInt(qtyEl.value, 10) || 0;
          __scanRefreshSummary();
        }
      }
    });
    container.addEventListener("click", e => {
      const del = e.target.closest(".sc-row-del");
      if (del) {
        const key = Number(del.dataset.srow);
        const el = container.querySelector(`.alloc-item-row[data-srow="${key}"]`);
        if (el) el.remove();
        __scanPeople.forEach(p => { p.rows = p.rows.filter(r => r.key !== key); });
        __scanRefreshSummary();
        return;
      }
      const pdel = e.target.closest(".scp-del");
      if (pdel) {
        const pkey = Number(pdel.dataset.sperson);
        const block = container.querySelector(`.scan-person[data-sperson="${pkey}"]`);
        if (block) block.remove();
        __scanPeople = __scanPeople.filter(p => p.key !== pkey);
        __scanRefreshSummary();
        return;
      }
      const addItem = e.target.closest(".scp-add-item");
      if (addItem) {
        const pkey = Number(addItem.dataset.sperson);
        addScanItemRow(pkey, "", 1);
      }
    });
  }
}

function __scanFindRow(rowKey) {
  rowKey = Number(rowKey);
  for (const p of __scanPeople) {
    const r = p.rows.find(x => x.key === rowKey);
    if (r) return r;
  }
  return null;
}

function __scanRefreshSummary() {
  const sum = $("#scItemsSummary");
  if (!sum) return;
  const valid = __scanPeople.reduce((a, p) => a.concat(p.rows.filter(r => r.itemId)), []);
  const total = valid.reduce((s, r) => s + (r.qty > 0 ? r.qty : 0), 0);
  const people = __scanPeople.filter(p => p.rows.some(r => r.itemId)).length;
  sum.textContent = `${valid.length} item(s) \u00b7 total quantity ${total} \u00b7 ${people} person(s)`;
}

async function __scanPickFile(file) {
  const name = (file.name || "").toLowerCase();
  const okExt = /\.(png|jpe?g|webp|bmp|pdf|docx|xlsx|xls|csv|txt)$/.test(name) || file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okExt) return toast("Unsupported file type. Use JPG/PNG/PDF/DOCX/XLSX/TXT/CSV.", "error");
  try {
    const dataUrl = await __scanFileToDataUrl(file);
    __scanFile = { file, dataUrl, name: file.name, type: file.type };
    $("#scanFileName").textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    $("#scanChosenFile").classList.remove("hidden");
    $("#scanExtractBtn").disabled = false;
  } catch (e) {
    toast("Could not read the file.", "error");
  }
}

async function scanExtract() {
  if (!__scanFile) return;
  if (!__scanLibs()) return toast("OCR libraries are still loading. Try again in a few seconds.", "error");
  try {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
    }
    __scanShow("Progress");
    __scanProgress("Preparing document\u2026");
    const text = await __scanExtractText(__scanFile.file);
    if (!text || !text.trim()) throw new Error("No readable text found in this document.");
    __scanText = text.trim();
    const parsed = __scanParsePeople(__scanText);
    __scanRenderReview(parsed);
  } catch (e) {
    console.error(e);
    __scanShow("Input");
    toast(e.message || "Scan failed. Try a clearer image or a different format.", "error");
  }
}

async function __scanExtractText(file) {
  const name = (file.name || "").toLowerCase();
  if (/\.(png|jpe?g|webp|bmp)$/.test(name) || file.type.startsWith("image/")) return await __ocrImage(file);
  if (/\.pdf$/.test(name) || file.type === "application/pdf") return await __ocrPdf(file);
  if (/\.docx$/.test(name)) {
    if (!window.mammoth) throw new Error("Word reader not loaded.");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value || "";
  }
  if (/\.(xlsx|xls)$/.test(name)) {
    if (!window.XLSX) throw new Error("Excel reader not loaded.");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const lines = [];
    wb.SheetNames.forEach(sn => {
      lines.push(`--- Sheet: ${sn} ---`);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
      (rows || []).forEach(r => lines.push((r || []).map(c => c == null ? "" : String(c)).join("\t")));
    });
    return lines.join("\n");
  }
  return await file.text();
}

function __scanPreprocessImage(dataUrl, binarize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const MAX = 2600, MIN = 700;
        let scale = 1;
        if (Math.min(w, h) < MIN) scale = Math.max(scale, MIN / Math.min(w, h));
        if (Math.max(w, h) > MAX) scale = Math.min(scale, MAX / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        let min = 255, max = 0;
        for (let i = 0; i < d.length; i += 4) {
          const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] = d[i + 1] = d[i + 2] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        const range = (max - min) || 1;
        for (let i = 0; i < d.length; i += 4) {
          let g = (d[i] - min) * (255 / range);
          if (binarize) g = g < 110 ? 0 : 255;
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = dataUrl;
  });
}

async function __ocrImage(file) {
  if (!window.Tesseract) throw new Error("OCR engine not loaded.");
  __scanProgress("Preparing image\u2026");
  const dataUrl = await __scanFileToDataUrl(file);
  const [prepBin, prepGray] = await Promise.all([
    __scanPreprocessImage(dataUrl, true),
    __scanPreprocessImage(dataUrl, false)
  ]);
  __scanProgress("Downloading OCR model (first time only)\u2026");
  let bestBin = "";
  for (const psm of [6, 4]) {
    bestBin = await __scanOcrPass(prepBin, psm, "binary").then(t => t.length > bestBin.length ? t : bestBin).catch(e => { console.error("OCR pass " + psm + " failed:", e); return bestBin; });
  }
  if (bestBin.trim().length >= 5) {
    __scanProgress("");
    return bestBin;
  }
  let bestGray = "";
  for (const psm of [6, 4]) {
    bestGray = await __scanOcrPass(prepGray, psm, "soft").then(t => t.length > bestGray.length ? t : bestGray).catch(e => { console.error("OCR pass " + psm + " failed:", e); return bestGray; });
  }
  __scanProgress("");
  return bestGray;
}

async function __scanOcrPass(image, psm, label) {
  let worker = null;
  try {
    worker = await Tesseract.createWorker("eng", 1, {
      workerPath: "vendor/tesseract/worker.min.js",
      corePath: "vendor/tesseract",
      langPath: "vendor/tessdata",
      logger: m => { if (m && m.status === "recognizing text") __scanProgress("Reading image (" + label + ") \u2026 " + Math.round((m.progress || 0) * 100) + "%"); }
    });
    await worker.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: "1" });
    const res = await worker.recognize(image);
    return (res && res.data && res.data.text ? res.data.text : "").trim();
  } finally {
    try { if (worker) await worker.terminate(); } catch (e) {}
  }
}

async function __ocrPdf(file) {
  if (!window.pdfjsLib) throw new Error("PDF reader not loaded.");
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (e) {
    throw new Error("Could not parse this PDF.");
  }
  const maxPages = Math.min(pdf.numPages, 20);
  let out = "";
  let ocrPage = null;
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    __scanProgress(`Reading PDF page ${i}/${maxPages}\u2026`);
    const tc = await page.getTextContent();
    const t = (tc.items || []).map(x => x.str).join(" ").trim();
    if (t.length > 0) {
      out += `\n[page ${i}]\n${t}`;
    } else {
      ocrPage = page;
    }
  }
  if (out.trim().length < 40 && ocrPage && window.Tesseract) {
    __scanProgress("Scanned PDF detected \u2014 OCR page 1\u2026");
    const vp = ocrPage.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext("2d");
    await ocrPage.render({ canvasContext: ctx, viewport: vp }).promise;
    const prep = await __scanPreprocessImage(canvas.toDataURL("image/jpeg", 0.85), true);
    let worker = null;
    try {
      worker = await Tesseract.createWorker("eng", 1, {
      workerPath: "vendor/tesseract/worker.min.js",
      corePath: "vendor/tesseract",
      langPath: "vendor/tessdata", logger: m => { if (m && m.status === "recognizing text") __scanProgress("Reading scanned page \u2026 " + Math.round((m.progress || 0) * 100) + "%"); } });
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
      const res = await worker.recognize(prep);
      out += `\n[scanned page]\n${res.data.text || ""}`;
    } catch (e) { console.error("PDF page OCR failed:", e); }
    finally { try { if (worker) await worker.terminate(); } catch (e) {} }
  }
  __scanProgress("");
  return out;
}

const __SCAN_RANKS = ["HEAD CONSTABLE", "SUB INSPECTOR", "SUB-INSPECTOR", "INSPECTOR", "CONSTABLE", "ASSISTANT SUB INSPECTOR", "HOME GUARD", "DRIVER", "CHAUKIDAR", "ASI", "SHO", "DSP", "ASP", "HC", "SI"];

function __scanNorm(s) { return (s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function __scanCellBelt(c) {
  c = String(c || "").trim();
  if (!c) return "";
  if (/^[0-9]{1,3}\s*\/\s*[A-Z0-9]{1,10}$/i.test(c) && /\d/.test(c)) return c.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{1,6}[-\/]?[0-9]{2,10}$/i.test(c) && /\d/.test(c)) return c.replace(/\s+/g, "").toUpperCase();
  if (/^[0-9]{2,10}(\.[0-9]{1,5})?$/i.test(c)) return c.replace(/\s+/g, "").toUpperCase();
  return "";
}

function __scanCellRank(c) {
  const n = __scanNorm(c);
  if (!n) return "";
  for (const rk of __SCAN_RANKS) if (n === rk.toLowerCase()) return rk;
  for (const rk of __SCAN_RANKS) if (rk.split(/[- ]/).length > 1 && n.startsWith(rk.toLowerCase())) return rk;
  return "";
}

function __scanCellCategory(c) {
  const n = __scanNorm(c);
  if (!n || n.length < 2) return "";
  const cats = getCategories().filter(Boolean);
  const hit = cats.find(ca => __scanNorm(ca.name) === n) || cats.find(ca => __scanNorm(ca.name).startsWith(n)) || cats.find(ca => n.startsWith(__scanNorm(ca.name)));
  return hit ? hit.id : "";
}

function __scanCellItem(c) {
  const n = __scanNorm(c);
  if (!n || n.length < 2) return "";
  const list = getItems().filter(Boolean);
  const hit = list.find(it => __scanNorm(it.name) === n) || list.find(it => __scanNorm(it.name).startsWith(n)) ||
    list.find(it => n.startsWith(__scanNorm(it.name))) || list.find(it => n.includes(__scanNorm(it.name)));
  return hit ? hit.id : "";
}

function __scanEditDist(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return dp[n];
}

function __scanFuzzyRankIn(line) {
  const lower = line.toLowerCase();
  let best = { rank: "", pos: -1, len: 0, score: -1 };
  for (const rk of __SCAN_RANKS) {
    const p = lower.indexOf(rk.toLowerCase());
    if (p >= 0 && (best.pos < 0 || p < best.pos)) best = { rank: rk, pos: p, len: rk.length, score: 100 };
  }
  if (best.rank) return best;
  const words = line.split(/\s+/).filter(Boolean).map(w => w.replace(/[^a-zA-Z0-9]/g, ""));
  let off = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const pos = line.indexOf(words[wi], off);
    off = pos + 1;
    for (const rk of __SCAN_RANKS) {
      const rw = rk.toLowerCase().split(/[- ]/).filter(Boolean);
      const W = (words[wi] || "").toLowerCase();
      let matched = 0;
      for (const w of rw) {
        if (W === w || (w.length >= 3 && Math.abs(W.length - w.length) <= 1 && __scanEditDist(W, w) <= 1)) matched++;
      }
      if (matched) {
        const score = (matched === rw.length ? 2 : 1) + matched;
        if (score > best.score) best = { rank: rk, pos, len: rk.length, score };
        else if (score === best.score && pos >= 0 && best.pos >= 0 && pos < best.pos) best = { rank: rk, pos, len: rk.length, score };
      }
    }
  }
  return best;
}

function __scanFuzzyLine(raw) {
  const s = raw.replace(/^\s*\d+[.)\-]?\s*/, "").trim();
  if (!s) return null;
  const rm = __scanFuzzyRankIn(s);
  const name = rm.pos > 0 ? s.slice(0, rm.pos).trim() : "";
  const tail = rm.pos >= 0 ? s.slice(rm.pos + rm.len).trim() : s;
  let belt = "";
  const bm = tail.match(/\b(\d{1,3}\s*[\/.)\-]\s*[A-Z0-9]{1,10})\b/i) || tail.match(/\b([A-Z]{1,5}-?\d{2,10})\b/i) || tail.match(/\b(\d{2,10})\b/i);
  if (bm) belt = bm[1].replace(/\s+/g, "").toUpperCase();
  const itemsList = getItems().filter(Boolean).map(it => ({ it, n: __scanNorm(it.name) })).sort((a, b) => b.n.length - a.n.length);
  let itemId = "", qty = -1;
  const lower = s.toLowerCase();
  for (const { it, n } of itemsList) {
    const p = lower.indexOf(n);
    if (p < 0) continue;
    itemId = it.id;
    const rest = s.slice(p + it.name.length).trim();
    const qm = rest.match(/^\s*[^A-Za-z]*(\d{1,6})/) || rest.match(/\b(\d{1,6})\b/);
    qty = qm ? parseInt(qm[1], 10) : -1;
    break;
  }
  if (!name && !itemId && !belt) return null;
  return { name, rank: rm.rank, belt, posting: "", items: itemId ? [{ itemId, categoryId: getItems().find(i => i.id === itemId).categoryId, qty: qty > 0 ? qty : 1 }] : [] };
}

function __scanParsePeople(text) {
  const people = [];
  const lines = (text || "").split(/\r?\n/).map(l => l.replace(/\t+/g, ", ").trim()).filter(Boolean);
  for (const raw of lines) {
    if (/^(NEW ALLOTTED|DATE|SR\.? ?NO|PERSON NAME|S\.? ?NO|NAME)|^[A-Z\s]{0,20}DETAILS/i.test(raw)) continue;
    let cells = raw.split(",").map(c => c.trim()).filter(Boolean).map(c => c.replace(/\s{2,}/g, " "));
    if (cells.length < 3) {
      const f = __scanFuzzyLine(raw);
      if (!f) continue;
      const dup = people.find(p => __scanNorm(p.name) === __scanNorm(f.name) && p.belt === f.belt);
      if (dup) {
        f.items.forEach(fi => {
          const ex = dup.items.find(r => r.itemId === fi.itemId);
          if (ex) ex.qty += fi.qty; else dup.items.push(fi);
        });
      } else people.push(f);
      continue;
    }
    if (/^\d+[.)\-]?\s*$/.test(cells[0])) cells = cells.slice(1);
    cells[0] = cells[0].replace(/^\d+[.)\-]?\s*/, "");

    const entry = { name: "", rank: "", belt: "", posting: "", items: [] };
    const used = cells.map(() => false);
    const firstUnused = () => { const i = used.findIndex(u => !u); return i; };

    let qty = -1;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (/^\d{1,6}$/.test(cells[i])) { qty = parseInt(cells[i], 10); used[i] = true; break; }
    }

    for (let i = 0; i < cells.length; i++) {
      if (used[i]) continue;
      const b = __scanCellBelt(cells[i]);
      if (b) { entry.belt = b; used[i] = true; break; }
    }

    for (let i = 0; i < cells.length; i++) {
      if (used[i]) continue;
      const rk = __scanCellRank(cells[i]);
      if (rk) { entry.rank = rk; used[i] = true; break; }
    }

    let catId = "";
    const firstIdx = firstUnused();
    for (let i = 0; i < cells.length; i++) {
      if (used[i] || i === firstIdx) continue;
      const c = __scanCellCategory(cells[i]);
      if (c) { catId = c; used[i] = true; break; }
    }

    let itemId = "";
    const firstIdx2 = firstUnused();
    for (let i = 0; i < cells.length; i++) {
      if (used[i] || i === firstIdx2) continue;
      const it = __scanCellItem(cells[i]);
      if (it) { itemId = it; used[i] = true; break; }
    }

    const nameIdx = firstUnused();
    if (nameIdx >= 0) {
      entry.name = cells[nameIdx].replace(/^[\d.)\-]+\s*/, "");
      used[nameIdx] = true;
    }
    const postIdx = firstUnused();
    if (postIdx >= 0) entry.posting = cells[postIdx];

    if (entry.name && (entry.belt || entry.rank || itemId)) {
      if (itemId) {
        const it = getItems().find(i => i.id === itemId);
        entry.items.push({ itemId, categoryId: it ? it.categoryId : (catId || ""), qty: qty > 0 ? qty : 1 });
      }
      const dup = people.find(p => __scanNorm(p.name) === __scanNorm(entry.name) && p.belt === entry.belt);
      if (dup) {
        const ex = dup.items.find(r => r.itemId === entry.items[0] && entry.items[0]);
        if (ex) {
          if (entry.items.length && ex) ex.qty += entry.items[0].qty;
        } else if (entry.items.length) dup.items.push(entry.items[0]);
      } else {
        people.push(entry);
      }
    }
  }
  return people;
}

function addScanItemRow(personKey, itemId, qty) {
  const block = document.querySelector(`.scan-person[data-sperson="${personKey}"]`);
  if (!block) return;
  const key = ++__scanRowSeq;
  const p = __scanPeople.find(x => x.key === personKey);
  const r = { key, itemId: itemId || "", qty: qty && qty > 0 ? qty : 1 };
  if (p) p.rows.push(r);
  const it = r.itemId ? getItems().find(i => i.id === r.itemId) : null;
  const cat = it ? (getCategories().find(c => c.id === it.categoryId) || {}) : {};
  const box = block.querySelector(".alloc-items");
  if (!box) return;
  box.insertAdjacentHTML("beforeend", `<div class="alloc-item-row" data-srow="${key}">
    <div class="form-group" style="flex:2.4">
      <label>Item</label>
      <select class="sc-row-items" data-srow="${key}" required></select>
    </div>
    <div class="form-group" style="flex:1.4">
      <label>Category</label>
      <input type="text" class="sc-row-cat" data-srow="${key}" value="${esc(cat.name || "")}" readonly placeholder="Auto" />
    </div>
    <div class="form-group" style="flex:0.8">
      <label>Qty</label>
      <input type="number" class="sc-row-qty" data-srow="${key}" min="1" value="${r.qty}" required />
    </div>
    <div class="alloc-row-del" data-srow="${key}" title="Remove item">&times;</div>
  </div>`);
  const sel = box.querySelector(`.sc-row-items[data-srow="${key}"]`);
  if (sel) {
    sel.innerHTML = `<option value="">Select item</option>` + __byName(getItems()).map(i => `<option value="${i.id}" ${i.id === r.itemId ? "selected" : ""}>${esc(i.name)} (Avail: ${availableQty(i)})</option>`).join("");
  }
  __scanRefreshSummary();
}

function __renderScanPerson(p) {
  const container = $("#scanPeople");
  if (!container) return;
  const n = __scanPeople.indexOf(p) + 1;
  const block = container.querySelector(`.scan-person[data-sperson="${p.key}"]`);
  const html = `<div class="scan-person" data-sperson="${p.key}">
    <div class="scan-person-head">
      <h4 class="modal-sec-title">Person ${n}</h4>
      <button type="button" class="scp-del" data-sperson="${p.key}" title="Remove person">&times;</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Person Name</label><input type="text" class="scp-name" data-sperson="${p.key}" value="${esc(p.name)}" placeholder="Auto-extracted or type"></div>
      <div class="form-group"><label>Post / Rank</label><input type="text" class="scp-rank" data-sperson="${p.key}" value="${esc(p.rank)}" placeholder="e.g. HC"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>BELT Number</label><input type="text" class="scp-belt" data-sperson="${p.key}" value="${esc(p.belt)}" placeholder="e.g. BRLT12345"></div>
      <div class="form-group"><label>Posting</label><input type="text" class="scp-posting" data-sperson="${p.key}" value="${esc(p.posting)}" placeholder="e.g. PS DLF Phase 3"></div>
    </div>
    <div class="alloc-items"></div>
    <div class="alloc-items-actions">
      <button type="button" class="btn btn-sm btn-outline scp-add-item" data-sperson="${p.key}">+ Add Item</button>
    </div>
  </div>`;
  if (block) block.outerHTML = html; else container.insertAdjacentHTML("beforeend", html);
}

function __scanRenderReview(people) {
  const container = $("#scanPeople");
  if (container) container.innerHTML = "";
  __scanPeople = [];
  __scanPersonSeq = 0;
  __scanRowSeq = 0;
  const list = (Array.isArray(people) && people.length) ? people : [{}];
  list.forEach(pt => {
    __scanPersonSeq++;
    const p = { key: __scanPersonSeq, name: pt.name || "", rank: pt.rank || "", belt: pt.belt || "", posting: pt.posting || "", rows: [] };
    __scanPeople.push(p);
    __renderScanPerson(p);
    (pt.items && pt.items.length ? pt.items : [{ itemId: "", qty: 1 }]).forEach(it => addScanItemRow(p.key, it.itemId, it.qty));
  });
  $("#scanRawText").textContent = __scanText;
  __scanShow("Review");
  __scanRefreshSummary();
}

async function scanCommit() {
  if (!canEdit()) return toast("You do not have permission to import issued items.", "error");
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!__scanPeople.length) return toast("Add at least one person.", "error");

  const items = getItems();
  const entries = [];
  for (const p of __scanPeople) {
    const block = document.querySelector(`.scan-person[data-sperson="${p.key}"]`);
    if (!block) continue;
    const name = (block.querySelector(".scp-name")?.value || "").trim();
    const rank = (block.querySelector(".scp-rank")?.value || "").trim();
    const belt = (block.querySelector(".scp-belt")?.value || "").trim().toUpperCase();
    const posting = (block.querySelector(".scp-posting")?.value || "").trim();
    if (!name || !rank || !belt || !posting) return toast("Fill all person details in every person card before inserting.", "error");
    const rows = [];
    block.querySelectorAll(".alloc-item-row").forEach(rowEl => {
      const sel = rowEl.querySelector(".sc-row-items");
      if (!sel || !sel.value) return;
      const qtyEl = rowEl.querySelector(".sc-row-qty");
      rows.push({ itemId: sel.value, qty: qtyEl ? (parseInt(qtyEl.value, 10) || 0) : 0 });
    });
    if (!rows.length) return toast(`Add at least one item with a quantity for ${name}.`, "error");
    for (const r of rows) {
      if (!r.qty || r.qty < 1) return toast("Enter a valid quantity for every item.", "error");
      const item = items.find(i => i.id === r.itemId);
      if (!item) return toast("Item not found.", "error");
      if (r.qty > availableQty(item)) return toast(`Insufficient stock for "${item.name}" (${name}). Only ${availableQty(item)} units available.`, "error");
    }
    entries.push({ name, rank, belt, posting, rows });
  }

  let persons = getPersons();
  const allotments = getAllotments();
  const now = Date.now();
  const reviewedItems = [];
  let totalItems = 0;

  entries.forEach(en => {
    let person = persons.find(x => x.beltNo === en.belt);
    if (!person) {
      person = { id: uid(), name: en.name, rank: en.rank, beltNo: en.belt, posting: en.posting, districtId: activeDistrictId, locationId: (getVisibleLocationId() || (currentUser && currentUser.locationId) || null), createdAt: now };
      persons.push(person);
    }
    const issueId = uid();
    en.rows.forEach(r => {
      totalItems += r.qty;
      const item = items.find(i => i.id === r.itemId);
      item.allotted = (item.allotted || 0) + r.qty;
      itemHistoryPush(item, { type: "ALLOTMENT", qty: -r.qty, person: en.name, ref: en.belt, date: todayStr(), time: nowTimeStr(), remarks: "Imported via scanned document (" + r.qty + " " + (item.unit || "pcs") + ")" });
      const cat = getCategories().find(c => c.id === item.categoryId);
      allotments.unshift({
        id: uid(),
        issueId,
        personId: person.id,
        name: en.name, rank: en.rank, beltNo: en.belt, posting: en.posting,
        districtId: activeDistrictId,
        locationId: person.locationId || item.locationId,
        itemId: item.id, itemName: item.name, categoryId: item.categoryId, categoryName: cat ? cat.name : "",
        qtyAllotted: r.qty, qtyReturned: 0, status: "ALLOTTED",
        date: todayStr(), time: nowTimeStr(),
        remarks: "Imported from scanned document",
        createdBy: currentUser ? (currentUser.name || currentUser.username) : "",
        createdAt: now, returns: []
      });
      reviewedItems.push({ itemId: item.id, itemName: item.name, qty: r.qty });
    });
  });

  persistAlloc(items, allotments, persons);

  const scanId = uid();
  const rec = {
    id: scanId,
    fileName: __scanFile ? __scanFile.name : "",
    mime: __scanFile ? __scanFile.type : "",
    size: __scanFile ? __scanFile.file.size : 0,
    text: __scanText,
    person: entries.length ? { name: entries[0].name, rank: entries[0].rank, beltNo: entries[0].belt, posting: entries[0].posting } : null,
    peopleCount: entries.length,
    items: reviewedItems,
    status: "VERIFIED",
    verifiedBy: currentUser ? (currentUser.name || currentUser.username) : "",
    createdAt: now, verifiedAt: Date.now()
  };
  const scans = getScans();
  scans.unshift(rec);
  saveScans(scans);

  if (__scanFile && __scanFile.dataUrl) {
    try {
      await __api("POST", "scanfile", { id: scanId, dataUrl: __scanFile.dataUrl });
      rec.fileSaved = true;
      const s2 = getScans(); const si = s2.findIndex(x => x.id === scanId); if (si >= 0) { s2[si].fileSaved = true; saveScans(s2); }
    } catch (e2) { console.error("scan file save failed:", e2); }
  }

  closeModals();
  __scanFile = null; __scanText = ""; __scanPeople = [];
  render();
  toast(`${reviewedItems.length} item(s) for ${entries.length} person(s) verified and inserted. Document saved to the scanned records.`, "success");
}

/* ---- Documents (uploaded files + scanned documents) ---- */
function getDocRecords() {
  const up = (loadData("documents_" + activeDistrictId) || []).map(d => ({ ...d, src: "upload" }));
  const sc = getScans().map(s => ({ ...s, src: "scan" }));
  return [...up, ...sc].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function __docExt(fileName) {
  const m = (fileName || "").split(".").pop();
  return m && m.length <= 5 ? m.toUpperCase() : "FILE";
}

function openScanHistory() {
  renderDocuments();
  openModal("#scanHistoryModal");
}
function openDocuments() { openScanHistory(); }

function renderDocuments() {
  const body = $("#scanHistoryBody");
  if (!body) return;
  const docs = getDocRecords();
  const cnt = $("#docCount");
  if (cnt) cnt.textContent = docs.length ? docs.length + " document(s)" : "No documents";
  if (!docs.length) { body.innerHTML = `<tr class="empty-row"><td colspan="8">No documents yet. Click <b>Upload Document</b> to add one.</td></tr>`; return; }
  const scanMimeFmt = s => (s.mime || "").includes("pdf") ? "PDF" : (s.mime || "").includes("sheet") ? "XLSX" : (s.mime || "").includes("word") ? "DOCX" : (s.mime || "").includes("image") ? "IMG" : (s.mime || "").includes("video") ? "VID" : "FILE";
  body.innerHTML = docs.slice(0, 200).map(r => {
    const d = new Date(r.createdAt || Date.now());
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const fmt = r.src === "upload" ? (r.ext || __docExt(r.fileName)) : scanMimeFmt(r);
    const type = r.src === "upload" ? (r.docType || "Other") : "Scan Copy";
    const item = r.src === "upload"
      ? (((r.docItems && r.docItems.length)
          ? r.docItems.map(x => x.itemName + (x.categoryName ? " (" + x.categoryName + ")" : "")).filter(Boolean).join(", ")
          : "") || r.itemName || r.note || "?")
      : ((r.person && r.person.name ? r.person.name : "") + (r.person && r.person.beltNo ? " (" + r.person.beltNo + ")" : "") + ((r.items || []).length ? " &middot; " + r.items.length + " item(s)" : "")) || "?";
    const by = r.src === "upload" ? (r.uploadedBy || "-") : (r.verifiedBy || "-");
    const viewBtn = r.src === "upload"
      ? `<button class="btn btn-sm btn-outline" data-doc-view="${r.id}">${r.data ? "View" : "Info"}</button>`
      : `<button class="btn btn-sm btn-outline" data-scan-view="${r.id}">View</button>`;
    const delBtn = r.src === "upload"
      ? `<button class="btn btn-sm btn-outline act-dd-del" data-doc-del="${r.id}">Delete</button>`
      : `<span class="muted">Scan</span>`;
    return `<tr>
      <td>${date}</td><td>${time}</td>
      <td><span class="status-badge status-neutral">${fmt}</span></td>
      <td>${esc(type)}</td>
      <td class="item-name">${nameCell(item)}</td>
      <td>${esc(by)}</td>
      <td class="item-name">${esc(r.fileName || "Untitled")}</td>
      <td class="actions-cell">${viewBtn} ${delBtn}</td>
    </tr>`;
  }).join("");
}

async function openScanView(id) {
  const rec = getScans().find(s => s.id === id);
  if (!rec) return toast("Record not found.", "error");
  $("#scanViewTitle").textContent = rec.fileName || "Document";
  const body = $("#scanViewBody");
  body.innerHTML = `<div class="scan-view-loading">Loading original document\u2026</div>`;
  openModal("#scanViewModal");
  let dataUrl = null;
  if (window.CONFIG && window.CONFIG.useRemote) {
    try {
      const r = await __api("GET", "scanfile/" + id);
      if (r && r.dataUrl) dataUrl = r.dataUrl;
    } catch (e) { /* fall through */ }
  }
  if (!dataUrl && rec.text) dataUrl = null;
  if (dataUrl) {
    const mime = dataUrl.split(",")[0] || "";
    body.innerHTML = `<div class="scan-view-actions"><a class="btn btn-sm btn-outline" href="${dataUrl}" download="${encodeURIComponent(rec.fileName || "document")}">Download Original</a></div>` +
      (mime.includes("image") ? `<img class="scan-view-img" src="${dataUrl}" alt="Original document">` :
       mime.includes("pdf") ? `<iframe class="scan-view-iframe" src="${dataUrl}"></iframe>` :
       `<pre class="scan-view-pre">${esc(rec.text || "-")}</pre>`);
  } else {
    body.innerHTML = `<pre class="scan-view-pre">${esc(rec.text || "-")}</pre>` +
      (window.CONFIG && window.CONFIG.useRemote ? "" : `<div class="muted">Original file is only kept on the server. (Local/offline mode stores text only.)</div>`);
  }
}

/* ---- Document upload ---- */
function __docRowHtml() {
  const opts = `<option value="">Select category...</option>` + __sortedCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  return `<div class="doc-item-row">
    <div class="form-row" style="align-items:end">
      <div class="form-group" style="flex:1 1 42%">
        <label>Category</label>
        <select class="doc-row-cat">${opts}</select>
      </div>
      <div class="form-group" style="flex:1 1 46%">
        <label>Item</label>
        <span class="cb cb-full">
          <input type="text" class="doc-row-item cb-input" placeholder="Select or type item name..." autocomplete="off">
          <span class="cb-menu hidden doc-row-menu"></span>
        </span>
      </div>
      <button type="button" class="btn btn-sm btn-outline act-dd-del doc-row-del" title="Remove item">&times;</button>
    </div>
  </div>`;
}

function __populateDocRow(row) {
  const input = row.querySelector(".doc-row-item");
  const menu = row.querySelector(".doc-row-menu");
  const catSel = row.querySelector(".doc-row-cat");
  if (!input || !menu || !catSel) return;
  const categoryId = catSel.value || "";
  input.disabled = !categoryId;
  const names = new Set();
  getItems().filter(i => i.categoryId === categoryId).forEach(i => { if (i.name && i.name.trim()) names.add(i.name.trim()); });
  (loadData("documents_" + activeDistrictId) || []).filter(d => d.categoryId === categoryId).forEach(d => { if (d.itemName && d.itemName.trim()) names.add(d.itemName.trim()); });
  const allNames = [...names];
  const q = input.value.trim().toLowerCase();
  const filtered = allNames.filter(n => !q || n.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b));
  const current = input.value.trim();
  if (current && !allNames.includes(current)) filtered.unshift(current);
  menu.innerHTML = filtered.length
    ? filtered.map(n => `<button type="button" class="cb-opt${n === current ? " cb-opt-sel" : ""}" data-name="${esc(n)}">${esc(n)}</button>`).join("")
    : `<div class="cb-empty">No items in this category yet ? type a new name</div>`;
  input.classList.toggle("cb-has-value", !!current);
}

function openDocUploadModal() {
  // devadmin may open to VIEW; uploading is blocked inside saveDocUpload.
  if (!canEdit()) return toast("You do not have permission to upload documents.", "error");
  const f = $("#docFileInput"); if (f) f.value = "";
  const chosen = $("#docChosen"); if (chosen) chosen.classList.add("hidden");
  const pv = $("#docPreview"); if (pv) pv.innerHTML = "";
  window.__docUploadData = { data: null, size: 0 };
  const dt = $("#docType"); if (dt) dt.value = "";
  const box = $("#docItemsRow");
  if (box) box.innerHTML = __docRowHtml();
  const nt = $("#docNote"); if (nt) nt.value = "";
  const ub = $("#docUploadedBy");
  if (ub) ub.value = currentUser ? (currentUser.name || currentUser.username) : "";
  openModal("#docUploadModal");
}

function handleDocFileChange() {
  const f = $("#docFileInput");
  const file = f && f.files && f.files[0];
  if (!file) return;
  window.__docUploadData = { data: null, size: file.size };
  const chosen = $("#docChosen") || {};
  $("#docFileName").textContent = file.name;
  const KB = file.size / 1024;
  $("#docFileInfo").textContent = (KB >= 1024 ? (KB / 1024).toFixed(1) + " MB" : Math.round(KB) + " KB") + " &middot; " + __docExt(file.name);
  chosen.classList.remove("hidden");
  const pv = $("#docPreview"); if (!pv) return;
  pv.innerHTML = "";
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    if (file.size <= 1800000) window.__docUploadData.data = data;
    else pv.insertAdjacentHTML("beforeend", `<div class="doc-preview-warn">File is large ? saved as a record only (no preview).</div>`);
    if (file.type.startsWith("image/") && data) pv.insertAdjacentHTML("beforeend", `<img class="doc-preview-img" src="${data}" alt="preview">`);
    else if (file.type.startsWith("video/") && data) pv.insertAdjacentHTML("beforeend", `<video class="doc-preview-vid" src="${data}" controls></video>`);
    else if (data && (file.type.includes("pdf") || /\.pdf$/i.test(file.name))) pv.insertAdjacentHTML("beforeend", `<a class="btn btn-sm btn-outline" href="${data}" download="${encodeURIComponent(file.name)}">Preview / Download</a>`);
  };
  reader.readAsDataURL(file);
}

function saveDocUpload(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!currentUser) return toast("Login required.", "error");
  const f = $("#docFileInput");
  const file = f && f.files && f.files[0];
  if (!file) return toast("Please choose a file to upload.", "error");
  const docType = ($("#docType") || {}).value;
  if (!docType) return toast("Please select the type of document.", "error");
  const docItems = [];
  const rowsBox = $("#docItemsRow");
  if (rowsBox) rowsBox.querySelectorAll(".doc-item-row").forEach(row => {
    const catSel = row.querySelector(".doc-row-cat");
    const it = row.querySelector(".doc-row-item");
    const categoryId = catSel ? catSel.value : "";
    const itemName = it ? it.value.trim() : "";
    if (categoryId || itemName) {
      const matched = itemName ? getItems().find(i => i.categoryId === categoryId && i.name.trim() === itemName) : null;
      const cat = getCategories().find(c => c.id === categoryId);
      docItems.push({ categoryId, categoryName: cat ? cat.name : "", itemId: matched ? matched.id : "", itemName });
    }
  });
  const itemName = docItems.map(x => x.itemName).filter(Boolean).join(", ");
  const key = "documents_" + activeDistrictId;
  const up = loadData(key) || [];
  const rec = {
    id: uid(),
    fileName: file.name,
    mime: file.type || "",
    ext: __docExt(file.name),
    docType: docType,
    docItems: docItems,
    categoryId: docItems.length ? docItems[0].categoryId : "",
    itemId: docItems.length ? docItems[0].itemId : "",
    itemName: itemName,
    note: ($("#docNote") || {}).value.trim(),
    uploadedBy: currentUser.name || currentUser.username,
    uploadedById: currentUser.id || currentUser.username,
    role: currentUser.role || "",
    data: (window.__docUploadData && window.__docUploadData.data) || null,
    createdAt: Date.now()
  };
  up.unshift(rec);
  saveData(key, up);
  __audit("Document Uploaded", `"${file.name}" (${rec.docType})`, { entity: "Document" });
  closeModals();
  render();
  toast("Document saved.", "success");
}

function deleteDocument(id) {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const key = "documents_" + activeDistrictId;
  const up = loadData(key) || [];
  const rec = up.find(r => r.id === id);
  if (!rec) return toast("Record not found.", "error");
  if (!(canEdit() || (currentUser && rec.uploadedById === (currentUser.id || currentUser.username)))) return toast("You may only delete documents you uploaded.", "error");
  if (!confirm("Delete this uploaded document?")) return;
  saveData(key, up.filter(r => r.id !== id));
  __audit("Document Deleted", `"${rec.fileName}"`, { entity: "Document" });
  renderDocuments();
  toast("Document deleted.", "success");
}

function openDocView(id) {
  const rec = (loadData("documents_" + activeDistrictId) || []).find(r => r.id === id);
  if (!rec) return toast("Record not found.", "error");
  $("#scanViewTitle").textContent = rec.fileName || "Document";
  const body = $("#scanViewBody");
  if (!rec.data) {
    body.innerHTML = `<div class="scan-view-actions"><b>${esc(rec.fileName || "Untitled")}</b></div>` +
      `<div class="muted">${esc(rec.docType || "Document")} &middot; ${esc(rec.ext || "")}</div>` +
      `<pre class="scan-view-pre">${esc(rec.note || "No preview available for this file (large file).")}</pre>`;
    openModal("#scanViewModal");
    return;
  }
  body.innerHTML = `<div class="scan-view-actions"><a class="btn btn-sm btn-outline" href="${rec.data}" download="${encodeURIComponent(rec.fileName || "document")}">Download</a></div>` +
    (rec.mime && rec.mime.startsWith("image/") ? `<img class="scan-view-img" src="${rec.data}" alt="Document">` :
     rec.mime && rec.mime.startsWith("video/") ? `<video class="scan-view-vid" src="${rec.data}" controls></video>` :
     rec.mime && rec.mime.includes("pdf") ? `<iframe class="scan-view-iframe" src="${rec.data}"></iframe>` :
     `<div class="muted"><a class="btn btn-sm btn-outline" href="${rec.data}" download>Open ${rec.ext || "file"}</a></div>`);
  openModal("#scanViewModal");
}

/* ==================== INIT ==================== */
async function init() {
  if (window.__apiReadyPromise) await window.__apiReadyPromise;
  try { seedAll(); } catch (e) { console.error("seed failed:", e); }

  const auth = getAuth();
  if (auth && auth.user) {
    const valid = await validateSession(auth.token);
    if (valid) {
      currentUser = auth.user;
      activeDistrictId = currentUser.districtId || "dist_1";
      setActiveDistrict(activeDistrictId);
      try { showApp(); } catch (e) { console.error("restore failed:", e); }
    } else {
      clearAuth();
    }
  }

  try { renderQuickLogin(); } catch (e) { console.error("quick login failed:", e); }
  try { __loadDemoAccounts(); } catch (e) { console.error("demo accounts failed:", e); }

  // "Use Demo Account" collapses/expands the demo panel on narrow screens and
  // lets someone on a small screen get the form back to full height.
  $("#demoToggle")?.addEventListener("click", () => {
    const panel = $("#demoPanel");
    const open = $("#demoToggle").getAttribute("aria-expanded") !== "false";
    $("#demoToggle").setAttribute("aria-expanded", open ? "false" : "true");
    if (panel) panel.classList.toggle("hidden", open);
  });

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("#loginBtn");
    const loader = $("#loginLoader");
    __demoClearError();
    if (btn) btn.disabled = true;
    if (loader) loader.classList.remove("hidden");
    try {
      const rememberMe = !!$("#rememberMe") && $("#rememberMe").checked;
      const res = await login($("#loginUser").value.trim(), $("#loginPass").value);
      if (res && res.user) {
        currentUser = res.user;
        activeDistrictId = currentUser.districtId || "dist_1";
        setActiveDistrict(activeDistrictId);
        setAuth({ user: currentUser, token: res.token || null }, rememberMe);
        addQuickUser({ username: currentUser.username, name: currentUser.name, password: $("#loginPass").value }, rememberMe);
        showApp();
      } else {
        $("#loginError").classList.remove("hidden");
      }
    } catch (err) {
      $("#loginError").classList.remove("hidden");
    } finally {
      if (btn) btn.disabled = false;
      if (loader) loader.classList.add("hidden");
    }
  });

  $("#togglePass").addEventListener("click", () => { const i = $("#loginPass"); i.type = i.type === "password" ? "text" : "password"; });

  $("#forgotPassBtn")?.addEventListener("click", () => {
    $("#fpUsername").value = "";
    $("#fpPhone").value = "";
    $("#fpResult").classList.add("hidden");
    $("#fpSubmitBtn").disabled = false;
    openModal("#forgotPassModal");
  });

  $("#forgotPassForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const username = $("#fpUsername").value.trim();
    const phone = $("#fpPhone").value.trim();
    if (!username || !phone) return;

    const devs = getUsers().filter(u => u.role === "devadmin");
    devs.forEach(dev => {
      addNotification(dev.districtId, {
        type: "password_reset",
        title: "Password Reset Request",
        message: `User "${username}" (Phone: ${phone}) has requested a password reset. Please contact them to reset the password.`,
        fromDistrictId: dev.districtId,
        demandId: null,
      });
    });

    $("#fpResult").classList.remove("hidden");
    $("#fpSubmitBtn").disabled = true;
    toast("Request sent to admin!", "success");
  });

  $("#requestAccessBtn")?.addEventListener("click", openRequestAccessModal);
  $("#raDistrict")?.addEventListener("change", updateRALocationDropdown);
  $("#requestAccessForm")?.addEventListener("submit", submitAccessRequest);

  $("#logoutBtn").addEventListener("click", logout);
  $("#districtSelect")?.addEventListener("change", e => switchDistrict(e.target.value));

  $$(".sidebar-link").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $$("[data-goto]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.goto)));

  $$("#statsGrid .stat-card").forEach(card => {
    card.addEventListener("click", () => {
      const cls = [...card.classList].find(c => c.startsWith("stat-") && c !== "stat-card" && c !== "clickable");
      if (cls) openStatDetail(cls.replace("stat-", ""));
    });
  });
  $$("#demandStats .stat-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.demandKey;
      if (key) openDemandStatDetail(key);
    });
  });
  $("#statExportBtn").addEventListener("click", e => { e.stopPropagation(); $("#statExportMenu").classList.toggle("hidden"); });
  $$("#statExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#statExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printStatDetail();
    else if (t === "pdf") exportStatPDF();
    else if (t === "excel") exportStatExcel();
    else if (t === "word") exportStatWord();
  }));
  $("#statSearch")?.addEventListener("input", e => renderStatDetail(e.target.value));
  document.addEventListener("click", e => {
    if (!e.target.closest(".stat-export-dd")) $$(".stat-export-menu").forEach(m => m.classList.add("hidden"));
  });
document.addEventListener("click", e => {
    const act = e.target.closest("[data-action]");
    if (act && act.dataset.action === "dash-add-stock") {
      // Opens Add Stock already set to this row's item. The item is looked up
      // by id from the store rather than carried on the button, so the button
      // cannot be edited in the page to mean something else.
      const btn = act;
      const it = getItems().find(x => x && x.id === btn.dataset.itemId);
      if (!it) { toast("That item is no longer in the list.", "error"); renderDashboard(); return; }
      openAddStockModal(it);
      return;
    }
    if (act && act.dataset.action === "review-demand") {
      openDemandReview(act.dataset.id, act.dataset.item || "i0");
      document.querySelectorAll(".act-dd-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
      return;
    }
    if (act && act.dataset.action === "process-demand") {
      openDemandAction(act.dataset.id);
      document.querySelectorAll(".act-dd-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
      return;
    }
    if (act && act.dataset.action === "view-demand") {
      openDemandDetails(act.dataset.id);
      document.querySelectorAll(".act-dd-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
      return;
    }
    if (act && (act.dataset.action === "dist-approve" || act.dataset.action === "dist-reject" || act.dataset.action === "dist-details")) {
      if (act.dataset.action === "dist-approve") openDistApprove(act.dataset.id);
      else if (act.dataset.action === "dist-reject") openDistReject(act.dataset.id);
      else openDistributionDetail(act.dataset.id);
      document.querySelectorAll(".act-dd-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
      return;
    }
    if (act && (act.dataset.action === "maint-process" || act.dataset.action === "maint-approve" || act.dataset.action === "maint-details")) {
      if (act.dataset.action === "maint-process") openMaintProcess(act.dataset.id);
      else if (act.dataset.action === "maint-approve") openMaintApprove(act.dataset.id);
      else openMaintenanceDetail(act.dataset.id);
      document.querySelectorAll(".act-dd-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
      return;
    }
    if (e.target.closest("[data-maint-photo-remove]")) {
      __maintRemovePhoto(e.target.closest("[data-maint-photo-remove]").dataset.maintPhotoRemove);
      return;
    }
    if (e.target.closest("[data-maint-photo-view]")) {
      openMaintPhotoView(e.target.closest("[data-maint-photo-view]").dataset.maintPhotoView);
      return;
    }
    if (e.target.closest("[data-stock-photo]")) {
      __viewStockPhoto(e.target.closest("[data-stock-photo]").dataset.stockPhoto);
      return;
    }
    document.querySelectorAll(".act-dd-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
    const trig = e.target.closest("[data-act-dd]");
    if (trig) {
      const box = trig.parentElement.querySelector(".act-dd-menu");
      if (box) { box.classList.remove("hidden"); actDdFlip(trig.parentElement); }
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const open = $$(".modal-backdrop:not(.hidden)");
    if (open.length) { closeModals(); return; }
    let closed = false;
    $$(".act-dd-menu:not(.hidden), .stat-export-menu:not(.hidden), .cb-menu:not(.hidden), #notifPanel:not(.hidden)").forEach(m => { m.classList.add("hidden"); closed = true; });
    if (closed) return;
    const root = $("#appRoot");
    if (root && window.innerWidth <= 768 && root.classList.contains("sidebar-collapsed")) {
      root.classList.remove("sidebar-collapsed");
    }
  });

  /* #addItemBtn removed 2026.09.87; binding crashed init (fixed 2026.09.91) */
  $("#itemForm").addEventListener("submit", saveItem);
  $("#fCategory").addEventListener("change", () => {
    __populateItemNameList();
    const m = $("#itemNameMenu");
    if (m) { m.classList.remove("hidden"); const ipt = $("#fItemName"); if (ipt) ipt.focus(); }
  });
  const itemNameInput = $("#fItemName");
  if (itemNameInput && $("#itemNameMenu")) {
    itemNameInput.addEventListener("focus", () => { __populateItemNameList(); $("#itemNameMenu").classList.remove("hidden"); });
    itemNameInput.addEventListener("input", __populateItemNameList);
    itemNameInput.addEventListener("blur", () => setTimeout(() => { const m = $("#itemNameMenu"); if (m) m.classList.add("hidden"); }, 160));
    itemNameInput.addEventListener("keydown", e => { if (e.key === "Escape") { const m = $("#itemNameMenu"); if (m) m.classList.add("hidden"); } });
  }
$("#inventoryBody").addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "delete") {
      const item = getItems().find(x => x.id === btn.dataset.id);
      if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
      if (currentUser.role === "admin" && ($("#locationFilter") || {}).value !== currentUser.locationId) return toast(__rbacLockMsg(), "error");
      if (!canManageItem(item)) return toast(__rbacLockMsg(), "error");
    }
    if (btn.dataset.action === "view") { const item = getItems().find(i => i.id === btn.dataset.id); if (item) openViewItem(item); }
    else if (btn.dataset.action === "edit") { const item = getItems().find(i => i.id === btn.dataset.id); if (item) openItemModal(item); }
    else if (btn.dataset.action === "delete") deleteItem(btn.dataset.id);
  });
  $("#searchInput")?.addEventListener("input", renderInventory);
  bindItemSearch();
  $("#categoryFilter")?.addEventListener("change", renderInventory);
  $("#locationFilter")?.addEventListener("change", renderInventory);
  $("#conditionFilter")?.addEventListener("change", renderInventory);
  window.__msCatSH = bindMultiCombobox("categoryCbInput", "categoryCbMenu", "categoryFilter", renderInventory);
  bindCombobox("locationCbInput", "locationCbMenu", "locationFilter");
  bindCombobox("conditionCbInput", "conditionCbMenu", "conditionFilter");
  $("#itemDateFrom")?.addEventListener("change", renderInventory);
  $("#itemDateTo")?.addEventListener("change", renderInventory);
  $("#clearInvFilter")?.addEventListener("click", () => {
    ["searchInput", "categoryFilter", "locationFilter", "conditionFilter", "itemDateFrom", "itemDateTo"].forEach(id => { const e = $(`#${id}`); if (!e) return; if (e.multiple) { Array.prototype.forEach.call(e.options, o => { o.selected = false; }); } else { e.value = ""; } });
    [window.__msCatSH, window.__msCatIS].forEach(h => { if (h && h.refresh) h.refresh(); });
    renderInventory();
  });
  $("#invExportBtn").addEventListener("click", e => { e.stopPropagation(); $("#invExportMenu").classList.toggle("hidden"); });
  $$("#invExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#invExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printInventoryReport();
    else if (t === "pdf") exportInvPDF();
    else if (t === "excel") exportInvExcel();
    else if (t === "word") exportInvWord();
  }));

  const condIds = ["fCondGood", "fCondPoor", "fCondDamaged"];
  const recalcTotal = () => {
    const total = condIds.reduce((sum, id) => sum + (parseInt($("#" + id)?.value, 10) || 0), 0);
    const qtyField = $("#fQuantity");
    if (!qtyField) return;
    /* Update (edit) mode: Total Qty stays locked at the item's current total;
       user may only redistribute Good/Damaged/Scrap (2026.09.182). */
    if (!($("#fItemId") || {}).value) qtyField.value = total;
    __updateItemQtyHint(total);
  };
  condIds.forEach(id => { const el = $("#" + id); if (el) el.addEventListener("input", recalcTotal); });


  $("#newInspectionBtn").addEventListener("click", () => openInspectionModal(null));
  $("#inspectionForm").addEventListener("submit", saveInspection);
  $$("#inspectionStats .stat-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.inspKey;
      if (key) openInspStatDetail(key);
    });
  });
  $("#inspBody")?.addEventListener("click", e => {
  const b = e.target.closest("[data-insp-view]");
  if (b) { openInspectionView(b.getAttribute("data-insp-view")); return; }
});
$("#inspViewExcel")?.addEventListener("click", __inspExportExcel);
$("#inspViewWord")?.addEventListener("click", __inspExportWord);
$("#inspViewPdf")?.addEventListener("click", __inspExportPdf);
$("#inspSearch")?.addEventListener("input", renderInspections);
  $("#inspTypeFilter")?.addEventListener("change", renderInspections);
  $("#inspStatusFilter")?.addEventListener("change", renderInspections);
  $("#inspExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#inspExportMenu")?.classList.toggle("hidden"); });
  $$("#inspExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#inspExportMenu")?.classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printInspReport();
    else if (t === "pdf") exportInspPDF();
    else if (t === "excel") exportInspExcel();
    else if (t === "word") exportInspWord();
  }));

  $("#alTypeStock")?.addEventListener("change", () => { if (!$("#alTypeStock").checked) { $("#alTypeStock").checked = true; return; } $("#alTypeCons").checked = false; __alItemRows = []; const __c = $("#alItems"); if (__c) __c.innerHTML = ""; addAllotItemRow(); });
  $("#alTypeCons")?.addEventListener("change", () => { if (!$("#alTypeCons").checked) { $("#alTypeStock").checked = true; return; } $("#alTypeStock").checked = false; __alItemRows = []; const __c = $("#alItems"); if (__c) __c.innerHTML = ""; addAllotItemRow(); });
  $("#fdTypeStock")?.addEventListener("change", () => { if (!$("#fdTypeStock").checked) { $("#fdTypeStock").checked = true; return; } $("#fdTypeCons").checked = false; const __b = $("#fdItemsBody"); if (__b) { __b.innerHTML = ""; addFdRow(); } });
  $("#fdTypeCons")?.addEventListener("change", () => { if (!$("#fdTypeCons").checked) { $("#fdTypeStock").checked = true; return; } $("#fdTypeStock").checked = false; const __b = $("#fdItemsBody"); if (__b) { __b.innerHTML = ""; addFdRow(); } });
  $("#raiseDemandBtn").addEventListener("click", openDemandModal);
  $("#fdAddItemBtn")?.addEventListener("click", addFdRow);
  $("#fdItemsBody")?.addEventListener("click", e => {
    const rm = e.target.closest(".fd-row-remove");
    if (rm) { const row = rm.closest(".fd-item-row"); if (row) row.remove(); return; }
    const sug = e.target.closest(".fd-suggest-item");
    if (sug) { const wrap = sug.closest(".fd-name-wrap"); if (wrap) { wrap.querySelector(".fd-row-name").value = sug.dataset.name; wrap.querySelector(".fd-suggest").classList.add("hidden"); } return; }
  });
  ["change", "input"].forEach(evt => {
    $("#fdItemsBody")?.addEventListener(evt, e => {
      const row = e.target.closest(".fd-item-row");
      if (!row) return;
      if (e.target.classList.contains("fd-row-name")) {
        __fdSuggest(e.target);
        return;
      }
      if (e.target.classList.contains("fd-row-cat")) {
        const inp = row.querySelector(".fd-row-name");
        if (inp) { inp.value = ""; __fdSuggest(inp); }
      }
    });
  });
  $("#fdItemsBody")?.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const menu = e.target.closest(".fd-name-wrap") ? e.target.closest(".fd-name-wrap").querySelector(".fd-suggest") : null;
      if (menu) menu.classList.add("hidden");
    }
  });
  $("#fdItemsBody")?.addEventListener("mousedown", e => {
    if (e.target.classList.contains("fd-suggest-item")) e.preventDefault();
  });
  $("#fdItemsBody")?.addEventListener("focusout", e => {
    if (e.target.classList.contains("fd-row-name")) {
      const menu = e.target.closest(".fd-name-wrap").querySelector(".fd-suggest");
      setTimeout(() => { if (menu && !menu.contains(document.activeElement)) menu.classList.add("hidden"); }, 150);
    }
  });
  $("#fdDemandTo")?.addEventListener("change", function() {
    const locSel = $("#fdDemandToLocation");
    const distId = this.value;
    if (!distId) {
      locSel.innerHTML = `<option value="">Select location</option>`;
      locSel.disabled = true;
      __fdAssigneeInfo();
      return;
    }
    locSel.innerHTML = __fdLocOptions(distId);
    locSel.disabled = false;
    __fdAssigneeInfo();
  });
  $("#fdDemandToLocation")?.addEventListener("change", function() {
    __fdAssigneeInfo();
  });
  $("#demandForm").addEventListener("submit", saveDemand);
  $("#demandSearch")?.addEventListener("input", renderDemands);
  $("#demandStatusFilter")?.addEventListener("change", renderDemands);
  $("#demandDateFrom")?.addEventListener("change", renderDemands);
  $("#demandDateTo")?.addEventListener("change", renderDemands);
  $("#clearDemandFilter")?.addEventListener("click", () => { ["demandSearch","demandStatusFilter","demandDateFrom","demandDateTo"].forEach(id => { const e = $(`#${id}`); if (e) e.value = ""; }); renderDemands(); });
  $("#demandExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#demandExportMenu")?.classList.toggle("hidden"); });
  $$("#demandExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#demandExportMenu")?.classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printDemandReport();
    else if (t === "pdf") exportDemandPDF();
    else if (t === "excel") exportDemandExcel();
    else if (t === "word") exportDemandWord();
  }));

  $("#demandActionItems")?.addEventListener("click", e => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "demand-open-fulfill") openDemandFulfill(b.dataset.item);
    else if (b.dataset.action === "demand-reject-item") openDemandReject(b.dataset.item);
  });
  $("#fulfillCompleteBtn")?.addEventListener("click", completeDemandItem);
  $("#fulfillPartialBtn")?.addEventListener("click", openDemandPartial);
  $("#demandPartialForm")?.addEventListener("submit", submitDemandPartial);
  $("#demandRejectForm")?.addEventListener("submit", submitDemandReject);
  $("#demandReviewApproveBtn")?.addEventListener("click", approveDemandReview);
  $("#demandReviewRejectBtn")?.addEventListener("click", rejectDemandReview);

  // ---- Distribution bindings ----
  $("#addDistributionBtn")?.addEventListener("click", openDistributionModal);
  $("#distAddItemBtn")?.addEventListener("click", addDistRow);
  $("#distItemsBody")?.addEventListener("change", e => {
    const row = e.target.closest(".fd-item-row"); if (!row) return;
    if (e.target.classList.contains("fd-row-cat")) { __distPopulateRowItems(row); return; }
    if (e.target.classList.contains("fd-row-item")) {
      const nn = row.querySelector(".fd-row-newname");
      if ((e.target.value || "") === "__new__") { nn.classList.remove("hidden"); nn.focus(); }
      else { nn.classList.add("hidden"); nn.value = ""; }
      __distUpdateRowInfo(row); return;
    }
  });
  $("#distToChecks")?.addEventListener("change", e => {
    if (e.target.classList.contains("dist-check-none")) {
  __distToChecked.clear();
  __distRenderChecks(($("#distToSearch") || {}).value || "");
  __distUpdateToLabel();
  return;
}
if (e.target.classList.contains("dist-check-all")) {
      const opts = __distReceiverOptions();
      const val = (($("#distToSearch") || {}).value || "").trim().toLowerCase();
      const vis = opts.map((o, i) => ({ o, i })).filter(x => !val || x.o.label.toLowerCase().includes(val)).map(x => x.i);
      if (e.target.checked) vis.forEach(i => __distToChecked.add(i)); else vis.forEach(i => __distToChecked.delete(i));
      __distRenderChecks(($("#distToSearch") || {}).value || "");
    } else if (e.target.classList.contains("dist-check-one")) {
      const i = Number(e.target.value);
      if (e.target.checked) __distToChecked.add(i); else __distToChecked.delete(i);
    }
    __distUpdateToLabel();
  });
  $("#distToSearch")?.addEventListener("input", e => __distRenderChecks(e.target.value));
  $("#distToDropBtn")?.addEventListener("click", () => $("#distToChecks")?.classList.toggle("hidden"));
  $("#distributionForm")?.addEventListener("submit", saveDistribution);
  $("#distApproveSubmitBtn")?.addEventListener("click", approveDistribution);
  $("#distRejectForm")?.addEventListener("submit", doDistReject);
  $("#distRejectRemark")?.addEventListener("input", e => {
    const btn = $("#distRejectSubmitBtn");
    if (btn) btn.disabled = !e.target.value.trim();
  });
  $("#distItemsBody")?.addEventListener("click", e => {
    const rm = e.target.closest(".fd-row-remove");
    if (rm) { const row = rm.closest(".fd-item-row"); if (row) row.remove(); return; }
    const sug = e.target.closest(".fd-suggest-item");
    if (sug) { const wrap = sug.closest(".fd-name-wrap"); if (wrap) { wrap.querySelector(".fd-row-name").value = sug.dataset.name; wrap.querySelector(".fd-suggest").classList.add("hidden"); } return; }
  });
  ["change", "input"].forEach(evt => {
    $("#distItemsBody")?.addEventListener(evt, e => {
      const row = e.target.closest(".fd-item-row");
      if (!row) return;
      if (e.target.classList.contains("fd-row-name")) { __fdSuggest(e.target); return; }
      if (e.target.classList.contains("fd-row-cat")) {
        const inp = row.querySelector(".fd-row-name");
        if (inp) { inp.value = ""; __fdSuggest(inp); }
      }
    });
  });
  $("#distItemsBody")?.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const menu = e.target.closest(".fd-name-wrap") ? e.target.closest(".fd-name-wrap").querySelector(".fd-suggest") : null;
      if (menu) menu.classList.add("hidden");
    }
  });
  $("#distItemsBody")?.addEventListener("mousedown", e => {
    if (e.target.classList.contains("fd-suggest-item")) e.preventDefault();
  });
  $("#distItemsBody")?.addEventListener("focusout", e => {
    if (e.target.classList.contains("fd-row-name")) {
      const menu = e.target.closest(".fd-name-wrap").querySelector(".fd-suggest");
      setTimeout(() => { if (menu && !menu.contains(document.activeElement)) menu.classList.add("hidden"); }, 150);
    }
  });
  $$("#distStats .stat-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.distKey;
      if (key) openDistStatDetail(key);
    });
  });
  $("#distSearch")?.addEventListener("input", renderDistribution);
  $("#distStatusFilter")?.addEventListener("change", renderDistribution);
  $("#distDateFrom")?.addEventListener("change", renderDistribution);
  $("#distDateTo")?.addEventListener("change", renderDistribution);
  $("#distClearFilter")?.addEventListener("click", () => { ["distSearch","distStatusFilter","distDateFrom","distDateTo"].forEach(id => { const e = $(`#${id}`); if (e) e.value = ""; }); renderDistribution(); });
  $("#distExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#distExportMenu")?.classList.toggle("hidden"); });
  $$("#distExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#distExportMenu")?.classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printDistributionReport();
    else if (t === "pdf") exportDistPDF();
    else if (t === "excel") exportDistExcel();
    else if (t === "word") exportDistWord();
  }));

  // ---- Maintenance bindings ----
  $("#addMaintenanceBtn")?.addEventListener("click", openMaintenanceModal);
  $("#maintPhotoAdd")?.addEventListener("click", () => { const i = $("#maintPhotoInput"); if (i) i.click(); });
  $("#maintPhotoInput")?.addEventListener("change", e => { __maintReadPhotoFiles(e.target.files); e.target.value = ""; });
  $("#maintType")?.addEventListener("change", e => {
    const isOther = e.target.value === "other";
    $("#maintTypeOtherWrap")?.classList.toggle("hidden", !isOther);
    $("#maintTypeOther")?.classList.toggle("hidden", !isOther);
    if (isOther) { const o = $("#maintTypeOther"); if (o) o.focus(); }
    __maintUpdateRequestTo();
  });
  $("#maintenanceForm")?.addEventListener("submit", saveMaintenanceRequest);
  $("#maintProcessForm")?.addEventListener("submit", submitMaintProcess);
  $("#maintApproveForm")?.addEventListener("submit", submitMaintApprove);
  $("#maintSearch")?.addEventListener("input", renderMaintenance);
  $("#maintStatusFilter")?.addEventListener("change", renderMaintenance);
  $("#maintTypeFilter")?.addEventListener("change", renderMaintenance);
  $("#maintDateFrom")?.addEventListener("change", renderMaintenance);
  $("#maintDateTo")?.addEventListener("change", renderMaintenance);
  $("#maintClearFilter")?.addEventListener("click", () => { ["maintSearch","maintStatusFilter","maintTypeFilter","maintDateFrom","maintDateTo"].forEach(id => { const e = $(`#${id}`); if (e) e.value = ""; }); renderMaintenance(); });
  $("#maintExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#maintExportMenu")?.classList.toggle("hidden"); });
  $$("#maintExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#maintExportMenu")?.classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printMaintReport();
    else if (t === "pdf") exportMaintPDF();
    else if (t === "excel") exportMaintExcel();
    else if (t === "word") exportMaintWord();
  }));
  $("#maintLightboxClose")?.addEventListener("click", closeMaintLightbox);
  $("#maintLightbox")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeMaintLightbox(); });


  $("#notifBell")?.addEventListener("click", e => { e.stopPropagation(); toggleNotifPanel(); });
  $("#notifList")?.addEventListener("click", e => {
    const approveBtn = e.target.closest("[data-notif-approve]");
    const rejectBtn = e.target.closest("[data-notif-reject]");
    if (approveBtn) {
      e.stopPropagation();
      const distId = approveBtn.closest(".notif-item")?.dataset.distId || activeDistrictId;
      handleAccessApproval(approveBtn.dataset.notifId, approveBtn.dataset.requestId, "approved", distId);
      return;
    }
    if (rejectBtn) {
      e.stopPropagation();
      const distId = rejectBtn.closest(".notif-item")?.dataset.distId || activeDistrictId;
      handleAccessApproval(rejectBtn.dataset.notifId, rejectBtn.dataset.requestId, "rejected", distId);
      return;
    }
const item = e.target.closest(".notif-item");
    if (!item) return;
    const nId = item.dataset.notifId;
    if (!nId) return;
    if (item.dataset.rt === "1") {
      const readDistId = item.dataset.distId || activeDistrictId;
      __rtMarkReadFromItem(nId, readDistId);
      renderNotifications();
    } else {
      const readDistId = item.dataset.distId || activeDistrictId;
      const notifs = getNotifications(readDistId);
      const n = notifs.find(x => x.id === nId);
      if (n && !n.read) {
        n.read = true;
        saveNotifications(readDistId, notifs);
        renderNotifications();
      }
    }
    __goToNotif(item);
  });
  $("#markAllReadBtn")?.addEventListener("click", () => { markAllRead(); __rtMarkAllRead(); renderNotifications(); });
  $("#notifAllList")?.addEventListener("click", e => {
    const item = e.target.closest(".notif-item");
    if (!item || !item.dataset.notifId) return;
    if (item.dataset.rt === "1") {
      __rtMarkReadFromItem(item.dataset.notifId, item.dataset.distId || activeDistrictId);
    } else {
      const dr = item.dataset.distId || activeDistrictId;
      const notifs = getNotifications(dr);
      const n = notifs.find(x => x.id === item.dataset.notifId);
      if (n && !n.read) { n.read = true; saveNotifications(dr, notifs); }
    }
    __goToNotif(item);
  });
  $("#notifSoundToggle")?.addEventListener("click", e => { e.stopPropagation(); __rtToggleSound(); toast(__rt.soundOn ? "Sound notifications on" : "Sound notifications muted", ""); });
  const nst = $("#notifSoundToggle");
  if (nst) nst.textContent = __rt.soundOn ? "🔔" : "🔇";
  $("#viewNotifAllBtn")?.addEventListener("click", e => { e.stopPropagation(); renderAllNotifs(); openModal("#notifAllModal"); });
  $("#notifAllModalClose")?.addEventListener("click", () => closeModals());
  $("#notifAllModalClose2")?.addEventListener("click", () => closeModals());
  const rtModalX = $("#rtModalClose");
  if (rtModalX) rtModalX.addEventListener("click", () => closeModals());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && document.querySelector(".modal-backdrop:not(.hidden)")) closeModals(); });
  document.addEventListener("pointerdown", () => { if (__rt.audio && __rt.audio.state === "suspended") __rt.audio.resume().catch(() => {}); }, { once: false });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (__rt.running && __rt.ws) __rtCloseWs();
      return;
    }
    if (!__rt.running) return;
    __rtSetStatus("live");
    if (__rtWsUrl() && !__rt.wsFallback && typeof WebSocket !== "undefined") {
      if (!__rt.ws) __rtWsConnect();
    } else if (!__rt.timer) {
      __rt.backoff = 1000;
      __rt.timer = setTimeout(__rtLoopOnce, 300);
    }
  });
document.addEventListener("click", e => {
    const panel = $("#notifPanel");
    if (panel && !panel.classList.contains("hidden") && !e.target.closest(".notif-wrapper")) {
      panel.classList.add("hidden");
    }
  });

  let __pollInflight = false;
  setInterval(() => {
    if (!currentUser || !$("#appRoot") || $("#appRoot").classList.contains("hidden") || document.hidden) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (document.querySelector(".act-dd-menu:not(.hidden), .stat-export-menu:not(.hidden), .cb-menu:not(.hidden), #notifPanel:not(.hidden), .modal-backdrop:not(.hidden)")) return;
    if (window.CONFIG && window.CONFIG.useRemote && window.__apiPoll && !__pollInflight) {
      __pollInflight = true;
      window.__apiPoll().then(() => {
        __pollInflight = false;
        if (currentUser && !document.hidden && !$("#appRoot").classList.contains("hidden")) {
          renderNotifications();
          render();
        }
      });
    } else {
      renderNotifications();
      render();
    }
    __rt.dirty = false;
  }, 5000);

  /* Honor deferred realtime renders: an event during an open modal / focused
     input sets __rt.dirty; re-render as soon as the UI is free again. */
  setInterval(() => {
    if (__rt.running && __rt.dirty && currentUser && __rtCanRefresh()) {
      __rt.dirty = false;
      renderNotifications();
      render();
    }
  }, 1500);

  $("#manageCatsBtn").addEventListener("click", openCatModal);
$("#consManageCatsBtn")?.addEventListener("click", openConsCatModal);
$("#consCatAddBtn")?.addEventListener("click", addConsCategory);
$("#consCatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addConsCategory(); }
});
// The consumable category items dialog can add an item too, exactly as the
// stock one can. Both are name-only quick adds: the quantity lives in the
// consumable ledger rather than on the item, so a new row starts at zero.
$("#ccitAddBtn")?.addEventListener("click", __ccitAdd);
$("#ccitNewName")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); __ccitAdd(); }
});
// The Edit / Save / Cancel / Delete buttons in that dialog were drawn and the
// functions behind them were all written, but nothing was listening for the
// clicks, so the buttons did nothing at all. Adding an item worked because its
// button had a listener of its own; renaming one did not, which is why this was
// only noticed once someone tried to edit an item. Delegated from the body so it
// keeps working when the rows are redrawn.
$("#ccitBody")?.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest("[data-ccit-save]")) { __ccitSave(t.closest("[data-ccit-save]").dataset.ccitSave); return; }
  if (t.closest("[data-ccit-cancel]")) { if (__consCitCatId) __renderConsCatItems(__consCitCatId); return; }
  if (t.closest("[data-ccit-edit]")) { __ccitStartEdit(t.closest("[data-ccit-edit]").dataset.ccitEdit); return; }
  if (t.closest("[data-ccit-del]")) { __ccitDelete(t.closest("[data-ccit-del]").dataset.ccitDel); return; }
});
$("#distTypeStock")?.addEventListener("change", () => {
  if (!$("#distTypeStock").checked) { $("#distTypeStock").checked = true; return; }
  $("#distTypeCons").checked = false;
  __distResetRowsForType();
});
$("#distTypeCons")?.addEventListener("change", () => {
  if (!$("#distTypeCons").checked) { $("#distTypeStock").checked = true; return; }
  $("#distTypeStock").checked = false;
  __distResetRowsForType();
});
$("#consCatList").addEventListener("click", e => {
  if (e.target.closest("[data-ccat-items]")) openConsCatItems(parseInt(e.target.closest("[data-ccat-items]").dataset.ccatItems, 10));
if (e.target.closest("[data-ccat-edit]")) startEditConsCat(parseInt(e.target.closest("[data-ccat-edit]").dataset.ccatEdit, 10));
  else if (e.target.closest("[data-ccat-save]")) saveEditConsCat(parseInt(e.target.closest("[data-ccat-save]").dataset.ccatSave, 10));
  else if (e.target.closest("[data-ccat-cancel]")) renderConsCatList();
  else if (e.target.closest("[data-ccat-del]")) deleteConsCategory(parseInt(e.target.closest("[data-ccat-del]").dataset.ccatDel, 10));
});
  $("#catAddBtn").addEventListener("click", addCategory);
  $("#catList").addEventListener("click", e => {
    if (e.target.closest("[data-cat-edit]")) startEditCat(parseInt(e.target.closest("[data-cat-edit]").dataset.catEdit, 10));
    else if (e.target.closest("[data-cat-save]")) saveEditCat(parseInt(e.target.closest("[data-cat-save]").dataset.catSave, 10));
    else if (e.target.closest("[data-cat-cancel]")) renderCatList();
    else if (e.target.closest("[data-cat-del]")) deleteCategory(parseInt(e.target.closest("[data-cat-del]").dataset.catDel, 10));
  else if (e.target.closest("[data-cat-items]")) openCatItems(parseInt(e.target.closest("[data-cat-items]").dataset.catItems, 10));
  else if (e.target.closest("[data-cit-edit]")) __citStartEdit(e.target.closest("[data-cit-edit]").dataset.citEdit);
  else if (e.target.closest("[data-cit-save]")) __citSave(e.target.closest("[data-cit-save]").dataset.citSave);
  else if (e.target.closest("[data-cit-cancel]")) { const __ci = getAllDistrictItems().find(function(i){ return i.id === e.target.closest("[data-cit-cancel]").dataset.citCancel; }); if (__ci) __renderCatItems(__ci.categoryId); }
  else if (e.target.closest("[data-cit-del]")) __citDelete(e.target.closest("[data-cit-del]").dataset.citDel);

  });

  $("#manageUsersBtn")?.addEventListener("click", () => { if (isDevAdmin()) openDevUsers(); else if (isAdmin()) openAdminUsers(); else openUsersModal(); });
  $("#addUserForm").addEventListener("submit", addUser);
  $("#cancelUserEdit").addEventListener("click", cancelUserEdit);
  $("#nuDistrict")?.addEventListener("change", updateUserLocationDropdown);
  // The district column belongs to the IG role alone: it appears the moment the
  // role is set to Inspector General and disappears again for every other role.
  $("#nuRole")?.addEventListener("change", () => { buildIgDistrictPicker(readIgDistricts()); syncIgRow(); });
  $("#usersList").addEventListener("click", e => {
    if (e.target.closest("[data-edit-user]")) startEditUser(e.target.closest("[data-edit-user]").dataset.editUser);
    else if (e.target.closest("[data-del-user]")) deleteUser(e.target.closest("[data-del-user]").dataset.delUser);
  });

  $("#manageMenuBtn")?.addEventListener("click", (e) => { e.stopPropagation(); $("#manageMenu")?.classList.toggle("hidden"); });
document.addEventListener("click", (e) => { if (!e.target.closest(".nav-manage-wrap")) $("#manageMenu")?.classList.add("hidden"); });
$$("#manageMenu .manage-menu-item").forEach(b => b.addEventListener("click", () => {
  const act = b.getAttribute("data-maction");
  $("#manageMenu")?.classList.add("hidden");
  if (act === "districts") { if (isIg()) openIgDistricts(); else openDevDistricts(); }
  else if (act === "users") { if (isDevAdmin()) openDevUsers(); else if (isAdmin()) openAdminUsers(); else openUsersModal(); }
  else if (act === "igs") openDevIgs();
  else if (act === "locations") openAdminLocs();
}));
  $("#addDistrictForm").addEventListener("submit", addDistrict);
  $("#cancelDistEdit").addEventListener("click", cancelDistEdit);
  $("#addLocationBtn").addEventListener("click", addLocation);
  $("#districtsList").addEventListener("click", e => {
    if (e.target.closest("[data-dist-edit]")) startEditDistrict(e.target.closest("[data-dist-edit]").dataset.distEdit);
    else if (e.target.closest("[data-dist-del]")) deleteDistrict(e.target.closest("[data-dist-del]").dataset.distDel);
    else if (e.target.closest("[data-dist-locs]")) showLocations(e.target.closest("[data-dist-locs]").dataset.distLocs);
  });
  $("#locationList").addEventListener("click", e => {
    if (e.target.closest("[data-loc-del]")) deleteLocation(e.target.closest("[data-loc-del]").dataset.locDel);
  });

  $$(".report-tab").forEach(t => t.addEventListener("click", () => { $$(".report-tab").forEach(rt => rt.classList.remove("active")); t.classList.add("active"); renderReports(); }));
  $("#reportExportBtn").addEventListener("click", e => { e.stopPropagation(); $("#reportExportMenu").classList.toggle("hidden"); });
  $$("#reportExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#reportExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printRptReport();
    else if (t === "pdf") exportRptPDF();
    else if (t === "excel") exportRptExcel();
    else if (t === "word") exportRptWord();
  }));
  $("#reportSearch")?.addEventListener("input", e => { __rptSearch = e.target.value; renderReports(); });

  /* ----- Allotments ----- */
  const __allocShowTab = (name) => {
    __allocTab = name;
    $$("[data-atab]").forEach(t => t.classList.toggle("active", t.dataset.atab === name));
    $$(".alloc-tab").forEach(tab => tab.classList.toggle("hidden", tab.dataset.allocTab !== name));
    renderAllotments();
  };
  $$("[data-atab]").forEach(t => t.addEventListener("click", () => __allocShowTab(t.dataset.atab)));

  /* ----- Inventory: Item Stock / Stock History sub-tabs ----- */
  $$("[data-invt]").forEach(t => t.addEventListener("click", () => {
    __invTab = t.dataset.invt;
    $$("[data-invt]").forEach(x => x.classList.toggle("active", x.dataset.invt === __invTab));
    $$("[data-inv-tab]").forEach(p => p.classList.toggle("hidden", p.dataset.invTab !== __invTab));
    if (__invTab === "stock") renderAllocStock();
  }));

  $("#allocOpenBtn")?.addEventListener("click", openAllotModal);
  $("#allocAddStockBtn")?.addEventListener("click", openAddStockModal);
  $("#addStockForm")?.addEventListener("submit", saveAddStock);
  $("#asAddItemBtn")?.addEventListener("click", addAsRow);
  $("#asRows")?.addEventListener("click", __asRowsClick);
  $("#asRows")?.addEventListener("change", __asRowsChange);
  
  $("#locOwnBtn")?.addEventListener("click", () => setInvStockLoc("own"));
  $("#locAllSel")?.addEventListener("change", () => setInvStockLoc(($("#locAllSel") || {}).value || "all"));
  $("#scanOpenBtn")?.addEventListener("click", openScanModal);
  $("#scanHistoryBtn")?.addEventListener("click", openScanHistory);
  $("#docUploadBtn")?.addEventListener("click", openDocUploadModal);
  $("#documentsBtn")?.addEventListener("click", openDocuments);
  bindScanEvents();
  $("#scanHistoryBody")?.addEventListener("click", e => {
    const b = e.target.closest("[data-scan-view]");
    if (b) { openScanView(b.dataset.scanView); return; }
    const dv = e.target.closest("[data-doc-view]");
    if (dv) { openDocView(dv.dataset.docView); return; }
    const dd = e.target.closest("[data-doc-del]");
    if (dd) { deleteDocument(dd.dataset.docDel); }
  });
  $("#documentsUploadBtn")?.addEventListener("click", openDocUploadModal);
  $("#itemDocForm")?.addEventListener("submit", saveDocUpload);
  $("#docFileInput")?.addEventListener("change", handleDocFileChange);
  $("#docFileClear")?.addEventListener("click", () => {
    const f = $("#docFileInput"); if (f) f.value = "";
    const c = $("#docChosen"); if (c) c.classList.add("hidden");
    const p = $("#docPreview"); if (p) p.innerHTML = "";
    window.__docUploadData = { data: null, size: 0 };
  });
  const docItemsBox = $("#docItemsRow");
  if (docItemsBox) {
    docItemsBox.addEventListener("change", e => {
      const cat = e.target.closest(".doc-row-cat");
      if (cat) {
        const row = cat.closest(".doc-item-row");
        __populateDocRow(row);
        const menu = row.querySelector(".doc-row-menu");
        if (menu) { menu.classList.remove("hidden"); const ipt = row.querySelector(".doc-row-item"); if (ipt) ipt.focus(); }
      }
    });
    docItemsBox.addEventListener("input", e => {
      const it = e.target.closest(".doc-row-item");
      if (it) __populateDocRow(it.closest(".doc-item-row"));
    });
    docItemsBox.addEventListener("focusin", e => {
      const it = e.target.closest(".doc-row-item");
      if (it) { const row = it.closest(".doc-item-row"); __populateDocRow(row); const m = row.querySelector(".doc-row-menu"); if (m) m.classList.remove("hidden"); }
    });
    docItemsBox.addEventListener("focusout", e => {
      const it = e.target.closest(".doc-row-item");
      if (it) setTimeout(() => { const m = it.closest(".doc-item-row").querySelector(".doc-row-menu"); if (m) m.classList.add("hidden"); }, 160);
    });
    docItemsBox.addEventListener("keydown", e => {
      if (e.key === "Escape") { const it = e.target.closest(".doc-row-item"); if (it) { const m = it.closest(".doc-item-row").querySelector(".doc-row-menu"); if (m) m.classList.add("hidden"); } }
    });
    docItemsBox.addEventListener("mousedown", e => {
      const del = e.target.closest(".doc-row-del");
      if (del) {
        e.preventDefault();
        const row = del.closest(".doc-item-row");
        if (row && docItemsBox.children.length > 1) row.remove();
        return;
      }
      const opt = e.target.closest(".cb-opt");
      if (opt) {
        e.preventDefault();
        const row = opt.closest(".doc-item-row");
        const ipt = row.querySelector(".doc-row-item");
        ipt.value = opt.dataset.name;
        __populateDocRow(row);
        const m = row.querySelector(".doc-row-menu"); if (m) m.classList.add("hidden");
      }
    });
  }
  $("#docAddItemBtn")?.addEventListener("click", () => { const box = $("#docItemsRow"); if (box) box.insertAdjacentHTML("beforeend", __docRowHtml()); });
  $("#allotForm")?.addEventListener("submit", saveAllotment);
  $("#alAddItemRow")?.addEventListener("click", () => addAllotItemRow());
  bindPersonSuggest();
  bindAllotMobileValidation();

  $("#allocStockSearch")?.addEventListener("input", renderAllocStock);
  window.__msCatIS = bindMultiCombobox("allocStockCatInput", "allocStockCatMenu", "allocStockCat", renderAllocStock);
  window.__msCatAI = bindMultiCombobox("allocCatInput", "allocCatMenu", "allocCatFilter", renderAllottedList);
  window.__msStatus = bindMultiCombobox("allocStatusInput", "allocStatusMenu", "allocStatusFilter", renderAllottedList, { anyLabel: 'Any Status', allLabel: 'All Status', emptyLabel: 'No statuses', selectAllLabel: 'Select All', clearLabel: 'Deselect All' });
  document.querySelectorAll("[data-stock-filter]").forEach(b => b.addEventListener("click", () => setStockType(b.dataset.stockFilter)));
  $("#allocStockType")?.addEventListener("change", e => setStockType(e.target.value));
  $("#allocStockTable")?.addEventListener("click", e => {
    const th = e.target.closest(".sortable");
    if (th && th.dataset.sort) setStockSort(th.dataset.sort);
  });
  /* Adjust Stock toolbar button removed (2026.09.87) */
  $("#allocStockExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#allocStockExportMenu").classList.toggle("hidden"); });
  $$("#allocStockExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#allocStockExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printAllocStock();
    else if (t === "pdf") exportAllocStockPDF();
    else if (t === "excel") exportAllocStockExcel();
    else if (t === "word") exportAllocStockWord();
  }));

  $("#allocSearch")?.addEventListener("input", renderAllottedList);
  $("#allocCatFilter")?.addEventListener("change", renderAllottedList);
  $("#allocItemFilter")?.addEventListener("change", renderAllottedList);
  $("#allocPostingFilter")?.addEventListener("input", renderAllottedList);
  $("#allocRankFilter")?.addEventListener("change", renderAllottedList);
  $("#allocStatusFilter")?.addEventListener("change", renderAllottedList);
  $("#allocDateFrom")?.addEventListener("change", renderAllottedList);
  $("#allocDateTo")?.addEventListener("change", renderAllottedList);
  $("#allocClearFilter")?.addEventListener("click", () => {
    // allocCatFilter is a multiple select: setting .value = "" on it leaves the
    // ticked boxes ticked, so the filter would survive the Clear.
    ["allocSearch", "allocCatFilter", "allocItemFilter", "allocPostingFilter", "allocRankFilter", "allocStatusFilter", "allocDateFrom", "allocDateTo"].forEach(id => { const el = $("#" + id); if (!el) return; if (el.multiple) { Array.prototype.forEach.call(el.options, o => { o.selected = false; }); } else { el.value = ""; } });
    [window.__msCatAI, window.__msStatus].forEach(h => { if (h && h.refresh) h.refresh(); });
    renderAllottedList();
  });
  $("#allocExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#allocExportMenu").classList.toggle("hidden"); });
  $$("#allocExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#allocExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printAllocList();
    else if (t === "pdf") exportAllocListPDF();
    else if (t === "excel") exportAllocListExcel();
    else if (t === "word") exportAllocListWord();
  }));

  $("#allocRetSearch")?.addEventListener("input", renderReturnHistory);
  $("#allocRetExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#allocRetExportMenu").classList.toggle("hidden"); });
  $$("#allocRetExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#allocRetExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printAllocReturns();
    else if (t === "pdf") exportAllocReturnsPDF();
    else if (t === "excel") exportAllocReturnsExcel();
    else if (t === "word") exportAllocReturnsWord();
  }));

  $("#allocStockBody")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-alloc-action]");
    if (!btn) return;
    if (btn.dataset.allocAction === "view") openAllocItemDetail(btn.dataset.id);
    else if (btn.dataset.allocAction === "edit") { const it = getItems().find(i => i.id === btn.dataset.id); if (it) openItemModal(it); }
    /* row Adjust action removed (2026.09.87) */
  });
  $("#allocBody")?.addEventListener("click", e => {
    const el = e.target.closest("[data-alloc-action]");
    if (!el) return;
    const id = el.dataset.id;
    const action = el.dataset.allocAction;
    if (action === "person") openAllocPersonDetail(el.dataset.belt);
    else if (action === "view") openAllocItemDetail(getAllotments().find(a => a.id === id)?.itemId);
    else if (action === "edit") openEditAllotment(id);
    else if (action === "return") openReturnModal(id);
    else if (action === "loss") openLossModal(id);
    else if (action === "recovery") openRecoveryModal(id);
  });
  $("#returnForm")?.addEventListener("submit", saveReturn);
  $("#lossForm")?.addEventListener("submit", submitLoss);
  $("#recoveryForm")?.addEventListener("submit", submitRecovery);
  $("#adjustForm")?.addEventListener("submit", saveAdjust);
  $("#ajType")?.addEventListener("change", () => {
    const isCorrection = $("#ajType").value === "correction";
    $("#ajQtyGroup").classList.toggle("hidden", isCorrection);
    $("#ajTotalGroup").classList.toggle("hidden", !isCorrection);
  });

  // Two different jobs hang off this one button, and they are told apart by
  // width alone. Between 769px and 1024px the sidebar is a side drawer and
  // mobile.js opens and closes it; below 769px the sidebar is a bottom bar
  // that is always on screen, and above 1024px it is a rail that widens on
  // hover and this pins it open. Both listeners sit on this same button and
  // stopPropagation() does not stop a second listener on the same element, so
  // the two would otherwise both fire and the next press would look broken.
  // This is the same query mobile.js isNarrow() uses, so they cannot disagree.
  $("#sidebarToggle")?.addEventListener("click", () => {
    if (window.matchMedia("(min-width: 769px) and (max-width: 1024px)").matches) return;
    if (window.matchMedia("(max-width: 768px)").matches) return;
    $("#appRoot").classList.toggle("sidebar-collapsed");
  })
  // every table in the app gets its column names copied onto its cells once, then
  // and again whenever any of them is rebuilt
  try { watchTables(); } catch (e) { /* older browser without MutationObserver */ };

  document.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target.closest("#themeToggle") : null;
    if (t) toggleTheme();
  });

  $$("[data-close]").forEach(btn => { btn.type = "button"; btn.addEventListener("click", closeModals); });
  $$(".modal-backdrop").forEach(b => b.addEventListener("click", e => { if (e.target === b) closeModals(); }));
  $("#catInput")?.addEventListener("keydown", e => { if (e.key === "Enter") addCategory(); });
}

function toggleTheme() {
  const root = document.documentElement;
  const now = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  if (now === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  try { localStorage.setItem("hpi_theme", now); } catch (e) {}
}

/* ==================== REALTIME (LIVE) SYSTEM ==================== */
let __rt = {
  running: false, timer: null, cursor: 0, backoff: 1000,
  events: [], dirty: false, justAdded: false,
  soundOn: (function () { try { return localStorage.getItem("hpi_rt_mute") !== "1"; } catch (e) { return true; } })(),
  audio: null,
  ws: null, wsOk: false, wsRetries: 0, wsFallback: false, wsReconnectTimer: null,
};
const __rtCursorKey = () => (STORAGE_PREFIX + "rt_cursor_" + (currentUser ? (currentUser.username || currentUser.id) : "anon"));
const __rtReadKey = () => (STORAGE_PREFIX + "rt_read_" + (currentUser ? (currentUser.username || currentUser.id) : "anon"));
const __rtApiBase = () => (window.CONFIG && CONFIG.apiBase ? CONFIG.apiBase : "");

function __rtLoadCursor() { try { return parseInt(localStorage.getItem(__rtCursorKey()) || "0", 10) || 0; } catch (e) { return 0; } }
function __rtSaveCursor(id) { try { localStorage.setItem(__rtCursorKey(), String(id)); } catch (e) {} }

function __rtMarkedRead(id) {
  try { const m = JSON.parse(localStorage.getItem(__rtReadKey()) || "{}"); return !!m["e" + id]; } catch (e) { return false; }
}
function __rtMarkRead(id) {
  try { const m = JSON.parse(localStorage.getItem(__rtReadKey()) || "{}"); m["e" + id] = 1; localStorage.setItem(__rtReadKey(), JSON.stringify(m)); } catch (e) {}
}
function __rtMarkAllRead() { __rt.events.forEach(ev => __rtMarkRead(ev.id)); }

function __rtMarkReadFromItem(nId, distId) {
  if (!isDevAdmin() && distId && distId !== activeDistrictId) return;
  if (typeof nId === "string" && nId.indexOf("rt_") === 0) {
    const id = parseInt(nId.slice(3), 10);
    if (id) __rtMarkRead(id);
    renderNotifications();
  }
}

function __rtSetStatus(s) {
  const el = $("#rtStatus");
  if (el) {
    el.style.display = currentUser ? "inline-flex" : "none";
    el.classList.remove("rt-live", "rt-reconnect", "rt-off");
    el.classList.add("rt-" + s);
  }
  const lbl = $("#rtStatusLabel");
  if (lbl) lbl.textContent = s === "live" ? "Live" : s === "reconnect" ? "Connecting?" : "Offline";
  const lbl2 = $("#rtStatusLabel2");
  if (lbl2) lbl2.textContent = s === "live" ? "Live" : s === "reconnect" ? "Connecting?" : "Offline";
}

function __rtStart() {
  if (__rt.running || !currentUser) return;
  __rt.running = true;
  __rt.backoff = 1000;
  __rt.wsRetries = 0;
  __rt.cursor = __rtLoadCursor();
  __rtSetStatus("live");
  __rtBackfill().then(() => {
    if (!__rt.running) return;
    if (__rtWsUrl() && typeof WebSocket !== "undefined") __rtWsConnect();
    else __rtSchedulePoll(300);
  });
}

function __rtStop() {
  __rt.running = false;
  if (__rt.timer) { clearTimeout(__rt.timer); __rt.timer = null; }
  if (__rt.wsReconnectTimer) { clearTimeout(__rt.wsReconnectTimer); __rt.wsReconnectTimer = null; }
  __rtCloseWs();
  __rtSetStatus("off");
}

function __rtSchedulePoll(delay) {
  if (!__rt.running) return;
  __rt.timer = setTimeout(__rtLoopOnce, delay);
}

function __rtWsUrl() {
  try { return ((window.CONFIG && CONFIG.wsUrl) || "").toString().trim(); } catch (e) { return ""; }
}

function __rtWsConnect() {
  if (!__rt.running || !currentUser || __rt.wsFallback) return;
  const url = __rtWsUrl();
  if (!url) return;
  try { __rtCloseWs(); } catch (e) { /* ignore */ }
  const u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "token=" + encodeURIComponent(getToken() || "");
  let socket;
  try { socket = new WebSocket(u); } catch (e) { __rtWsFallback(); return; }
  __rt.ws = socket;
  socket.onopen = () => {
    if (!__rt.running) { try { socket.close(); } catch (e) {} return; }
    __rt.wsOk = true;
    __rt.wsRetries = 0;
    __rtSetStatus("live");
  };
  socket.onmessage = (e) => {
    if (!__rt.running) return;
    try {
      const m = JSON.parse(e.data);
      if (m && m.type === "rt" && Array.isArray(m.events)) {
        __rt.wsOk = true;
        __rt.wsRetries = 0;
        __rtHandleEvents(m.events, false);
      } else if (m && m.type === "error") {
        __rtWsFallback();
      }
    } catch (err) { /* non-JSON frame -> ignore */ }
  };
  socket.onclose = () => { __rtWsClosed(); };
  socket.onerror = () => { /* onclose follows */ };
}

function __rtCloseWs() {
  if (__rt.ws) {
    try { __rt.ws.onopen = __rt.ws.onmessage = __rt.ws.onclose = __rt.ws.onerror = null; __rt.ws.close(); } catch (e) { /* ignore */ }
    __rt.ws = null;
  }
  __rt.wsOk = false;
}

function __rtWsClosed() {
  __rt.ws = null;
  __rt.wsOk = false;
  if (!__rt.running) return;
  if (__rt.wsFallback) { __rtLoopOnce(); return; }
  __rt.wsRetries++;
  if (__rt.wsRetries >= 4) { __rtWsFallback(); return; }
  __rtSetStatus("reconnect");
  __rt.wsReconnectTimer = setTimeout(__rtWsConnect, __rt.backoff);
  __rt.backoff = Math.min(Math.max(__rt.backoff * 1.5, 1000), 8000);
}

function __rtWsFallback() {
  if (__rt.wsFallback) return;
  __rt.wsFallback = true;
  __rtCloseWs();
  __rtSchedulePoll(200);
}

async function __rtBackfill() {
  try {
    const res = await fetch(__rtApiBase() + "/api/rt?since=0&limit=50", {
      headers: { Authorization: "Bearer " + (getToken() || "") }, cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.events)) {
      const maxId = data.events.reduce((m, e) => Math.max(m, e.id), 0);
      if (maxId > __rt.cursor) { __rt.cursor = maxId; __rtSaveCursor(maxId); }
      __rtHandleEvents(data.events, true);
    }
  } catch (e) { /* offline until the stream reconnects */ }
}

async function __rtLoopOnce() {
  if (!__rt.running || !currentUser) return;
  if (__rt.wsOk && !__rt.wsFallback) return; /* ws is delivering; poll only as fallback */
  __rtSetStatus("live");
  const since = __rt.cursor;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9500);
    const res = await fetch(__rtApiBase() + "/api/rtstream?since=" + since, {
      headers: { Authorization: "Bearer " + (getToken() || "") }, cache: "no-store", signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error("rtstream " + res.status);
    const data = await res.json();
    if (data && Array.isArray(data.events) && data.events.length) __rtHandleEvents(data.events, false);
    __rt.backoff = 1000;
    if (!__rt.running) return;
    __rt.timer = setTimeout(__rtLoopOnce, 50);
  } catch (e) {
    if (!__rt.running) return;
    if (document.hidden) { __rtSetStatus("off"); return; } /* visibilitychange restarts */
    __rtSetStatus("reconnect");
    __rt.timer = setTimeout(__rtLoopOnce, __rt.backoff);
    __rt.backoff = Math.min(__rt.backoff * 1.5, 15000);
  }
}

function __rtHandleEvents(list, backfill) {
  if (!list || !list.length) return;
  const known = new Set(__rt.events.map(e => e.id));
  const fresh = [];
  const sorted = list.slice().sort((a, b) => b.createdAt - a.createdAt);
  for (const ev of sorted) {
    if (known.has(ev.id)) continue;
    __rt.events.unshift(ev);
    if (__rt.events.length > 60) __rt.events.pop();
    fresh.push(ev);
  }
  if (sorted.length) {
    const maxId = sorted.reduce((m, e) => Math.max(m, e.id), 0);
    if (maxId > __rt.cursor) { __rt.cursor = maxId; __rtSaveCursor(maxId); }
  }
  if (!fresh.length) return;
  __rt.justAdded = !backfill && fresh.length > 0;
  if (!backfill) fresh.slice().reverse().forEach(ev => __rtNotifyLive(ev));
  __rtRenderFeed();
  __rtRefresh();
  if (!backfill && window.CONFIG && window.CONFIG.useRemote && window.__apiPoll) {
    window.__apiPoll().then(() => { if (__rtCanRefresh()) { renderNotifications(); render(); } }).catch(() => {});
  }
}

function __rtNotifyLive(ev) {
  __rtPlaySound();
  const err = ev.type === "LOW_STOCK_ALERT" || ev.type === "DEMAND_REJECTED" || ev.type.indexOf("ACCESS_REQUEST_REJECTED") === 0;
  const ok = /APPROVED$|ISSUED$|COMPLETED$|RETURNED$/.test(ev.type);
  toast(ev.message, ok ? "success" : err ? "error" : "");
}

function __rtVisibleEvents() {
  if (!currentUser || !activeDistrictId) return [];
  return __rt.events.filter(ev => {
    const sc = ev.scope || {};
    if (isDevAdmin()) return true;
    if (Array.isArray(sc.users) && sc.users.includes(currentUser.id)) return true;
    if (Array.isArray(sc.districts) && sc.districts.includes(activeDistrictId)) return true;
    return false;
  });
}

function __rtToNotifType(t) {
  if (t === "DEMAND_CREATED" || t === "DEMAND_ASSIGNED") return "demand_assigned";
  if (t === "DEMAND_APPROVED" || t === "DEMAND_COMPLETED") return "demand_completed";
  if (t === "DEMAND_PARTIAL_COMPLETED") return "demand_partial_completed";
  if (t === "DEMAND_REJECTED") return "demand_rejected";
  if (t === "DEMAND_AWAITING_REVIEW") return "demand_review_pending";
  if (t.indexOf("DEMAND_") === 0) return "demand_assigned";
  if (t === "DISTRIBUTION_CREATED") return "distribution_received";
  if (t === "DISTRIBUTION_APPROVED") return "distribution_approved";
  if (t === "DISTRIBUTION_REJECTED") return "distribution_rejected";
  if (t.indexOf("DISTRIBUTION_") === 0) return "distribution_received";
  if (t === "MAINTENANCE_CREATED") return "maintenance_received";
  if (t === "MAINTENANCE_PROCESSED") return "maintenance_processed";
  if (t === "MAINTENANCE_COMPLETED") return "maintenance_completed";
  if (t.indexOf("MAINTENANCE_") === 0) return "maintenance_received";
  if (t.indexOf("ACCESS_REQUEST_APPROVED") === 0) return "access_approved";
  if (t.indexOf("ACCESS_REQUEST_REJECTED") === 0) return "access_rejected";
  if (t.indexOf("ACCESS_") === 0) return "access_request";
  if (t.indexOf("LOW_STOCK") === 0) return "low_stock";
  if (t === "USER_CREATED" || t === "ROLE_UPDATED" || t === "USER_UPDATED") return "access_request";
  return "demand_assigned";
}

function __rtPersistKey(ev) {
  const p = ev.payload || {};
  const id = p.demandId || p.requestId || p.txnId || p.distributionId || p.maintenanceId || null;
  if (!id) return null;
  let fam = null;
  if (ev.type.indexOf("DEMAND_") === 0) fam = "demand";
  if (ev.type.indexOf("DISTRIBUTION_") === 0) fam = "dist";
  if (ev.type.indexOf("MAINTENANCE_") === 0) fam = "maint";
  if (ev.type.indexOf("ACCESS_") === 0) fam = "access";
  return fam ? fam + ":" + id : null;
}

function __rtUnreadCount() {
  if (!currentUser || !activeDistrictId) return 0;
  const persistKeys = new Set();
  const lists = isDevAdmin()
    ? getDistricts().map(d => getNotifications(d.id)).flat()
    : getNotifications(activeDistrictId);
  lists.forEach(n => {
    const k = n.demandId ? "demand:" + n.demandId : n.requestId ? "access:" + n.requestId : n.distributionId ? "dist:" + n.distributionId : n.maintenanceId ? "maint:" + n.maintenanceId : null;
    if (k) persistKeys.add(k);
  });
  return __rtVisibleEvents().filter(ev => {
    const pk = __rtPersistKey(ev);
    if (pk && persistKeys.has(pk)) return false;
    return !__rtMarkedRead(ev.id);
  }).length;
}

function __rtCanRefresh() {
  if (!currentUser || !$("#appRoot") || $("#appRoot").classList.contains("hidden") || document.hidden) return false;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (document.querySelector(".act-dd-menu:not(.hidden), .stat-export-menu:not(.hidden), .cb-menu:not(.hidden), #notifPanel:not(.hidden), .modal-backdrop:not(.hidden)")) return false;
  return true;
}

function __rtRefresh() {
  if (__rtCanRefresh()) { renderNotifications(); render(); }
  else __rt.dirty = true;
}

function __rtRenderFeed() {
  const box = $("#rtFeed");
  if (!box) return;
  if (!__rt.events.length) { box.innerHTML = `<div class="feed-empty">No recent activity yet.</div>`; return; }
  const first = __rt.justAdded ? "feed-new" : "";
  __rt.justAdded = false;
  box.innerHTML = __rt.events.slice(0, 30).map((ev, i) => {
    const fi = __rtFeedIcon(ev.type);
    return `<div class="feed-item ${i === 0 ? first : ""}" data-feed="${ev.id}">
      <span class="feed-icon ${fi.cls}">${fi.svg}</span>
      <div class="feed-body">
        <div class="feed-msg">${esc(ev.message)}</div>
        <div class="feed-time">${getTimeAgo(ev.createdAt)}</div>
      </div>
    </div>`;
  }).join("");
}

function __rtFeedIcon(type) {
  const box = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/></svg>`;
  const check = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`;
  const cross = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const user = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
  const warn = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const key = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
  if (type === "LOW_STOCK_ALERT") return { cls: "feed-alert", svg: warn };
  if (type.indexOf("ACCESS_") === 0) return { cls: "feed-user", svg: type.indexOf("REJECT") >= 0 ? cross : user };
  if (type.indexOf("DISTRIBUTION_") === 0) return { cls: type === "DISTRIBUTION_REJECTED" ? "feed-cross" : type === "DISTRIBUTION_CREATED" ? "feed-box" : "feed-check", svg: type === "DISTRIBUTION_REJECTED" ? cross : type === "DISTRIBUTION_CREATED" ? box : check };
  if (type.indexOf("MAINTENANCE_") === 0) return { cls: type === "MAINTENANCE_COMPLETED" ? "feed-check" : (type === "MAINTENANCE_PROCESSED" ? "feed-box" : "feed-alert"), svg: type === "MAINTENANCE_COMPLETED" ? check : box };
  if (type.indexOf("DEMAND_") === 0) return { cls: type === "DEMAND_REJECTED" ? "feed-cross" : type === "DEMAND_CREATED" ? "feed-box" : "feed-check", svg: type === "DEMAND_REJECTED" ? cross : type === "DEMAND_CREATED" ? box : check };
  if (type === "USER_CREATED" || type === "ROLE_UPDATED" || type === "USER_UPDATED") return { cls: "feed-user", svg: user };
  if (type.indexOf("PASSWORD") === 0) return { cls: "feed-user", svg: key };
  return { cls: "feed-box", svg: box };
}

function __notifIconCls(type) {
  if (type === "demand_raised" || type === "demand_assigned" || type === "demand_review_pending" || type === "distribution_received" || type === "maintenance_received" || type === "maintenance_processed") return "notif-icon-demand";
  if (type === "demand_approved" || type === "demand_completed" || type === "demand_review_approved" || type === "access_approved" || type === "distribution_approved" || type === "maintenance_completed") return "notif-icon-approved";
  if (type === "demand_rejected" || type === "demand_partial_completed" || type === "demand_review_rejected" || type === "distribution_rejected") return "notif-icon-rejected";
  if (type === "password_reset") return "notif-icon-password";
  if (type === "access_request") return "notif-icon-access";
  return "notif-icon-demand";
}

function __notifIconSvg(type) {
  const box = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/></svg>`;
  const check = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`;
  const cross = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const lock = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
  const user = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
  const clock = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  if (type === "demand_raised" || type === "demand_assigned" || type === "distribution_received" || type === "maintenance_received") return box;
  if (type === "demand_review_pending" || type === "maintenance_processed") return clock;
  if (type === "demand_approved" || type === "demand_completed" || type === "demand_review_approved" || type === "access_approved" || type === "distribution_approved" || type === "maintenance_completed") return check;
  if (type === "demand_rejected" || type === "demand_partial_completed" || type === "demand_review_rejected" || type === "distribution_rejected") return cross;
  if (type === "password_reset") return lock;
  if (type === "access_request") return user;
  return box;
}

function __rtToggleSound() {
  __rt.soundOn = !__rt.soundOn;
  try { localStorage.setItem("hpi_rt_mute", __rt.soundOn ? "0" : "1"); } catch (e) {}
  const b = $("#notifSoundToggle");
  if (b) b.textContent = __rt.soundOn ? "🔔" : "🔇";
  return __rt.soundOn;
}

function __rtPlaySound() {
  if (!__rt.soundOn) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!__rt.audio) __rt.audio = new AC();
    if (__rt.audio.state === "suspended") __rt.audio.resume().catch(() => {});
    const ctx = __rt.audio, now = ctx.currentTime;
    const blip = (freq, at, len) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.1, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(ctx.destination);
      o.start(at); o.stop(at + len + 0.02);
    };
    blip(880, now, 0.28);
    blip(1174, now + 0.09, 0.3);
  } catch (e) {}
}

function __ensureDistrictStaffUsers() {
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "devadmin")) return;
  try {
    const users = getUsers().slice();
    const allLocs = loadData("locations") || {};
    const districts = getDistricts();
    const scope = currentUser.role === "devadmin" ? districts : districts.filter(d => d.id === currentUser.districtId);
    let added = false;
    for (const d of scope) {
      const code = String(d.code || d.name || d.id || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || String(d.id).toLowerCase().replace(/[^a-z0-9]+/g, "");
      const locs = Array.isArray(allLocs[d.id]) ? allLocs[d.id].slice() : [];
      for (const def of [
        { role: "itstaff", name: "Computer/IT Staff", username: ("it.staff." + code), locId: ("staff_it_" + d.id) },
        { role: "mtostaff", name: "MTO Staff", username: ("mto.staff." + code), locId: ("staff_mto_" + d.id) }
      ]) {
        if (!locs.some(l => l.id === def.locId)) { locs.push({ id: def.locId, name: def.name, type: "staff", districtId: d.id }); added = true; }
        if (users.some(u => u.districtId === d.id && u.role === def.role)) continue;
        users.push({ id: uid(), username: def.username, name: def.name, role: def.role, districtId: d.id, locationId: def.locId, mobile: "", password: "Staff@123", active: true, createdAt: Date.now() });
        added = true;
      }
      for (const u of users) {
        if ((u.role === "itstaff" || u.role === "mtostaff") && u.districtId === d.id && !u.locationId) { u.locationId = u.role === "itstaff" ? ("staff_it_" + d.id) : ("staff_mto_" + d.id); added = true; }
      }
      allLocs[d.id] = locs;
    }
    if (added) {
      saveData("locations", allLocs);
      saveData("users", users);
      toast("District staff accounts ready: Computer/IT Staff + MTO Staff (password Staff@123).", "success");
    }
  } catch (e) { console.error("ensure staff failed:", e); }
}

function showApp() {
  $("#loginScreen").classList.add("hidden");
  $("#appRoot").classList.remove("hidden");
  const ver = $("#appVersion");
  if (ver) ver.textContent = "v" + APP_VERSION;
  try { applyRoleUI(); } catch (e) { console.error("applyRoleUI failed:", e); }
  try { __ensureDistrictStaffUsers(); } catch (e) { console.error("staff ensure failed:", e); }
  try { rebuildDropdowns(); } catch (e) { console.error("dropdowns failed:", e); }
  try { switchTab(currentUser && (currentUser.role === "itstaff" || currentUser.role === "mtostaff") ? "maintenance" : "dashboard"); } catch (e) { console.error("initial render failed:", e); }
  try { __rtStart(); } catch (e) { console.error("realtime failed:", e); }
  try { history.replaceState(null, "" , location.pathname + location.search); } catch (e) { try { location.hash = ""; } catch (e2) { } }
  try { __devApplyRoute(); } catch (e) { }
}

/* ---- Admin tools + import bindings ---- */
  $("#itemImportBtn")?.addEventListener("click", openItemImport);
  $("#itemTemplateBtn")?.addEventListener("click", downloadItemTemplate);
  $("#itemImportFile")?.addEventListener("change", function () { if (this.files && this.files[0]) handleItemImportFile(this.files[0]); });
  $("#itemImportCommit")?.addEventListener("click", commitItemImport);
  $$("#itemImportCancel").forEach(b => b.addEventListener("click", () => { window.__pendingImport = null; window.__pendingImportInfo = null; }));
  $("#backupDBBtn")?.addEventListener("click", backupAllData);
  $("#backupExcelBtn")?.addEventListener("click", backupExcel);
  $("#restoreDBBtn")?.addEventListener("click", () => { const f = $("#restoreFileInput"); if (f) f.click(); });
  $("#restoreFileInput")?.addEventListener("change", function () { if (this.files && this.files[0]) { restoreAllData(this.files[0]); this.value = ""; } });
  $("#auditLogBtn")?.addEventListener("click", openAuditLog);
  $("#allotImportBtn")?.addEventListener("click", openAllotImport);
  $("#allotTemplateBtn")?.addEventListener("click", downloadAllotTemplate);
  $("#allotImportFile")?.addEventListener("change", function () { if (this.files && this.files[0]) handleAllotImportFile(this.files[0]); });
  $("#allotImportCommit")?.addEventListener("click", commitAllotImport);
  $$("#allotImportCancel").forEach(b => b.addEventListener("click", () => { window.__pendingAllotImport = null; }));

/* ==================== SORTABLE TABLES ==================== */
/* Click any column header to sort. Works on static and re-rendered tables (delegated). */
function __domSortTable(table, th) {
  if (!table || table.getAttribute("data-sortable") === "false") return;
  // Tables driven by the data-level sorter (th[data-sort-col]) are handled by
  // __sortToggle - never re-order just the rows that happen to be rendered.
  if (th && th.hasAttribute("data-sort-col")) return;
  if (table.querySelector("th[data-sort-col]")) return;
  const idx = Array.from(th.parentNode.children).indexOf(th);
  if (idx < 0) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  const SKIP = /(?:^|\s)(?:rpt-total-row|stat-total-row|summary-row|summary-grand|empty-row)(?:\s|$)/;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const normal = [], tail = [];
  rows.forEach(r => { if (SKIP.test(r.className || "")) tail.push(r); else normal.push(r); });
  if (normal.length < 2) return;
  const key = table.id || table.getAttribute("data-table") || table.parentElement.id || "t";
  const st = (window.__domSortState = window.__domSortState || {});
  const cur = st[key] || {};
  const ndir = cur.idx === idx ? -(cur.dir || 1) : 1;
  st[key] = { idx, dir: ndir };
  const extract = r => {
    const cell = r.children[idx];
    if (!cell) return { t: "", n: null };
    const t = (cell.textContent || "").trim().replace(/,/g, "").replace(/\s+/g, " ");
    const n = parseFloat(t);
    return { t: t.toLowerCase(), n: (t !== "" && isFinite(n)) ? n : null };
  };
  const allNum = normal.every(r => extract(r).n !== null);
  normal.sort((a, b) => {
    const x = extract(a), y = extract(b);
    if (allNum) {
      if (x.n === null && y.n === null) return 0;
      if (x.n === null) return 1;
      if (y.n === null) return -1;
      return (x.n - y.n) * ndir;
    }
    if (x.t === "" && y.t === "") return 0;
    if (x.t === "") return 1;
    if (y.t === "") return -1;
    return x.t.localeCompare(y.t) * ndir;
  });
  const frag = document.createDocumentFragment();
  normal.forEach(r => frag.appendChild(r));
  tail.forEach(r => frag.appendChild(r));
  tbody.appendChild(frag);
  table.querySelectorAll(".sort-arrow").forEach(el => el.remove());
  const s = document.createElement("span");
  s.className = "sort-arrow";
  s.textContent = ndir === 1 ? " \u25B2" : " \u25BC";
  th.appendChild(s);
}
document.addEventListener("click", e => {
  const th = e.target.closest("th");
  if (!th) return;
  const table = th.closest("table");
  if (!table) return;
  __domSortTable(table, th);
});

/* ==================== AUDIT LOG ==================== */
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function __audit(action, detail, opts) {
  try {
    const did = (opts && opts.districtId) || activeDistrictId;
    if (!did) return;
    const list = loadData("audit_" + did) || [];
    list.unshift({
      id: uid(),
      ts: Date.now(),
      userId: currentUser ? currentUser.id : null,
      user: currentUser ? currentUser.name : "System",
      role: currentUser ? currentUser.role : "system",
      districtId: did,
      locationId: currentUser ? (currentUser.locationId || "") : "",
      action,
      entity: (opts && opts.entity) || "",
      detail: detail || "",
    });
    if (list.length > 5000) list.length = 5000;
    saveData("audit_" + did, list);
  } catch (err) { console.error("audit failed:", err); }
}

function getAuditLog(districtId) { return loadData("audit_" + districtId) || []; }

function openAuditLog() {
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  const rows = getAuditLog(activeDistrictId);
  __statDetail = {
    title: "Audit Trail",
    subtitle: (dist ? dist.name + " \u00b7 " : "") + "Generated " + new Date().toLocaleString() + (rows.length ? " \u00b7 " + rows.length + " recorded actions" : ""),
    cols: ["Date & Time", "User", "Role", "Action", "Entity", "Details"],
    rows: rows.map(r => [fmtDateTime(r.ts), r.user || "\u2014", (ROLE_LABELS[r.role] || r.role || "\u2014"), r.action, r.entity || "\u2014", r.detail || "\u2014"]),
    fileName: "audit-log"
  };
  __statFilter = "";
  __pgReset("statDetail");
  $("#statDetailTitle").textContent = __statDetail.title;
  $("#statDetailSubtitle").textContent = __statDetail.subtitle;
  $("#statDetailHead").innerHTML = "<tr>" + __statDetail.cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const s = $("#statSearch");
  if (s) s.value = "";
  renderStatDetail("");
  openModal("#statDetailModal");
}

/* ==================== FULL DB BACKUP / RESTORE ==================== */
function __allStoreKeys() {
  const keys = new Set();
  if (window.CONFIG && window.CONFIG.useRemote && window.__apiCache) {
    Object.keys(window.__apiCache).forEach(k => { if (k.indexOf(STORAGE_PREFIX) === 0) keys.add(k); });
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(STORAGE_PREFIX) === 0) keys.add(k);
    }
  } catch (e) {}
  ["categories", "districts", "users", "locations", "items", "persons", "allotments", "scans", "accessRequests", "seedVersion", "activeDistrict"].forEach(k => keys.add(STORAGE_PREFIX + k));
  getDistricts().forEach(d => {
    ["demands_", "notifications_", "inspections_", "audit_"].forEach(px => keys.add(STORAGE_PREFIX + px + d.id));
  });
  return [...keys];
}

function __collectBackup() {
  const data = {};
  __allStoreKeys().forEach(k => {
    const v = loadData(k.indexOf(STORAGE_PREFIX) === 0 ? k.slice(STORAGE_PREFIX.length) : k);
    if (v !== null && v !== undefined) data[k] = v;
  });
  return { app: "haryana-police-inventory", version: APP_VERSION, exportedAt: new Date().toISOString(), data };
}

function backupAllData() {
  if (!isDevAdmin()) return toast("Only developer admin can take a backup.", "error");
  const payload = __collectBackup();
  downloadBlob(JSON.stringify(payload), "application/json", "inventory-backup-" + new Date().toISOString().slice(0, 10) + ".json");
  __audit("Backup Created", "Full database backup downloaded", { entity: "System" });
  toast("Backup downloaded.", "success");
}

function backupExcel() {
  if (!isDevAdmin()) return toast("Only developer admin can take a backup.", "error");
  if (typeof XLSX === "undefined") return toast("Excel library not loaded. Please reload the page.", "error");
  const payload = __collectBackup();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Backup: haryana-police-inventory"],
    ["Version", payload.version],
    ["Exported", payload.exportedAt],
    ["Hint", "Each store key is one sheet. Array data becomes a table; object data becomes key/value rows."]
  ]), "Info");
  const used = new Set(["INFO"]);
  Object.keys(payload.data).forEach(k => {
    const v = payload.data[k];
    let sheetName = k.indexOf(STORAGE_PREFIX) === 0 ? k.slice(STORAGE_PREFIX.length) : k;
    sheetName = sheetName.replace(/[^A-Za-z0-9]/g, "").slice(0, 28);
    if (!sheetName) sheetName = "DATA";
    let n = sheetName.toUpperCase(), i = 1;
    while (used.has(n)) { n = (sheetName + i).toUpperCase(); i++; }
    used.add(n);
    let rows;
    if (Array.isArray(v)) {
      const cols = [];
      v.forEach(o => { if (o && typeof o === "object" && !Array.isArray(o)) Object.keys(o).forEach(cx => { if (cols.indexOf(cx) === -1) cols.push(cx); }); });
      rows = cols.length ? [cols, ...v.map(o => cols.map(cx => (o && typeof o === "object" && !Array.isArray(o)) ? (o[cx] === undefined || o[cx] === null ? "" : (typeof o[cx] === "object" ? JSON.stringify(o[cx]) : o[cx])) : o))] : [[k, JSON.stringify(v)]];
    } else if (v && typeof v === "object") {
      rows = [["key", "value"], ...Object.keys(v).map(cx => [cx, typeof v[cx] === "object" && v[cx] !== null ? JSON.stringify(v[cx]) : v[cx]])];
    } else {
      rows = [[k, String(v)]];
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n);
  });
  XLSX.writeFile(wb, "inventory-backup-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  __audit("Backup Created", "Full database backup downloaded as Excel", { entity: "System" });
  toast("Excel backup downloaded.", "success");
}

function restoreAllData(file) {
  if (!isDevAdmin()) return toast("Only developer admin can restore data.", "error");
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const payload = JSON.parse(fr.result);
      if (!payload || !payload.data || typeof payload.data !== "object") return toast("Invalid backup file.", "error");
      const keys = Object.keys(payload.data);
      if (!keys.length) return toast("Backup file is empty.", "error");
      if (!confirm(`Restore will OVERWRITE current data for ${keys.length} store keys. Continue?`)) return;
      keys.forEach(k => {
        if (payload.data[k] === null || payload.data[k] === undefined) return;
        const name = k.indexOf(STORAGE_PREFIX) === 0 ? k.slice(STORAGE_PREFIX.length) : k;
        saveData(name, payload.data[k]);
      });
      __audit("Data Restored", "Full database restored from backup (" + keys.length + " keys)", { entity: "System" });
      toast("Data restored. Reloading...", "success");
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      console.error(err);
      toast("Restore failed: " + (err && err.message ? err.message : String(err)), "error");
    }
  };
  fr.onerror = () => toast("Could not read file.", "error");
  fr.readAsText(file);
}

/* ==================== DASHBOARD CHARTS ==================== */
function renderCharts() {
  let items = getItems();
  if (isDevAdmin()) {
    const all = getAllItems();
    items = Object.keys(all).flatMap(k => all[k] || []);
  }
  const cats = getCategories();
  const catEl = $("#chartCategoryBars");
  if (catEl) {
    const catData = cats.map(c => {
      const list = items.filter(i => i.categoryId === c.id);
      return { name: c.name, qty: list.reduce((a, i) => a + (Number(i.quantity) || 0), 0), count: list.length };
    }).filter(c => c.count > 0 || c.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 8);
    if (!catData.length) {
      catEl.innerHTML = `<p class="chart-empty">No items yet.</p>`;
    } else {
      const maxQty = Math.max(...catData.map(c => c.qty), 1);
      catEl.innerHTML = catData.map(c => {
        const pct = Math.max(2, Math.round((c.qty / maxQty) * 100));
        return `<div class="hbar-row"><div class="hbar-title" title="${esc(c.name)}">${esc(c.name)}</div><div class="hbar-track"><div class="hbar-fill" style="width:${pct}%"></div></div><div class="hbar-val">${c.qty.toLocaleString()}</div></div>`;
      }).join("");
    }
  }
  const dEl = $("#chartConditionStack");
  if (dEl) {
    const good = items.reduce((a, i) => a + ((i.conditionCounts || {}).good || 0), 0);
    const poor = items.reduce((a, i) => a + ((i.conditionCounts || {}).poor || 0), 0);
    const damaged = items.reduce((a, i) => a + ((i.conditionCounts || {}).damaged || 0), 0);
    const total = good + poor + damaged;
    const pct = n => total ? Math.round((n / total) * 100) : 0;
    if (!total) {
      dEl.innerHTML = `<p class="chart-empty">No quantity data yet.</p>`;
    } else {
      dEl.innerHTML = `<div class="cond-stack">` +
        (good ? `<div class="cond-stack-good" style="width:${pct(good)}%" title="Good: ${good} (${pct(good)}%)"></div>` : "") +
        (poor ? `<div class="cond-stack-poor" style="width:${pct(poor)}%" title="Damaged: ${poor} (${pct(poor)}%)"></div>` : "") +
        (damaged ? `<div class="cond-stack-damaged" style="width:${pct(damaged)}%" title="Scrap: ${damaged} (${pct(damaged)}%)"></div>` : "") +
        `</div><div class="cond-legend">` +
        `<span class="cond-legend-item"><span class="legend-dot legend-good"></span>Good <b>${good.toLocaleString()}</b> (${pct(good)}%)</span>` +
        `<span class="cond-legend-item"><span class="legend-dot legend-poor"></span>Damaged <b>${poor.toLocaleString()}</b> (${pct(poor)}%)</span>` +
        `<span class="cond-legend-item"><span class="legend-dot legend-damaged"></span>Scrap <b>${damaged.toLocaleString()}</b> (${pct(damaged)}%)</span>` +
        `</div>`;
    }
  }
}

/* ==================== DEMAND AVAILABILITY CHECK ==================== */
function __demandTargetAvail(itemName, condition, distId, locId) {
  if (!itemName || !distId) return 0;
  let items = getItemsForDistrict(distId).filter(i => i.name.toLowerCase() === String(itemName).toLowerCase());
  if (locId) items = items.filter(i => i.locationId === locId);
  let avail = 0;
  items.forEach(i => {
    const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 };
    if (condition === "good" || condition === "poor" || condition === "damaged") avail += cc[condition] || 0;
    else avail += Number(i.quantity) || 0;
  });
  return avail;
}

function __fdAvailable() {
  const el = $("#fdAvailability");
  if (!el) return;
  const itemName = ($("#fdItemsBody") && $("#fdItemsBody").querySelector(".fd-row-name") ? $("#fdItemsBody").querySelector(".fd-row-name").value.trim() : "");
  const toDist = $("#fdDemandTo") ? $("#fdDemandTo").value : "";
  const toLoc = $("#fdDemandToLocation") ? $("#fdDemandToLocation").value : "";
  const condition = ($("#fdItemsBody") && $("#fdItemsBody").querySelector(".fd-row-cond") ? $("#fdItemsBody").querySelector(".fd-row-cond").value : "any");
  if (!itemName || !toDist) { el.innerHTML = ""; el.className = "fd-avail"; return; }
  const avail = __demandTargetAvail(itemName, condition, toDist, toLoc);
  const qty = parseInt(($("#fdItemsBody") && $("#fdItemsBody").querySelector(".fd-row-qty") ? $("#fdItemsBody").querySelector(".fd-row-qty").value : "0"), 10) || 0;
  const dist = getDistricts().find(d => d.id === toDist);
  const loc = getLocationsForDistrict(toDist).find(l => l.id === toLoc);
  const place = (loc && loc.name) || (dist && dist.name) || "destination";
  if (avail === 0) {
    el.className = "fd-avail fd-avail-warn";
    el.innerHTML = `&#9888; No stock of this item currently at <b>${esc(place)}</b>. Consider requesting from another unit.`;
  } else if (qty > avail) {
    el.className = "fd-avail fd-avail-warn";
    el.innerHTML = `&#9888; Available at <b>${esc(place)}</b>: <b>${avail}</b> unit(s) ? requested <b>${qty}</b> exceeds available stock.`;
  } else {
    el.className = "fd-avail fd-avail-ok";
    el.innerHTML = `&#9989; Available at <b>${esc(place)}</b>: <b>${avail}</b> unit(s).`;
  }
}

/* ==================== BULK EXCEL ITEM IMPORT ==================== */
function downloadItemTemplate() {
  if (!canManageItems()) return toast("You do not have permission to use bulk import.", "error");
  if (typeof XLSX === "undefined") return toast("Excel library not loaded. Please reload the page.", "error");
  const data = [
    ["Item Name", "Category", "Unit", "Min Stock", "Location", "Good", "Damaged", "Scrap"],
    ["Wireless Set", "Communication Equipment", "Pcs", 0, "District HQ - Gurugram", 10, 2, 1],
    ["Traffic Signal Light", "Office & Admin Supplies", "Pcs", 2, "PS DLF Phase 3", 5, 1, 0],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 24 }, { wch: 26 }, { wch: 8 }, { wch: 10 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Items");
  XLSX.writeFile(wb, "inventory-items-template.xlsx");
  toast("Template downloaded.", "success");
}

function openItemImport() {
  if (!canManageItems()) return toast("You do not have permission to import items.", "error");
  const f = $("#itemImportFile");
  if (f) f.value = "";
  const res = $("#itemImportResult");
  if (res) { res.innerHTML = ""; res.classList.add("hidden"); }
  const st = $("#itemImportStatus");
  if (st) st.innerHTML = "";
  window.__pendingImport = null;
  window.__pendingImportInfo = null;
  openModal("#itemImportModal");
}

function handleItemImportFile(file) {
  if (typeof XLSX === "undefined") return toast("Excel library not loaded. Please reload the page.", "error");
  if (!file) return;
  const st = $("#itemImportStatus");
  if (st) st.innerHTML = `<span style="color:var(--muted)">Reading <b>${esc(file.name)}</b>?</span>`;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const wb = XLSX.read(fr.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) throw new Error("No data rows found in the sheet.");
      const pick = (r, keys) => {
        for (const k of Object.keys(r)) {
          const kl = k.toLowerCase().trim();
          if (keys.some(x => kl.includes(x) || x.includes(kl))) {
            const v = r[k];
            return v === undefined || v === null ? "" : String(v).trim();
          }
        }
        return "";
      };
      const cats = getCategories();
      const catByName = {};
      cats.forEach(c => { catByName[c.name.toLowerCase()] = c.id; });
      const defaultLocId = getVisibleLocationId() || (getLocations()[0] ? getLocations()[0].id : "");
      let added = 0, updated = 0, skipped = 0;
      const errors = [];
      const out = getItems().map(i => ({ ...i }));
      rows.forEach((r, idx) => {
        const name = pick(r, ["item name", "name", "item"]);
        if (!name) { skipped++; errors.push(`Row ${idx + 2}: missing item name.`); return; }
        const catInput = pick(r, ["category", "cat"]);
        const categoryId = (catInput && catByName[catInput.toLowerCase()]) || "other";
        const unit = pick(r, ["unit", "uom"]) || "Pcs";
        const minStock = parseInt(pick(r, ["min stock", "minstock", "minimum", "min"]), 10) || 0;
        const locName = pick(r, ["location", "loc"]);
        let locationId = defaultLocId;
        if (locName) {
          const loc = getLocations().find(l => l.name.toLowerCase() === locName.toLowerCase());
          if (loc) locationId = loc.id;
        }
        let good = parseInt(pick(r, ["good qty", "good", "condition good"]), 10) || 0;
        let poor = parseInt(pick(r, ["poor qty", "poor", "condition poor", "damaged qty", "damaged"]), 10) || 0;
        let damaged = parseInt(pick(r, ["scrap qty", "scrap", "condition damaged"]), 10) || 0;
        const total = parseInt(pick(r, ["total qty", "total", "quantity", "qty"]), 10) || 0;
        if (!(good || poor || damaged) && total) good = total;
        if (!(good || poor || damaged)) { skipped++; errors.push(`Row ${idx + 2} (<b>${esc(name)}</b>): no quantity ? skipped.`); return; }
        const existing = out.find(i => i.name.toLowerCase() === name.toLowerCase() && i.locationId === locationId);
        if (existing) {
          const cc = existing.conditionCounts || { good: 0, poor: 0, damaged: 0 };
          cc.good = (cc.good || 0) + good;
          cc.poor = (cc.poor || 0) + poor;
          cc.damaged = (cc.damaged || 0) + damaged;
          existing.conditionCounts = cc;
          existing.quantity = cc.good + cc.poor + cc.damaged;
          if (minStock) existing.minStock = minStock;
          if (unit) existing.unit = unit;
          existing.updatedAt = Date.now();
          updated++;
        } else {
          out.push({ id: uid(), name, categoryId, unit, quantity: good + poor + damaged, minStock, locationId, conditionCounts: { good, poor, damaged }, createdAt: Date.now(), updatedAt: Date.now() });
          added++;
        }
      });
      if (st) st.innerHTML = "";
      const res = $("#itemImportResult");
      if (res) {
        res.innerHTML =
          `<div class="import-summary"><span class="imp-ok">&#10004; ${added} added</span><span class="imp-ok">&#10004; ${updated} updated</span>${skipped ? `<span class="imp-warn">&#9888; ${skipped} skipped</span>` : ""}</div>` +
          (errors.length ? `<ul class="imp-errors">` + errors.slice(0, 15).map(e => `<li>${e}</li>`).join("") + (errors.length > 15 ? `<li>&#8230; and ${errors.length - 15} more</li>` : "") + `</ul>` : `<p class="imp-note">All rows were valid.</p>`) +
          `<p class="imp-note">Click <b>Save Import</b> to write ${added + updated} rows into your inventory, or Cancel to discard.</p>`;
        res.classList.remove("hidden");
      }
      window.__pendingImport = (added + updated) ? out : null;
      window.__pendingImportInfo = { added, updated };
      if (!added && !updated) { toast("Nothing was imported.", "error"); return; }
      toast("File parsed — review and save.", "success");
    } catch (err) {
      console.error(err);
      toast("Import failed: " + (err && err.message ? err.message : String(err)), "error");
      if (st) st.innerHTML = `<span style="color:var(--red)">Import failed: ${esc(err && err.message ? err.message : String(err))}</span>`;
    }
  };
  fr.onerror = () => toast("Could not read file.", "error");
  fr.readAsArrayBuffer(file);
}

function commitItemImport() {
  // RBAC: Developer Admin is read-only for inventory; imported records must
  // all belong to the caller's own unit (server enforces the same rules).
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canManageItems()) return toast("You do not have permission to import items.", "error");
  if (!window.__pendingImport) return toast("Nothing to save ? import a file first.", "error");
  if (Array.isArray(window.__pendingImport) && window.__pendingImport.some(i => !itemOwnedByCurrentUser(i))) {
    return toast(__rbacLockMsg(), "error");
  }
  const info = window.__pendingImportInfo || { added: 0, updated: 0 };
  saveItems(window.__pendingImport);
  window.__pendingImport = null;
  window.__pendingImportInfo = null;
  closeModals();
  __audit("Items Bulk Imported", `${info.added} added, ${info.updated} updated`, { entity: "Inventory" });
  toast("Items imported successfully.", "success");
  render();
}

/* ==================== BULK EXCEL ALLOTMENT IMPORT ==================== */
function downloadAllotTemplate() {
  if (!canEdit()) return toast("You do not have permission to import issued items.", "error");
  if (typeof XLSX === "undefined") return toast("Excel library not loaded. Please reload the page.", "error");
  const data = [
    ["Person Name", "Rank", "BELT Number", "Posting", "Item Name", "Quantity", "Remarks"],
    ["SI Rajesh Kumar", "SI", "GN-112233", "PS DLF Phase 3", "9mm Pistol", 2, ""],
    ["SI Rajesh Kumar", "SI", "GN-112233", "PS DLF Phase 3", "Boots (Pair)", 1, "New join"],
    ["HC Vikas", "HC", "GN-445566", "PS Sohna Road", "Wireless Walkie Talkie", 3, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Issued Items");
  XLSX.writeFile(wb, "issued-items-import-template.xlsx");
  toast("Template downloaded.", "success");
}

function openAllotImport() {
  if (!canEdit()) return toast("You do not have permission to import issued items.", "error");
  const f = $("#allotImportFile");
  if (f) f.value = "";
  const res = $("#allotImportResult");
  if (res) { res.innerHTML = ""; res.classList.add("hidden"); }
  const st = $("#allotImportStatus");
  if (st) st.innerHTML = "";
  window.__pendingAllotImport = null;
  openModal("#allotImportModal");
}

function handleAllotImportFile(file) {
  if (!canEdit()) return toast("You do not have permission to import issued items.", "error");
  if (typeof XLSX === "undefined") return toast("Excel library not loaded. Please reload the page.", "error");
  if (!file) return;
  const st = $("#allotImportStatus");
  if (st) st.innerHTML = `<span style="color:var(--muted)">Reading <b>${esc(file.name)}</b>?</span>`;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const wb = XLSX.read(fr.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) throw new Error("No data rows found in the sheet.");
      const pick = (r, keys) => {
        for (const k of Object.keys(r)) {
          const kl = k.toLowerCase().trim();
          if (keys.some(x => kl.includes(x) || x.includes(kl))) {
            const v = r[k];
            return v === undefined || v === null ? "" : String(v).trim();
          }
        }
        return "";
      };
      const items = getItems();
      const itemByName = {};
      items.forEach(i => { itemByName[i.name.toLowerCase()] = i; });
      const groups = new Map();
      const order = [];
      const reserved = {};
      let skipped = 0;
      const errors = [];
      rows.forEach((r, idx) => {
        const name = pick(r, ["person name", "name", "person"]);
        const rank = pick(r, ["rank", "designation"]);
        const belt = pick(r, ["belt number", "belt no", "belt"]).toUpperCase();
        const posting = pick(r, ["posting", "unit"]);
        const itemName = pick(r, ["item name", "item"]);
        const qty = parseInt(pick(r, ["quantity", "qty", "qty allotted"]), 10) || 0;
        const remarks = pick(r, ["remarks", "note"]) || "";
        if (!name || !belt) { skipped++; errors.push(`Row ${idx + 2}: missing person name/BELT number ? skipped.`); return; }
        if (!itemName) { skipped++; errors.push(`Row ${idx + 2}: missing item name ? skipped.`); return; }
        const item = itemByName[itemName.toLowerCase()];
        if (!item) { skipped++; errors.push(`Row ${idx + 2}: item <b>${esc(itemName)}</b> not found in this district ? skipped.`); return; }
        if (!qty || qty < 1) { skipped++; errors.push(`Row ${idx + 2} (<b>${esc(itemName)}</b>): invalid quantity ? skipped.`); return; }
        const used = reserved[item.id] || 0;
        const avail = availableQty(item) - used;
        if (qty > avail) { skipped++; errors.push(`Row ${idx + 2} (<b>${esc(itemName)}</b>): only ${Math.max(0, avail)} units available (incl. earlier rows) ? skipped.`); return; }
        reserved[item.id] = used + qty;
        if (!groups.has(belt)) {
          const g = { name, rank: rank || "?", belt, posting: posting || "?", rows: [] };
          groups.set(belt, g);
          order.push(g);
        }
        groups.get(belt).rows.push({ itemId: item.id, itemName: item.name, qty, remarks });
      });
      if (st) st.innerHTML = "";
      const totalRows = groups.size ? [...groups.values()].reduce((a, g) => a + g.rows.length, 0) : 0;
      const res = $("#allotImportResult");
      if (res) {
        res.innerHTML =
          `<div class="import-summary"><span class="imp-ok">&#10004; ${groups.size} person(s)</span><span class="imp-ok">&#10004; ${totalRows} issued item row(s)</span>${skipped ? `<span class="imp-warn">&#9888; ${skipped} skipped</span>` : ""}</div>` +
          (groups.size ? order.slice(0, 8).map(g => `<p class="imp-note" style="margin:2px 0">&#8226; ${esc(g.name)} (${esc(g.belt)}) ? ${g.rows.map(r => `${esc(r.itemName)} x${r.qty}`).join(", ")}</p>`).join("") + (order.length > 8 ? `<p class="imp-note">&#8230; and ${order.length - 8} more</p>` : "") : "") +
          (errors.length ? `<ul class="imp-errors">` + errors.slice(0, 15).map(e => `<li>${e}</li>`).join("") + (errors.length > 15 ? `<li>&#8230; and ${errors.length - 15} more</li>` : "") + `</ul>` : `<p class="imp-note">All rows were valid.</p>`) +
          (groups.size ? `<p class="imp-note">Click <b>Save Import</b> to write these issues (stock will be deducted), or Cancel to discard.</p>` : "");
        res.classList.remove("hidden");
      }
      window.__pendingAllotImport = groups.size ? { groups: order } : null;
      if (!groups.size) { toast("Nothing valid was imported.", "error"); return; }
      toast("File parsed — review and save.", "success");
    } catch (err) {
      console.error(err);
      toast("Import failed: " + (err && err.message ? err.message : String(err)), "error");
      if (st) st.innerHTML = `<span style="color:var(--red)">Import failed: ${esc(err && err.message ? err.message : String(err))}</span>`;
    }
  };
  fr.onerror = () => toast("Could not read file.", "error");
  fr.readAsArrayBuffer(file);
}

function commitAllotImport() {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!canEdit()) return toast("You do not have permission to import issued items.", "error");
  if (!window.__pendingAllotImport) return toast("Nothing to save ? import a file first.", "error");
  const groups = window.__pendingAllotImport.groups;
  window.__pendingAllotImport = null;
  const items = getItems();
  const allotments = getAllotments();
  const persons = getPersons();
  const now = Date.now();
  const date = todayStr();
  const time = nowTimeStr();
  const createdBy = currentUser ? (currentUser.name || currentUser.username) : "";
  let people = 0, rowCount = 0;
  groups.forEach(g => {
    let person = persons.find(p => p.beltNo.toUpperCase() === g.belt);
    if (!person) {
      person = { id: uid(), name: g.name, rank: g.rank, beltNo: g.belt, posting: g.posting, districtId: activeDistrictId, locationId: (getVisibleLocationId() || (currentUser && currentUser.locationId) || null), createdAt: now };
      persons.push(person);
    }
    const issueId = uid();
    g.rows.forEach(r => {
      const item = items.find(i => i.id === r.itemId);
      if (!item) return;
      item.allotted = (item.allotted || 0) + r.qty;
      itemHistoryPush(item, { type: "ALLOTMENT", qty: -r.qty, person: g.name, ref: g.belt, date, time, remarks: "Imported issue" });
      const cat = getCategories().find(c => c.id === item.categoryId);
      allotments.unshift({
        id: uid(), issueId, personId: person.id, name: g.name, rank: g.rank, beltNo: g.belt, posting: g.posting,
        districtId: activeDistrictId, locationId: person.locationId || item.locationId,
        itemId: item.id, itemName: item.name, categoryId: item.categoryId, categoryName: cat ? cat.name : "",
        qtyAllotted: r.qty, qtyReturned: 0, status: "ALLOTTED", date, time, remarks: r.remarks || "",
        createdBy, createdAt: now, returns: []
      });
      rowCount++;
    });
    people++;
  });
  persistAlloc(items, allotments, persons);
  closeModals();
  render();
  __audit("Issued Items Bulk Imported", `${people} person(s), ${rowCount} item row(s)`, { entity: "Allotment" });
  toast(`Issued items imported ? ${people} person(s), ${rowCount} row(s).`, "success");
}

/* ==================== LANGUAGE SWITCH (English / हिंदी) ==================== */
const __I18N = {
  "Dashboard":"\u0921\u0948\u0936\u092c\u094b\u0930\u094d\u0921",
  "Item Consume":"\u0935\u0938\u094d\u0924\u0941 \u0909\u092a\u092d\u094b\u0917",
  "Consume History":"\u0909\u092a\u092d\u094b\u0917 \u0907\u0924\u093f\u0939\u093e\u0938",
  "+ Add Consume Item":"+ \u0909\u092a\u092d\u094b\u0917 \u0935\u0938\u094d\u0924\u0941 \u091c\u094b\u0921\u093c\u0947\u0902",
  "Manage Categories":"\u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0902 \u092a\u094d\u0930\u092c\u0902\u0927\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Manage Category":"\u0936\u094d\u0930\u0947\u0923\u0940 \u092a\u094d\u0930\u092c\u0902\u0927\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Download / Print":"\u0921\u093e\u0909\u0928\u0932\u094b\u0921 / \u092a\u094d\u0930\u093f\u0902\u091f",
  "Item Category":"\u0935\u0938\u094d\u0924\u0941 \u0936\u094d\u0930\u0947\u0923\u0940",
  "Recipient":"\u092a\u094d\u0930\u093e\u092a\u094d\u0924\u0915\u0930\u094d\u0924\u093e",
  "Date of Distribution":"\u0935\u093f\u0924\u0930\u0923 \u0915\u0940 \u0924\u093f\u0925\u093f",
  "Type":"\u092a\u094d\u0930\u0915\u093e\u0930",
  "S.No":"\u0915\u094d\u0930.\u0938\u0902.",
  "Distributed":"\u0935\u093f\u0924\u0930\u093f\u0924",
  "All Categories":"\u0938\u092d\u0940 \u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0902",
  "All Stock":"\u0938\u092d\u0940 \u0938\u094d\u091f\u0949\u0915",
  "Only Distributed":"\u0915\u0947\u0935\u0932 \u0935\u093f\u0924\u0930\u093f\u0924",
  "Only Available":"\u0915\u0947\u0935\u0932 \u0909\u092a\u0932\u092c\u094d\u0927",
  "All Status":"\u0938\u092d\u0940 \u0938\u094d\u0925\u093f\u0924\u093f",
  "All Units":"\u0938\u092d\u0940 \u092f\u0942\u0928\u093f\u091f",
  "All Staff":"\u0938\u092d\u0940 \u0938\u094d\u091f\u093e\u092b",
  "All Items":"\u0938\u092d\u0940 \u0935\u0938\u094d\u0924\u0941\u090f\u0902",
  "Distribution by Location":"\u0938\u094d\u0925\u093e\u0928 \u0905\u0928\u0941\u0938\u093e\u0930 \u0935\u093f\u0924\u0930\u0923",
  "Mark Lost":"\u0916\u094b\u092f\u093e \u091a\u093f\u0939\u094d\u0928\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Total":"\u0915\u0941\u0932",
  "Added Qty":"\u091c\u094b\u0921\u093c\u0940 \u0917\u0908 \u092e\u093e\u0924\u094d\u0930\u093e",
  "Manage Consumable Categories":"\u0909\u092a\u092d\u094b\u0917 \u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0902 \u092a\u094d\u0930\u092c\u0902\u0927\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Photo / Attachment":"\u092b\u094b\u091f\u094b / \u0938\u0902\u0932\u0917\u094d\u0928\u0915",
  "Upload":"\u0905\u092a\u0932\u094b\u0921",
  "Camera":"\u0915\u0948\u092e\u0930\u093e",
  "Send Distribution Request":"\u0935\u093f\u0924\u0930\u0923 \u0905\u0928\u0941\u0930\u094b\u0927 \u092d\u0947\u091c\u0947\u0902",
  "Available Quantity":"\u0909\u092a\u0932\u092c\u094d\u0927 \u092e\u093e\u0924\u094d\u0930\u093e",
  "Distribution Quantity *":"\u0935\u093f\u0924\u0930\u0923 \u092e\u093e\u0924\u094d\u0930\u093e *",
  "Distributed By":"\u0915\u093f\u0938\u0928\u0947 \u0935\u093f\u0924\u0930\u093f\u0924 \u0915\u093f\u092f\u093e",
  "No consume items found.":"\u0915\u094b\u0908 \u0909\u092a\u092d\u094b\u0917 \u0935\u0938\u094d\u0924\u0941 \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u0940\u0964",
  "Search by item or category...":"\u0935\u0938\u094d\u0924\u0941 \u092f\u093e \u0936\u094d\u0930\u0947\u0923\u0940 \u0938\u0947 \u0916\u094b\u091c\u0947\u0902...",
  "Search item, category, recipient, distributor...":"\u0935\u0938\u094d\u0924\u0941, \u0936\u094d\u0930\u0947\u0923\u0940, \u092a\u094d\u0930\u093e\u092a\u094d\u0924\u0915\u0930\u094d\u0924\u093e, \u0935\u093f\u0924\u0930\u0915 \u0938\u0947 \u0916\u094b\u091c\u0947\u0902...",
  "Inventory":"\u0907\u0928\u094d\u0935\u0947\u0902\u091f\u0930\u0940",
  "Distribution":"\u0935\u093f\u0924\u0930\u0923",
  "Item Issued":"\u091c\u093e\u0930\u0940 \u0906\u0907\u091f\u092e",
  "Demands":"\u092e\u093e\u0902\u0917\u0947\u0902",
  "Maintenance":"\u0930\u0916\u0930\u0916\u093e\u0935",
  "Inspections":"\u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0923",
  "Reports":"\u0930\u093f\u092a\u094b\u0930\u094d\u091f",
  "Logout":"\u0932\u0949\u0917 \u0906\u0909\u091f",
  "Users":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e",
  "Districts":"\u091c\u093f\u0932\u0947",
  "Notifications":"\u0938\u0942\u091a\u0928\u093e\u090f\u0902",
  "View all":"\u0938\u092d\u0940 \u0926\u0947\u0916\u0947\u0902",
  "Mark all read":"\u0938\u092d\u0940 \u092a\u0922\u093c\u093e \u0939\u0941\u0906 \u091a\u093f\u0939\u094d\u0928\u093f\u0924 \u0915\u0930\u0947\u0902",
  "District:":"\u091c\u093f\u0932\u093e:",
  "Live":"\u0932\u093e\u0907\u0935",
  "Total Items":"\u0915\u0941\u0932 \u0906\u0907\u091f\u092e",
  "Total Quantity":"\u0915\u0941\u0932 \u092e\u093e\u0924\u094d\u0930\u093e",
  "Total Qty":"\u0915\u0941\u0932 \u092e\u093e\u0924\u094d\u0930\u093e",
  "Low Stock Alerts":"\u0915\u092e \u0938\u094d\u091f\u0949\u0915 \u091a\u0947\u0924\u093e\u0935\u0928\u0940",
  "Categories":"\u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0902",
  "Damaged":"\u0915\u094d\u0937\u0924\u093f\u0917\u094d\u0930\u0938\u094d\u0924",
  "Scrap":"\u0938\u094d\u0915\u094d\u0930\u0948\u092a",
  "Poor":"\u0916\u0930\u093e\u092c",
  "Good":"\u0905\u091a\u094d\u091b\u0940",
  "Lost":"\u0916\u094b\u092f\u093e",
  "Recovered":"\u092c\u0930\u093e\u092e\u0926",
  "Available":"\u0909\u092a\u0932\u092c\u094d\u0927",
  "Issued":"\u091c\u093e\u0930\u0940",
  "Min Stock":"\u0928\u094d\u092f\u0942\u0928\u0924\u092e \u0938\u094d\u091f\u0949\u0915",
  "Overview of inventory status":"\u0907\u0928\u094d\u0935\u0947\u0902\u091f\u0930\u0940 \u0938\u094d\u0925\u093f\u0924\u093f \u0915\u093e \u0905\u0935\u0932\u094b\u0915\u0928",
  "Login":"\u0932\u0949\u0917\u093f\u0928",
  "Username":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u0928\u093e\u092e",
  "Password":"\u092a\u093e\u0938\u0935\u0930\u094d\u0921",
  "Sign In":"\u0938\u093e\u0907\u0928 \u0907\u0928",
  "Remember Me":"\u092e\u0941\u091d\u0947 \u092f\u093e\u0926 \u0930\u0916\u0947\u0902",
  "Forgot Password?":"\u092a\u093e\u0938\u0935\u0930\u094d\u0921 \u092d\u0942\u0932 \u0917\u090f?",
  "Request Access":"\u092a\u0939\u0941\u0902\u091a \u0915\u093e \u0905\u0928\u0941\u0930\u094b\u0927",
  "Add Item":"\u0935\u0938\u094d\u0924\u0941 \u091c\u094b\u0921\u093c\u0947\u0902",
  "Add Stock":"\u0938\u094d\u091f\u0949\u0915 \u091c\u094b\u0921\u093c\u0947\u0902",
  "Raise Demand":"\u092e\u093e\u0902\u0917 \u0915\u0930\u0947\u0902",
  "New Request":"\u0928\u092f\u093e \u0905\u0928\u0941\u0930\u094b\u0927",
  "Issue Items":"\u0935\u0938\u094d\u0924\u0941\u090f\u0902 \u091c\u093e\u0930\u0940 \u0915\u0930\u0947\u0902",
  "Export":"\u0928\u093f\u0930\u094d\u092f\u093e\u0924",
  "Last Updated":"\u0905\u0902\u0924\u093f\u092e \u0905\u092a\u0921\u0947\u091f",
  "Download / Print":"\u0921\u093e\u0909\u0928\u0932\u094b\u0921 / \u092a\u094d\u0930\u093f\u0902\u091f \u0915\u0930\u0947\u0902",
  "Print":"\u092a\u094d\u0930\u093f\u0902\u091f \u0915\u0930\u0947\u0902",
  "Download":"\u0921\u093e\u0909\u0928\u0932\u094b\u0921",
  "Save":"\u0938\u0939\u0947\u091c\u0947\u0902",
  "Update":"\u0905\u092a\u0921\u0947\u091f \u0915\u0930\u0947\u0902",
  "Cancel":"\u0930\u0926\u094d\u0926 \u0915\u0930\u0947\u0902",
  "Close":"\u092c\u0902\u0926 \u0915\u0930\u0947\u0902",
  "Submit":"\u091c\u092e\u093e \u0915\u0930\u0947\u0902",
  "Delete":"\u0939\u091f\u093e\u090f\u0902",
  "Edit":"\u0938\u0902\u092a\u093e\u0926\u093f\u0924 \u0915\u0930\u0947\u0902",
  "View":"\u0926\u0947\u0916\u0947\u0902",
  "Yes":"\u0939\u093e\u0902",
  "No":"\u0928\u0939\u0940\u0902",
  "OK":"\u0920\u0940\u0915 \u0939\u0948",
  "Confirm":"\u092a\u0941\u0937\u094d\u091f\u093f \u0915\u0930\u0947\u0902",
  "Process":"\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e \u0915\u0930\u0947\u0902",
  "Approve":"\u0938\u094d\u0935\u0940\u0915\u0943\u0924 \u0915\u0930\u0947\u0902",
  "Reject":"\u0905\u0938\u094d\u0935\u0940\u0915\u093e\u0930 \u0915\u0930\u0947\u0902",
  "Mark as Completed":"\u092a\u0942\u0930\u094d\u0923 \u091a\u093f\u0939\u094d\u0928\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Add Photo":"\u092b\u094b\u091f\u094b \u091c\u094b\u0921\u093c\u0947\u0902",
  "Return":"\u0935\u093e\u092a\u0938\u0940",
  "Add":"\u091c\u094b\u0921\u093c\u0947\u0902",
  "Search":"\u0916\u094b\u091c\u0947\u0902",
  "Item":"\u0935\u0938\u094d\u0924\u0941",
  "Item Name":"\u0935\u0938\u094d\u0924\u0941 \u0915\u093e \u0928\u093e\u092e",
  "Item Code":"\u0906\u0907\u091f\u092e \u0915\u094b\u0921",
  "Category":"\u0936\u094d\u0930\u0947\u0923\u0940",
  "Location":"\u0938\u094d\u0925\u093e\u0928",
  "Unit":"\u0907\u0915\u093e\u0908",
  "Quantity":"\u092e\u093e\u0924\u094d\u0930\u093e",
  "Qty":"\u092e\u093e\u0924\u094d\u0930\u093e",
  "Status":"\u0938\u094d\u0925\u093f\u0924\u093f",
  "Condition":"\u0938\u094d\u0925\u093f\u0924\u093f",
  "Action":"\u0915\u093e\u0930\u094d\u0930\u0935\u093e\u0908",
  "Actions":"\u0915\u093e\u0930\u094d\u0930\u0935\u093e\u0908",
  "Date":"\u0924\u093f\u0925\u093f",
  "Time":"\u0938\u092e\u092f",
  "Created":"\u092c\u0928\u093e\u092f\u093e \u0917\u092f\u093e",
  "Created At":"\u092c\u0928\u093e\u092f\u093e \u0917\u092f\u093e",
  "Remarks":"\u091f\u093f\u092a\u094d\u092a\u0923\u0940",
  "Remark":"\u091f\u093f\u092a\u094d\u092a\u0923\u0940",
  "Description":"\u0935\u093f\u0935\u0930\u0923",
  "Request ID":"\u0905\u0928\u0941\u0930\u094b\u0927 \u0906\u0908\u0921\u0940",
  "Request To":"\u0905\u0928\u0941\u0930\u094b\u0927 \u092a\u094d\u0930\u0947\u0937\u093f\u0924",
  "Requesting Unit":"\u0905\u0928\u0941\u0930\u094b\u0927\u0915\u0930\u094d\u0924\u093e \u0907\u0915\u093e\u0908",
  "Request Type":"\u0905\u0928\u0941\u0930\u094b\u0927 \u092a\u094d\u0930\u0915\u093e\u0930",
  "Requesting By":"\u0905\u0928\u0941\u0930\u094b\u0927\u0915\u0930\u094d\u0924\u093e",
  "Person":"\u0935\u094d\u092f\u0915\u094d\u0924\u093f",
  "Rank":"\u0930\u0948\u0902\u0915",
  "Belt No":"\u092c\u0947\u0932\u094d\u091f \u0928\u0902\u092c\u0930",
  "Posting":"\u092a\u094b\u0938\u094d\u091f\u093f\u0902\u0917",
  "Mobile":"\u092e\u094b\u092c\u093e\u0907\u0932",
  "Pending":"\u0932\u0902\u092c\u093f\u0924",
  "Approved":"\u0938\u094d\u0935\u0940\u0915\u0943\u0924",
  "Rejected":"\u0905\u0938\u094d\u0935\u0940\u0915\u093e\u0930",
  "Under Process":"\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e \u092e\u0947\u0902",
  "Completed":"\u092a\u0942\u0930\u094d\u0923",
  "ALLOTTED":"\u0906\u0935\u0902\u091f\u093f\u0924",
  "RETURNED":"\u0935\u093e\u092a\u0938",
  "PARTIAL":"\u0906\u0902\u0936\u093f\u0915",
  "High":"\u0909\u091a\u094d\u091a",
  "Medium":"\u092e\u0927\u094d\u092f\u092e",
  "Low":"\u0928\u093f\u092e\u094d\u0928",
  "Maintenance Type":"\u0930\u0916\u0930\u0916\u093e\u0935 \u092a\u094d\u0930\u0915\u093e\u0930",
  "Plumber":"\u0928\u0932 \u092e\u093f\u0938\u094d\u0924\u094d\u0930\u0940",
  "Electrician":"\u092c\u093f\u091c\u0932\u0940 \u092e\u093f\u0938\u094d\u0924\u094d\u0930\u0940",
  "Carpenter":"\u092c\u0922\u093c\u0908",
  "Mason / Civil Work":"\u0930\u093e\u091c\u092e\u093f\u0938\u094d\u0924\u094d\u0930\u0940 / \u0938\u093f\u0935\u093f\u0932 \u0915\u093e\u0930\u094d\u092f",
  "Computer / IT":"\u0915\u0902\u092a\u094d\u092f\u0942\u091f\u0930 / \u0906\u0908\u091f\u0940",
  "Vehicle":"\u0935\u093e\u0939\u0928",
  "Other":"\u0905\u0928\u094d\u092f",
  "Select type...":"\u092a\u094d\u0930\u0915\u093e\u0930 \u091a\u0941\u0928\u0947\u0902...",
  "Specify Maintenance Type":"\u0930\u0916\u0930\u0916\u093e\u0935 \u092a\u094d\u0930\u0915\u093e\u0930 \u092c\u0924\u093e\u090f\u0902",
  "Reason for Demand":"\u092e\u093e\u0902\u0917 \u0915\u093e \u0915\u093e\u0930\u0923",
  "Urgency":"\u0924\u093e\u0924\u094d\u0915\u093e\u0932\u093f\u0915\u0924\u093e",
  "Manage Users":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u092a\u094d\u0930\u092c\u0902\u0927\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Manage Districts":"\u091c\u093f\u0932\u0947 \u092a\u094d\u0930\u092c\u0902\u0927\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Add New District":"\u0928\u092f\u093e \u091c\u093f\u0932\u093e \u091c\u094b\u0921\u093c\u0947\u0902",
  "District Code":"\u091c\u093f\u0932\u093e \u0915\u094b\u0921",
  "Headquarters":"\u092e\u0941\u0916\u094d\u092f\u093e\u0932\u092f",
  "Locations":"\u0938\u094d\u0925\u093e\u0928",
  "Add Location":"\u0938\u094d\u0925\u093e\u0928 \u091c\u094b\u0921\u0947\u0902",
  "Location Type":"\u0938\u094d\u0925\u093e\u0928 \u092a\u094d\u0930\u0915\u093e\u0930",
  "District Admins":"\u091c\u093f\u0932\u093e \u092a\u094d\u0930\u0936\u093e\u0938\u0915",
  "Developer Admins":"\u0935\u093f\u0915\u093e\u0938 \u092a\u094d\u0930\u0936\u093e\u0938\u0915",
  "Back":"\u0935\u093e\u092a\u0938",
  "Add District":"\u091c\u093f\u0932\u093e \u091c\u094b\u0921\u0947\u0902",
  "Add New User":"\u0928\u092f\u093e \u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u091c\u094b\u0921\u093c\u0947\u0902",
  "Edit User":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u0938\u0902\u092a\u093e\u0926\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Name":"\u0928\u093e\u092e",
  "Role":"\u092d\u0942\u092e\u093f\u0915\u093e",
  "General User":"\u0938\u093e\u092e\u093e\u0928\u094d\u092f \u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e",
  "District Admin":"\u091c\u093f\u0932\u093e \u092a\u094d\u0930\u0936\u093e\u0938\u0915",
  "Developer Admin":"\u0921\u0947\u0935\u0932\u092a\u0930 \u092a\u094d\u0930\u0936\u093e\u0938\u0915",
  "Station Manager":"\u0925\u093e\u0928\u093e \u092a\u094d\u0930\u092d\u093e\u0930\u0940",
  "Police Post":"\u092a\u0941\u0932\u093f\u0938 \u091a\u094c\u0915\u0940",
  "MHC":"\u090f\u092e\u090f\u091a\u0938\u0940",
  "TSI":"\u091f\u0940\u090f\u0938\u0906\u0908",
  "Staff":"\u0938\u094d\u091f\u093e\u092b",
  "Computer/IT Staff":"\u0915\u0902\u092a\u094d\u092f\u0942\u091f\u0930/\u0906\u0908\u091f\u0940 \u0938\u094d\u091f\u093e\u092b",
  "MTO Staff":"\u090f\u092e\u091f\u0940\u0913 \u0938\u094d\u091f\u093e\u092b",
  "Items":"\u0906\u0907\u091f\u092e",
  "Photos":"\u092b\u094b\u091f\u094b",
  "Timeline":"\u091f\u093e\u0907\u092e\u0932\u093e\u0907\u0928",
  "Processing History":"\u092a\u094d\u0930\u0915\u094d\u0930\u093f\u092f\u093e \u0907\u0924\u093f\u0939\u093e\u0938",
  "Decision Remarks":"\u0928\u093f\u0930\u094d\u0923\u092f \u091f\u093f\u092a\u094d\u092a\u0923\u0940",
  "Attachments":"\u0938\u0902\u0932\u0917\u094d\u0928\u0915",
  "Sender Remark":"\u092a\u094d\u0930\u0947\u0937\u0915 \u091f\u093f\u092a\u094d\u092a\u0923\u0940",
  "Distributed To":"\u0915\u093f\u0938\u0947 \u0935\u093f\u0924\u0930\u093f\u0924",
  "Inventory Report":"\u0907\u0928\u094d\u0935\u0947\u0902\u091f\u0930\u0940 \u0930\u093f\u092a\u094b\u0930\u094d\u091f",
  "Maintenance Requests Report":"\u0930\u0916\u0930\u0916\u093e\u0935 \u0905\u0928\u0941\u0930\u094b\u0927 \u0930\u093f\u092a\u094b\u0930\u094d\u091f",
  "Columns":"\u0915\u0949\u0932\u092e",
  "User updated.":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u0905\u092a\u0921\u0947\u091f \u0939\u094b \u0917\u092f\u093e\u0964",
  "User added.":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u091c\u094b\u0921\u093c\u093e \u0917\u092f\u093e\u0964",
  "User deleted.":"\u0909\u092a\u092f\u094b\u0917\u0915\u0930\u094d\u0924\u093e \u0939\u091f\u093e \u0926\u093f\u092f\u093e \u0917\u092f\u093e\u0964",
  "Item added.":"\u0906\u0907\u091f\u092e \u091c\u094b\u0921\u093c\u093e \u0917\u092f\u093e\u0964",
  "Item updated.":"\u0906\u0907\u091f\u092e \u0905\u092a\u0921\u0947\u091f \u0939\u094b \u0917\u092f\u093e\u0964",
  "Item deleted.":"\u0906\u0907\u091f\u092e \u0939\u091f\u093e \u0926\u093f\u092f\u093e \u0917\u092f\u093e\u0964",
  "Demand submitted successfully!":"\u092e\u093e\u0902\u0917 \u0938\u092b\u0932\u0924\u093e\u092a\u0942\u0930\u094d\u0935\u0915 \u091c\u092e\u093e \u0939\u094b \u0917\u0908!",
  "Excel exported.":"\u090f\u0915\u094d\u0938\u0947\u0932 \u0928\u093f\u0930\u094d\u092f\u093e\u0924 \u0939\u0941\u0906\u0964",
  "Word document exported.":"\u0935\u0930\u094d\u0921 \u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c \u0928\u093f\u0930\u094d\u092f\u093e\u0924 \u0939\u0941\u0906\u0964",
  "Please login first.":"\u0915\u0943\u092a\u092f\u093e \u092a\u0939\u0932\u0947 \u0932\u0949\u0917\u093f\u0928 \u0915\u0930\u0947\u0902\u0964",
  "Fill all required fields.":"\u0915\u0943\u092a\u092f\u093e \u0938\u092d\u0940 \u0906\u0935\u0936\u094d\u092f\u0915 \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u092d\u0930\u0947\u0902\u0964",
  "Photo could not be loaded.":"\u092b\u094b\u091f\u094b \u0932\u094b\u0921 \u0928\u0939\u0940\u0902 \u0939\u094b \u0938\u0915\u0940\u0964",
  "Attachment could not be loaded.":"\u0938\u0902\u0932\u0917\u094d\u0928\u0915 \u0932\u094b\u0921 \u0928\u0939\u0940\u0902 \u0939\u094b \u0938\u0915\u093e\u0964",
  "Why is this item needed?":"\u092f\u0939 \u0906\u0907\u091f\u092e \u0915\u094d\u092f\u094b\u0902 \u0906\u0935\u0936\u094d\u092f\u0915 \u0939\u0948?",
  "Any notes about this distribution...":"\u0907\u0938 \u0935\u093f\u0924\u0930\u0923 \u0938\u0947 \u091c\u0941\u0921\u093c\u0940 \u091f\u093f\u092a\u094d\u092a\u0923\u0940...",
  "Optional":"\u0935\u0948\u0915\u0932\u094d\u092a\u093f\u0915",
  "Consumable Items":"\u0909\u092a\u092d\u094b\u0917\u094d\u092f \u0935\u0938\u094d\u0924\u0941\u090f\u0902",
  "Pending Approval":"\u0938\u094d\u0935\u0940\u0915\u0943\u0924\u093f \u0932\u0902\u092c\u093f\u0924",
  "Complete":"\u092a\u0942\u0930\u094d\u0923",
  "Distributed Quantity":"\u0935\u093f\u0924\u0930\u093f\u0924 \u092e\u093e\u0924\u094d\u0930\u093e",
  "Lost Quantity":"\u0916\u094b\u0908 \u0917\u0908 \u092e\u093e\u0924\u094d\u0930\u093e",
  "Distribute":"\u0935\u093f\u0924\u0930\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Loss":"\u0939\u093e\u0928\u093f",
  "UNIT":"\u092f\u0942\u0928\u093f\u091f",
  "STAFF":"\u0938\u094d\u091f\u093e\u092b",
  "Photos / Attachments":"\u092b\u094b\u091f\u094b / \u0938\u0902\u0932\u0917\u094d\u0928\u0915",
  "Take Photo":"\u092b\u094b\u091f\u094b \u0932\u0947\u0902",
  "Capture":"\u0915\u0948\u092a\u094d\u091a\u0930",
  "Done":"\u092a\u0942\u0930\u094d\u0923",
  "Flip":"\u092a\u0932\u091f\u0947\u0902",
  "Photo captured.":"\u092b\u094b\u091f\u094b \u0915\u0948\u092a\u094d\u091a\u0930 \u0939\u094b \u0917\u0908\u0964",
  "Photo added.":"\u092b\u094b\u091f\u094b \u091c\u094b\u0921\u093c\u0940 \u0917\u0908\u0964",
  "e.g. Water Pump Repair":"\u091c\u0948\u0938\u0947: \u0935\u093e\u091f\u0930 \u092a\u0902\u092a \u092e\u0930\u092e\u094d\u092e\u0924",
  "Auto-selected by maintenance type":"\u0930\u0916\u0930\u0916\u093e\u0935 \u092a\u094d\u0930\u0915\u093e\u0930 \u0938\u0947 \u0938\u094d\u0935\u0924\u0903 \u091a\u0941\u0928\u093e \u0917\u092f\u093e",
  "Allotments":"\u0906\u0935\u0902\u091f\u0928",
  "+ Issue Items":"+ \u0935\u0938\u094d\u0924\u0941\u090f\u0902 \u091c\u093e\u0930\u0940 \u0915\u0930\u0947\u0902",
  "Return History":"\u0935\u093e\u092a\u0938\u0940 \u0907\u0924\u093f\u0939\u093e\u0938",
  "Type of Items *":"\u0935\u0938\u094d\u0924\u0941\u0913\u0902 \u0915\u093e \u092a\u094d\u0930\u0915\u093e\u0930 *",
  "Stock":"\u0938\u094d\u091f\u0949\u0915",
  "Consume":"\u0909\u092a\u092d\u094b\u0917",
  "Consumable":"\u0909\u092a\u092d\u094b\u0917\u094d\u092f",
  "Items *":"\u0935\u0938\u094d\u0924\u0941\u090f\u0902 *",
  "Demand Items *":"\u092e\u093e\u0902\u0917 \u0935\u0938\u094d\u0924\u0941\u090f\u0902 *",
  "+ Add Item":"+ \u0935\u0938\u094d\u0924\u0941 \u091c\u094b\u0921\u093c\u0947\u0902",
  "Remarks (optional)":"\u091f\u093f\u092a\u094d\u092a\u0923\u0940 (\u0935\u0948\u0915\u0932\u094d\u092a\u093f\u0915)",
  "Submit Demand":"\u092e\u093e\u0902\u0917 \u091c\u092e\u093e \u0915\u0930\u0947\u0902",
  "Clear":"\u0938\u093e\u092b\u093c \u0915\u0930\u0947\u0902",
  "Download PDF":"\u092a\u0940\u0921\u0940\u090f\u092b \u0921\u093e\u0909\u0928\u0932\u094b\u0921 \u0915\u0930\u0947\u0902",
  "Download Excel":"\u090f\u0915\u094d\u0938\u0947\u0932 \u0921\u093e\u0909\u0928\u0932\u094b\u0921 \u0915\u0930\u0947\u0902",
  "Download Word":"\u0935\u0930\u094d\u0921 \u0921\u093e\u0909\u0928\u0932\u094b\u0921 \u0915\u0930\u0947\u0902",
  "Any":"\u0915\u094b\u0908 \u092d\u0940",
  "Only Issued":"\u0915\u0947\u0935\u0932 \u091c\u093e\u0930\u0940",
  "Person Name":"\u0935\u094d\u092f\u0915\u094d\u0924\u093f \u0915\u093e \u0928\u093e\u092e",
  "Search Person":"\u0935\u094d\u092f\u0915\u094d\u0924\u093f \u0916\u094b\u091c\u0947\u0902",
  "+ New Person":"\u0928\u092f\u093e \u0935\u094d\u092f\u0915\u094d\u0924\u093f \u091c\u094b\u0921\u093c\u0947\u0902",
  "BELT Number":"\u092c\u0947\u0932\u094d\u091f \u0928\u0902\u092c\u0930",
  "Post / Rank":"\u092a\u0926 / \u0930\u0948\u0902\u0915",
  "Mobile No.":"\u092e\u094b\u092c\u093e\u0907\u0932 \u0928\u0902.",
  "Normal":"\u0938\u093e\u092e\u093e\u0928\u094d\u092f",
  "Urgent":"\u0924\u0924\u094d\u0915\u093e\u0932",
  "Demand To (District)":"\u092e\u093e\u0902\u0917 \u0915\u093f\u0938\u0947 (\u091c\u093f\u0932\u093e)",
  "To Location / Unit":"\u0938\u094d\u0925\u093e\u0928 / \u092f\u0942\u0928\u093f\u091f \u0915\u094b",
  "Date Added":"\u091c\u094b\u0921\u093c\u0940 \u0917\u0908 \u0924\u093f\u0925\u093f",
  "Returns":"\u0935\u093e\u092a\u0938\u0940",
  "Issued Items":"\u091c\u093e\u0930\u0940 \u0935\u0938\u094d\u0924\u0941\u090f\u0902",
  "No items found.":"\u0915\u094b\u0908 \u0935\u0938\u094d\u0924\u0941 \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u0940\u0964",
  "No records found.":"\u0915\u094b\u0908 \u0930\u093f\u0915\u0949\u0930\u094d\u0921 \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e\u0964",
  "Import from Excel":"\u090f\u0915\u094d\u0938\u0947\u0932 \u0938\u0947 \u0906\u092f\u093e\u0924 \u0915\u0930\u0947\u0902",
  "Documents":"\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c",
  "Adjust Stock":"\u0938\u094d\u091f\u0949\u0915 \u0938\u092e\u093e\u092f\u094b\u091c\u093f\u0924 \u0915\u0930\u0947\u0902",
  "New Inspection":"\u0928\u0908 \u091c\u093e\u0902\u091a",
  "Distribute Items":"\u0935\u0938\u094d\u0924\u0941\u090f\u0902 \u0935\u093f\u0924\u0930\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Manage":"\u092a\u094d\u0930\u092c\u0902\u0927\u0928",
  "Backup":"\u092c\u0948\u0915\u0905\u092a",
  "Restore Data":"\u0921\u0947\u091f\u093e \u092a\u0941\u0928\u0930\u094d\u0938\u094d\u0925\u093e\u092a\u093f\u0924 \u0915\u0930\u0947\u0902",
  "Download Template":"\u091f\u0947\u092e\u094d\u092a\u0932\u0947\u091f \u0921\u093e\u0909\u0928\u0932\u094b\u0921 \u0915\u0930\u0947\u0902",
  "Apply Adjustment":"\u0938\u092e\u093e\u092f\u094b\u091c\u0928 \u0932\u093e\u0917\u0942 \u0915\u0930\u0947\u0902",
  "Request Access / Sign Up":"\u092a\u0939\u0941\u0902\u091a \u0905\u0928\u0941\u0930\u094b\u0927 / \u0938\u093e\u0907\u0928 \u0905\u092a",
  "Stock Report":"\u0938\u094d\u091f\u0949\u0915 \u0930\u093f\u092a\u094b\u0930\u094d\u091f",
  "Category Breakdown":"\u0936\u094d\u0930\u0947\u0923\u0940 \u0935\u093f\u0935\u0930\u0923",
  "Location Report":"\u0938\u094d\u0925\u093e\u0928 \u0930\u093f\u092a\u094b\u0930\u094d\u091f",
  "Search by item, category, unit or location...":"\u0935\u0938\u094d\u0924\u0941, \u0936\u094d\u0930\u0947\u0923\u0940, \u092f\u0942\u0928\u093f\u091f \u092f\u093e \u0938\u094d\u0925\u093e\u0928 \u0938\u0947 \u0916\u094b\u091c\u0947\u0902...",
  "Admin":"\u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e\u092a\u0915",
  "Profile":"\u092a\u094d\u0930\u094b\u092b\u093c\u093e\u0907\u0932",
  "Search items...":"\u0935\u0938\u094d\u0924\u0941\u090f\u0902 \u0916\u094b\u091c\u0947\u0902...",
  "All Conditions":"\u0938\u092d\u0940 \u0938\u094d\u0925\u093f\u0924\u093f\u092f\u093e\u0902",
  "Date Added From":"\u0938\u0947 \u091c\u094b\u0921\u093c\u0940 \u0917\u0908 \u0924\u093f\u0925\u093f",
  "Date Added To":"\u0924\u0915 \u091c\u094b\u0921\u093c\u0940 \u0917\u0908 \u0924\u093f\u0925\u093f",
  "All Locations":"\u0938\u092d\u0940 \u0938\u094d\u0925\u093e\u0928",
  "Received":"\u092a\u094d\u0930\u093e\u092a\u094d\u0924",
  "Total Qty (Received)":"\u0915\u0941\u0932 \u092e\u093e\u0924\u094d\u0930\u093e (\u092a\u094d\u0930\u093e\u092a\u094d\u0924)",
  "Total Demands":"\u0915\u0941\u0932 \u092e\u093e\u0902\u0917\u0947\u0902",
  "Pending Demands":"\u0932\u0902\u092c\u093f\u0924 \u092e\u093e\u0902\u0917\u0947\u0902",
  "Approved Demands":"\u0938\u094d\u0935\u0940\u0915\u0943\u0924 \u092e\u093e\u0902\u0917\u0947\u0902",
  "Rejected Demands":"\u0905\u0938\u094d\u0935\u0940\u0915\u0943\u0924 \u092e\u093e\u0902\u0917\u0947\u0902"
};
const __I18N_ITEMS = {
  "Water Pump":"\u0935\u093e\u091f\u0930 \u092a\u0902\u092a",
  "Water Cooler":"\u0935\u093e\u091f\u0930 \u0915\u0942\u0932\u0930",
  "Water Tank":"\u092a\u093e\u0928\u0940 \u0915\u0940 \u091f\u0902\u0915\u0940",
  "Chair":"\u0915\u0941\u0930\u094d\u0938\u0940",
  "Table":"\u092e\u0947\u091c\u093c",
  "Desk":"\u092e\u0947\u091c\u093c",
  "Bench":"\u092c\u0947\u0902\u091a",
  "Almirah":"\u0905\u0932\u092e\u093e\u0930\u0940",
  "Sofa":"\u0938\u094b\u092b\u093e",
  "Bed":"\u092c\u093f\u0938\u094d\u0924\u0930",
  "Mattress":"\u0917\u0926\u094d\u0926\u093e",
  "Pillow":"\u0924\u0915\u093f\u092f\u093e",
  "Sheet":"\u091a\u093e\u0926\u0930",
  "Blanket":"\u0915\u0902\u092c\u0932",
  "Curtain":"\u092a\u0930\u094d\u0926\u093e",
  "Carpet":"\u0915\u093e\u0932\u0940\u0928",
  "Computer":"\u0915\u0902\u092a\u094d\u092f\u0942\u091f\u0930",
  "Laptop":"\u0932\u0948\u092a\u091f\u0949\u092a",
  "Printer":"\u092a\u094d\u0930\u093f\u0902\u091f\u0930",
  "Scanner":"\u0938\u094d\u0915\u0948\u0928\u0930",
  "Photocopier":"\u092b\u094b\u091f\u094b\u0915\u0949\u092a\u093f\u092f\u0930",
  "Monitor":"\u092e\u0949\u0928\u093f\u091f\u0930",
  "Screen":"\u0938\u094d\u0915\u094d\u0930\u0940\u0928",
  "Keyboard":"\u0915\u0940\u092c\u094b\u0930\u094d\u0921",
  "Mouse":"\u092e\u093e\u0909\u0938",
  "UPS":"\u092f\u0942\u092a\u0940\u090f\u0938",
  "Server":"\u0938\u0930\u094d\u0935\u0930",
  "Router":"\u0930\u093e\u0909\u091f\u0930",
  "CCTV Camera":"\u0938\u0940\u0938\u0940\u091f\u0940\u0935\u0940 \u0915\u0948\u092e\u0930\u093e",
  "Camera":"\u0915\u0948\u092e\u0930\u093e",
  "Projector":"\u092a\u094d\u0930\u094b\u091c\u0947\u0915\u094d\u091f\u0930",
  "Microphone":"\u092e\u093e\u0907\u0915\u094d\u0930\u094b\u092b\u094b\u0928",
  "Speaker":"\u0938\u094d\u092a\u0940\u0915\u0930",
  "Sound System":"\u0938\u093e\u0909\u0902\u0921 \u0938\u093f\u0938\u094d\u091f\u092e",
  "Generator":"\u091c\u0928\u0930\u0947\u091f\u0930",
  "Battery":"\u092c\u0948\u091f\u0930\u0940",
  "Inverter":"\u0907\u0928\u094d\u0935\u0930\u094d\u091f\u0930",
  "Cooler":"\u0915\u0942\u0932\u0930",
  "Fan":"\u092a\u0902\u0916\u093e",
  "Tube Light":"\u091f\u094d\u092f\u0942\u092c \u0932\u093e\u0907\u091f",
  "LED Bulb":"\u090f\u0932\u0908\u0921\u0940 \u092c\u0932\u094d\u092c",
  "Electric Wire":"\u092c\u093f\u091c\u0932\u0940 \u0915\u093e \u0924\u093e\u0930",
  "Wire":"\u0924\u093e\u0930",
  "Switch":"\u0938\u094d\u0935\u093f\u091a",
  "Bulb":"\u092c\u0932\u094d\u092c",
  "Fire Extinguisher":"\u0905\u0917\u094d\u0928\u093f\u0936\u093e\u092e\u0915",
  "First Aid Kit":"\u092a\u094d\u0930\u093e\u0925\u092e\u093f\u0915 \u091a\u093f\u0915\u093f\u0924\u094d\u0938\u093e \u0915\u093f\u091f",
  "Medicine":"\u0926\u0935\u093e",
  "Pipe":"\u092a\u093e\u0907\u092a",
  "Tap":"\u0928\u0932",
  "Bucket":"\u092c\u093e\u0932\u094d\u091f\u0940",
  "Mop":"\u092a\u094b\u091b\u093e",
  "Broom":"\u091d\u093e\u0921\u093c\u0942",
  "Dustbin":"\u0915\u0942\u0921\u093c\u093e\u0926\u093e\u0928",
  "Bottle":"\u092c\u094b\u0924\u0932",
  "Hammer":"\u0939\u0925\u094c\u0921\u093c\u093e",
  "Screwdriver":"\u092a\u0947\u091a\u0915\u0938",
  "Ladder":"\u0938\u0940\u0922\u093c\u0940",
  "Rope":"\u0930\u0938\u094d\u0938\u0940",
  "Lock":"\u0924\u093e\u0932\u093e",
  "Key":"\u091a\u093e\u092c\u0940",
  "Helmet":"\u0939\u0947\u0932\u092e\u0947\u091f",
  "Uniform":"\u0935\u0930\u094d\u0926\u0940",
  "Boots":"\u091c\u0942\u0924\u0947",
  "Jacket":"\u091c\u0948\u0915\u0947\u091f",
  "Radio Set":"\u0930\u0947\u0921\u093f\u092f\u094b \u0938\u0947\u091f",
  "Wireless Set":"\u0935\u093e\u092f\u0930\u0932\u0947\u0938 \u0938\u0947\u091f",
  "Binoculars":"\u0926\u0942\u0930\u092c\u0940\u0928",
  "Torch":"\u091f\u0949\u0930\u094d\u091a",
  "Umbrella":"\u091b\u093e\u0924\u093e",
  "Barbed Wire":"\u0915\u093e\u0902\u091f\u0947\u0926\u093e\u0930 \u0924\u093e\u0930",
  "Fence":"\u092c\u093e\u0921\u093c",
  "Gate":"\u0917\u0947\u091f",
  "Door":"\u0926\u0930\u0935\u093e\u091c\u093e",
  "Window":"\u0916\u093f\u0921\u093c\u0915\u0940",
  "Paint":"\u092a\u0947\u0902\u091f",
  "Cement":"\u0938\u0940\u092e\u0947\u0902\u091f",
  "Bricks":"\u0908\u0902\u091f\u0947\u0902",
  "Sand":"\u0930\u0947\u0924",
  "Tiles":"\u091f\u093e\u0907\u0932\u094d\u0938",
  "Stationery":"\u0938\u094d\u091f\u0947\u0936\u0928\u0930\u0940",
  "Paper":"\u0915\u093e\u0917\u091c",
  "File":"\u092b\u093e\u0907\u0932",
  "Register":"\u0930\u091c\u093f\u0938\u094d\u091f\u0930",
  "Pen":"\u092a\u0947\u0928",
  "Pencil":"\u092a\u0947\u0902\u0938\u093f\u0932",
  "Chairs":"\u0915\u0941\u0930\u094d\u0938\u093f\u092f\u093e\u0902",
  "Tables":"\u092e\u0947\u091c\u093c\u0947\u0902",
  "Fans":"\u092a\u0902\u0916\u0947",
  "Coolers":"\u0915\u0942\u0932\u0930",
  "Computer Table":"\u0915\u0902\u092a\u094d\u092f\u0942\u091f\u0930 \u092e\u0947\u091c\u093c",
  "Office Table":"\u0911\u092b\u093f\u0938 \u092e\u0947\u091c\u093c",
  "Add":"जोड़ें",
  "Cancel":"रद्द करें",
  "Confirm":"पुष्टि करें",
  "Approve":"स्वीकृत करें",
  "Reject":"अस्वीकृत करें",
  "Approved":"स्वीकृत",
  "Edit":"संपादित करें",
  "Delete":"हटाएं",
  "Remove":"हटाएं",
  "View":"देखें",
  "Actions":"कार्रवाई",
  "Action":"कार्रवाई",
  "Cancel Edit":"संपादन रद्द करें",
  "Save Changes":"परिवर्तन सहेजें",
  "Adjust Stock":"स्टॉक समायोजित करें",
  "Apply Adjustment":"समायोजन लागू करें",
  "Add Stock":"स्टॉक जोड़ें",
  "+ Add Stock":"+ स्टॉक जोड़ें",
  "Issue Items":"आइटम जारी करें",
  "+ Issue Items":"+ आइटम जारी करें",
  "Distribute Items":"आइटम वितरित करें",
  "+ Distribute Items":"+ आइटम वितरित करें",
  "Add Consume Item":"उपभोग वस्तु जोड़ें",
  "Add Consumable Stock":"उपभोग स्टॉक जोड़ें",
  "Add New Item":"नई वस्तु जोड़ें",
  "Add User":"उपयोगकर्ता जोड़ें",
  "+ Add New User":"+ नया उपयोगकर्ता जोड़ें",
  "+ Add Person":"+ व्यक्ति जोड़ें",
  "+ Add Location":"+ लोकेशन जोड़ें",
  "+ Add New Location":"+ नई लोकेशन जोड़ें",
  "+ Add New District":"+ नया जिला जोड़ें",
  "+ New Inspection":"+ नई निरीक्षण प्रविष्टि",
  "Add New Inspection":"नई निरीक्षण प्रविष्टि जोड़ें",
  "+ New Request":"+ नया अनुरोध",
  "+ Raise Demand":"+ नई मांग दर्ज करें",
  "Raise New Demand":"नई मांग दर्ज करें",
  "Edit Consumable Item":"उपभोग वस्तु संपादित करें",
  "Distribute Consumable Item":"उपभोग वस्तु वितरित करें",
  "Mark Consumable Quantity as Lost":"उपभोग मात्रा खोया चिह्नित करें",
  "Mark as Lost":"खोया चिह्नित करें",
  "Mark Scrap":"स्क्रैप चिह्नित करें",
  "Report Lost":"खोया रिपोर्ट करें",
  "Report Item Lost":"वस्तु खोया रिपोर्ट करें",
  "Return Item":"वस्तु लौटाएं",
  "Save Return":"वापसी सहेजें",
  "Save Item":"वस्तु सहेजें",
  "Save Inspection":"निरीक्षण सहेजें",
  "Save Document":"दस्तावेज़ सहेजें",
  "Save Import":"इम्पोर्ट सहेजें",
  "Upload Document":"दस्तावेज़ अपलोड करें",
  "Scan Document":"दस्तावेज़ स्कैन करें",
  "Scan & Import":"स्कैन और इम्पोर्ट",
  "Verify & Insert Data":"जांचें और डेटा डालें",
  "Import Items from Excel":"एक्सेल से आइटम इम्पोर्ट करें",
  "Import Issued Items from Excel":"एक्सेल से जारी आइटम इम्पोर्ट करें",
  "Download Template":"टेम्पलेट डाउनलोड करें",
  "Take Photo":"फोटो लें",
  "Capture":"कैप्चर करें",
  "Flip":"पलटें",
  "Start Over":"फिर से शुरू करें",
  "Upload Photo":"फोटो अपलोड करें",
  "📷 Camera":"📷 कैमरा",
  "Item":"वस्तु",
  "Item Name":"वस्तु नाम",
  "Item Name *":"वस्तु नाम *",
  "Item Details":"वस्तु विवरण",
  "Item Stock":"वस्तु स्टॉक",
  "Items":"वस्तुएं",
  "Category":"श्रेणी",
  "Categories":"श्रेणियां",
  "Category Items":"श्रेणी वस्तुएं",
  "Location":"लोकेशन",
  "Min Stock":"न्यूनतम स्टॉक",
  "Unit":"यूनिट",
  "Condition":"कंडीशन",
  "Status":"स्थिति",
  "Date":"तिथि",
  "Time":"समय",
  "Qty":"मात्रा",
  "Quantity":"मात्रा",
  "Total Qty":"कुल मात्रा",
  "Total Quantity":"कुल मात्रा",
  "Last Updated":"अंतिम अपडेट",
  "Date Added":"जोड़ने की तिथि",
  "Issued Date":"जारी तिथि",
  "Issued On":"जारी तिथि",
  "Name":"नाम",
  "Rank":"रैंक",
  "Post / Rank":"पद / रैंक",
  "Post / Designation":"पद / पदनाम",
  "Posting":"पोस्टिंग",
  "Mobile":"मोबाइल",
  "Mobile No.":"मोबाइल नं.",
  "Mobile Number":"मोबाइल नंबर",
  "Phone Number":"फोन नंबर",
  "BELT No.":"बेल्ट नं.",
  "BELT Number":"बेल्ट नंबर",
  "Person":"व्यक्ति",
  "Person Details":"व्यक्ति विवरण",
  "PERSON DETAILS":"व्यक्ति विवरण",
  "Full Name":"पूरा नाम",
  "Display Name":"प्रदर्शित नाम",
  "District":"जिला",
  "District:":"जिला:",
  "District Name":"जिला नाम",
  "District HQ":"जिला मुख्यालय",
  "Headquarters":"मुख्यालय",
  "Station":"स्टेशन",
  "Police Station":"पुलिस थाना",
  "Police Post":"पुलिस चौकी",
  "Location / Station":"लोकेशन / स्टेशन",
  "MHC Store":"MHC भंडार",
  "Role":"भूमिका",
  "Username":"उपयोगकर्ता नाम",
  "Password":"पासवर्ड",
  "Admin":"प्रशासक",
  "District Admin":"जिला प्रशासक",
  "Developer Admin":"डेवलपर प्रशासक",
  "General User":"सामान्य उपयोगकर्ता",
  "Station Manager":"स्टेशन प्रबंधक",
  "User":"उपयोगकर्ता",
  "Users":"उपयोगकर्ता",
  "By":"द्वारा",
  "Remaining":"शेष",
  "Found":"मिली",
  "New":"नया",
  "Live":"लाइव",
  "Previous":"पिछला",
  "Back":"वापस",
  "Logout":"लॉगआउट",
  "Notifications":"सूचनाएं",
  "Mark all read":"सभी पढ़े हुए मार्क करें",
  "View All":"सभी देखें",
  "View all":"सभी देखें",
  "Demands":"मांगें",
  "Maintenance":"मेंटेनेंस",
  "Inspections":"निरीक्षण",
  "Reports":"रिपोर्ट",
  "Documents":"दस्तावेज़",
  "Scans":"स्कैन",
  "Consumable Items":"उपभोग वस्तुएं",
  "Consumable":"उपभोग्य",
  "Good":"अच्छी",
  "Damaged":"क्षतिग्रस्त",
  "Scrap":"स्क्रैप",
  "Available":"उपलब्ध",
  "Pending":"लंबित",
  "Pending Approval":"स्वीकृति हेतु लंबित",
  "Lost":"खोया",
  "Recovered":"वसूली हुई",
  "Cancelled":"रद्द",
  "Completed":"पूर्ण",
  "Complete":"पूर्ण",
  "Rejected":"अस्वीकृत",
  "Added":"जोड़ा गया",
  "Stock Added":"स्टॉक जोड़ा गया",
  "In Stock":"स्टॉक में",
  "Low Stock":"कम स्टॉक",
  "Out of Stock":"स्टॉक समाप्त",
  "Partially Available":"आंशिक रूप से उपलब्ध",
  "Fully Issued":"पूर्ण जारी",
  "Stock":"स्टॉक",
  "Consume":"उपभोग",
  "STOCK ADDED":"स्टॉक जोड़ा गया",
  "DISTRIBUTED":"वितरित",
  "DISTRIBUTION PENDING":"वितरण लंबित",
  "DISTRIBUTION REJECTED":"वितरण अस्वीकृत",
  "MARKED LOST":"खोया चिह्नित",
  "TOTAL (RECEIVED+ADDED)":"कुल (प्राप्त+जोड़ी गई)",
  "AVAILABLE (IN STOCK NOW)":"उपलब्ध (अभी स्टॉक में)",
  "LOST":"खोया",
  "PENDING":"लंबित",
  "All Types":"सभी प्रकार",
  "All Ranks":"सभी रैंक",
  "All Notifications":"सभी सूचनाएं",
  "All Conditions":"सभी कंडीशन",
  "All Locations":"सभी लोकेशन",
  "Select type...":"प्रकार चुनें...",
  "Select item":"वस्तु चुनें",
  "Select category first":"पहले श्रेणी चुनें",
  "Select Mode":"मोड चुनें",
  "Select recipients...":"प्राप्तकर्ता चुनें...",
  "Search by Type: All":"प्रकार से खोजें: सभी",
  "Annual":"वार्षिक",
  "Routine":"सामान्य",
  "Special":"विशेष",
  "Normal":"सामान्य",
  "Urgent":"तत्काल",
  "Urgency":"प्राथमिकता",
  "Item Details":"वस्तु विवरण",
  "Demand Details":"मांग विवरण",
  "Distribution Details":"वितरण विवरण",
  "Maintenance Request Details":"मेंटेनेंस अनुरोध विवरण",
  "Transaction Details":"लेनदेन विवरण",
  "Transaction":"लेनदेन",
  "Transaction History":"लेनदेन इतिहास",
  "Transaction History (Stock Changes)":"लेनदेन इतिहास (स्टॉक परिवर्तन)",
  "Stock History":"स्टॉक इतिहास",
  "Return History":"वापसी इतिहास",
  "Consumable Item Details":"उपभोग वस्तु विवरण",
  "Consumable Distribution Request":"उपभोग वितरण अनुरोध",
  "New Maintenance Request":"नया मेंटेनेंस अनुरोध",
  "Complete Maintenance Request":"मेंटेनेंस अनुरोध पूरा करें",
  "Process Maintenance Request":"मेंटेनेंस अनुरोध प्रक्रिया करें",
  "Process Demand":"मांग प्रक्रिया करें",
  "Proceed to Process":"प्रक्रिया हेतु आगे बढ़ें",
  "Review Supply":"आपूर्ति समीक्षा",
  "Approve Distribution":"वितरण स्वीकृत करें",
  "Reject Distribution":"वितरण अस्वीकृत करें",
  "Reject Distribution Request":"वितरण अनुरोध अस्वीकृत करें",
  "Reject Demand Item":"मांग वस्तु अस्वीकृत करें",
  "Reject Item":"वस्तु अस्वीकृत करें",
  "Reject Request":"अनुरोध अस्वीकृत करें",
  "Approve & Complete":"स्वीकृत और पूर्ण करें",
  "Approve & Fulfill":"स्वीकृत और पूरा करें",
  "Submit & Approve":"जमा और स्वीकृत करें",
  "Submit Distribution":"वितरण जमा करें",
  "Submit Demand":"मांग जमा करें",
  "Submit Request":"अनुरोध जमा करें",
  "Submit Partial":"आंशिक जमा करें",
  "Submit Recovery":"वसूली जमा करें",
  "Submit Rejection":"अस्वीकृति जमा करें",
  "Open Item Page":"आइटम पेज खोलें",
  "Open Full Profile":"पूरी प्रोफ़ाइल खोलें",
  "Item Information":"आइटम जानकारी",
  "Complete Transaction History":"पूरा लेनदेन इतिहास",
  "Item Activity Timeline":"आइटम गतिविधि टाइमलाइन",
  "Total Transactions":"कुल लेनदेन",
  "Date & Time":"दिनांक और समय",
  "Transaction Type":"लेनदेन प्रकार",
  "Reference":"संदर्भ",
  "From":"से",
  "To":"तक",
  "Balance":"शेष",
  "Performed By":"किसके द्वारा",
  "Item Code":"आइटम कोड",
  "Uploaded Photos":"अपलोड की गई फोटो",
  "Photo History":"फोटो इतिहास",
  "Set Profile":"प्रोफ़ाइल बनाएं",
  "Profile":"प्रोफ़ाइल",
  "No photos uploaded.":"कोई फोटो अपलोड नहीं की गई।",
  "Export / Download":"निर्यात / डाउनलोड",
  "Export CSV (filtered)":"CSV निर्यात (फ़िल्टर किया)",
  "Export Excel (filtered)":"एक्सेल निर्यात (फ़िल्टर किया)",
  "Export PDF (filtered)":"PDF निर्यात (फ़िल्टर किया)",
  "Print (filtered)":"प्रिंट (फ़िल्टर किया)",
  "Download Complete History (CSV)":"पूरा इतिहास डाउनलोड (CSV)",
  "◀ Prev":"◀ पिछला",
  "Next ▶":"अगला ▶",
  "Stock by Category":"श्रेणी अनुसार स्टॉक",
  "Condition Breakdown":"कंडीशन विवरण",
  "Condition Health":"कंडीशन स्वास्थ्य",
  "Units by condition":"कंडीशन अनुसार यूनिट",
  "Low Stock Alerts":"कम स्टॉक अलर्ट",
  "Minimum Stock Alert":"न्यूनतम स्टॉक अलर्ट",
  "Low Stock Items":"कम स्टॉक वस्तुएं",
  "1 row":"1 पंक्ति",
  "2 rows":"2 पंक्तियाँ",
  "3 rows":"3 पंक्तियाँ",
  "4 rows":"4 पंक्तियाँ",
  "5 rows":"5 पंक्तियाँ",
  "6 rows":"6 पंक्तियाँ",
  "7 rows":"7 पंक्तियाँ",
  "8 rows":"8 पंक्तियाँ",
  "9 rows":"9 पंक्तियाँ",
  "10 rows":"10 पंक्तियाँ",
  "Recent Activity":"हालिया गतिविधि",
  "Overview of inventory status":"इन्वेंटरी स्थिति का अवलोकन",
  "Total Items":"कुल वस्तुएं",
  "Total Demands":"कुल मांगें",
  "Total Distributions":"कुल वितरण",
  "Total Inspections":"कुल निरीक्षण",
  "Demand Items *":"मांग वस्तुएं *",
  "Items *":"वस्तुएं *",
  "Demand To (District)":"मांग किस जिले को",
  "Request To":"अनुरोध किसे",
  "Request Type":"अनुरोध प्रकार",
  "Request ID":"अनुरोध आईडी",
  "Requested Role":"अनुरोधित भूमिका",
  "Requested":"अनुरोधित",
  "Requesting Unit":"अनुरोध कर्ता यूनिट",
  "Reason for Demand":"मांग का कारण",
  "Why is this item needed?":"यह वस्तु क्यों चाहिए?",
  "Rejection Reason *":"अस्वीकृति कारण *",
  "Rejection Remark *":"अस्वीकृति टिप्पणी *",
  "Decision Remarks":"निर्णय टिप्पणी",
  "Approval Remark (optional)":"स्वीकृति टिप्पणी (वैकल्पिक)",
  "Completion Remark (optional)":"पूर्णता टिप्पणी (वैकल्पिक)",
  "Remark (optional)":"टिप्पणी (वैकल्पिक)",
  "Remark *":"टिप्पणी *",
  "Remark / Reason":"टिप्पणी / कारण",
  "Remarks / Notes (optional)":"टिप्पणियां / नोट्स (वैकल्पिक)",
  "Your Remark (optional)":"आपकी टिप्पणी (वैकल्पिक)",
  "Description":"विवरण",
  "Description *":"विवरण *",
  "Detail":"विवरण",
  "Findings":"निष्कर्ष",
  "Recommendations":"सिफारिशें",
  "Quantity to supply *":"आपूर्ति मात्रा *",
  "Qty (Remaining)":"मात्रा (शेष)",
  "Quantity to distribute":"वितरण हेतु मात्रा",
  "Distributed To *":"किसे वितरित *",
  "Distributed From":"कहाँ से वितरित",
  "To Location / Unit":"लोकेशन / यूनिट को",
  "Distributed To":"किसे वितरित",
  "Quantity to Mark as Lost":"खोया चिह्नित करने की मात्रा",
  "Lost Quantity *":"खोई मात्रा *",
  "Lost Reason":"खोने का कारण",
  "Corrected Total Quantity":"संशोधित कुल मात्रा",
  "Adjustment Type":"समायोजन प्रकार",
  "Stock Correction (Set Total)":"स्टॉक सुधार (कुल सेट करें)",
  "Maintenance Type *":"मेंटेनेंस प्रकार *",
  "Specify Maintenance Type *":"मेंटेनेंस प्रकार बताएं *",
  "Plumber":"प्लंबर",
  "Electrician":"इलेक्ट्रिशियन",
  "Carpenter":"बढ़ई",
  "Mason / Civil Work":"राजमिस्त्री / सिविल कार्य",
  "Computer / IT":"कंप्यूटर / IT",
  "Vehicle":"वाहन",
  "Other":"अन्य",
  "Condition On Return":"वापसी पर कंडीशन",
  "Return Date":"वापसी तिथि",
  "Return Time":"वापसी समय",
  "Return Quantity":"लौटाई मात्रा",
  "Qty Returned":"लौटाई गई मात्रा",
  "Returned":"लौटाई गई",
  "Partially Returned":"आंशिक रूप से लौटाई गई",
  "Handed Over":"सौंपी गई",
  "Surrendered":"समर्पित",
  "Written Off":"लेखांकन से हटाई गई",
  "Recovered":"वसूली हुई",
  "Partially Recovered":"आंशिक रूप से वसूली",
  "Mode of Recovery":"वसूली का तरीका",
  "Item Recovery":"वस्तु वसूली",
  "Returned to Store":"भंडार में लौटाई गई",
  "Returned / Settled Items":"लौटाई / निपटाई गई वस्तुएं",
  "Currently Issued Items":"वर्तमान में जारी वस्तुएं",
  "Currently Issued To":"वर्तमान में किसे जारी",
  "Issued Items":"जारी वस्तुएं",
  "Issued":"जारी",
  "Type of Inspection":"निरीक्षण प्रकार",
  "Date of Inspection":"निरीक्षण तिथि",
  "Inspected By":"निरीक्षक",
  "Name of inspector":"निरीक्षक का नाम",
  "Item / Asset Inspected":"निरीक्षित वस्तु / एसेट",
  "In Progress":"प्रगति पर",
  "Overdue":"अतिदेय",
  "Under Process":"प्रक्रिया में",
  "Pending for Review":"समीक्षा हेतु लंबित",
  "Partial":"आंशिक",
  "Partial Complete":"आंशिक पूर्ण",
  "Partial Completion":"आंशिक पूर्णता",
  "Processed By":"किसने प्रक्रिया की",
  "Processed On":"प्रक्रिया तिथि",
  "Processing History":"प्रक्रिया इतिहास",
  "Timeline":"टाइमलाइन",
  "Type of Document":"दस्तावेज़ प्रकार",
  "Format":"फॉर्मेट",
  "File":"फ़ाइल",
  "Excel Sheet":"एक्सेल शीट",
  "Word Document":"वर्ड दस्तावेज़",
  "PDF":"PDF",
  "Video":"वीडियो",
  "Photo":"फोटो",
  "Photos":"फोटो",
  "Photos / Attachments":"फोटो / संलग्नक",
  "Scan Copy":"स्कैन प्रति",
  "Uploaded By":"किसने अपलोड किया",
  "Document":"दस्तावेज़",
  "0 files":"0 फ़ाइलें",
  "1 · Upload Document":"1 · दस्तावेज़ अपलोड करें",
  "Choose File — any format: Photo, Video, PDF, Excel, Word, ...":"फ़ाइल चुनें — कोई भी फॉर्मेट: फोटो, वीडियो, PDF, एक्सेल, वर्ड, ...",
  "Photos, videos & any file (PDF / Excel / Word) — date, time, format, item details, type & uploaded by are recorded.":"फोटो, वीडियो और कोई भी फ़ाइल (PDF / एक्सेल / वर्ड) — तिथि, समय, फॉर्मेट, वस्तु विवरण, प्रकार और अपलोडकर्ता दर्ज होता है।",
  "(optional, any format, up to 4MB each — unlimited)":"(वैकल्पिक, कोई भी फॉर्मेट, 4MB प्रति — असीमित)",
  "Pieces":"पीस",
  "Boxes":"डिब्बे",
  "Sets":"सेट",
  "Kilograms":"किलोग्राम",
  "Liters":"लीटर",
  "Sign In":"साइन इन करें",
  "Remember me":"मुझे याद रखें",
  "Forgot Password":"पासवर्ड भूल गए",
  "Forgot Password?":"पासवर्ड भूल गए?",
  "Invalid username or password":"अवैध उपयोगकर्ता नाम या पासवर्ड",
  "Enter your password":"अपना पासवर्ड लिखें",
  "Enter your username":"अपना उपयोगकर्ता नाम लिखें",
  "Enter your username...":"अपना उपयोगकर्ता नाम लिखें...",
  "Enter your full name...":"अपना पूरा नाम लिखें...",
  "Enter registered phone number...":"पंजीकृत फोन नंबर लिखें...",
  "Minimum 6 characters":"न्यूनतम 6 अक्षर",
  "Leave blank to keep current":"वर्तमान रखने के लिए खाली छोड़ें",
  "Request Access / Sign Up":"पहुंच का अनुरोध / साइन अप",
  "Requested Role":"अनुरोधित भूमिका",
  "Notification Recipient":"सूचना प्राप्तकर्ता",
  "Request sent to admin successfully!":"अनुरोध प्रशासक को सफलतापूर्वक भेजा गया!",
  "Request submitted successfully!":"अनुरोध सफलतापूर्वक जमा हुआ!",
  "Authorized personnel only. Contact your system administrator for access.":"केवल अधिकृत कर्मी ही उपयोग कर सकते हैं। पहुंच के लिए अपने सिस्टम प्रशासक से संपर्क करें।",
  "District admin and developer admin have been notified. You will be contacted once approved.":"जिला प्रशासक और डेवलपर प्रशासक को सूचित कर दिया गया है। स्वीकृति के बाद संपर्क किया जाएगा।",
  "You will be notified once your password is reset.":"पासवर्ड रीसेट होने पर आपको सूचित किया जाएगा।",
  "Haryana Police":"हरियाणा पुलिस",
  "Inventory Management System":"इन्वेंटरी प्रबंधन प्रणाली",
  "Inventory System":"इन्वेंटरी सिस्टम",
  "Manage Locations":"लोकेशन प्रबंधित करें",
  "Manage Districts":"जिले प्रबंधित करें",
  "Manage Users":"उपयोगकर्ता प्रबंधित करें",
  "Add New District":"नया जिला जोड़ें",
  "Add District":"जिला जोड़ें",
  "Add Location":"लोकेशन जोड़ें",
  "District Code":"जिला कोड",
  "Locations in Selected District":"चयनित जिले की लोकेशन",
  "Location name...":"लोकेशन का नाम...",
  "New category name...":"नई श्रेणी का नाम...",
  "Icon (optional)":"आइकन (वैकल्पिक)",
  "Add a note about the action being taken...":"की जा रही कार्रवाई के बारे में नोट लिखें...",
  "Add a note about the received items...":"प्राप्त वस्तुओं के बारे में नोट लिखें...",
  "Add a note about the supplied quantity...":"आपूर्ति की गई मात्रा के बारे में नोट लिखें...",
  "Any additional detail...":"कोई अतिरिक्त विवरण...",
  "Any recommendations or follow-up actions...":"कोई सिफारिश या आगे की कार्रवाई...",
  "Describe the inspection findings...":"निरीक्षण के निष्कर्ष लिखें...",
  "Describe the maintenance required...":"आवश्यक मेंटेनेंस का विवरण लिखें...",
  "Notes about the completed work...":"पूर्ण कार्य के बारे में नोट्स...",
  "Optional remarks...":"वैकल्पिक टिप्पणी...",
  "Distributed by...":"किसने वितरित किया...",
  "Please provide reason for rejection.":"कृपया अस्वीकृति का कारण बताएं।",
  "Reason for partial completion (required).":"आंशिक पूर्णता का कारण (आवश्यक)।",
  "Reason for rejection (required).":"अस्वीकृति का कारण (आवश्यक)।",
  "Why is this distribution being rejected?":"यह वितरण क्यों अस्वीकृत किया जा रहा है?",
  "Why is this item lost? (required)":"यह वस्तु क्यों खोई? (आवश्यक)",
  "Type to search...":"खोजने के लिए लिखें...",
  "Type to search units / staff...":"यूनिट / स्टाफ खोजने के लिए लिखें...",
  "Type name or BELT No...":"नाम या बेल्ट नं. लिखें...",
  "Select or type item name...":"वस्तु नाम चुनें या लिखें...",
  "Auto-calculated":"स्वतः गणना",
  "Auto-selected by maintenance type":"मेंटेनेंस प्रकार के अनुसार स्वतः चयन",
  "10-digit mobile number":"10 अंकों का मोबाइल नंबर",
  "10-digit mobile number...":"10 अंकों का मोबाइल नंबर...",
  "e.g. 9mm Pistol, Patrol Car, Uniform Stock":"जैसे: 9mm पिस्तौल, गश्ती गाड़ी, यूनिफॉर्म स्टॉक",
  "e.g. BRLT12345":"जैसे: BRLT12345",
  "e.g. Constable, SI, Head Constable...":"जैसे: कांस्टेबल, SI, हेड कांस्टेबल...",
  "e.g. KNL":"जैसे: KNL",
  "e.g. Karnal":"जैसे: करनाल",
  "e.g. Karnal District":"जैसे: करनाल जिला",
  "e.g. PS DLF Phase 3":"जैसे: PS DLF फेज 3",
  "e.g. PS Sector 4":"जैसे: PS सेक्टर 4",
  "e.g. PSI Ramesh Kumar":"जैसे: PSI रमेश कुमार",
  "e.g. ps_sector4":"जैसे: ps_sector4",
  "e.g. received from store":"जैसे: भंडार से प्राप्त",
  "e.g. Water Pump Repair":"जैसे: वाटर पंप रिपेयर",
  "(add one or more items – different categories & quantities)":"(एक या अधिक वस्तुएं – अलग श्रेणियां और मात्रा)",
  "(one or more items of any category)":"(किसी भी श्रेणी की एक या अधिक वस्तुएं)",
  "(tick one or more — use All for everyone)":"(एक या अधिक टिक करें — सबके लिए All चुनें)",
  "each table row is auto-filled as one person — correct everything before inserting":"हर टेबल रो एक व्यक्ति के रूप में भरी जाती है — डालने से पहले सब जांच लें",
  "Quantity — Good / Damaged":"मात्रा — अच्छी / क्षतिग्रस्त",
  "Search by item, category, distributed by or distributed to...":"वस्तु, श्रेणी, वितरक या प्राप्तकर्ता से खोजें...",
  "Search by location name or type...":"लोकेशन नाम या प्रकार से खोजें...",
  "Search by name, code or headquarters...":"नाम, कोड या मुख्यालय से खोजें...",
  "Search by request ID, unit, type, description...":"अनुरोध आईडी, यूनिट, प्रकार, विवरण से खोजें...",
  "Search by username, name, role, district, location...":"उपयोगकर्ता नाम, नाम, भूमिका, जिला, लोकेशन से खोजें...",
  "Search by username, name, role, location...":"उपयोगकर्ता नाम, नाम, भूमिका, लोकेशन से खोजें...",
  "Search demands...":"मांगें खोजें...",
  "Search inspections...":"निरीक्षण खोजें...",
  "Search name / belt / item / posting / rank...":"नाम / बेल्ट / वस्तु / पोस्टिंग / रैंक से खोजें...",
  "Search recipient, item, distributor...":"प्राप्तकर्ता, वस्तु, वितरक से खोजें...",
  "Search reports...":"रिपोर्ट खोजें...",
  "Search return history...":"वापसी इतिहास खोजें...",
  "Search this list...":"इस सूची में खोजें...",
  "Search items...":"वस्तुएं खोजें...",
  "Top 8":"टॉप 8",
  "From:":"से:",
  "To:":"तक:",
  "📝 Audit Log":"📝 ऑडिट लॉग",
  "← Back":"← वापस",
  "↻ Restore Data":"↻ डेटा पुनर्स्थापित करें",
  "⬇ Backup (Excel)":"⬇ बैकअप (एक्सेल)",
  "⬇ Backup (JSON)":"⬇ बैकअप (JSON)",
  "© 2026 Haryana Police – Inventory Management System. All rights reserved.":"© 2026 हरियाणा पुलिस – इन्वेंटरी प्रबंधन प्रणाली। सर्वाधिकार सुरक्षित।",
  "Submit and track maintenance requests for your unit.":"अपनी यूनिट के मेंटेनेंस अनुरोध जमा करें और ट्रैक करें।",
  "Total Qty (Received)":"कुल मात्रा (प्राप्त)",
  "Recipient Distribution History":"प्राप्तकर्ता वितरण इतिहास",
};
let __itemReCache = null;
function __itemReList() {
  if (!__itemReCache) {
    __itemReCache = Object.keys(__I18N_ITEMS).sort((a, b) => b.length - a.length).map(en => ({
      en,
      re: new RegExp("(?<![A-Za-z])" + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z])", "g"),
    }));
  }
  return __itemReCache;
}
window.__LANG = "en";
try { window.__LANG = localStorage.getItem("hp_lang") === "hi" ? "hi" : "en"; } catch (e) {}
const __origTextNode = new WeakMap();
const __origPlaceholder = new WeakMap();
function __applyLanguage() {
  try {
    const hi = window.__LANG === "hi";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (n.parentElement && n.parentElement.closest("#langToggleBtn")) continue;
      const key = n.nodeValue.trim();
      if (hi) {
        const hit = __I18N[key];
        if (hit && hit !== key) {
          if (!__origTextNode.has(n)) __origTextNode.set(n, n.nodeValue);
          n.nodeValue = n.nodeValue.replace(key, hit);
        }
        let v = n.nodeValue;
        for (const it of __itemReList()) {
          if (v.indexOf(it.en) === -1) continue;
          if (!__origTextNode.has(n)) __origTextNode.set(n, n.nodeValue);
          v = v.replace(it.re, __I18N_ITEMS[it.en]);
        }
        if (v !== n.nodeValue) n.nodeValue = v;
      } else if (__origTextNode.has(n)) {
        n.nodeValue = __origTextNode.get(n);
        __origTextNode.delete(n);
      }
    }
    document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(el => {
      const ph = (el.getAttribute("placeholder") || "").trim();
      if (hi) {
        const hit = __I18N[ph];
        if (hit && hit !== ph) {
          if (!__origPlaceholder.has(el)) __origPlaceholder.set(el, el.getAttribute("placeholder"));
          el.setAttribute("placeholder", hit);
        }
      } else if (__origPlaceholder.has(el)) {
        el.setAttribute("placeholder", __origPlaceholder.get(el));
        __origPlaceholder.delete(el);
      }
    });
  } catch (e) {}
}
function __updateLangBtn(l) {
  const b = document.getElementById("langToggleBtn");
  if (!b) return;
  const isEn = l === "en";
  const badge = b.querySelector(".lang-badge") || document.getElementById("langBadge");
  if (badge) {
    badge.textContent = isEn ? "HI" : "EN";
  } else if (!b.querySelector("svg")) {
    b.textContent = isEn ? "हिंदी" : "English";
  }
  b.title = isEn ? "Switch to Hindi / भाषा बदलें" : "Switch to English / अंग्रेज़ी में बदलें";
  b.setAttribute("aria-label", isEn ? "Switch to Hindi" : "Switch to English");
}
function __setLang(l) {
  window.__LANG = l;
  try { localStorage.setItem("hp_lang", l); } catch (e) {}
  __updateLangBtn(l);
  __applyLanguage();
}
const __langMO = new MutationObserver(() => {
  if (window.__LANG !== "hi") return;
  clearTimeout(__langMO.__t);
  __langMO.__t = setTimeout(__applyLanguage, 250);
});
function __initLanguage() {
  const b = document.getElementById("langToggleBtn");
  if (b && !b.dataset.langBound) {
    b.dataset.langBound = "1";
    b.addEventListener("click", () => __setLang(window.__LANG === "en" ? "hi" : "en"));
  }
  __updateLangBtn(window.__LANG);
  if (!__langMO.__obs) { __langMO.__obs = true; __langMO.observe(document.body, { childList: true, subtree: true }); }
  if (window.__LANG === "hi") __applyLanguage();
}
__initLanguage();
document.addEventListener("DOMContentLoaded", __initLanguage);

/* ==================== CONSUMABLE ITEMS ==================== */
/* One-way inventory: TOTAL = AVAILABLE + DISTRIBUTED + LOST.
   Distributions reserve (pending) until the recipient approves;
   rejection releases the reservation. NO return workflow exists.
   The server (_rbac.js) re-validates every ledger change diff-based. */
function getConsItems() {
  if (!activeDistrictId) return [];
  const map = loadData("consumable_items") || {};
  return Array.isArray(map[activeDistrictId]) ? map[activeDistrictId] : [];
}
function getConsTxns() {
  if (!activeDistrictId) return [];
  const map = loadData("consumable_txns") || {};
  return Array.isArray(map[activeDistrictId]) ? map[activeDistrictId] : [];
}
function saveConsItems(arr) {
  const map = loadData("consumable_items") || {};
  map[activeDistrictId] = arr;
  saveData("consumable_items", map);
}
function saveConsTxns(arr) {
  const map = loadData("consumable_txns") || {};
  map[activeDistrictId] = arr;
  saveData("consumable_txns", map);
}
/* District-scoped consumable category store (2026.09.212):
   "cons_categories" is a map { [districtId]: [category...] } — same shape as
   items/categories — so every district owns an independent list. A legacy
   shared array is migrated once by copying it into each known district;
   after that, edits in one district never show up in another. A district
   with no stored list yet derives one from its OWN consumable items only
   (empty when it has none — no auto "General", 2026.09.213). */
function getConsCategoriesForDistrict(districtId) {
  if (!districtId) return [];
  let map = loadData("cons_categories");
  if (Array.isArray(map)) {
    const legacy = map;
    map = {};
    getDistricts().forEach(d => { map[d.id] = legacy.map(c => Object.assign({}, c)); });
    saveData("cons_categories", map);
  }
  if (!map || typeof map !== "object") { map = {}; saveData("cons_categories", map); }
  if (!Array.isArray(map[districtId])) {
    // First access for this district: derive from its own consumable items.
    let c = [];
    const seen = {};
    const items = (loadData("consumable_items") || {})[districtId] || [];
    const invCats = getCategoriesForDistrict(districtId);
    for (const it of items) {
      if (seen[it.categoryId]) continue;
      seen[it.categoryId] = 1;
      const inv = invCats.find(x => x.id === it.categoryId);
      c.push({ id: it.categoryId || uid(), name: inv ? inv.name : "General", icon: (inv && inv.icon) || "" });
    }
    // No auto "General" fallback (2026.09.213): a district without items and
    // without a stored list simply starts empty.
    map[districtId] = c;
    saveData("cons_categories", map);
  }
  return map[districtId];
}
function saveConsCategoriesForDistrict(districtId, list) {
  if (!districtId) return;
  let map = loadData("cons_categories");
  if (!map || typeof map !== "object" || Array.isArray(map)) map = {};
  map[districtId] = list;
  saveData("cons_categories", map);
}
function getConsCats() { return getConsCategoriesForDistrict(__activeCatDistrictId()); }
function saveConsCats(c) { saveConsCategoriesForDistrict(__activeCatDistrictId(), c); }
function openConsCatModal() {
  renderConsCatList();
  const a = $("#consCatInput");
  if (a) {
    a.value = "";
    setTimeout(() => { try { a.focus(); } catch (e) {} }, 60);
  }
  openModal("#consCatModal");
}
function addConsCategory() {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const name = (($("#consCatInput") || {}).value || "").trim();
  if (!name) return toast("Enter a name.", "error");
  const cats = getConsCats();
  if (cats.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast("Already exists.", "error");
  cats.push({ id: uid(), name });
  saveConsCats(cats);
  renderConsCatList();
  toast("Added: " + name, "success");
  const a = $("#consCatInput");
  if (a) { a.value = ""; try { a.focus(); } catch (e) {} }
  if (typeof renderConsumables === "function") renderConsumables();
  if (typeof __repopulateConsMultiCat === "function") __repopulateConsMultiCat($("#consStockCat"));
}
function renderConsCatList() {
  const box = $("#consCatList");
  if (!box) return;
  const cats = getConsCats();
  const items = getConsItems(); // own district only (categories are district-scoped, 2026.09.212)
  box.innerHTML = cats.map((c, idx) => {
    const count = items.filter(i => i.categoryId === c.id && !i.isDeleted).length;
    return '<div class="cat-list-row" data-idx="' + idx + '"><span class="cat-list-name">' + esc(c.name) + '</span><span class="cat-list-count">' + count + ' items</span><div class="cat-list-actions"><button class="btn btn-sm btn-outline" data-ccat-items="' + idx + '">Items</button><button class="btn btn-sm btn-outline" data-ccat-edit="' + idx + '">Edit</button><button class="btn btn-sm btn-outline act-dd-del" data-ccat-del="' + idx + '"' + (count > 0 ? ' disabled title="Remove items first"' : '') + '>Delete</button></div></div>';
  }).join("");
}
function __consCitCurrent() { return __consCitCatId || null; }
let __consCitCatId = null;
function openConsCatItems(idx) {
  const c = getConsCats()[idx];
  if (!c) return;
  __consCitCatId = c.id;
  $("#ccitTitle").textContent = c.name;
  $("#ccitSubtitle").textContent = "Items in this consumable category - add, rename or delete an item";
  // Cleared on open so a half-typed name from a previous category is never
  // carried over and added to the wrong one.
  const inp0 = $("#ccitNewName");
  if (inp0) inp0.value = "";
  __renderConsCatItems(c.id);
  openModal("#consCitModal");
}
function __renderConsCatItems(cid) {
  const body = $("#ccitBody");
  if (!body) return;
  __consCitCatId = cid;
  const items = getConsItems().filter(i => i.categoryId === cid && !i.isDeleted);
  const editable = __consCanManage();
  // The add row is hidden rather than disabled for a view-only account, so a
  // read-only user is not invited to try; __ccitAdd re-checks either way.
  const addRow = $("#ccitAddRow");
  if (addRow) addRow.style.display = editable ? "" : "none";
  body.innerHTML = items.length
    ? items.map(i => {
        const q = __consQty(i.id);
        const acts = editable
          ? `<button class="btn btn-sm btn-outline" data-ccit-edit="${i.id}">Edit</button> <button class="btn btn-sm btn-outline act-dd-del" data-ccit-del="${i.id}">Delete</button>`
          : `<span class="muted">View only</span>`;
        return `<tr data-ccit-row="${i.id}"><td class="item-name"><span class="cit-name">${nameCell(i.name)}</span></td><td>${q.total}</td><td>${q.available}</td><td class="actions-cell">${acts}</td></tr>`;
      }).join("")
    : `<tr class="empty-row"><td colspan="4">No items in this category yet.</td></tr>`;
}
function __ccitAdd() {
  const cid = __consCitCatId;
  if (!cid) return toast("Open a category first.", "error");
  if (!__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const name = (($("#ccitNewName") || {}).value || "").trim();
  if (!name) return toast("Enter an item name.", "error");
  const items = getConsItems();
  // Scoped to the category being viewed, which is what the list below shows.
  if (items.some(i => i.categoryId === cid && (i.name || "").toLowerCase() === name.toLowerCase())) {
    return toast("An item with this name already exists in this category.", "error");
  }
  items.push({
    id: uid(),
    name: name,
    categoryId: cid,
    unit: "Pcs",
    locationId: (currentUser && currentUser.locationId) || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  saveConsItems(items);
  __audit("Consumable Item Added", name + " (name-only quick add, qty 0)", { entity: "Consumable Item" });
  toast("Item added.", "success");
  const inp = $("#ccitNewName");
  if (inp) { inp.value = ""; inp.focus(); }
  __renderConsCatItems(cid);
  renderConsCatList();
  render();
}
function __ccitStartEdit(id) {
  const item = getConsItems().find(i => i.id === id);
  if (!item || !__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const row = document.querySelector('[data-ccit-row="' + id + '"]');
  if (!row) return;
  row.querySelector(".item-name").innerHTML = `<input class="cat-edit-input" id="ccitEditName" value="${esc(item.name)}">`;
  row.querySelector(".actions-cell").innerHTML = `<button class="btn btn-sm btn-primary" data-ccit-save="${id}">Save</button> <button class="btn btn-sm btn-outline" data-ccit-cancel="${id}">Cancel</button>`;
  const inp = $("#ccitEditName");
  if (inp) { inp.focus(); inp.select(); }
}
function __ccitSave(id) {
  const items = getConsItems();
  const item = items.find(i => i.id === id);
  if (!item || !__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const name = (($("#ccitEditName") || {}).value || "").trim();
  if (!name) return toast("Enter a name.", "error");
  if (items.some(i => i.id !== id && i.categoryId === item.categoryId && (i.name || "").toLowerCase() === name.toLowerCase())) return toast("An item with this name already exists in this category.", "error");
  const old = item.name;
  item.name = name;
  item.updatedAt = Date.now();
  saveConsItems(items);
  toast("Item renamed.", "success");
  __renderConsCatItems(item.categoryId);
  renderConsCatList();
  render();
}
function __ccitDelete(id) {
  const items = getConsItems();
  const item = items.find(i => i.id === id);
  if (!item || !__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const q = __consQty(item.id);
  if (q.available > 0 || q.pending > 0 || q.total > 0) {
    return toast("Cannot delete item with remaining stock. Available quantity must be 0.", "error");
  }
  if (!confirm("Delete this item from this category?")) return;
  item.isDeleted = true;
  item.deletedAt = Date.now();
  item.updatedAt = Date.now();
  saveConsItems(items);
  const txns = getConsTxns();
  const t = __consCommit("DELETED", item, 0, null, null, "Deleted Item", "");
  txns.unshift(t);
  saveConsTxns(txns);
  __audit("Consumable Item Deleted", '"' + (item.name || id) + '"', { entity: "Consumable Item" });
  toast("Item deleted.", "success");
  __renderConsCatItems(item.categoryId);
  renderConsCatList();
  render();
}

function startEditConsCat(idx) {
  const c = getConsCats()[idx];
  if (!c) return;
  // $$(...), not $(...): $ is querySelector and hands back ONE element, so
  // indexing that single element by idx is always undefined and the row was
  // never found - which is why pressing Edit did nothing at all.
  const rows = $$("#consCatList .cat-list-row");
  const row = rows[idx];
  if (!row) return;
  const nameSpan = row.querySelector(".cat-list-name");
  const actionsDiv = row.querySelector(".cat-list-actions");
  if (!nameSpan || !actionsDiv) return;
  row.classList.add("editing");
  nameSpan.innerHTML = '<input class="cat-edit-input" id="consCatEditName" value="' + esc(c.name) + '">';
  actionsDiv.innerHTML = '<button class="btn btn-sm btn-primary" data-ccat-save="' + idx + '">Save</button><button class="btn btn-sm btn-outline" data-ccat-cancel="' + idx + '">Cancel</button>';
  const inp = $("#consCatEditName");
  if (inp) {
    inp.focus();
    inp.select();
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); saveEditConsCat(idx); }
      else if (e.key === "Escape") { e.preventDefault(); renderConsCatList(); }
    });
  }
}
function saveEditConsCat(idx) {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const cats = getConsCats();
  const name = (($("#consCatEditName") || {}).value || "").trim();
  if (!name) return toast("Enter a name.", "error");
  if (cats.some((c, i) => i !== idx && c.name.toLowerCase() === name.toLowerCase())) return toast("Already exists.", "error");
  cats[idx].name = name;
  saveConsCats(cats);
  renderConsCatList();
  toast("Updated: " + name, "success");
  if (typeof renderConsumables === "function") renderConsumables();
  if (typeof __repopulateConsMultiCat === "function") __repopulateConsMultiCat($("#consStockCat"));
}
function deleteConsCategory(idx) {
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const cats = getConsCats();
  const cat = cats[idx];
  if (!cat) return;
  if (getConsItems().filter(i => i.categoryId === cat.id && !i.isDeleted).length > 0) return toast("Has items. Remove or reassign items first.", "error"); // own district only (2026.09.212)
  cats.splice(idx, 1);
  saveConsCats(cats);
  renderConsCatList();
  toast("Deleted: " + cat.name, "success");
  if (typeof renderConsumables === "function") renderConsumables();
  if (typeof __repopulateConsMultiCat === "function") __repopulateConsMultiCat($("#consStockCat"));
}

function __consCanManage() {
  return currentUser && !isDevAdmin();
}
function __consIsAdminView() {
  return !!currentUser && (currentUser.role === "admin" || currentUser.role === "devadmin");
}
function __consOwnLocKey() {
  if (!currentUser) return "";
  if (getLocations().some(l => l.id === currentUser.locationId)) return "unit:" + currentUser.locationId;
  return "staff:" + currentUser.id;
}
function __consOwnLocLabel() {
  const k = __consOwnLocKey();
  if (k.indexOf("unit:") === 0) { const l = getLocations().find(x => x.id === currentUser.locationId); return ((l && l.name) || "My Unit") + " (My Unit)"; }
  return (currentUser.name || "My Staff") + " (My Staff)";
}
/* Own stock for the logged-in unit/staff user: what was distributed TO their unit (unit:<locId>) or to them (staff:<userId>), minus their unit's own onward distributions (requests raised by their unit's users to other units/staff), pending onward requests and losses marked by their unit's users. */
function __consQtyOwn(itemId) {
  const myLoc = String(currentUser.locationId || "");
  const mates = getUsers().filter(u => String(u.locationId) === myLoc).map(u => String(u.id));
  const isOnward = (t) => {
    if (!mates.includes(String(t.byId))) return false;
    if (String(t.toType) === "staff") return true;
    if (String(t.toType) === "unit" && String(t.toId) !== myLoc) return true;
    return false;
  };
  const onwardReqIds = new Set();
  for (const t of getConsTxns()) {
    if (t && t.type === "DISTRIBUTION_REQUEST" && isOnward(t)) onwardReqIds.add(String(t.requestId || t.id));
  }
  const addMatch = (t) => {
    const u = getUsers().find(x => String(x.id) === String(t.byId));
    return !!u && String(u.locationId) === myLoc;
  };
  let received = 0, pendingIn = 0, lost = 0, outPending = 0, outDist = 0;
  for (const t of getConsTxns()) {
    if (!t || t.itemId !== itemId) continue;
    const q = Math.max(0, Math.floor(Number(t.qty) || 0));
    if (t.type === "ADD" && addMatch(t)) received += q;
    if ((String(t.toType) === "unit" && String(t.toId) === myLoc) || (String(t.toType) === "staff" && String(t.toId) === String(currentUser.id))) {
      if (t.type === "DISTRIBUTION_APPROVED") received += q;
      else if (t.type === "DISTRIBUTION_REQUEST") pendingIn += q;
    }
    if (t.type === "LOSS" && mates.includes(String(t.byId))) lost += q;
    else if (t.type === "DISTRIBUTION_REQUEST" && isOnward(t)) outPending += q;
    else if (t.type === "DISTRIBUTION_APPROVED" && (onwardReqIds.has(String(t.requestId || "")) )) outDist += q;
  }
  const avail = Math.max(0, received - lost - outDist);
  let status = "Available";
  if (received === 0) status = "Available";
  else if (avail > 0) status = (pendingIn > 0 || outPending > 0) ? "Partially Available" : "Available";
  else if (pendingIn > 0) status = "Pending Approval";
  else status = "Distributed";
  return { total: received, available: avail, pending: pendingIn + outPending, distributed: outDist, lost: lost, availForNew: avail, status: status };
}
function __consLedger() {
  const m = {};
  for (const t of getConsTxns()) {
    if (!t || !t.itemId) continue;
    const q = Math.max(0, Math.floor(Number(t.qty) || 0));
    const a = (m[t.itemId] = m[t.itemId] || { total: 0, pending: 0, distributed: 0, lost: 0 });
    if (t.type === "ADD") a.total += q;
    else if (t.type === "DISTRIBUTION_REQUEST") a.pending += q;
    else if (t.type === "DISTRIBUTION_APPROVED") { a.pending -= q; a.distributed += q; }
    else if (t.type === "DISTRIBUTION_REJECTED") a.pending -= q;
    else if (t.type === "LOSS") a.lost += q;
  }
  return m;
}
function __consQty(itemId) {
  const a = __consLedger()[itemId] || { total: 0, pending: 0, distributed: 0, lost: 0 };
  const avail = Math.max(0, a.total - a.distributed - a.lost - a.pending);
  let status = "Available";
  if (a.total === 0) status = "Available";
  else if (avail > 0 && (a.pending > 0 || a.distributed > 0 || a.lost > 0)) status = "Partially Available";
  else if (avail === 0 && a.pending > 0) status = "Pending Approval";
  else if (avail === 0 && a.distributed > 0) status = "Distributed";
  else if (avail === 0 && a.lost > 0) status = "Lost";
  return { total: a.total, available: avail, pending: a.pending, distributed: a.distributed, lost: a.lost, availForNew: avail, status };
}
function __consReqStatus(reqId) {
  const txns = getConsTxns();
  if (txns.some(t => t.type === "DISTRIBUTION_APPROVED" && t.requestId === reqId)) return "Complete";
  if (txns.some(t => t.type === "DISTRIBUTION_REJECTED" && t.requestId === reqId)) return "Rejected";
  return "Pending Approval";
}
function __consItemCat(catId) { return (getCategories().find(c => c.id === catId) || {}).name || ""; }
function __consItem(itemId) { return getConsItems().find(x => x.id === itemId) || null; }
function __consNow() {
  const d = new Date();
  return { date: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), ts: Date.now() };
}
function __consStatusBadge(st) {
  const map = { "Available": "cons-b-green", "Partially Available": "cons-b-amber", "Pending Approval": "cons-b-amber", "Complete": "cons-b-green", "Rejected": "cons-b-red", "Lost": "cons-b-red", "Distributed": "cons-b-blue", "Deleted Item": "cons-b-red", "Deleted": "cons-b-red" };
  return `<span class="cons-badge ${map[st] || "cons-b-gray"}">${esc(st)}</span>`;
}
/* ---- Searchable combobox (existing categories / items / recipients) ---- */
function __consComboInit(rootId, cfg) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const inp = root.querySelector(".combo-input");
  const hid = root.querySelector(".combo-val");
  const list = root.querySelector(".combo-list");
  const api = { root, inp, hid, opts: [], isNew: false, newName: "" };
  api.render = function() {
    api.opts = cfg.options() || [];
    const q = inp.value.trim().toLowerCase();
    const f = api.opts.filter(o => !q || o.label.toLowerCase().indexOf(q) !== -1);
    let html = f.map(o => `<button type="button" class="combo-opt" data-cv="${esc(o.value)}">${esc(o.label)}${o.badge ? ` <span class="combo-badge">${esc(o.badge)}</span>` : ""}</button>`).join("");
    if (cfg.extra) {
      const ex = cfg.extra(inp.value.trim(), f);
      if (ex) html += `<button type="button" class="combo-opt combo-new" data-cv="__new__">${esc(ex)}</button>`;
    }
    list.innerHTML = html || `<div class="combo-empty">No matches.</div>`;
    list.classList.remove("hidden");
  };
  inp.addEventListener("focus", () => api.render());
  inp.addEventListener("input", () => { hid.value = ""; api.isNew = false; api.newName = ""; api.render(); });
  list.addEventListener("mousedown", (e) => {
    const b = e.target.closest("[data-cv]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.cv === "__new__") {
      const ex = cfg.extra(inp.value.trim(), []);
      api.isNew = true; api.newName = inp.value.trim(); hid.value = "__new__:" + inp.value.trim();
      list.classList.add("hidden");
      if (cfg.onNew) cfg.onNew(inp.value.trim());
      return;
    }
    const o = api.opts.find(x => String(x.value) === b.dataset.cv);
    if (!o) return;
    api.isNew = false; api.newName = "";
    hid.value = o.value; inp.value = o.label; list.classList.add("hidden");
    if (cfg.onPick) cfg.onPick(o);
  });
  inp.addEventListener("blur", () => setTimeout(() => list.classList.add("hidden"), 160));
  return api;
}
let __consCatCombo = null, __consItemCombo = null, __consToCombo = null;
/* ---- Filters state ---- */
const __consF = { q: "", cat: "", item: "", status: "", loc: "", from: "", to: "" };
const __consdF = { q: "", loc: "", cat: "", item: "", by: "", from: "", to: "" };
/* Merged "All Locations" filter value is "unit:<id>" or "staff:<id>" */
function __consLocMatch(t, loc) {
  if (!loc) return true;
  const c = String(loc).indexOf(":");
  if (c === -1) return true;
  return t.toType === String(loc).slice(0, c) && String(t.toId) === String(loc).slice(c + 1);
}
/* ---- Summary cards ---- */
function __consTotals() {
  const led = __consLedger();
  const t = { total: 0, available: 0, pending: 0, distributed: 0, lost: 0 };
  for (const id of Object.keys(led)) {
    const a = led[id];
    t.total += a.total; t.pending += a.pending; t.distributed += a.distributed; t.lost += a.lost;
  }
  t.available = Math.max(0, t.total - t.distributed - t.lost - t.pending);
  return t;
}
let __consTab = "stock";
/* Per-location consumable view (admin selecting a unit/staff): received stock of that unit/staff minus what that unit/staff further distributed onward (Available = after distribution), their losses and pending onward requests. */
function __consQtyAt(itemId, loc) {
  const c = String(loc).indexOf(":");
  const tt = String(loc).slice(0, c), tid = String(loc).slice(c + 1);
  let mates, recvKeys;
  if (tt === "unit") {
    mates = getUsers().filter(u => String(u.locationId) === String(tid)).map(u => String(u.id));
    recvKeys = [["unit", String(tid)]].concat(mates.map(u => ["staff", u]));
  } else {
    mates = [String(tid)];
    recvKeys = [["staff", String(tid)]];
  }
  const isOnward = (t) => {
    if (!mates.includes(String(t.byId))) return false;
    if (String(t.toType) === "staff") return true;
    if (String(t.toType) === "unit" && String(t.toId) !== String(tid)) return true;
    return false;
  };
  const onwardReqIds = new Set();
  for (const t of getConsTxns()) {
    if (t && t.type === "DISTRIBUTION_REQUEST" && isOnward(t)) onwardReqIds.add(String(t.requestId || t.id));
  }
  const addMatch = (t) => {
    const u = getUsers().find(x => String(x.id) === String(t.byId));
    if (!u) return false;
    if (tt === "unit") return String(u.locationId) === String(tid);
    return String(u.id) === String(tid) && !(u.locationId && getLocations().some(l => l.id === u.locationId));
  };
  let received = 0, pendingIn = 0, lost = 0, outPending = 0, outDist = 0;
  for (const t of getConsTxns()) {
    if (!t || t.itemId !== itemId) continue;
    const q = Math.max(0, Math.floor(Number(t.qty) || 0));
    if (t.type === "ADD" && addMatch(t)) received += q;
    if (recvKeys.some(k => String(t.toType) === k[0] && String(t.toId) === k[1])) {
      if (t.type === "DISTRIBUTION_APPROVED") received += q;
      else if (t.type === "DISTRIBUTION_REQUEST") pendingIn += q;
    }
    if (t.type === "LOSS" && mates.includes(String(t.byId))) lost += q;
    else if (t.type === "DISTRIBUTION_REQUEST" && isOnward(t)) outPending += q;
    else if (t.type === "DISTRIBUTION_APPROVED" && onwardReqIds.has(String(t.requestId || ""))) outDist += q;
  }
  const avail = Math.max(0, received - lost - outDist);
  let status = "Available";
  if (received === 0) status = "Available";
  else if (avail > 0) status = (pendingIn > 0 || outPending > 0) ? "Partially Available" : "Available";
  else if (pendingIn > 0) status = "Pending Approval";
  else status = "Distributed";
  return { total: received, available: avail, pending: pendingIn + outPending, distributed: outDist, lost: lost, availForNew: 0, status: status };
}
let __consStockLoc = "";
function __repopulateConsMultiCat(sel, ms) {
  if (!sel) return;
  if (!window.__msCatCS && typeof bindMultiCombobox === "function" && $("#consStockCatInput")) {
    window.__msCatCS = bindMultiCombobox("consStockCatInput", "consStockCatMenu", "consStockCat", renderConsStock);
  }
  const keep = (typeof __msSelected === "function" ? __msSelected(sel) : []).map(o => o.value);
  sel.innerHTML = `<option value="">All Categories</option>` + __byName(getConsCats()).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  Array.prototype.forEach.call(sel.options, o => { if (o.value && keep.indexOf(o.value) >= 0) o.selected = true; });
  const inst = ms || window.__msCatCS;
  if (inst && inst.refresh) inst.refresh();
}
function __consStockFilteredRows() {
  const cats = getConsCats();
  const q = (($("#consStockSearch") || {}).value || "").toLowerCase();
  const catFilter = (typeof __msMatches === "function") ? __msMatches($("#consStockCat")) : null;
  const catF = (!catFilter && $("#consStockCat")) ? $("#consStockCat").value : "";
  const typeF = (($("#consStockType") || {}).value || "all");
  const isAdmin = __consIsAdminView();
  const ownKey = __consOwnLocKey();
  const locF = isAdmin ? (($("#consStockLoc") || {}).value || "") : ownKey;
  const items = getConsItems().filter(i => !i.isDeleted).map(i => { const qq = !isAdmin ? __consQtyOwn(i.id) : (locF ? __consQtyAt(i.id, locF) : __consQty(i.id)); return { i, q: qq }; });
  let rows = items.filter(x => {
    if (catFilter) {
      if (!catFilter(x.i)) return false;
    } else if (catF && x.i.categoryId !== catF) {
      return false;
    }
    const cat = cats.find(c => c.id === x.i.categoryId);
    if (q && !((x.i.name || "").toLowerCase().includes(q) || ((cat && cat.name) || "").toLowerCase().includes(q))) return false;
    if (typeF === "distributed" && x.q.total <= 0) return false;
    if (typeF === "available" && x.q.available <= 0) return false;
    if (!isAdmin && x.q.total <= 0) return false;
    return true;
  });
  rows.sort((a, b) => (a.i.name || "").localeCompare(b.i.name || ""));
  if (typeof __msGrouped === "function") {
    rows = __msGrouped(rows, $("#consStockCat"), x => x.i.categoryId);
  }
  return rows;
}
function renderConsStock() {
  const body = $("#consStockBody");
  if (!body) return;
  __repopulateConsMultiCat($("#consStockCat"));
  const isAdmin = __consIsAdminView();
  const ownKey = __consOwnLocKey();
  const locF = isAdmin ? (($("#consStockLoc") || {}).value || "") : ownKey;
  const rows = __consStockFilteredRows();
  const head = $("#consStockHead");
  if (head) { const th = head.querySelectorAll("th")[2]; if (th) th.textContent = locF ? "Total Qty (Received)" : "Total Qty"; }
  let ttotal = 0, tavail = 0, tdist = 0, tlost = 0;
  rows.forEach(x => { ttotal += x.q.total; tavail += x.q.available; tdist += x.q.distributed; tlost += x.q.lost; });
  const baseNo = __pgPage("consStock", rows.length) * PAGE_SIZE;
  const rowsHtml = rows.length === 0
    ? `<tr class="empty-row"><td colspan="8">No consume items found.</td></tr>`
    : __pgRows("consStock", rows).map((x, idx) => {
        const st = x.q.status;
        const acts = __consCanManage() ? actDD([
          { label: "View", attrs: `data-cons-view="${x.i.id}"` },
          ...((!isAdmin || !locF) && x.q.availForNew > 0 ? [{ label: "Distribute", attrs: `data-cons-dist="${x.i.id}"` }] : []),
          ...((!isAdmin || !locF) && x.q.availForNew > 0 ? [{ label: "Mark Lost", attrs: `data-cons-loss="${x.i.id}"` }] : [])
        ]) : `<button type="button" class="btn btn-sm btn-outline" data-cons-view="${x.i.id}">View</button>`;
        return `<tr><td>${baseNo + idx + 1}</td><td class="item-name"><button type="button" class="linklike" data-cons-view="${x.i.id}" title="Open item details">${nameCell(x.i.name)}</button></td><td class="qty-strong">${x.q.total}</td><td class="qty-strong">${x.q.available}</td><td>${x.q.distributed}</td><td>${x.q.lost}</td><td><span class="status-badge">${esc(st)}</span></td><td>${acts}</td></tr>`;
      }).join("");
  body.innerHTML = rowsHtml +
    `<tr class="rpt-total-row"><td></td><td class="rpt-total-label">Total</td><td class="qty-strong">${ttotal}</td><td class="qty-strong">${tavail}</td><td>${tdist}</td><td>${tlost}</td><td></td><td></td></tr>`;
  const note = $("#consStockNote");
  if (note) {
    let name = "All Locations";
    if (locF) {
      const ci = String(locF).indexOf(":");
      const tt = String(locF).slice(0, ci), tid = String(locF).slice(ci + 1);
      if (tt === "unit") { const l = getLocations().find(x => x.id === tid); name = (l && l.name) || "Unit"; }
      else { const u = getUsers().find(x => x.id === tid); name = (u && u.name) || "Staff"; }
    }
    note.classList.remove("hidden");
    note.innerHTML = "<b>" + esc(name) + "</b> &mdash; Total Quantity: <b>" + ttotal + "</b> &middot; Available (in stock now): <b>" + tavail + "</b> &middot; " + (locF ? "Received: <b>" + ttotal + "</b> &middot; " : "Added: <b>" + ttotal + "</b> &middot; ") + "Distributed: <b>" + tdist + "</b> &middot; Lost: <b>" + tlost + "</b>";
  }
  renderPager("consStock", rows.length, renderConsStock);
}
function __consExportTableRows() {
  const cats = getConsCats();
  return __consStockFilteredRows().map(x => { const q = x.q; const i = x.i; const cat = cats.find(c => c.id === i.categoryId); return [i.name, (cat && cat.name) || "", String(q.total), String(q.available), String(q.distributed), String(q.lost), q.status]; });
}
function __consStockExportData() {
  const locF = __consIsAdminView() ? (($("#consStockLoc") || {}).value || "") : __consOwnLocKey();
  const first = ["S.No", "Item Name", "Category", locF ? "Total Qty (Received)" : "Total Qty", "Available", "Distributed", "Lost", "Status"];
  return [first].concat(__consExportTableRows().map((r, i) => [String(i + 1)].concat(r)));
}
function exportConsStockCSV() { __consCsv("consumable-item-consume.csv", __consStockExportData()); toast("CSV exported.", "success"); }
function exportConsStockPDF() {
  const rows = __consExportTableRows();
  const win = window.open("", "_blank");
  if (!win) return toast("Popup blocked.", "error");
  const __consPrintCols = ["Item", "Category", "Total", "Available", "Distributed", "Lost", "Status"];
  win.document.write("<h2>Consumable Items \u2014 Item Consume</h2><table border=1 cellpadding=4 style=\"border-collapse:collapse\"><tr>" + __consPrintCols.map(h => "<th>" + h + "</th>").join("") + "</tr>" + rows.map(r => "<tr>" + r.map((c, ci) => "<td>" + colCellInline(__consPrintCols[ci], c) + "</td>").join("") + "</tr>").join("") + "</table>");
  win.document.close(); win.print();
}
function exportConsStockExcel() { exportConsStockCSV(); }
function exportConsStockWord() { exportConsStockPDF(); }
function printConsStock() { exportConsStockPDF(); }
function __consShowTab(name) {
  __consTab = name;
  $$("[data-constab]").forEach(t => t.classList.toggle("active", t.dataset.constab === name));
  $$("[data-cons_tab]").forEach(p => p.classList.toggle("hidden", p.dataset.cons_tab !== name));
  if (name === "stock") renderConsStock();
}

function renderConsCards() {
  const box = $("#consCards");
  if (!box) return;
  const t = __consTotals();
  const svg = (p) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`;
  const cards = [
    ["stat-total", svg('<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-1V7"/>'), t.total, "Total Quantity"],
    ["cons-stat-green", svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'), t.available, "Available Quantity"],
    ["cons-stat-amber", svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>'), t.distributed, "Distributed Quantity"],
    ["cons-stat-red", svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'), t.lost, "Lost Quantity"],
  ];
  box.innerHTML = cards.map(c =>
    `<div class="stat-card ${c[0]}"><div class="stat-icon">${c[1]}</div><div class="stat-info"><span class="stat-value">${c[2]}</span><span class="stat-label">${esc(c[3])}</span></div></div>`
  ).join("");
}

let __consDistItemId = null, __consEditItemId = null;
/* ---- Main ledger table ---- */
function __consRowStatus(t) {
  if (t.type === "ADD") return "Available";
  if (t.type === "DISTRIBUTION_REQUEST") return __consReqStatus(t.id);
  if (t.type === "LOSS") return "Lost";
  if (t.type === "DELETED") return "Deleted Item";
  return "";
}
/* Privacy: non-admin users see only transactions they are involved in — as the distributor (Distributed By) or as the recipient (Distributed To). Admins see the full trail. */
function __consInvolved(t) {
  if (!currentUser) return false;
  if (currentUser.role === "admin" || currentUser.role === "devadmin") return true;
  if (String(t.byId) === String(currentUser.id)) return true;
  if (String(t.toType) === "unit" && String(t.toId) === String(currentUser.locationId)) return true;
  if (String(t.toType) === "staff" && String(t.toId) === String(currentUser.id)) return true;
  return false;
}
function __consRows() {
  const items = getConsItems();
  const cats = getConsCats();
  return getConsTxns().filter(t => (t.type === "ADD" || t.type === "DISTRIBUTION_REQUEST" || t.type === "LOSS" || t.type === "DELETED") && __consInvolved(t)).map(t => {
    const it = items.find(x => x.id === t.itemId) || {};
    const cat = (cats.find(c => c.id === (it ? it.categoryId : t.categoryId)) || {}).name || "";
    return { t, categoryName: cat, itemName: (it && it.name) || t.itemName || "(unknown)", isItemDeleted: !!(it && it.isDeleted), status: __consRowStatus(t), to: t.toType ? (t.toName || "") : "", by: t.byName || "", qty: t.qty, date: t.date };
  });
}
function __consRecipientLabel(t) {
  if (!t.toType) return "&mdash;";
  return esc(t.toName || "") + ` <span class="combo-badge">${t.toType === "unit" ? "UNIT" : "STAFF"}</span>`;
}
function renderConsumables() {
  if (!currentUser) return;
  __consRefreshFilterOptions();
  renderConsStock();
  renderConsLedger();
  renderConsDistByLoc();
  const badge = $("#consDot");
  const pend = __consMyPendingCount();
  if (badge) { badge.style.display = pend > 0 ? "inline-block" : "none"; }
}
function __consMyPendingCount() {
  if (!currentUser) return 0;
  return getConsTxns().filter(t => t.type === "DISTRIBUTION_REQUEST" && __consReqStatus(t.id) === "Pending Approval" && __consIsRecipient(t)).length;
}
function __consIsRecipient(t) {
  if (!currentUser || !t.toType) return false;
  return t.toType === "staff" ? t.toId === currentUser.id : t.toId === currentUser.locationId;
}
function openConsTxnDetails(txnId) {
  const t = getConsTxns().find(x => x.id === txnId);
  if (!t) return toast("Transaction not found.", "error");
  const item = __consItem(t.itemId) || {};
  const body = $("#consTxnBody");
  if (!body) return;
  let status = "";
  if (t.type === "ADD") status = "Added";
  else if (t.type === "DISTRIBUTION_REQUEST") status = __consReqStatus(t.id);
  else if (t.type === "LOSS") status = "Lost";
  else if (t.type === "DELETED") status = "Deleted Item";
  const ap = t.type === "DISTRIBUTION_REQUEST" ? getConsTxns().find(x => x.type === "DISTRIBUTION_APPROVED" && x.requestId === t.id) : null;
  const rj = t.type === "DISTRIBUTION_REQUEST" ? getConsTxns().find(x => x.type === "DISTRIBUTION_REJECTED" && x.requestId === t.id) : null;
  const typeLabel = t.type === "ADD" ? "Stock Added" : t.type === "DISTRIBUTION_REQUEST" ? "Distribution" : t.type === "LOSS" ? "Marked Lost" : t.type === "DELETED" ? "Item Deleted" : (t.type || "");
  const row = (k, v) => '<div style="display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px dashed var(--border);font-size:.87rem"><span style="color:var(--muted);min-width:130px">' + k + '</span><span style="text-align:right;font-weight:600">' + v + "</span></div>";
  body.innerHTML =
    row("Item", esc(item.name || "(unknown)") + (item.id ? ' <button type="button" class="linklike" style="margin-left:6px" data-cons-item="' + item.id + '">Open Item Page</button>' : "")) +
    row("Category", esc(__consItemCat(item.categoryId) || "&mdash;")) +
    row("Transaction Type", esc(typeLabel)) +
    row("Quantity", esc(t.qty)) +
    row("Date &amp; Time", esc(fmtDate(t.date ? new Date(t.date) : t.createdAt)) + (t.time ? " " + esc(t.time) : "")) +
    (t.toType ? row("Distributed To", __consRecipientLabel(t)) : "") +
    row(t.type === "LOSS" ? "Marked Lost By" : t.type === "ADD" ? "Added By" : "Distributed By", esc(t.byName || "&mdash;")) +
    (ap ? row("Approved By", esc(ap.byName || "&mdash;")) : "") +
    (rj ? row("Rejected By", esc(rj.byName || "&mdash;")) : "") +
    row("Status", status ? __consStatusBadge(status) : "&mdash;") +
    (t.remarks ? row("Remarks", esc(t.remarks)) : "") +
    (rj && rj.reason ? row("Reject Reason", esc(rj.reason)) : "");
  openModal("#consTxnModal");
}
function renderConsLedger() {
  const body = $("#consBody");
  if (!body) return;
  let rows = __consRows();
  rows = __consRowsFilter(rows);
  const page = __pgRows("cons", rows);
  body.innerHTML = rows.length === 0 ? `<tr><td colspan="8" class="empty-row">No consumable records yet. Use "+ Add Consume Item".</td></tr>` : page.map(r => {
    const t = r.t;
    const canManage = __consCanManage();
    const q = __consQty(t.itemId);
    const acts = [];
    acts.push(`<button type="button" class="btn btn-sm btn-outline" data-cons-txnview="${t.id}">View</button>`);
    // removed: distribute button moved to Item Consume tab
    // removed: mark lost button moved to Item Consume tab
    // removed: recipient approve moved out of history actions
    // removed: edit button moved to Item Consume tab
    return `<tr data-cons-txn="${t.id}">
      <td data-th="Item Category">${esc(r.categoryName)}</td>
      <td data-th="Item"><button type="button" class="linklike" data-cons-item="${t.itemId}">${nameCell(r.itemName)}</button>${r.isItemDeleted ? ' <span class="status-badge status-out" style="font-size:0.7rem;padding:1px 5px;margin-left:4px">Deleted</span>' : ''}</td>
      <td data-th="Quantity">${t.type === "DELETED" ? `<span class="muted">&mdash;</span>` : t.qty}</td>
      <td data-th="Date">${esc(fmtDate(t.date ? new Date(t.date) : t.createdAt))}</td>
      <td data-th="Distributed To">${__consRecipientLabel(t)}</td>
      <td data-th="Distributed By">${t.type === "DISTRIBUTION_REQUEST" ? esc(t.byName || "") : esc(t.approvedByName || t.byName || "")}</td>
      <td data-th="Status">${__consStatusBadge(r.status)}</td>
      <td data-th="Actions" class="cell-actions">${acts.join(" ")}</td>
    </tr>`;
  }).join("");
  renderPager("cons", rows.length, renderConsLedger);
}
function __consRowsFilter(rows) {
  const F = __consF;
  const q = F.q.trim().toLowerCase();
  return rows.filter(r => {
    const t = r.t;
    if (q && !(r.itemName.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q) || (t.byName || "").toLowerCase().includes(q) || (t.toName || "").toLowerCase().includes(q))) return false;
    if (F.cat && t.categoryId !== F.cat) return false;
    if (F.item && t.itemId !== F.item) return false;
    if (F.status && r.status !== F.status) return false;
    if (!__consLocMatch(t, F.loc)) return false;
    if (F.from && r.date < F.from) return false;
    if (F.to && r.date > F.to) return false;
    return true;
  });
}
/* ---- Distribution by Location ---- */
function __consDistRows() {
  const items = getConsItems();
  const cats = getConsCats();
  return getConsTxns().filter(t => t.type === "DISTRIBUTION_REQUEST" && __consInvolved(t)).map(t => {
    const it = items.find(x => x.id === t.itemId) || {};
    const cat = (cats.find(c => c.id === (it ? it.categoryId : t.categoryId)) || {}).name || "";
    return { t, categoryName: cat, itemName: it ? it.name : "(unknown)", status: __consReqStatus(t.id), date: t.date, to: t.toName || "", toType: t.toType || "", by: t.byName || "", qty: t.qty };
  });
}
function __consDistFilter(rows) {
  const F = __consdF;
  const q = F.q.trim().toLowerCase();
  return rows.filter(r => {
    const t = r.t;
    if (q && !(r.itemName.toLowerCase().includes(q) || (t.toName || "").toLowerCase().includes(q) || (t.byName || "").toLowerCase().includes(q))) return false;
    if (!__consLocMatch(t, F.loc)) return false;
    if (F.cat && t.categoryId !== F.cat) return false;
    if (F.item && t.itemId !== F.item) return false;
    if (F.by && !(t.byName || "").toLowerCase().includes(F.by.trim().toLowerCase())) return false;
    if (F.from && r.date < F.from) return false;
    if (F.to && r.date > F.to) return false;
    return true;
  });
}
function renderConsDistByLoc() {
  const body = $("#consDistBody");
  if (!body) return;
  let rows = __consDistFilter(__consDistRows());
  const page = __pgRows("consDist", rows);
  body.innerHTML = rows.length === 0 ? `<tr><td colspan="9" class="empty-row">No distributions yet.</td></tr>` : page.map(r => {
    const t = r.t;
    const pend = r.status === "Pending Approval";
    const mine = __consIsRecipient(t);
    const acts = pend && mine ? `<button type="button" class="btn btn-sm btn-green" data-cons-approve="${t.id}">Approve</button> <button type="button" class="btn btn-sm btn-red" data-cons-reject="${t.id}">Reject</button> <button type="button" class="btn btn-sm btn-outline" data-cons-view="${t.itemId}">View</button>` : `<button type="button" class="btn btn-sm btn-outline" data-cons-view="${t.itemId}">View</button>`;
    return `<tr data-cons-req="${t.id}">
      <td data-th="Recipient"><button type="button" class="linklike" data-cons-recipient="${t.toType}:${t.toId}" data-cons-recipient-name="${esc(t.toName || "")}" data-cons-recipient-type="${t.toType}">${esc(t.toName || "")}</button> <span class="combo-badge">${t.toType === "unit" ? "UNIT" : "STAFF"}</span></td>
      <td data-th="Type">${t.toType === "unit" ? "Unit" : "Staff"}</td>
      <td data-th="Category">${esc(r.categoryName)}</td>
      <td data-th="Item"><button type="button" class="linklike" data-cons-item="${t.itemId}">${nameCell(r.itemName)}</button></td>
      <td data-th="Quantity">${t.qty}</td>
      <td data-th="Date">${esc(fmtDate(t.date ? new Date(t.date) : t.createdAt))}</td>
      <td data-th="Distributed By">${esc(t.byName || "")}</td>
      <td data-th="Status">${__consStatusBadge(r.status)}</td>
      <td data-th="Actions" class="cell-actions">${acts}</td>
    </tr>`;
  }).join("");
  renderPager("consDist", rows.length, renderConsDistByLoc);
}
/* ---- Combobox wiring per modal ---- */
function __consWireCombos() {
  __consCatCombo = __consComboInit("consCatCombo", {
    options: () => getConsCats().map(c => ({ value: c.id, label: c.name })),
    extra: null,
    onPick: () => { if (__consItemCombo) { __consItemCombo.hid.value = ""; __consItemCombo.inp.value = ""; } },
  });
  __consItemCombo = __consComboInit("consItemCombo", {
    options: () => {
      const cid = __consCatCombo ? __consCatCombo.hid.value : "";
      return cid ? getConsItems().filter(i => i.categoryId === cid).map(i => ({ value: i.id, label: i.name })) : [];
    },
    extra: (text, f) => {
      const cid = __consCatCombo ? __consCatCombo.hid.value : "";
      if (!cid || !text) return null;
      return '\u2795 New item "' + text + '" (first stock entry)';
    },
  });
  __consToCombo = __consComboInit("consToCombo", {
    options: () => __consIsAdminView() ? [].concat(
      getLocations().map(l => ({ value: "unit:" + l.id, label: l.name, badge: "UNIT" })),
      getUsers().filter(u => u.districtId === activeDistrictId && u.role !== "devadmin" && u.role !== "ig").map(u => ({ value: "staff:" + u.id, label: u.name, badge: "STAFF" }))
    ) : getUsers().filter(u => u.locationId === currentUser.locationId && u.id !== currentUser.id).map(u => ({ value: "staff:" + u.id, label: u.name, badge: "STAFF" })),
    extra: null,
  });
}
let __consRowSeq = 0;
let __consRowPhotos = {};
function __consRowHtml(key) {
  const cats = getConsCats();
  return `<div class="as-item-row cons-item-row" data-key="${key}">
    <div class="as-row-fields">
      <select class="as-row-cat cons-row-cat"><option value="">Category *</option>${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <div class="as-item-wrap">
        <select class="as-row-item cons-row-item" disabled><option value="">Select a category first...</option></select>
        <input type="text" class="as-row-newname hidden" placeholder="New item name..." autocomplete="off">
      </div>
      <div class="as-cond-qtys cons-cond-qtys">
        <span class="as-cq"><input type="number" class="cons-row-qty" placeholder="Qty" min="1" value=""></span>
      </div>
      <button type="button" class="as-row-remove" data-action="cons-row-remove" title="Remove item">&times;</button>
    </div>
    <div class="as-photo-bar">
      <div class="att-bar-actions">
        <label class="att-btn att-btn-upload" title="Attach photo or file (any format)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> Upload<input type="file" class="cons-photo-input" multiple hidden></label>
        <button type="button" class="att-btn att-btn-cam" data-att-cam="cons:${key}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Camera</button>
        <span class="att-count" data-cons-count="${key}">0 files</span>
      </div>
      <div class="att-grid as-photo-thumbs"></div>
    </div>
  </div>`;
}
function __consRowOf(el) { return el ? el.closest(".cons-item-row") : null; }
function addConsRow() {
  const box = $("#consRows");
  if (!box) return;
  const key = "k" + (++__consRowSeq);
  box.insertAdjacentHTML("beforeend", __consRowHtml(key));
  const row = box.querySelector(`.cons-item-row[data-key="${key}"]`);
  if (row) __initRowCombos(row);
}
function __consPopulateRowItems(row) {
  if (!row) return;
  const catSel = row.querySelector(".cons-row-cat");
  const itemSel = row.querySelector(".cons-row-item");
  const newName = row.querySelector(".as-row-newname");
  const cid = (catSel || {}).value || "";
  newName.classList.add("hidden"); newName.value = "";
  if (!cid) {
    itemSel.disabled = true;
    itemSel.innerHTML = `<option value="">Select a category first...</option>`;
    if (row.__itemCombo) row.__itemCombo.sync();
    return;
  }
  const consNames = getConsItems().filter(i => i.categoryId === cid && !i.isDeleted).map(i => i.name);
  const distNames = getAllDistrictItems().filter(i => i.categoryId === cid && !i.isDeleted).map(i => i.name);
  const combined = [...new Set([...consNames, ...distNames].filter(Boolean))];
  const names = __byName(combined, x => x);
  itemSel.disabled = false;
  itemSel.innerHTML = `<option value="">Select item</option>` + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("") + `<option value="__new__">&#10133; New item...</option>`;
  if (row.__itemCombo) row.__itemCombo.sync();
}
function __consRenderThumbs(row) {
  const key = row.dataset.key;
  const box = row.querySelector(".as-photo-thumbs");
  if (!box) return;
  const photos = __consRowPhotos[key] || [];
  const cnt = row.querySelector("[data-cons-count]");
  if (cnt) cnt.textContent = photos.length + (photos.length === 1 ? " file" : " files");
  box.innerHTML = photos.map(p => { const isImg = String(p.mime || "").toLowerCase().startsWith("image/"); return `<div class="as-thumb" data-action="cons-photo-remove" data-pid="${p.id}" title="Remove">${isImg ? `<img src="${p.dataUrl}" alt="">` : `<span class="as-thumb-file">${esc(p.name)}</span>`}<span class="as-thumb-x">&times;</span></div>`; }).join("");
}
function __consReadPhotos(row, files) {
  const key = row.dataset.key;
  const list = __consRowPhotos[key] || [];
  for (const f of Array.from(files || [])) {
    if (f.size > 4 * 1024 * 1024) { toast(`"${f.name}" is too large (max 4MB).`, "error"); continue; }
    if (list.some(p => p.name === f.name && p.size === f.size)) { toast(`"${f.name}" is already attached.`, "error"); continue; }
    const reader = new FileReader();
    reader.onload = () => { (__consRowPhotos[key] = __consRowPhotos[key] || []).push({ id: uid(), name: f.name, mime: f.type, size: f.size, dataUrl: reader.result }); __consRenderThumbs(row); };
    reader.onerror = () => toast(`Could not read "${f.name}".`, "error");
    reader.readAsDataURL(f);
  }
}
function __consRowsClick(e) {
  const row = __consRowOf(e.target);
  if (!row) return;
  const rm = e.target.closest("[data-action=cons-row-remove]");
  if (rm) {
    const rows = $$("#consRows .cons-item-row");
    if (rows.length <= 1) return toast("At least one item row is required.", "error");
    delete __consRowPhotos[row.dataset.key];
    row.remove();
    return;
  }
  const px = e.target.closest("[data-action=cons-photo-remove]");
  if (px) { __consRowPhotos[row.dataset.key] = (__consRowPhotos[row.dataset.key] || []).filter(p => p.id !== px.dataset.pid); __consRenderThumbs(row); return; }
}
function __consRowsChange(e) {
  const row = __consRowOf(e.target);
  if (!row) return;
  if (e.target.classList.contains("cons-row-cat")) { __consPopulateRowItems(row); return; }
  if (e.target.classList.contains("cons-row-item")) {
    const newName = row.querySelector(".as-row-newname");
    if ((e.target.value || "") === "__new__") {
      newName.classList.remove("hidden");
      if (row.__itemCombo && row.__itemCombo.lastTyped && row.__itemCombo.lastTyped !== "➕ New item...") {
        newName.value = row.__itemCombo.lastTyped;
      }
      newName.focus();
    }
    else { newName.classList.add("hidden"); newName.value = ""; }
    return;
  }
  if (e.target.classList.contains("cons-photo-input")) { __consReadPhotos(row, e.target.files); e.target.value = ""; return; }
}
function openConsAdd() {
  if (!__consCanManage() && !isDevAdmin()) return toast("You are not allowed to modify consumables.", "error"); // devadmin: view only, save blocked in saveConsAdd
  __consRowSeq = 0;
  __consRowPhotos = {};
  $("#consRows").innerHTML = "";
  addConsRow();
  $("#consRemarks").value = "";
  const d = $("#consDate"); if (d) d.value = todayStr();
  const t = $("#consTime"); if (t) t.value = nowTimeStr();
  openModal("#consAddModal");
}
function saveConsAdd(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const rows = $$("#consRows .cons-item-row");
  const cleanRows = [];
  for (const row of rows) {
    const cid = (row.querySelector(".cons-row-cat") || {}).value || "";
    const sel = row.querySelector(".cons-row-item");
    const newNameEl = row.querySelector(".as-row-newname");
    const selV = (sel || {}).value || "";
    const newName = (selV === "__new__" ? (newNameEl ? newNameEl.value : "") : selV).trim();
    const qty = Math.floor(Number((row.querySelector(".cons-row-qty") || {}).value));
    if (!cid && !newName && (!isFinite(qty) || qty <= 0)) continue;
    if (!cid) return toast("Har row me category select karo.", "error");
    if (!newName) return toast("Har row me item select ya type karo.", "error");
    if (!isFinite(qty) || qty <= 0) return toast("Quantity must be a positive whole number.", "error");
    cleanRows.push({ row, cid, newName, qty });
  }
  if (!cleanRows.length) return toast("Add at least one item.", "error");
  const remarks = $("#consRemarks").value.trim();
  const date = $("#consDate") ? $("#consDate").value : todayStr();
  const time = $("#consTime") ? $("#consTime").value : nowTimeStr();
  const items = getConsItems();
  const txns = getConsTxns();
  let added = 0;
  for (const p of cleanRows) {
    let item = items.find(x => x.name.toLowerCase() === p.newName.toLowerCase() && x.categoryId === p.cid && !x.isDeleted);
    if (!item) {
      item = { id: uid(), categoryId: p.cid, name: p.newName, photoUrl: "", condition: "Good", remarks: "", createdAt: Date.now() };
      items.push(item);
    }
    const photos = __consRowPhotos[p.row.dataset.key] || [];
    const photo = photos[0];
    if (photo) { item.photoUrl = photo.dataUrl; item.updatedAt = Date.now(); }
    if (remarks) { item.remarks = remarks; item.updatedAt = Date.now(); }
    saveConsItems(items);
    const txn = __consCommit("ADD", item, p.qty, null, null, remarks, photo ? photo.dataUrl : "");
    if (date) txn.date = date;
    if (time) txn.time = time;
    txns.unshift(txn);
    added++;
  }
  saveConsTxns(txns);
  __consRowPhotos = {};
  closeModals();
  render();
  toast(added + " consumable item row(s) added successfully.", "success");
}


function __consCommit(type, item, qty, to, reqRef, remarks, photo) {
  const agg = __consLedger()[item.id] || { total: 0, pending: 0, distributed: 0, lost: 0 };
  const prev = { total: agg.total, available: Math.max(0, agg.total - agg.distributed - agg.lost - agg.pending), pending: agg.pending, distributed: agg.distributed, lost: agg.lost };
  const a2 = Object.assign({}, agg);
  if (type === "ADD") a2.total += qty;
  else if (type === "DISTRIBUTION_REQUEST") a2.pending += qty;
  else if (type === "DISTRIBUTION_APPROVED") { a2.pending -= qty; a2.distributed += qty; }
  else if (type === "DISTRIBUTION_REJECTED") a2.pending -= qty;
  else if (type === "LOSS") a2.lost += qty;
  const next = { total: a2.total, available: Math.max(0, a2.total - a2.distributed - a2.lost - a2.pending), pending: a2.pending, distributed: a2.distributed, lost: a2.lost };
  const now = __consNow();
  const t = {
    id: uid(), itemId: item.id, categoryId: item.categoryId, itemName: item.name, type, qty,
    toType: to ? to.type : null, toId: to ? to.id : null, toName: to ? to.name : null,
    byId: currentUser.id, byName: currentUser.name,
    requestId: reqRef || null, reason: "", remarks: remarks || "", photo: photo || "",
    date: now.date, time: now.time, createdAt: now.ts,
    prev: prev, next: next,
  };
  return t;
}
/* ---- Distribute ---- */
function openConsDist(itemId) {
  if (!__consCanManage() && !isDevAdmin()) return toast("You are not allowed to modify consumables.", "error"); // devadmin: view only, save blocked in saveConsDist
  const item = __consItem(itemId);
  if (!item) return toast("Item not found.", "error");
  const q = __consIsAdminView() ? __consQty(itemId) : __consQtyOwn(itemId);
  if (q.availForNew <= 0) return toast("Insufficient available quantity. Available quantity: " + q.availForNew, "error");
  __consDistItemId = itemId;
  $("#cdCat").value = __consItemCat(item.categoryId);
  $("#cdItem").value = item.name;
  $("#cdAvail").value = String(q.availForNew);
  $("#cdBy").value = currentUser.name;
  $("#cdQty").value = "";
  __attStore.consDist = [];
  __attRender("consDist");
  $("#cdRemarks").value = "";
  __consToCombo = __consComboInit("consToCombo", {
    options: () => __consIsAdminView() ? [].concat(
      getLocations().map(l => ({ value: "unit:" + l.id, label: l.name, badge: "UNIT" })),
      getUsers().filter(u => u.districtId === activeDistrictId && u.role !== "devadmin" && u.role !== "ig").map(u => ({ value: "staff:" + u.id, label: u.name, badge: "STAFF" }))
    ) : getUsers().filter(u => u.locationId === currentUser.locationId && u.id !== currentUser.id).map(u => ({ value: "staff:" + u.id, label: u.name, badge: "STAFF" })),
    extra: null,
  });
  if (__consToCombo) { __consToCombo.hid.value = ""; __consToCombo.inp.value = ""; }
  openModal("#consDistModal");
}
function saveConsDist(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  if (!__consCanManage()) return toast("You are not allowed to modify consumables.", "error");
  const item = __consItem(__consDistItemId);
  if (!item) return toast("Item not found.", "error");
  const q = __consIsAdminView() ? __consQty(item.id) : __consQtyOwn(item.id);
  const qty = Math.floor(Number($("#cdQty").value));
  if (!isFinite(qty) || qty <= 0) return toast("Distribution quantity must be a positive whole number.", "error");
  if (qty > q.availForNew) return toast("Insufficient available quantity. Available quantity: " + q.availForNew + " | Requested quantity: " + qty, "error");
  const tv = __consToCombo ? __consToCombo.hid.value : "";
  if (!tv || tv.indexOf(":") === -1) return toast("Please choose a recipient (unit or staff).", "error");
  const toType = tv.slice(0, tv.indexOf(":")) === "unit" ? "unit" : "staff";
  const toId = tv.slice(tv.indexOf(":") + 1);
  let toName = "";
  if (toType === "unit") {
    const loc = getLocations().find(l => l.id === toId);
    if (!loc) return toast("Recipient must be a unit under your district.", "error");
    toName = loc.name;
  } else {
    const u = getUsers().find(x => x.id === toId);
    if (!u || u.districtId !== activeDistrictId) return toast("Recipient must be staff under your district.", "error");
    toName = u.name;
  }
  const remarks = $("#cdRemarks").value.trim();
  const __cdPhoto = (__attStore.consDist || [])[0];
  const t = __consCommit("DISTRIBUTION_REQUEST", item, qty, { type: toType, id: toId, name: toName }, null, remarks, __cdPhoto ? __cdPhoto.dataUrl : "");
  t.requestId = t.id;
  const txns = getConsTxns();
  txns.unshift(t);
  saveConsTxns(txns);
  const catName = __consItemCat(item.categoryId);
  const msg = "Category: " + catName + " | Item: " + item.name + " | Quantity: " + qty + " | Distributed By: " + currentUser.name + " | Date: " + t.date + ". Please Approve or Reject this distribution request.";
  addNotification(activeDistrictId, {
    type: "cons_request",
    title: "New Consumable Distribution Request",
    message: msg,
    consReqId: t.id,
    targetLocId: toType === "unit" ? toId : null,
    targetUserId: toType === "staff" ? toId : null,
  });
  __audit("Consumable Distribution Requested", `"${item.name}" x${qty} -> ${toName} (${toType})`, { entity: "Consumable" });
  closeModals();
  render();
  toast("Consumable distribution request sent for approval.", "success");
}
/* ---- Approve / Reject ---- */
function __consApplyDecision(reqId, approve, reason) {
  const txns = getConsTxns();
  const req = txns.find(x => x.id === reqId);
  if (!req) return toast("Distribution request not found.", "error");
  if (__consReqStatus(reqId) !== "Pending Approval") return toast("This request was already " + __consReqStatus(reqId) + ".", "error");
  if (!__consIsRecipient(req)) return toast("Only the receiving unit/staff can approve or reject this request.", "error");
  const item = __consItem(req.itemId);
  if (!item) return toast("Item not found.", "error");
  const now = __consNow();
  const t = __consCommit(approve ? "DISTRIBUTION_APPROVED" : "DISTRIBUTION_REJECTED", item, req.qty, { type: req.toType, id: req.toId, name: req.toName }, reqId, "", "");
  if (!approve) {
    t.reason = reason;
  }
  t.approvedById = currentUser.id;
  t.approvedByName = currentUser.name;
  t.date = now.date; t.time = now.time;
  const txns2 = getConsTxns();
  txns2.unshift(t);
  saveConsTxns(txns2);
  const catName = __consItemCat(item.categoryId);
  if (approve) {
    addNotification(activeDistrictId, { type: "cons_approved", title: "Consumable distribution approved.", message: "Item: " + item.name + " | Quantity: " + req.qty + " | Approved By: " + currentUser.name + " | Status: Complete", consReqId: req.id, targetUserId: req.byId });
    __audit("Consumable Distribution Approved", `"${item.name}" x${req.qty} to ${req.toName} approved by ${currentUser.name}`, { entity: "Consumable" });
    toast("Distribution approved. Quantity is now recorded as distributed.", "success");
  } else {
    addNotification(activeDistrictId, { type: "cons_rejected", title: "Consumable distribution rejected.", message: "Item: " + item.name + " | Quantity: " + req.qty + " | Rejected By: " + currentUser.name + " | Reason: " + reason + " | Status: Rejected", targetUserId: req.byId });
    __audit("Consumable Distribution Rejected", `"${item.name}" x${req.qty} rejected by ${currentUser.name}: ${reason}`, { entity: "Consumable" });
    toast("Distribution rejected. Reserved quantity released back to available.", "success");
  }
  closeModals();
  render();
}
/* ---- Loss ---- */
let __consLossItemId = null;
function openConsLoss(itemId) {
  if (!__consCanManage() && !isDevAdmin()) return toast("You are not allowed to modify consumables.", "error"); // devadmin: view only, save blocked in saveConsLoss
  const item = __consItem(itemId);
  if (!item) return toast("Item not found.", "error");
  const q = __consIsAdminView() ? __consQty(itemId) : __consQtyOwn(itemId);
  if (q.availForNew <= 0) return toast("No available quantity to mark lost. Available quantity: 0", "error");
  __consLossItemId = itemId;
  $("#clItem").value = item.name;
  $("#clAvail").value = String(q.availForNew);
  $("#clQty").value = "";
  $("#clRemarks").value = "";
  openModal("#consLossModal");
}
function saveConsLoss(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const item = __consItem(__consLossItemId);
  if (!item) return toast("Item not found.", "error");
  const q = __consIsAdminView() ? __consQty(item.id) : __consQtyOwn(item.id);
  const qty = Math.floor(Number($("#clQty").value));
  if (!isFinite(qty) || qty <= 0) return toast("Lost quantity must be a positive whole number.", "error");
  if (qty > q.availForNew) return toast("Insufficient available quantity. Available quantity: " + q.availForNew + " | Requested quantity: " + qty, "error");
  const remarks = $("#clRemarks").value.trim();
  const tLoss = __consCommit("LOSS", item, qty, null, null, remarks, "");
  const txnsLoss = getConsTxns();
  txnsLoss.unshift(tLoss);
  saveConsTxns(txnsLoss);
  __audit("Consumable Quantity Lost", `"${item.name}" x${qty} marked lost by ${currentUser.name}`, { entity: "Consumable" });
  closeModals();
  render();
  toast("Consumable item quantity marked as lost successfully.", "success");
}
/* ---- Item details ---- */
let __consViewItemId = null;
function openConsItem(itemId) {
  const item = __consItem(itemId);
  if (!item) return toast("Item not found.", "error");
  __consViewItemId = itemId;
  const q = __consQty(itemId);
  const box = $("#consItemBody");
  const hist = getConsTxns().filter(t => t.itemId === itemId);
  const histRows = hist.map(t => {
    let st = "";
    if (t.type === "ADD") st = "Stock added";
    else if (t.type === "DISTRIBUTION_REQUEST") st = __consReqStatus(t.id);
    else if (t.type === "LOSS") st = "Lost";
    else st = "";
    return `<tr>
      <td data-th="Date">${esc(fmtDate(t.date ? new Date(t.date) : t.createdAt))} <span style="color:var(--muted);font-size:.72rem">${esc(t.time || "")}</span></td>
      <td data-th="Type">${esc(t.type === "ADD" ? "Stock In" : t.type === "DISTRIBUTION_REQUEST" ? "Distribution" : t.type === "LOSS" ? "Loss" : t.type)}</td>
      <td data-th="Quantity">${t.qty}</td>
      <td data-th="Distributed To">${__consRecipientLabel(t)}</td>
      <td data-th="Type">${t.toType === "unit" ? "Unit" : t.toType === "staff" ? "Staff" : "&mdash;"}</td>
      <td data-th="Distributed By">${esc(t.approvedByName && t.type === "DISTRIBUTION_APPROVED" ? t.approvedByName : (t.byName || ""))}</td>
      <td data-th="Status">${st ? __consStatusBadge(st) : "&mdash;"}</td>
    </tr>`;
  }).join("");
  box.innerHTML =
    `<div class="cons-item-head">
      ${item.photoUrl ? `<img class="cons-photo" src="${item.photoUrl}" alt="${esc(item.name)}">` : `<div class="cons-photo cons-photo-ph">&#128247;</div>`}
      <div>
        <h3 style="margin:0 0 4px">${esc(item.name)}</h3>
        <div style="color:var(--muted);font-size:.8rem">Category: ${esc(__consItemCat(item.categoryId))} &middot; Condition: ${esc(item.condition || "Good")}</div>
        ${item.remarks ? `<div style="color:var(--muted);font-size:.78rem;margin-top:4px">${esc(item.remarks)}</div>` : ""}
      </div>
    </div>
    <div class="cons-qty-grid">
      <div class="cons-qty"><span class="cons-qty-v">${q.total}</span><span class="cons-qty-l">Total Quantity</span></div>
      <div class="cons-qty"><span class="cons-qty-v">${q.available}</span><span class="cons-qty-l">Available Quantity</span></div>
      <div class="cons-qty"><span class="cons-qty-v">${q.pending}</span><span class="cons-qty-l">Pending Quantity</span></div>
      <div class="cons-qty"><span class="cons-qty-v">${q.distributed}</span><span class="cons-qty-l">Distributed Quantity</span></div>
      <div class="cons-qty"><span class="cons-qty-v">${q.lost}</span><span class="cons-qty-l">Lost Quantity</span></div>
      <div class="cons-qty"><span class="cons-qty-v">${esc(q.status)}</span><span class="cons-qty-l">Status</span></div>
    </div>
    <h4 style="margin:14px 0 6px">Distribution History</h4>
    <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Distributed To</th><th>Distributed By</th><th>Status</th></tr></thead>
    <tbody>${histRows || `<tr><td colspan="6" class="empty-row">No transactions yet.</td></tr>`}</tbody></table></div>`;
  if (__consCanManage()) $("#consItemEditBtn").classList.remove("hidden"); else $("#consItemEditBtn").classList.add("hidden");
  openModal("#consItemModal");
}
/* ---- Edit item (info only; quantities live in the ledger) ---- */
function openConsEdit(itemId) {
  if (!__consCanManage() && !isDevAdmin()) return toast("You are not allowed to modify consumables.", "error"); // devadmin: view only, save blocked in saveConsEdit
  const item = __consItem(itemId);
  if (!item) return toast("Item not found.", "error");
  __consEditItemId = itemId;
  $("#ceName").value = item.name;
  $("#ceRemarks").value = item.remarks || "";
  $("#ceCat").textContent = __consItemCat(item.categoryId);
  __attStore.consEdit = [];
  __attRender("consEdit");
  openModal("#consEditModal");
}
function saveConsEdit(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const item = __consItem(__consEditItemId);
  if (!item) return toast("Item not found.", "error");
  const name = $("#ceName").value.trim();
  if (!name) return toast("Item name is required.", "error");
  const items = getConsItems();
  if (items.some(x => x.id !== item.id && x.name.toLowerCase() === name.toLowerCase() && x.categoryId === item.categoryId)) return toast("Another item with this name already exists in the category.", "error");
  item.name = name;
  item.remarks = $("#ceRemarks").value.trim();
  const photo = (__attStore.consEdit || [])[0];
  if (photo) item.photoUrl = photo.dataUrl;
  item.updatedAt = Date.now();
  saveConsItems(items);
  __audit("Consumable Item Edited", `"${item.name}"`, { entity: "Consumable" });
  __attStore.consEdit = [];
  closeModals();
  render();
  toast("Consumable item updated.", "success");
}
/* ---- Request review modal ---- */
let __consReviewReqId = null;
function openConsRequest(reqId) {
  const req = getConsTxns().find(t => t.id === reqId);
  if (!req) return toast("Distribution request not found.", "error");
  __consReviewReqId = reqId;
  const item = __consItem(req.itemId) || {};
  const st = __consReqStatus(reqId);
  const box = $("#consReqBody");
  box.innerHTML =
    `<div class="cons-item-head">
      ${req.photo || item.photoUrl ? `<img class="cons-photo" src="${req.photo || item.photoUrl}" alt="">` : ""}
      <div>
        <h3 style="margin:0 0 4px">${esc(item.name || "(unknown item)")}</h3>
        <div style="color:var(--muted);font-size:.8rem">Category: ${esc(__consItemCat(req.categoryId))} &middot; Condition: Good</div>
      </div>
    </div>
    <div class="cons-req-grid">
      <div><span class="stat-label">Quantity</span><b>${req.qty}</b></div>
      <div><span class="stat-label">Distributed To</span><b>${esc(req.toName || "")} (${req.toType === "unit" ? "Unit" : "Staff"})</b></div>
      <div><span class="stat-label">Distributed By</span><b>${esc(req.byName || "")}</b></div>
      <div><span class="stat-label">Date</span><b>${esc(fmtDate(req.date ? new Date(req.date) : req.createdAt))}</b></div>
      <div><span class="stat-label">Time</span><b>${esc(req.time || "")}</b></div>
      <div><span class="stat-label">Status</span>${__consStatusBadge(st)}</div>
      ${req.remarks ? `<div style="grid-column:1/-1"><span class="stat-label">Remarks</span><div>${esc(req.remarks)}</div></div>` : ""}
      ${st === "Rejected" && req.reason ? `<div style="grid-column:1/-1"><span class="stat-label">Rejection Reason</span><b>${esc(req.reason)}</b></div>` : ""}
    </div>`;
  const pend = st === "Pending Approval";
  const mine = __consIsRecipient(req);
  const foot = $("#consReqFoot");
  foot.innerHTML = (pend && mine)
    ? `<button type="button" class="btn btn-green" id="consReqApproveBtn">Approve</button><button type="button" class="btn btn-red" data-cons-reject="${reqId}">Reject</button>`
    : `<button type="button" class="btn btn-outline" data-close>Close</button>`;
  foot.querySelectorAll("[data-cons-approve-btn]").forEach(() => {});
  const ab = foot.querySelector("#consReqApproveBtn");
  if (ab) ab.addEventListener("click", () => {
    if (!confirm(`Are you sure you want to approve receipt of ${req.qty} ${item.name}?`)) return;
    __consApplyDecision(reqId, true, "");
  });
  openModal("#consRequestModal");
}
/* ---- Reject modal ---- */
let __consRejectReqId = null;
function openConsReject(reqId) {
  __consRejectReqId = reqId;
  $("#consRejectReason").value = "";
  openModal("#consRejectModal");
}
function saveConsReject(e) {
  e.preventDefault();
  if (isDevAdmin()) return toast(__devRbacLockMsg(), "error");
  const reason = $("#consRejectReason").value.trim();
  if (!reason) return toast("Rejection reason is required.", "error");
  __consApplyDecision(__consRejectReqId, false, reason);
}
/* ---- Recipient history modal ---- */
function openConsRecipient(toType, toId, name) {
  const box = $("#consRecipBody");
  const dist = (getDistricts().find(d => d.id === activeDistrictId) || {}).name || "";
  const rows = getConsTxns().filter(t => t.type === "DISTRIBUTION_REQUEST" && t.toType === toType && t.toId === toId);
  const F = { q: "", cat: "", item: "", st: "", from: "", to: "" };
  const render = () => {
    const q = F.q.trim().toLowerCase();
    const f = rows.filter(r2 => {
      const it = __consItem(r2.itemId) || {};
      const cat = __consItemCat(r2.categoryId);
      const st = __consReqStatus(r2.id);
      if (q && !(it.name || "").toLowerCase().includes(q) && cat.toLowerCase().indexOf(q) === -1) return false;
      if (F.cat && r2.categoryId !== F.cat) return false;
      if (F.item && r2.itemId !== F.item) return false;
      if (F.st && st !== F.st) return false;
      if (F.from && r2.date < F.from) return false;
      if (F.to && r2.date > F.to) return false;
      return true;
    });
    $("#consRecipList").innerHTML = f.length === 0 ? `<tr><td colspan="6" class="empty-row">No distribution records.</td></tr>` : f.map(r2 => {
      const it = __consItem(r2.itemId) || {};
      const st = __consReqStatus(r2.id);
      const pend = st === "Pending Approval";
      const mine = __consIsRecipient(r2);
      const act = pend && mine ? `<button type="button" class="btn btn-sm btn-green" data-cons-approve="${r2.id}">Approve</button> <button type="button" class="btn btn-sm btn-red" data-cons-reject="${r2.id}">Reject</button>` : "";
      return `<tr><td>${esc(fmtDate(r2.date ? new Date(r2.date) : r2.createdAt))}</td><td>${esc(cat)}</td><td>${nameCell(it.name || "(unknown)")}</td><td>${r2.qty}</td><td>${esc(r2.byName || "")}</td><td>${__consStatusBadge(st)}${act ? " " + act : ""}</td></tr>`;
    }).join("");
  };
  box.innerHTML =
    `<div class="cons-item-head"><div><h3 style="margin:0">${esc(name || "")}</h3>
      <div style="color:var(--muted);font-size:.8rem">Type: ${toType === "unit" ? "Unit" : "Staff"} &middot; District: ${esc(dist)}</div></div></div>
    <div class="cons-toolbar" style="margin:10px 0">
      <input type="text" id="consRecipQ" class="input" placeholder="Search item / category..." style="max-width:220px">
      <input type="date" id="consRecipFrom" class="input" title="From date">
      <input type="date" id="consRecipTo" class="input" title="To date">
      <select id="consRecipSt" class="input" style="max-width:150px"><option value="">All Status</option><option>Pending Approval</option><option>Complete</option><option>Rejected</option></select>
      <button type="button" class="btn btn-sm btn-outline" id="consRecipExport">Export</button>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Category</th><th>Item</th><th>Quantity</th><th>Distributed By</th><th>Status</th></tr></thead>
    <tbody id="consRecipList"></tbody></table></div>`;
  $("#consRecipQ").addEventListener("input", () => { F.q = $("#consRecipQ").value; render(); });
  $("#consRecipFrom").value = "";
  $("#consRecipTo").value = "";
  $("#consRecipSt").value = "";
  $("#consRecipQ").value = "";
  render();
  $("#consRecipExport").onclick = () => {
    const data = [["Date", "Category", "Item", "Quantity", "Distributed By", "Status"]].concat(rows.map(r2 => [r2.date, __consItemCat(r2.categoryId), (__consItem(r2.itemId) || {}).name || "", String(r2.qty), r2.byName || "", __consReqStatus(r2.id)]));
    downloadBlob(data.map(r2 => r2.map(v => `"${String(v == null ? "" : v).replace(/"/g, '\"')}"`).join(",")).join("\r\n"), "text/csv", "consumable-recipient-history.csv");
  };
  openModal("#consRecipientModal");
}
/* ---- Exports ---- */
function __consCsv(name, rows) {
  downloadBlob(rows.map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '\"')}"`).join(",")).join("\r\n"), "text/csv", name);
}
function __consLedgerExportData() {
  const rows = __consRowsFilter(__consRows());
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  return {
    title: "Consumable Item Consume History",
    subtitle: (dist ? dist.name + " - " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " row" + (rows.length === 1 ? "" : "s") + ")",
    fileName: "consumable-items-transactions",
    cols: ["Item Category", "Item", "Quantity", "Date", "Distributed To", "Type", "Distributed By", "Status"],
    rows: rows.map(r =>
      [r.categoryName, r.itemName, String(r.t.qty), r.t.date || "", (r.t.toName || "") + (r.t.toType ? " (" + (r.t.toType === "unit" ? "Unit" : "Staff") + ")" : ""), r.t.type, r.t.byName || "", r.status])
  };
}
function exportConsLedgerExcel() { excelReport(__consLedgerExportData()); toast("Excel exported.", "success"); }
function exportConsLedgerWord() { wordReport(__consLedgerExportData()); toast("Word document exported.", "success"); }
function exportConsLedgerPDF() { pdfReport(__consLedgerExportData()); toast("PDF exported.", "success"); }
function printConsLedger() { printReport(__consLedgerExportData()); }
function __consDistExportData() {
  const rows = __consDistFilter(__consDistRows());
  const dist = getDistricts().find(d => d.id === activeDistrictId);
  return {
    title: "Distribution by Location",
    subtitle: (dist ? dist.name + " - " : "") + "Generated " + new Date().toLocaleString() + " (" + rows.length + " row" + (rows.length === 1 ? "" : "s") + ")",
    fileName: "consumable-distribution-by-location",
    cols: ["Recipient", "Type", "Category", "Item", "Quantity", "Date", "Distributed By", "Status"],
    rows: rows.map(r =>
      [r.t.toName || "", r.t.toType === "unit" ? "Unit" : "Staff", r.categoryName, r.itemName, String(r.t.qty), r.t.date || "", r.t.byName || "", r.status])
  };
}
function exportConsDistExcel() { excelReport(__consDistExportData()); toast("Excel exported.", "success"); }
function exportConsDistWord() { wordReport(__consDistExportData()); toast("Word document exported.", "success"); }
function exportConsDistPDF() { pdfReport(__consDistExportData()); toast("PDF exported.", "success"); }
function printConsDist() { printReport(__consDistExportData()); }
/* ---- Filter toolbar bindings ---- */
function __consBindToolbar() {
  const bind = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => { __pgReset("cons"); renderConsLedger(); }); };
  const bindV = (id, prop, ev) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => { __consF[prop] = el.value; __pgReset("cons"); renderConsLedger(); }); };
  bindV("consSearch", "q", "input");
  bindV("consCatFilter", "cat", "change");
  bindV("consItemFilter", "item", "change");
  bindV("consStatusFilter", "status", "change");
  bindV("consLocFilter", "loc", "change");
  bindV("consDateFrom", "from", "change");
  bindV("consDateTo", "to", "change");
  const bindD = (id, prop, ev) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => { __consdF[prop] = el.value; __pgReset("consDist"); renderConsDistByLoc(); }); };
  bindD("consdSearch", "q", "input");
  bindD("consdLoc", "loc", "change");
  bindD("consdCat", "cat", "change");
  bindD("consdItem", "item", "change");
  bindD("consdBy", "by", "input");
  bindD("consdFrom", "from", "change");
  bindD("consdTo", "to", "change");
}
function __consRefreshFilterOptions() {
  const catSel = $("#consCatFilter");
  if (catSel) { const v = catSel.value; catSel.innerHTML = `<option value="">All Categories</option>` + __byName(getConsCats()).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""); catSel.value = v; }
  const itemSel = $("#consItemFilter");
  if (itemSel) { const v = itemSel.value; itemSel.innerHTML = `<option value="">All Items</option>` + __byName(getConsItems()).map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join(""); itemSel.value = v; }
  const locSel = $("#consLocFilter");
  if (locSel) {
    const v = locSel.value;
    locSel.innerHTML = `<option value="">All Locations</option>`
      + __byName(getLocations()).map(l => `<option value="unit:${l.id}">${esc(l.name)}</option>`).join("")
      + __byName(getUsers().filter(u => u.districtId === activeDistrictId && u.role !== "devadmin" && u.role !== "ig")).map(u => `<option value="staff:${u.id}">${esc(u.name)} (Staff)</option>`).join("");
    locSel.value = v;
  }
  const dLocSel = $("#consdLoc");
  if (dLocSel) {
    const v = dLocSel.value;
    dLocSel.innerHTML = `<option value="">All Locations</option>`
      + __byName(getLocations()).map(l => `<option value="unit:${l.id}">${esc(l.name)}</option>`).join("")
      + __byName(getUsers().filter(u => u.districtId === activeDistrictId && u.role !== "devadmin" && u.role !== "ig")).map(u => `<option value="staff:${u.id}">${esc(u.name)} (Staff)</option>`).join("");
    dLocSel.value = v;
  }
  const sLocSel = $("#consStockLoc");
  if (sLocSel) {
    const v = sLocSel.value;
    if (__consIsAdminView()) {
      sLocSel.disabled = false;
      sLocSel.innerHTML = `<option value="">All Locations</option>`
        + __byName(getLocations()).map(l => `<option value="unit:${l.id}">${esc(l.name)}</option>`).join("");
      /* (Staff) entries removed from Item Consume location list (2026.09.192) */
      sLocSel.value = v;
      if (sLocSel.selectedIndex < 0) sLocSel.value = "";
    } else {
      const k = __consOwnLocKey();
      sLocSel.disabled = true;
      sLocSel.innerHTML = `<option value="${esc(k)}">${esc(__consOwnLocLabel())}</option>`;
      sLocSel.value = k;
    }
  }
  const dCatSel = $("#consdCat");
  if (dCatSel) { const v = dCatSel.value; dCatSel.innerHTML = `<option value="">All Categories</option>` + __byName(getConsCats()).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""); dCatSel.value = v; }
  const dItemSel = $("#consdItem");
  if (dItemSel) { const v = dItemSel.value; dItemSel.innerHTML = `<option value="">All Items</option>` + __byName(getConsItems()).map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join(""); dItemSel.value = v; }
}
/* ---- Event delegation ---- */
document.addEventListener("click", (e) => {
  const view = e.target.closest("[data-cons-view]");
  if (view) { if (window.openItemProfile) openItemProfile(view.dataset.consView); else openConsItem(view.dataset.consView); return; }
  const txnv = e.target.closest("[data-cons-txnview]");
  if (txnv) { openConsTxnDetails(txnv.dataset.consTxnview); return; }
  const itemBtn = e.target.closest("[data-cons-item]");
  if (itemBtn) { if (window.openItemProfile) openItemProfile(itemBtn.dataset.consItem); else openConsItem(itemBtn.dataset.consItem); return; }
  const recipBtn = e.target.closest("[data-cons-recipient]");
  if (recipBtn) { openConsRecipient(recipBtn.dataset.consRecipientType, recipBtn.dataset.consRecipient.split(":")[1] === undefined ? recipBtn.dataset.consRecipient : recipBtn.dataset.consRecipient.split(":")[1], recipBtn.dataset.consRecipientName); return; }
  const dist = e.target.closest("[data-cons-dist]");
  if (dist) { openConsDist(dist.dataset.consDist); return; }
  const loss = e.target.closest("[data-cons-loss]");
  if (loss) { openConsLoss(loss.dataset.consLoss); return; }
  const edit = e.target.closest("[data-cons-edit]");
  if (edit) { openConsEdit(edit.dataset.consEdit); return; }
  const appr = e.target.closest("[data-cons-approve]");
  if (appr) {
    const req = getConsTxns().find(t => t.id === appr.dataset.consApprove);
    const item = req ? (__consItem(req.itemId) || {}) : {};
    if (!confirm(`Are you sure you want to approve receipt of ${req ? req.qty : "?"} ${esc(item.name || "item(s)")}?`)) return;
    __consApplyDecision(appr.dataset.consApprove, true, "");
    return;
  }
  const rej = e.target.closest("[data-cons-reject]");
  if (rej) { openConsReject(rej.dataset.consReject); return; }
  const recip = e.target.closest("[data-cons-recipient]");
  if (recip) { openConsRecipient(recip.dataset.consRecipientType || "unit", (recip.dataset.consRecipient || "").split(":").pop(), recip.dataset.consRecipientName || ""); return; }
});
/* ---- Init ---- */
document.addEventListener("DOMContentLoaded", () => {
  $("#consAddBtn")?.addEventListener("click", openConsAdd);
$$("[data-constab]").forEach(t => t.addEventListener("click", () => __consShowTab(t.dataset.constab)));
$("#consStockSearch")?.addEventListener("input", renderConsStock);
window.__msCatCS = bindMultiCombobox("consStockCatInput", "consStockCatMenu", "consStockCat", renderConsStock);
$("#consStockType")?.addEventListener("change", renderConsStock);
  $("#consStockLoc")?.addEventListener("change", renderConsStock);
  $("#consStockClear")?.addEventListener("click", () => {
    const s = $("#consStockSearch"); if (s) s.value = "";
    const c = $("#consStockCat"); if (c) {
      if (c.multiple) {
        Array.prototype.forEach.call(c.options, o => { o.selected = false; });
      } else {
        c.value = "";
      }
    }
    if (window.__msCatCS && window.__msCatCS.refresh) window.__msCatCS.refresh();
    const ty = $("#consStockType"); if (ty) ty.value = "all";
    const l = $("#consStockLoc"); if (l && !l.disabled) l.value = "";
    renderConsStock();
  });
$("#consStockExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#consStockExportMenu").classList.toggle("hidden"); });
$$("#consStockExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
  $("#consStockExportMenu").classList.add("hidden");
  const t = b.dataset.export;
  if (t === "print") printConsStock();
  else if (t === "pdf") exportConsStockPDF();
  else if (t === "excel") exportConsStockExcel();
  else if (t === "word") exportConsStockWord();
}));
  $("#consExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#consExportMenu").classList.toggle("hidden"); });
  $$("#consExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#consExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printConsLedger();
    else if (t === "pdf") exportConsLedgerPDF();
    else if (t === "excel") exportConsLedgerExcel();
    else if (t === "word") exportConsLedgerWord();
  }));
  $("#consdExportBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#consdExportMenu").classList.toggle("hidden"); });
  $$("#consdExportMenu [data-export]").forEach(b => b.addEventListener("click", () => {
    $("#consdExportMenu").classList.add("hidden");
    const t = b.dataset.export;
    if (t === "print") printConsDist();
    else if (t === "pdf") exportConsDistPDF();
    else if (t === "excel") exportConsDistExcel();
    else if (t === "word") exportConsDistWord();
  }));
  $("#consAddForm")?.addEventListener("submit", saveConsAdd);
$("#consAddItemBtn")?.addEventListener("click", addConsRow);
$("#consRows")?.addEventListener("click", __consRowsClick);
$("#consRows")?.addEventListener("change", __consRowsChange);
  $("#consDistForm")?.addEventListener("submit", saveConsDist);
  $("#consLossForm")?.addEventListener("submit", saveConsLoss);
  $("#consEditForm")?.addEventListener("submit", saveConsEdit);
  $("#consRejectForm")?.addEventListener("submit", saveConsReject);
  $("#consItemEditBtn")?.addEventListener("click", () => openConsEdit(__consViewItemId));
  __consBindToolbar();
});

/* ==================== DEV ADMIN: DISTRICTS & USERS ==================== */
// dausers carries either daId (opened from a District Admin row) or districtId
// (opened from a district row) - renderDevDaUsers reads whichever is set.
const __devPg = { dists: { q: "" }, igs: { q: "", active: null }, igDists: null, users: { q: "", type: "" }, dausers: { daId: null, districtId: null, q: "", type: "" }, adminLocs: { q: "" }, adminUsers: { q: "", type: "" } };
let __devBound = false;
const __devLocTypes = [
  // above the districts: one PHQ for the state, then the IG Ranges
  { v: "phq", label: "PHQ" },
  { v: "igRange", label: "IG Range" },
  // inside a district
  { v: "district", label: "District HQ" },
  { v: "otherHq", label: "Other HQ" },
  { v: "station", label: "Police Station" },
  { v: "post", label: "Police Post" },
  { v: "mhc", label: "MHC Store" },
  { v: "staff", label: "Staff" },
  { v: "office", label: "Office" },
];
function __devLocLabel(t) { const x = __devLocTypes.find(y => y.v === t); return x ? x.label : (t || "—"); }
function __devDistName(id) { const d = getDistricts().find(x => x.id === id); return d ? d.name : "—"; }
function __devLocName(districtId, locId) { const l = getLocationsForDistrict(districtId).find(x => x.id === locId); return l ? l.name : "—"; }
function __devDistUsers(districtId) { return getUsers().filter(u => u.districtId === districtId && u.role !== "admin" && u.role !== "devadmin" && u.role !== "ig"); }
function __devBtnLoading(btn, on) { if (!btn) return; btn.disabled = !!on; btn.classList.toggle("loading", !!on); }

function __devApplyRoute() {
  const h = (location.hash || "").replace(/^#/, "");
  // An Inspector General is not a Developer Admin, so without this branch every
  // page they own bounced to the dashboard on reload: #dev-ig-dists and
  // #dev-dist-users/... both start with "dev-" and were sent away below.
  if (isIg()) {
    if (h === "dev-ig-dists") { openIgDistricts(); return true; }
    const mDist = h.match(/^dev-dist-users\/(.+)$/);
    if (mDist) { openDevDistUsers(mDist[1]); return true; }
    if (h.indexOf("dev-") === 0) { switchTab("dashboard"); return true; }
  }
  if (!isDevAdmin()) {
    if (isAdmin() && currentUser.districtId) {
      if (h === "admin-locs") { openAdminLocs(); return true; }
      if (h === "admin-users") { openAdminUsers(); return true; }
    }
    if (h.indexOf("dev-") === 0) { switchTab("dashboard"); return true; }
    return false;
  }
  if (h === "dev-districts") { switchTab("manage-districts"); return true; }
  if (h === "dev-igs") { switchTab("manage-igs"); return true; }
  if (h === "dev-users") { switchTab("manage-users"); return true; }
  if (h === "dev-igs") { switchTab("manage-igs"); return true; }
  const mIg = h.match(/^dev-igdists\/(.+)$/);
  if (mIg) {
    const igU = getUsers().find(u => u.id === mIg[1] && u.role === "ig");
    if (igU) { __devPg.igDists = { igId: igU.id, q: "" }; switchTab("manage-districts"); return true; }
  }
  const m = h.match(/^dev-dausers\/(.+)$/);
  if (m) {
    const da = getUsers().find(u => u.id === m[1] && u.role === "admin");
    if (da) { __devPg.dausers = { daId: da.id, q: "", type: "" }; switchTab("dausers"); return true; }
  }
  if (h.indexOf("dev-") === 0) { switchTab("dashboard"); return true; }
  return false;
}

/* An IG's districts page gets a Manage button on every district, so the IG can
   open a district and work inside it without leaving the page. Only the
   districts of the logged-in IG's own range are ever listed. */
function igLoggedInRangeId() {
  const u = currentUser;
  return u && u.role === "ig" ? u.rangeId : null;
}
function igLoggedInDistricts() {
  const rid = igLoggedInRangeId();
  if (rid) {
    const byRange = districtsInRange(rid);
    if (byRange.length) return byRange;
  }
  // A district only carries a range from the point the hierarchy was added to
  // it. A database created before that has no rangeId on the district record,
  // so matching on it finds nothing and the Inspector General is told their
  // range has no district under it - while the account plainly names the
  // districts it answers for. Where the range cannot answer, the account's own
  // list is the authority, and the same is true of an IG whose range was never
  // set. Returning nothing is only correct when neither can say.
  const own = igDistrictsOf(currentUser || {});
  if (own.length) {
    const found = getDistricts().filter(d => d && own.indexOf(d.id) >= 0);
    if (found.length) return found;
  }
  return [];
}
/* ==================== MANAGE IG ADMINS PAGE ==================== */
/* One tab per Inspector General, so each account and the districts it answers
   for sit side by side instead of in one long list. Only the Developer Admin
   reaches this page: an IG account is theirs to create, change and remove. */
function igDistrictsOf(u) {
  if (u && u.role === "ig" && u.rangeId) {
    return districtsInRange(u.rangeId).map(function(d) { return d.id; });
  }
  const list = Array.isArray(u.districtIds) && u.districtIds.length ? u.districtIds : (u && u.districtId ? [u.districtId] : []);
  return list.filter(Boolean);
}
function renderDevIgs() {
  const box = $("#devIgList");
  const tabsBox = $("#devIgTabs");
  const gapBox = $("#devIgGap");
  const tbody = $("#devIgBody");
  if (!box && !tbody) return;
  const dists = getDistricts();
  const nameOf = id => { const d = dists.find(x => x.id === id); return d ? d.name : id; };
  const allUsers = getUsers();
  const allItems = getAllItems();
  let igs = allUsers.filter(u => u.role === "ig");
  const total = igs.length;
  const q = ((__devPg.igs && __devPg.igs.q) || "").trim().toLowerCase();
  if (q) {
    igs = igs.filter(u =>
      (u.name || "").toLowerCase().indexOf(q) !== -1
      || (u.username || "").toLowerCase().indexOf(q) !== -1
      || igDistrictsOf(u).some(d => nameOf(d).toLowerCase().indexOf(q) !== -1));
  }
  const countEl = $("#devIgCount");
  if (countEl) countEl.textContent = q ? igs.length + " of " + total : String(total);
  if (tabsBox) tabsBox.innerHTML = "";
  // An IG Range with no IG on it is the one thing this page cannot show in the
  // table: there is no account to put a row for. Listing it above the table is what
  // makes a range that was set up but never staffed visible instead of invisible.
  const unstaffed = getIgRanges().filter(function(r) {
    return !allUsers.some(function(u) { return u.role === "ig" && u.rangeId === r.id; });
  });
  if (gapBox) {
    gapBox.innerHTML = unstaffed.length
      ? '<div class="ig-gap">' +
          '<div class="ig-gap-head">' + unstaffed.length + ' IG Range' + (unstaffed.length > 1 ? 's have' : ' has') +
            ' no Inspector General yet</div>' +
          unstaffed.map(function(r) {
            const rd = districtsInRange(r.id);
            return '<div class="ig-gap-row">' +
              '<span class="ig-gap-name">' + esc(r.name) + '</span>' +
              '<span class="ig-gap-dists">' + (rd.length
                ? esc(rd.map(function(d) { return d.name; }).join(', '))
                : 'no district under it yet') + '</span>' +
              '<div style="display:flex;gap:6px;"><button type="button" class="btn btn-sm btn-dark" data-devig-new-range="' + esc(r.id) + '">Add IG Admin</button>' +
              '<button type="button" class="btn btn-sm btn-red" data-devig-del-range="' + esc(r.id) + '">Delete Range</button></div>' +
            '</div>';
          }).join("") +
        '</div>'
      : "";
  }
  if (!igs.length) {
    if (box) box.innerHTML = '<div class="dev-empty"><p>' + (q ? "No IG Admin matches that search." : "No IG Admins yet.") + '</p>'
      + '<p class="dev-empty-sub">' + (q ? "Clear the search box to see the rest." : 'Click "+ Add New IG Admin" to create the first one.') + '</p></div>';
    if (tbody) tbody.innerHTML = "";
    return;
  }
  // One row per IG, all of them visible at once. The tab strip that used to hide
  // all but one of them at a time is gone - a list you can scan beats a tab you
  // have to remember to click.
  const rows = igs.map(function(u) {
    const dIds = igDistrictsOf(u);
    const nItems = dIds.reduce(function(n, d) { return n + ((allItems[d] || []).length); }, 0);
    const nUsers = dIds.reduce(function(n, d) { return n + allUsers.filter(x => x.districtId === d).length; }, 0);
    // An IG that still answers for a district cannot be deleted: the district would
    // be left with nobody above it until the scope is cleared first.
    const delBtn = '<button type="button" class="btn btn-sm btn-red" data-devig-del="' + esc(u.id) + '">Delete</button>';
    // The districts are shown for reference only - the way into a district is the
    // Districts button, so a name in this column is plain text, not a second door
    // into the same place that would go stale the moment the range changes.
    const names = dIds.length
      ? dIds.map(function(d) { return esc(nameOf(d)); }).join(", ")
      : '<span class="ig-scope-none">No district assigned</span>';
    return '<tr>' +
      '<td data-th="Name"><span class="dev-u-name">' + esc(u.name) + '</span></td>' +
      '<td data-th="Username"><span class="dev-code">' + esc(u.username) + '</span></td>' +
      '<td data-th="IG Range">' + (u.rangeId ? esc(rangeNameOf(u.rangeId)) : '<span class="dev-muted">-</span>') + '</td>' +
      '<td data-th="Districts">' + names + '</td>' +
      '<td data-th="Users">' + nUsers + '</td>' +
      '<td data-th="Items">' + nItems + '</td>' +
      '<td data-th="Actions" class="dev-acts">' +
        '<button type="button" class="btn btn-sm btn-dark" data-devig-dists="' + esc(u.id) + '">Districts</button>' +
        '<button type="button" class="btn btn-sm btn-outline" data-devig-edit="' + esc(u.id) + '">Edit</button>' +
        delBtn +
      '</td></tr>';
  }).join("");
  if (tbody) tbody.innerHTML = rows;
  if (box) box.innerHTML = "";
}
function openDevIgs() {
  if (!isDevAdmin()) return;
  // opening the IG list drops any scoped-districts view, so Back from an IG's
  // districts never lands on a stale page
  __devPg.igDists = null;
  history.replaceState(null, "", "#dev-igs");
  switchTab("manage-igs");
}

// Clicking an IG's district chip takes the Developer Admin into that district.
function devDeleteIg(id) {
  if (!isDevAdmin()) return toast("Only Developer Admin can delete an IG Admin.", "error");
  const u = getUsers().find(x => x.id === id);
  if (!u) return;
  if (!confirm("Delete the IG Admin \"" + u.username + "\"? (The IG Range will become unstaffed; districts remain untouched)")) return;
  saveUsers(getUsers().filter(x => x.id !== id));
  __audit("IG Admin Deleted", u.name + " (" + u.username + ")", { entity: "User" });
  toast("IG Admin deleted.", "success");
  renderDevIgs();
  renderUsers();
}

function devDeleteRange(rangeId) {
  if (!isDevAdmin()) return toast("Only Developer Admin can delete an IG Range.", "error");
  const r = getRangeById(rangeId);
  if (!r) return toast("IG Range not found.", "error");
  const assignedDistricts = getDistricts().filter(d => d.rangeId === rangeId);
  const igUser = getUsers().find(u => u.role === "ig" && u.rangeId === rangeId);
  let promptMsg = 'Delete IG Range "' + r.name + '"?';
  if (assignedDistricts.length) {
    promptMsg += '\nThere are ' + assignedDistricts.length + ' district(s) under this range (' + assignedDistricts.map(d => d.name).join(", ") + '). They will remain untouched and safe, detached from any IG range.';
  }
  if (igUser) {
    promptMsg += '\nThe IG Admin account "' + igUser.username + '" will also be deleted.';
  }
  if (!confirm(promptMsg)) return;

  // 1. Districts under this IG Range remain untouched and unchanged!
  const ds = getDistricts();
  ds.forEach(d => {
    if (d.rangeId === rangeId) {
      d.rangeId = "";
    }
  });
  saveDistricts(ds);

  // 2. Remove IG Admin if one existed
  if (igUser) {
    saveUsers(getUsers().filter(u => u.id !== igUser.id));
  } else {
    syncAllIgScopes(ds);
  }

  // 3. Remove IG Range from state locations
  const allLocations = getAllLocations();
  const hqLocs = allLocations[HQ_SCOPE_KEY] || [];
  allLocations[HQ_SCOPE_KEY] = hqLocs.filter(l => l.id !== rangeId);
  saveAllLocations(allLocations);

  toast('IG Range "' + r.name + '" deleted. Districts remain untouched.', "success");
  __audit("IG Range Deleted", r.name, { entity: "Location" });

  renderDevIgs();
  renderDevDistricts();
  renderDistricts();
  renderDistrictSelector();
  if (typeof renderAdminLocs === "function") renderAdminLocs();
}

/* ==================== IG ADMIN FORM (form only, no user list) ==================== */
// The districts an IG holds are the districts of its IG Range. Picking a range
// rebuilds the list, so the pair can never drift apart in the form.
// which range a district sits under - used to preselect the right one
function districtRangeId(districtId) {
  if (!districtId) return "";
  const d = getDistricts().find(function(x) { return x.id === districtId; });
  return d ? d.rangeId : "";
}
function igfApplyRange() {
  const rangeId = $("#igfHqLoc") ? $("#igfHqLoc").value : "";
  const inRange = rangeId ? districtsInRange(rangeId) : [];
  __igDdSet("igf", inRange.map(function(d) { return d.id; }));
  if (!inRange.length) {
    const s = $("#igfDistrictsSummary");
    if (s) s.textContent = "This IG Range has no district under it yet";
  }
  return rangeId;
}

function buildIgFormDistricts(selected) {
  __igDdSet("igf", Array.isArray(selected) ? selected : []);
}
function readIgFormDistricts() {
  return __igDdRead("igf");
}

function openIgForm(editId, presetRangeId) {
  if (!isDevAdmin()) return toast("Only the Developer Admin can manage IG Admins.", "error");
  const u = editId ? getUsers().find(x => x.id === editId) : null;
  if (editId && !u) return;
  if (u && u.role !== "ig") return toast("That account is not an IG Admin.", "error");
  $("#igForm").reset();
  $("#igfEditId").value = u ? u.id : "";
  $("#igfUsername").value = u ? u.username : "";
  $("#igfPassword").value = "";
  $("#igfName").value = u ? u.name : "";
  $("#igfMobile").value = u ? u.mobile : "";
  const ranges = getIgRanges();
  const rangeSel = $("#igfHqLoc");
  rangeSel.innerHTML = ranges.length
    ? ranges.map(function(r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join("")
    : '<option value="">No IG Range yet - create one in Manage Locations</option>';
  if (u && u.rangeId) rangeSel.value = u.rangeId;
  const home = (u && u.rangeId) || presetRangeId
    || (getRangeById(districtRangeId(u ? u.districtId : activeDistrictId)) || {}).id
    || (ranges[0] && ranges[0].id) || "";
  if (home) rangeSel.value = home;
  const currentAssigned = districtsInRange(home).map(function(d) { return d.id; });
  buildIgFormDistricts(currentAssigned);
  __igDdOpen("igf", false);
  $("#igModalTitle").textContent = u ? "Edit IG Admin" : "Add New IG Admin";
  $("#igfSubmit").textContent = u ? "Update IG Admin" : "Add IG Admin";
  $("#igfCancel").style.display = u ? "" : "none";
  openModal("#igModal");
}

function submitIgForm(e) {
  if (e) e.preventDefault();
  if (!isDevAdmin()) return toast("Only the Developer Admin can manage IG Admins.", "error");
  const editId = $("#igfEditId").value;
  const username = $("#igfUsername").value.trim();
  const password = $("#igfPassword").value;
  const name = $("#igfName").value.trim();
  const mobile = $("#igfMobile").value.trim();
  const rangeId = $("#igfHqLoc").value;
  if (!username || !name || !mobile) return toast("Fill all required fields.", "error");
  if (!/^\d{10}$/.test(mobile)) return toast("Mobile number must be exactly 10 digits.", "error");
  if (!rangeId) return toast("Choose the IG Range this Inspector General will hold.", "error");

  const selectedDistIds = readIgFormDistricts();
  const allDistricts = getDistricts();
  const newRangeName = rangeNameOf(rangeId) || "selected IG Range";

  // Check each selected district if it is already in another range
  const finalDistIds = [];
  let distsModified = false;
  for (const did of selectedDistIds) {
    const d = allDistricts.find(x => x.id === did);
    if (!d) continue;
    if (d.rangeId && d.rangeId !== rangeId) {
      const curRangeName = rangeNameOf(d.rangeId) || "another IG Range";
      const ok = confirm('District "' + d.name + '" is already in ' + curRangeName + '. Still want to send it to ' + newRangeName + '?');
      if (!ok) {
        continue;
      }
      d.rangeId = rangeId;
      distsModified = true;
    } else if (d.rangeId !== rangeId) {
      d.rangeId = rangeId;
      distsModified = true;
    }
    finalDistIds.push(did);
  }

  // Also check if any district previously in this range was unchecked
  const previouslyInRange = allDistricts.filter(d => d.rangeId === rangeId);
  for (const d of previouslyInRange) {
    if (finalDistIds.indexOf(d.id) === -1) {
      d.rangeId = "";
      distsModified = true;
    }
  }

  if (distsModified) {
    saveDistricts(allDistricts);
  }

  const districtIds = finalDistIds;
  const home = districtIds.length ? districtIds[0] : "";
  const users = getUsers();
  if (editId) {
    const u = users.find(x => x.id === editId);
    if (!u) return toast("User not found.", "error");
    if (users.some(x => x.username === username && x.id !== editId)) return toast("Username already taken.", "error");
    u.username = username;
    if (password) u.password = password;
    u.name = name;
    u.mobile = mobile;
    u.state = STATE_NAME;
    u.locationType = "igRange";
    u.locationId = rangeId;
    u.rangeId = rangeId;
    u.districtId = home;
    u.districtIds = districtIds.slice();
    toast("IG Admin updated.", "success");
  } else {
    if (!password) return toast("Password is required.", "error");
    if (users.some(x => x.username === username)) return toast("Username already exists.", "error");
    users.push({
      id: uid(), username: username, password: password, role: "ig", name: name, mobile: mobile,
      state: STATE_NAME, locationType: "igRange", locationId: rangeId, rangeId: rangeId,
      districtId: home, districtIds: districtIds.slice(),
      createdAt: Date.now()
    });
    toast("IG Admin added.", "success");
  }
  saveUsers(users);
  syncAllIgScopes(allDistricts);
  __audit(editId ? "IG Admin Updated" : "IG Admin Created", name + " (" + districtIds.length + " district(s))", { entity: "User" });
  closeModal("#igModal");
  renderDevIgs();
  renderDevDistricts();
  renderDistricts();
  renderDistrictSelector();
  renderUsers();
}
// Both open the IG form on its own - the user list is not part of it.
function devAddIgAdmin() {
  if (!isDevAdmin()) return;
  openIgForm(null);
}

function devEditIg(id) {
  if (!isDevAdmin()) return;
  openIgForm(id);
}

function devGoIgDistrict(districtId) {
  if (!isDevAdmin()) return;
  if (!getDistricts().some(d => d.id === districtId)) return;
  switchDistrict(districtId);
  toast("Opened " + ((getDistricts().find(d => d.id === districtId) || {}).name || districtId), "success");
}
/* Opens the Manage Districts page scoped to one IG, so it looks and behaves
   exactly like the Developer Admin's own districts page - same cards, same
   counts, same search - but shows only the districts that IG administers.
   The IG's own districts are chosen by a Developer Admin, never from this page,
   so creating and deleting districts stays hidden here. */
function devIgDistricts(id) {
  if (!isDevAdmin()) return;
  const u = getUsers().find(x => x.id === id);
  if (!u) return toast("IG Admin not found.", "error");
  __devPg.igDists = { igId: id, q: "" };
  __devPg.dists.q = "";
  history.replaceState(null, "", "#dev-igdists/" + id);
  switchTab("manage-districts");
}

// Back from an IG's districts returns to the IG list, not to the dashboard.
function devDistrictsBack() {
  // A logged-in IG has no IG list to go back to, so it lands on the dashboard
  // it came from instead of a page only the Developer Admin may open.
  if (isIg()) {
    __devPg.igDists = null;
    history.replaceState(null, "", "");
    return switchTab("dashboard");
  }
  if (!isDevAdmin()) return;
  if (__devPg.igDists) {
    __devPg.igDists = null;
    history.replaceState(null, "", "#dev-igs");
    return openDevIgs();
  }
  __devClosePage();
}
/* The IG's own Districts page: the same view the Developer Admin gets, with the
/* The IG's own Districts page: the same view the Developer Admin gets, with the
   list narrowed to the districts of the IG's range. */
function openIgDistricts() {
  if (!isIg()) return;
  if (!igLoggedInDistricts().length) {
    return toast("Your IG Range has no district under it yet. Ask a Developer Admin to check it.", "error");
  }
  __devPg.igDists = { igId: currentUser.id, q: "" };
  __devPg.dists.q = "";
  history.replaceState(null, "", "#dev-ig-dists");
  switchTab("manage-districts");
}

function openDevDistricts() {
  if (!isDevAdmin()) return;
  history.replaceState(null, "", "#dev-districts");
  switchTab("manage-districts");
}
function openDevUsers() {
  if (!isDevAdmin()) return;
  history.replaceState(null, "", "#dev-users");
  switchTab("manage-users");
}
function openDevDaUsers(daId) {
  if (!isDevAdmin()) return;
  // districtId cleared for the same reason as in openDevDistUsers.
  __devPg.dausers = { daId, districtId: null, q: "", type: "" };
  history.replaceState(null, "", "#dev-dausers/" + daId);
  switchTab("dausers");
}

/* The same users page, opened from a district row rather than from a District
   Admin row. It is the same table, the same search box, the same Edit and
   Delete - only what decides the list differs: a District Admin's page lists
   the users of the district that admin sits in, this lists the users of the
   district that was clicked. The page already takes its Edit and Delete
   buttons from the row, so reusing it is what keeps the two identical. */
function openDevDistUsers(districtId) {
  const d = getDistricts().find(x => x.id === districtId);
  if (!d) return toast("District not found.", "error");
  if (!isDevAdmin() && !isIg()) return toast("Only Developer Admin or IG Admin can do this.", "error");
  // An Inspector General must not be able to walk out of their own range by
  // reaching this from anywhere else in the app.
  if (!inDistrictScope(districtId)) return toast("That district is not in your IG Range.", "error");
  // daId is cleared explicitly: renderDevDaUsers prefers daId when it is set, so
  // a leftover value from a District Admin page would quietly list the wrong
  // district's users under this district's name.
  __devPg.dausers = { daId: null, districtId, q: "", type: "" };
  history.replaceState(null, "", "#dev-dist-users/" + districtId);
  switchTab("dausers");
}
function __devClosePage() {
  if (location.hash && location.hash.indexOf("#dev-") === 0) history.replaceState(null, "", location.pathname + location.search);
  switchTab("dashboard");
}

/* ==================== MANAGE DISTRICTS PAGE ==================== */
function renderDevDistricts() {
  const box = $("#devDistList");
  if (!box) return;
  // When this page was opened from an IG, it shows that IG's districts only, and
  // the header says whose they are.
  const igU = __devPg.igDists ? getUsers().find(u => u.id === __devPg.igDists.igId && u.role === "ig") : null;
  if (!__devPg.igDists || !igU) __devPg.igDists = null;
  const titleEl = $("#devDistTitle");
  if (titleEl) titleEl.textContent = igU ? "Districts under " + igU.name : "Manage Districts";
  const addBtn = $("#devAddDistBtn");
  if (addBtn) addBtn.style.display = "";
  let districts = getDistricts();
  if (igU) {
    // An IG's reach is its IG Range, so the list comes from the range rather
    // than from a stored list that could drift out of step with it.
    districts = districtsInRange(igU.rangeId);
  } else if (isIg()) {
    // A logged-in IG sees its own range and nothing else.
    districts = igLoggedInDistricts();
    const t = $("#devDistTitle");
    if (t) t.textContent = "Districts in your IG Range";
  }
  const dq = ((__devPg.dists && __devPg.dists.q) || "").trim().toLowerCase();
  // the badge counts the whole list, so "2 of 4" reads as a filter not a loss
  const total = districts.length;
  if (dq) districts = districts.filter(d => (d.name || "").toLowerCase().indexOf(dq) !== -1 || (d.code || "").toLowerCase().indexOf(dq) !== -1 || (d.headquarters || "").toLowerCase().indexOf(dq) !== -1);
  const allLocs = getAllLocations();
  const allUsers = getUsers();
  const allItems = getAllItems();
  // The count in the toolbar is the whole list, not the filtered one, so the
  // number does not jump about while somebody is typing in the search box.
  const countEl = $("#devDistCount");
  if (countEl) countEl.textContent = dq ? districts.length + " of " + total : String(total);
  if (!districts.length) {
    const forIg = isIg();
    box.innerHTML = forIg
      ? '<div class="dev-empty"><p>No district under your IG Range yet.</p>'
        + '<p class="dev-empty-sub">Add one here and give it your IG Range, so it lands where you look after it.</p></div>'
      : igU
        ? '<div class="dev-empty"><p>No district assigned to this IG.</p><p class="dev-empty-sub">Use Edit to tick the districts this IG should handle.</p></div>'
        : '<div class="dev-empty"><p>No districts yet.</p><p class="dev-empty-sub">Click "+ Add New District" to create the first one.</p></div>';
    const tb = $("#devDistBody");
    if (tb) tb.innerHTML = "";
    return;
  }
  const rows = districts.map(function(d) {
    const locs = allLocs[d.id] || [];
    const nUsers = allUsers.filter(function(u) { return u.districtId === d.id; }).length;
    const nItems = (allItems[d.id] || []).length;
    let delBlock = "";
    if (nUsers > 0) delBlock = "This district cannot be deleted because users are still assigned to it.";
    else if (nItems > 0) delBlock = "This district cannot be deleted because it still has items.";
    else if (total <= 1) delBlock = "The last district cannot be deleted.";
    const delBtn = delBlock
      ? '<button type="button" class="btn btn-sm btn-red" disabled title="' + esc(delBlock) + '">Delete</button>'
      : '<button type="button" class="btn btn-sm btn-red" data-devdd-del="' + d.id + '">Delete</button>';
    return '<tr>' +
      '<td data-th="District"><span class="dev-u-name">' + esc(d.name) + '</span></td>' +
      '<td data-th="Code"><span class="dev-code">' + esc(d.code) + '</span></td>' +
      '<td data-th="Headquarters">' + esc(d.headquarters) + '</td>' +
      '<td data-th="IG Range">' + (d.rangeId ? esc(rangeNameOf(d.rangeId)) : '<span class="dev-muted">-</span>') + '</td>' +
      '<td data-th="Locations">' + locs.length + '</td>' +
      '<td data-th="Users">' + nUsers + '</td>' +
      '<td data-th="Items">' + nItems + '</td>' +
      '<td data-th="Actions" class="dev-acts">' +
        '<button type="button" class="btn btn-sm btn-dark" data-devdu-users="' + d.id + '">Users</button>' +
        '<button type="button" class="btn btn-sm btn-loc" data-devdd-locs="' + d.id + '">Locations</button>' +
        '<button type="button" class="btn btn-sm btn-outline" data-devdd-edit="' + d.id + '">Edit</button>' +
        (d.rangeId ? '<button type="button" class="btn btn-sm btn-outline" style="border-color:#f59e0b;color:#d97706;" data-devdd-detach="' + d.id + '" title="Remove from ' + esc(rangeNameOf(d.rangeId)) + '">Remove from Range</button>' : '') +
        delBtn +
      '</td></tr>';
  }).join("");
  const tb = $("#devDistBody");
  if (tb) tb.innerHTML = rows;
  // the table carries the list now; the card container only shows the empty state
  box.innerHTML = "";
}

function openDevDistModal(editId) {
  $("#devDistErr").textContent = "";
  $("#devDistForm").reset();
  $("#ddEditId").value = editId || "";
  $("#devDistModalTitle").textContent = editId ? "Edit District" : "Add New District";
  $("#devDistSubmit").textContent = editId ? "Update District" : "Add District";
  const ranges = getIgRanges();
  const rangeSel = $("#ddRange");
  if (rangeSel) {
    let opts = '<option value="">-- No IG Range (Unassigned) --</option>';
    if (ranges.length) {
      opts += ranges.map(function(r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join("");
    }
    rangeSel.innerHTML = opts;
  }
  if (editId) {
    const d = getDistricts().find(x => x.id === editId);
    if (!d) return toast("District not found.", "error");
    $("#ddName").value = d.name;
    $("#ddCode").value = d.code;
    $("#ddHQ").value = d.headquarters;
    if (rangeSel) rangeSel.value = d.rangeId || "";
  }
  openModal("#devDistModal");
  setTimeout(() => { const f = $("#ddName"); if (f) f.focus(); }, 80);
}

function saveDevDistrict(e) {
  e.preventDefault();
  if (!isDevAdmin()) { $("#devDistErr").textContent = "Only Developer Admin can manage districts."; return; }
  const editId = $("#ddEditId").value;
  const name = $("#ddName").value.trim();
  const code = $("#ddCode").value.trim().toUpperCase();
  const hq = $("#ddHQ").value.trim();
  const rangeId = $("#ddRange") ? $("#ddRange").value : "";
  const errEl = $("#devDistErr");
  errEl.textContent = "";
  if (!name) { errEl.textContent = "District name is required."; return; }
  if (!code) { errEl.textContent = "District code is required."; return; }
  if (!hq) { errEl.textContent = "Headquarters is required."; return; }
  const districts = getDistricts();
  if (districts.some(d => d.id !== editId && d.code.toUpperCase() === code)) { errEl.textContent = "District code already exists. Codes must be unique."; return; }
  if (districts.some(d => d.id !== editId && d.name.trim().toLowerCase() === name.toLowerCase())) { errEl.textContent = "A district with this name already exists."; return; }

  if (editId) {
    const existing = districts.find(x => x.id === editId);
    if (existing && existing.rangeId && rangeId && existing.rangeId !== rangeId) {
      const curRangeName = rangeNameOf(existing.rangeId) || "another IG Range";
      const newRangeName = rangeNameOf(rangeId) || "new IG Range";
      const ok = confirm('District "' + existing.name + '" is already in ' + curRangeName + '. Still want to send it to ' + newRangeName + '?');
      if (!ok) return;
    } else if (existing && existing.rangeId && !rangeId) {
      const curRangeName = rangeNameOf(existing.rangeId) || "its IG Range";
      const ok = confirm('District "' + existing.name + '" is currently in ' + curRangeName + '. Remove it from this IG Range?');
      if (!ok) return;
    }
  }

  const btn = $("#devDistSubmit");
  __devBtnLoading(btn, true);
  setTimeout(() => {
    try {
      const ds = getDistricts();
      if (editId) {
        const d = ds.find(x => x.id === editId);
        if (!d) { errEl.textContent = "District not found."; return; }
        d.name = name; d.code = code; d.headquarters = hq; d.rangeId = rangeId || "";
        toast("District updated successfully.", "success");
        __audit("District Updated", name + " (" + code + ")", { entity: "District" });
      } else {
        const newId = "dist_" + uid();
        ds.push({ id: newId, name, code, headquarters: hq, rangeId: rangeId || "", createdAt: Date.now() });
        const allLocations = getAllLocations();
        const allItems = getAllItems();
        allLocations[newId] = []; allItems[newId] = [];
        saveAllLocations(allLocations); saveAllItems(allItems);
        toast("District created successfully.", "success");
        __audit("District Created", name + " (" + code + ")", { entity: "District" });
      }
      saveDistricts(ds);
      syncAllIgScopes(ds);
      closeModals();
      renderDevDistricts();
      renderDistricts();
      renderDistrictSelector();
    } finally {
      __devBtnLoading(btn, false);
    }
  }, 350);
}

function devDetachDistrictRange(id) {
  if (!isDevAdmin()) return toast("Only Developer Admin can remove districts from an IG Range.", "error");
  const ds = getDistricts();
  const d = ds.find(x => x.id === id);
  if (!d) return;
  const curRangeName = rangeNameOf(d.rangeId) || "its IG Range";
  if (!confirm('Remove district "' + d.name + '" from ' + curRangeName + '?')) return;
  d.rangeId = "";
  saveDistricts(ds);
  syncAllIgScopes(ds);
  toast('District "' + d.name + '" removed from ' + curRangeName + '.', "success");
  __audit("District Range Cleared", d.name + " (" + curRangeName + ")", { entity: "District" });
  renderDevDistricts();
  renderDistricts();
  renderDistrictSelector();
}

function devDeleteDistrict(id) {
  if (!isDevAdmin()) return toast("Only Developer Admin can delete districts.", "error");
  const d = getDistricts().find(x => x.id === id);
  if (!d) return;
  const nUsers = getUsers().filter(u => u.districtId === id).length;
  const nItems = (getAllItems()[id] || []).length;
  const locs = (getAllLocations()[id] || []).length;
  if (nUsers > 0) return toast("This district cannot be deleted because users are still assigned to it.", "error");
  if (nItems > 0) return toast("District has items. Remove them first.", "error");
  if (locs > 0) return toast("District has locations. Remove them first.", "error");
  if (getDistricts().length <= 1) return toast("Cannot delete the last district.", "error");
  __devConfirm("Delete District?", "Are you sure you want to delete <b>" + esc(d.name) + "</b> (" + esc(d.code) + ")? This cannot be undone.", "Delete District", () => {
    const allLocations = getAllLocations();
    const allItems = getAllItems();
    delete allLocations[id]; delete allItems[id];
    saveAllLocations(allLocations); saveAllItems(allItems);
    saveDistricts(getDistricts().filter(x => x.id !== id));
    if (activeDistrictId === id) {
      const remaining = getDistricts();
      if (remaining.length) switchDistrict(remaining[0].id);
    }
    toast("District deleted.", "success");
    __audit("District Deleted", d.name + " (" + d.code + ")", { entity: "District" });
    renderDevDistricts();
    renderDistricts();
    renderDistrictSelector();
  });
}

/* ==================== DISTRICT LOCATIONS DIALOG ==================== */
function openDevLocs(distId) {
  if (!isDevAdmin()) return toast("Only Developer Admin can manage locations.", "error");
  const d = getDistricts().find(x => x.id === distId);
  if (!d) return toast("District not found.", "error");
  $("#devLocModal").dataset.distId = distId;
  $("#devLocDistName").textContent = d.name;
  renderDevLocList();
  openModal("#devLocModal");
}

function renderDevLocList() {
  const box = $('#devLocList');
  if (!box) return;
  const distId = $('#devLocModal').dataset.distId;
  const locs = getLocationsForDistrict(distId);
  if (!locs.length) { box.innerHTML = '<div class="dev-empty dev-empty-sm"><p>No locations yet.</p><p class="dev-empty-sub">Click "+ Add Location" to add the first one.</p></div>'; return; }
  box.innerHTML = locs.map(l => { const t = __devLocLabel(l.type); const isHQ = l.type === 'district'; const del = isHQ ? '' : '<button type="button" class="btn btn-sm btn-red" data-devloc-del=\'' + l.id + '\'>Delete</button>'; return '<div class="dev-loc-row"><div class="dlr-info"><span class="dlr-name">' + esc(l.name) + '</span><span class="cons-badge ' + (isHQ ? "cons-b-blue" : l.type === "mhc" ? "cons-b-amber" : "cons-b-gray") + '">>' + esc(t) + '</span></div><div class="dlr-actions"><button type="button" class="btn btn-sm btn-loc" data-devloc-edit=\'' + l.id + '\'>Edit</button>' + del + '</div></div>'; }).join('');
}
function openDevLocAdd() {
  const distId = ($("#devLocModal") && $("#devLocModal").dataset.distId) || (currentUser && currentUser.districtId);
  if (!distId) return toast("Select a district first.", "error");
  $("#devLocAddErr").textContent = "";
  $("#devLocAddForm").reset();
  const hid = $("#dlEditId"); if (hid) hid.value = "";
  const tEl = $("#devLocAddTitle"); if (tEl) tEl.textContent = "Add Location";
  openModal("#devLocAddModal");
  setTimeout(() => { const f = $("#dlType"); if (f) f.focus(); }, 80);
}

function openDevLocEdit(locId) {
  const distId = ($("#devLocModal") && $("#devLocModal").dataset.distId) || (currentUser && currentUser.districtId);
  const loc = (getAllLocations()[distId] || []).find(l => l.id === locId);
  if (!loc) return toast("Location not found.", "error");
  $("#devLocAddErr").textContent = "";
  $("#devLocAddForm").reset();
  $("#dlType").value = loc.type || "";
  $("#dlName").value = loc.name || "";
  const hid = $("#dlEditId"); if (hid) hid.value = loc.id;
  const tEl = $("#devLocAddTitle"); if (tEl) tEl.textContent = "Edit Location";
  openModal("#devLocAddModal");
  setTimeout(() => { const f = $("#dlName"); if (f) f.focus(); }, 80);
}

function devDeleteLoc(locId) {
  const distId = ($("#devLocModal") && $("#devLocModal").dataset.distId) || (currentUser && currentUser.districtId);
  const loc = (getAllLocations()[distId] || []).find(l => l.id === locId);
  if (!loc) return;
  if (loc.type === 'district') { toast('District HQ cannot be deleted.', 'error'); return; }
  if (loc.type === 'igRange') { devDeleteRange(locId); return; }
  __devConfirm("Delete Location", "Are you sure you want to delete location <b>" + esc(loc.name) + "</b>?", "Delete", () => {
    try {
      const all = getAllLocations();
      const users = getUsers().filter(u => u.districtId === distId && u.locationId === locId);
      if (users.length) { toast("Cannot delete: " + users.length + " user(s) are assigned to this location.", "error"); return; }
      all[distId] = (all[distId] || []).filter(l => l.id !== locId);
      saveAllLocations(all);
      toast("Location deleted successfully.", "success");
      __audit("Location Deleted", loc.name, { entity: "Location" });
      renderDevLocList();
      renderDevDistricts();
      renderDistricts();
      renderLocationList();
      if (typeof renderAdminLocs === "function") renderAdminLocs();
    } catch (err) {
      toast(err && err.message ? err.message : "Delete failed.", "error");
    }
  });
}

function saveDevLocAdd(e) {
  e.preventDefault();
  const type = $("#dlType").value;
  const name = $("#dlName").value.trim();
  const errEl = $("#devLocAddErr");
  errEl.textContent = "";
  if (!type) { errEl.textContent = "Please select a location type."; return; }
  if (!name) { errEl.textContent = "Location name is required."; return; }
  // A PHQ or an IG Range belongs to the state, so it is filed under the state
  // scope instead of whichever district the form was opened from.
  const isHq = isHqType(type);
  if (isHq && !isDevAdmin()) { errEl.textContent = "Only the Developer Admin can manage the PHQ and IG Ranges."; return; }
  const distId = isHq ? HQ_SCOPE_KEY : (($("#devLocModal") && $("#devLocModal").dataset.distId) || (currentUser && currentUser.districtId));
  const allLocations = getAllLocations();
  const locs = allLocations[distId] || [];
  const editId = ($("#dlEditId") ? $("#dlEditId").value : "");
  if (locs.some(l => l.id !== editId && (l.name || "").trim().toLowerCase() === name.toLowerCase())) { errEl.textContent = "A location with this name already exists here."; return; }
  const btn = $("#devLocAddSubmit");
  __devBtnLoading(btn, true);
  setTimeout(() => {
    try {
      const all = getAllLocations();
      const list = all[distId] || [];
      if (editId) {
        const ex = list.find(l => l.id === editId);
        if (!ex) { toast("Location not found.", "error"); return; }
        ex.name = name; ex.type = type;
        if (isHq) { ex.districtId = null; ex.state = STATE_NAME; }
        toast("Location updated successfully.", "success");
        __audit("Location Updated", name + " (" + __devLocLabel(type) + ")", { entity: "Location" });
      } else {
        const rec = { id: "loc_" + uid(), name, type, districtId: isHq ? null : distId };
        if (isHq) rec.state = STATE_NAME;
        list.push(rec);
        toast("Location added successfully.", "success");
        __audit("Location Added", name + " (" + __devLocLabel(type) + ")", { entity: "Location" });
      }
      all[distId] = list;
      closeModals();
      renderDevLocList();
      renderDevDistricts();
      renderDistricts();
      renderLocationList();
      if (typeof renderAdminLocs === "function") renderAdminLocs();
    } finally {
      __devBtnLoading(btn, false);
    }
  }, 350);
}

/* ==================== MANAGE USERS PAGE ==================== */
function __devUserMatches(u, q) {
  if (!q) return true;
  const ql = q.toLowerCase();
  const dist = getDistricts().find(d => d.id === u.districtId);
  const loc = __devLocName(u.districtId, u.locationId);
  return [u.username, u.name, ROLE_LABELS[u.role] || u.role, dist ? dist.name : "", loc || ""]
    .some(v => String(v || "").toLowerCase().indexOf(ql) !== -1);
}
function __devRoleFilterVal() { return $("#devUserType") ? $("#devUserType").value : ""; }

function renderDevUsers() {
  const tbody = $("#devDaBody");
  if (!tbody) return;
  const q = (__devPg.users.q || "").trim();
  const type = __devPg.users.type || "";
  const users = getUsers();
  const districts = getDistricts();
  const das = users.filter(u => u.role === "admin").filter(u => __devUserMatches(u, q)).filter(u => !type || type === "admin");
  const devs = users.filter(u => u.role === "devadmin").filter(u => __devUserMatches(u, q)).filter(u => !type || type === "devadmin");
  $("#devDaCount").textContent = das.length;
  $("#devDevCount").textContent = devs.length;
  if (!das.length) tbody.innerHTML = '<tr><td colspan="6" class="dev-empty-cell">No District Admins found.</td></tr>';
  else tbody.innerHTML = das.map(u => {
    const n = __devDistUsers(u.districtId).length;
    const delDisabled = n > 0;
    const msg = "This District Admin cannot be deleted because users are still assigned to this account.";
    return '<tr data-devda-id="' + u.id + '">' +
      '<td data-th="Name"><span class="dev-u-name">' + esc(u.name) + '</span></td>' +
      '<td data-th="Username"><span class="dev-u-user">' + esc(u.username) + '</span></td>' +
      '<td data-th="District">' + esc(__devDistName(u.districtId)) + '</td>' +
      '<td data-th="Mobile">' + esc(u.mobile || "—") + '</td>' +
      '<td data-th="Users"><span class="cons-badge cons-b-blue">' + n + ' user' + (n === 1 ? "" : "s") + '</span></td>' +
      '<td data-th="Actions" class="cell-actions">' +
      '<button type="button" class="btn btn-sm btn-dark" data-devda-users="' + u.id + '">Users</button>' +
      '<button type="button" class="btn btn-sm btn-dark" data-devda-edit="' + u.id + '">Edit</button>' +
      (delDisabled
        ? '<button type="button" class="btn btn-sm btn-red" disabled title="' + esc(msg) + '">Delete</button>'
        : '<button type="button" class="btn btn-sm btn-red" data-devda-del="' + u.id + '">Delete</button>') +
      '</td></tr>';
  }).join("");
  if (!devs.length) $("#devDevBody").innerHTML = '<tr><td colspan="4" class="dev-empty-cell">No Developer Admins found.</td></tr>';
  else {
    // The count is taken from every Developer Admin, not the filtered list, so
    // the buttons do not appear and disappear as the search box is typed in.
    const devTotal = users.filter(u => u.role === "devadmin").length;
    const meId = currentUser ? currentUser.id : "";
    $("#devDevBody").innerHTML = devs.map(u => {
      const isMe = u.id === meId;
      // Your own row shows Edit and nothing else - no greyed-out Delete that
      // invites a click that cannot work. Another Developer Admin gets the full
      // pair, because there is a real second admin to fall back on.
      const delNote = isMe
        ? ""
        : (devTotal < 2
            ? '<span class="dev-self-tag dev-self-tag-mute">Only Developer Admin</span>'
            : '<button type="button" class="btn btn-sm btn-red" data-devda-del="' + u.id + '">Delete</button>');
      return '<tr' + (isMe ? ' class="is-self"' : '') + '>' +
        '<td data-th="Name"><span class="dev-u-name">' + esc(u.name) + (isMe ? '<span class="dev-self-tag">You</span>' : '') + '</span></td>' +
        '<td data-th="Username"><span class="dev-u-user">' + esc(u.username) + '</span></td>' +
        '<td data-th="Mobile">' + esc(u.mobile || "—") + '</td>' +
        '<td data-th="Actions" class="cell-actions">' +
        '<button type="button" class="btn btn-sm btn-outline" data-devda-edit="' + u.id + '">Edit</button>' +
        delNote +
        '</td></tr>';
    }).join("");
  }
}

function devDeleteUser(id) {
  if (!isAdmin()) return toast("Only District or Developer Admin can perform this action.", "error");
  const __tu = getUsers().find(u => u.id === id);
  if (!isDevAdmin() && __tu && (__tu.role === "ig" || __tu.role === "devadmin")) return toast("You cannot delete higher authority accounts.", "error");
  // inDistrictScope, not an equality test on districtId: an Inspector General
  // answers for every district of their range, so one of the other districts
  // they hold is as much theirs to manage as their home district. Comparing
  // against currentUser.districtId alone would refuse those.
  if (!isDevAdmin() && __tu && !inDistrictScope(__tu.districtId)) return toast("That user is not in a district you manage.", "error");
  const user = getUsers().find(u => u.id === id);
  if (!user) return;
  if (user.role === "admin" && __devDistUsers(user.districtId).length > 0) {
    return toast("This District Admin cannot be deleted because users are still assigned to this account.", "error");
  }
  if (user.role === "devadmin") {
    if (getUsers().filter(u => u.role === "devadmin").length <= 1) {
      return toast("Cannot delete the last Developer Admin.", "error");
    }
    // Your own account is not a delete target either: the button is hidden, and
    // this is the same rule on the code path, so a stale click cannot slip past.
    if (currentUser && user.id === currentUser.id) {
      return toast("You cannot delete your own account. Edit it instead.", "error");
    }
  }
  __devConfirm("Delete User?", "Are you sure you want to delete <b>" + esc(user.username) + "</b> (" + esc(user.name) + ")?", "Delete User", () => {
    saveUsers(getUsers().filter(u => u.id !== id));
    toast("User deleted.", "success");
    __audit("User Deleted", user.name + " (" + (ROLE_LABELS[user.role] || user.role) + ")", { entity: "User" });
    renderDevUsers();
    renderDevDaUsers();
    renderUsers();
    if (typeof renderAdminUsers === "function") renderAdminUsers();
  });
}

/* ==================== USER ADD / EDIT DIALOG ==================== */
/* The role decides where the account is filed, so the form follows it:
   a Developer Admin is placed at the PHQ, an Inspector General at an IG Range,
   and every other role inside a district that must sit under that range. */
function duSyncRole() {
  const roleEl = $("#duRole");
  const role = roleEl ? roleEl.value : "";
  const hqType = roleHomeType(role);
  const stateEl = $("#duState");
  if (stateEl) stateEl.value = STATE_NAME;
  const hqRow = $("#duHqRow"), distRow = $("#duDistrictRow"), locGroup = $("#duLocationGroup");
  if (hqType) {
    // state level: PHQ or IG Range, and never a district
    if (hqRow) hqRow.classList.remove("hidden");
    if (distRow) distRow.classList.add("hidden");
    if (locGroup) locGroup.classList.add("hidden");
    const sel = $("#duHqLoc");
    const list = hqType === "phq" ? getPhqLocations() : getIgRanges();
    sel.innerHTML = list.length
      ? list.map(function(l) { return '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>'; }).join("")
      : '<option value="">' + (hqType === "phq" ? "No PHQ yet - create one in Manage Locations" : "No IG Range yet - create one in Manage Locations") + '</option>';
    // a PHQ id is meaningless to an IG and an IG Range id to a Developer Admin,
    // so the previous choice is only kept while the level is the same
    const typeEl = $("#duHqType");
    const prevType = typeEl ? typeEl.value : "";
    const keep = prevType === hqType ? sel.dataset.keep : "";
    const hit = keep && list.some(function(l) { return l.id === keep; }) ? keep : ((list[0] || {}).id || "");
    sel.value = hit;
    sel.dataset.keep = hit;
    if (typeEl) typeEl.value = hqType;
    $("#duHqLabel").innerHTML = (hqType === "phq" ? "PHQ" : "IG Range") + ' <span class="req">*</span>';
    $("#duHqHint").textContent = hqType === "phq"
      ? "A Developer Admin works from the PHQ and covers the whole state."
      : "An Inspector General works from this IG Range and covers every district under it.";
    return;
  }
  if (hqRow) hqRow.classList.add("hidden");
  if (distRow) distRow.classList.remove("hidden");
  if (locGroup) locGroup.classList.remove("hidden");
  duSyncRange();
}

function duSyncRange() {
  const sel = $("#duRange");
  if (!sel) return;
  const ranges = getIgRanges();
  const keep = sel.value;
  sel.innerHTML = ranges.length
    ? ranges.map(function(r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join("")
    : '<option value="">No IG Range yet - create one in Manage Locations</option>';
  if (keep && ranges.some(function(r) { return r.id === keep; })) sel.value = keep;
  if (!sel.value && ranges.length) sel.value = ranges[0].id;
  duSyncDistrict();
}

function duSyncDistrict() {
  const sel = $("#duDistrict");
  if (!sel) return;
  const rangeId = $("#duRange") ? $("#duRange").value : "";
  const all = getDistricts();
  let ds = rangeId ? districtsInRange(rangeId) : all;
  // a District Admin only ever sees their own district
  if (!isDevAdmin()) {
    const mine = all.filter(function(d) { return d.id === currentUser.districtId; });
    ds = mine;
  }
  const keep = sel.value;
  sel.innerHTML = ds.length
    ? ds.map(function(d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join("")
    : '<option value="">No district under this IG Range yet</option>';
  if (keep && ds.some(function(d) { return d.id === keep; })) sel.value = keep;
  if (!sel.value && ds.length) sel.value = ds[0].id;
  sel.disabled = !isDevAdmin();
  __fillDevUserLocations();
}

/* kept for callers that only need the units of the chosen district */
function fillDevUserDistricts() { duSyncDistrict(); }
function __fillDevUserLocations() {
  const sel = $("#duLocation");
  if (!sel) return;
  const dSel = $("#duDistrict");
  const distId = dSel ? dSel.value : "";
  const locs = distId ? getDistrictUnits(distId) : [];
  const keep = sel.value;
  sel.innerHTML = locs.length
    ? locs.map(l => '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>').join("")
    : '<option value="">No unit in this district yet</option>';
  // never offer a PHQ or an IG Range as a unit: those sit above the district
  // and an id that is no longer on offer falls back to the first unit
  sel.value = (keep && locs.some(l => l.id === keep)) ? keep : ((locs[0] || {}).id || "");
}

function openDevUserModal(editId, presetDistrictId) {
  if (!isAdmin()) return toast("Only District or Developer Admin can manage users.", "error");
  $("#devUserErr").textContent = "";
  $("#devUserForm").reset();
  const rSel = $("#duRole");
  if (rSel && isDevAdmin()) {
    Array.from(rSel.options).forEach(opt => { opt.hidden = false; opt.disabled = false; });
  }
  $("#duEditId").value = editId || "";
  if (editId) {
    const user = getUsers().find(u => u.id === editId);
    if (!user) return toast("User not found.", "error");
    if (!isDevAdmin() && (user.role === "ig" || user.role === "devadmin")) return toast("You cannot manage higher authority accounts.", "error");
    $("#devUserTitle").textContent = "Edit User";
    $("#devUserSubmit").textContent = "Update User";
    $("#duUsername").value = user.username;
    $("#duName").value = user.name;
    $("#duMobile").value = user.mobile || "";
    $("#duRole").value = user.role;
    // a state-level account is filed at the PHQ or the IG Range, so the range
    // and district cascade is filled from its district while the PHQ row takes
    // its own placement - whichever the role calls for
    duSyncRange();
    if (user.rangeId) { const rs = $("#duRange"); if (rs) rs.value = user.rangeId; }
    duSyncDistrict();
    if (user.districtId) { const ds = $("#duDistrict"); if (ds) ds.value = user.districtId; }
    __fillDevUserLocations();
    const hqSel = $("#duHqLoc");
    if (hqSel && user.locationType) hqSel.dataset.keep = user.locationId;
    duSyncRole();
    setTimeout(() => {
      const hq = roleHomeType(user.role);
      if (hq && $("#duHqLoc")) $("#duHqLoc").value = user.locationId || "";
      else if ($("#duLocation")) $("#duLocation").value = user.locationId;
    }, 30);
    $("#duPassword").value = "";
    $("#duPassword").placeholder = "Leave blank to keep current password";
  } else {
    $("#devUserTitle").textContent = "Add New User";
    $("#devUserSubmit").textContent = "Add User";
    $("#duPassword").placeholder = "Minimum 6 characters";
    if (presetDistrictId) {
      const d = getDistricts().find(x => x.id === presetDistrictId);
      if (d && d.rangeId) { const rs = $("#duRange"); if (rs) rs.value = d.rangeId; }
    }
    duSyncRole();
    if (presetDistrictId) { const ds = $("#duDistrict"); if (ds) ds.value = presetDistrictId; __fillDevUserLocations(); }
  }
  openModal("#devUserModal");
  setTimeout(() => { const f = $("#duUsername"); if (f) f.focus(); }, 80);
}


/* ==================== DISTRICT ADMIN: LOCATIONS & USERS (v2026.09.136) ==================== */
function openAdminLocs(distId) {
  if (!isAdmin() && !isDevAdmin()) return toast('Only District or Developer Admin can manage locations.', 'error');
  const targetId = distId || (currentUser && currentUser.districtId) || activeDistrictId || (getDistricts()[0] || {}).id;
  const d = getDistricts().find(x => x.id === targetId);
  if (!d) return toast('District not found.', 'error');
  $('#devLocModal').dataset.distId = d.id;
  $('#devLocDistName').textContent = d.name;
  const s = $('#adminLocSearch'); if (s) s.value = '';
  __devPg.adminLocs = { q: '', distId: d.id };
  renderAdminLocs();
  history.replaceState(null, '', '#admin-locs');
  switchTab('admin-locs');
}
function renderAdminLocs() {
  const box = $('#adminLocList'); if (!box) return;
  const distId = (__devPg.adminLocs && __devPg.adminLocs.distId) || ($('#devLocModal') && $('#devLocModal').dataset.distId) || (currentUser && currentUser.districtId) || activeDistrictId || (getDistricts()[0] || {}).id;
  let distSel = document.getElementById("adminLocDistSel");
  if (isDevAdmin()) {
    if (!distSel) {
      const tb = document.querySelector("#view-admin-locs .dev-toolbar");
      if (tb) {
        distSel = document.createElement("select");
        distSel.id = "adminLocDistSel";
        distSel.className = "dev-type-sel";
        distSel.style.maxWidth = "240px";
        tb.appendChild(distSel);
        distSel.addEventListener("change", function() {
          openAdminLocs(distSel.value);
        });
      }
    }
    if (distSel) {
      distSel.innerHTML = getDistricts().map(d => '<option value="' + esc(d.id) + '"' + (d.id === distId ? ' selected' : '') + '>' + esc(d.name) + '</option>').join("");
      distSel.style.display = "";
    }
  } else if (distSel) {
    distSel.style.display = "none";
  }
  const locs = getLocationsForDistrict(distId);
  const aq = (__devPg.adminLocs && __devPg.adminLocs.q || '').trim().toLowerCase();
  const filtered = aq ? locs.filter(l => (l.name || '').toLowerCase().indexOf(aq) !== -1 || __devLocLabel(l.type || '').toLowerCase().indexOf(aq) !== -1) : locs;
  if (!filtered.length) { box.innerHTML = '<div class="dev-empty dev-empty-sm"><p>' + (aq ? 'No locations match your search.' : 'No locations yet.') + '</p><p class="dev-empty-sub">Click "+ Add New Location" to add the first one.</p></div>'; return; }
  box.innerHTML = '<div class="dev-table-wrap"><table class="dev-table"><thead><tr><th>Location Name</th><th>Type</th><th>Actions</th></tr></thead><tbody>' + filtered.map(l => { const t = __devLocLabel(l.type); const isHQ = l.type === "district"; const acts = '<button type="button" class="btn btn-sm btn-loc" data-devloc-edit="' + l.id + '">Edit</button>' + (isHQ ? '' : '<button type="button" class="btn btn-sm btn-red" data-devloc-del="' + l.id + '">Delete</button>'); return '<tr><td>' + esc(l.name) + '</td><td><span class="cons-badge ' + (isHQ ? "cons-b-blue" : l.type === "mhc" ? "cons-b-amber" : "cons-b-gray") + '">>' + esc(t) + '</span></td><td class="cell-actions">' + acts + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
function openAdminUsers() {
  if (!isAdmin()) return toast('Only District or Developer Admin can manage users.', 'error');
  __devPg.adminUsers = { q: '', type: '' };
  const s = $('#adminUserSearch'); if (s) s.value = '';
  const t = $('#adminUserType'); if (t) t.value = '';
  renderAdminUsers();
  history.replaceState(null, '', '#admin-users');
  switchTab('admin-users');
}
function renderAdminUsers() {
  const tbody = $('#adminUsersBody'); if (!tbody) return;
  const aq = (__devPg.adminUsers && __devPg.adminUsers.q || '').trim();
  const type = __devPg.adminUsers.type || '';
  let users = getUsers().filter(u => u.districtId === currentUser.districtId && u.role !== 'ig' && u.role !== 'devadmin');
  users = users.filter(u => __devUserMatches(u, aq)).filter(u => !type || u.role === type);
  const cnt = $('#adminUsersCount'); if (cnt) cnt.textContent = users.length + ' user' + (users.length === 1 ? '' : 's');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="dev-empty-cell">No users found.</td></tr>'; return; }
  const dist = getDistricts().find(d => d.id === currentUser.districtId);
  tbody.innerHTML = users.map(u => { const loc = (getLocationsForDistrict(currentUser.districtId) || []).find(l => l.id === u.locationId); return '<tr data-devu-id="' + u.id + '"><td>' + esc(u.username) + '</td><td>' + esc(u.name) + '</td><td>' + esc(u.mobile || '-') + '</td><td>' + esc(ROLE_LABELS[u.role] || u.role) + '</td><td>' + esc(dist ? dist.name : '-') + '</td><td>' + esc(loc ? loc.name : '-') + '</td><td class="cell-actions"><button type="button" class="btn btn-sm btn-dark" data-devu-edit="' + u.id + '">Edit</button>' + (u.id === currentUser.id ? '' : '<button type="button" class="btn btn-sm btn-red" data-devu-del="' + u.id + '">Delete</button>') + '</td></tr>'; }).join('');
}
function openAdminUserModal(editId) {
  if (!isAdmin()) return toast('Only District or Developer Admin can manage users.', 'error');
  if (editId) {
    const target = getUsers().find(u => u.id === editId);
    if (target && (target.role === 'ig' || target.role === 'devadmin')) return toast('You cannot manage higher authority accounts.', 'error');
  }
  openDevUserModal(editId || null);
  if (!isDevAdmin()) {
    $('#duDistrict').value = currentUser.districtId;
    __fillDevUserLocations();
    const rSel = $('#duRole');
    if (rSel) {
      Array.from(rSel.options).forEach(opt => {
        const higher = (opt.value === 'admin' || opt.value === 'devadmin' || opt.value === 'ig');
        opt.hidden = higher;
        opt.disabled = higher;
      });
      if (rSel.value === 'admin' || rSel.value === 'devadmin' || rSel.value === 'ig') {
        rSel.value = 'user';
        duSyncRole();
      }
    }
  }
}
/* ==================== END DISTRICT ADMIN PAGES ==================== */

function saveDevUser(e) {
  e.preventDefault();
  if (!isAdmin()) { $("#devUserErr").textContent = "Only District or Developer Admin can manage users."; return; }
  const editId = $("#duEditId").value;
  const username = $("#duUsername").value.trim();
  const password = $("#duPassword").value;
  const name = $("#duName").value.trim();
  const mobile = $("#duMobile").value.trim();
  const role = $("#duRole").value;
  const errEl = $("#devUserErr");
  if (!isDevAdmin() && (role === "admin" || role === "devadmin" || role === "ig")) { errEl.textContent = "You cannot assign admin roles."; return; }
  errEl.textContent = "";
  if (!username) { errEl.textContent = "Username is required."; return; }
  const users = getUsers();
  if (users.some(u => u.id !== editId && u.username.trim().toLowerCase() === username.toLowerCase())) { errEl.textContent = "Username already exists."; return; }
  if (!name) { errEl.textContent = "Display name is required."; return; }
  if (!/^\d{10}$/.test(mobile)) { errEl.textContent = "Mobile number must be exactly 10 digits."; return; }
  if (!editId && !password) { errEl.textContent = "Password is required for a new user."; return; }
  if (password && password.length < 6) { errEl.textContent = "Password must be at least 6 characters."; return; }
  if (!role) { errEl.textContent = "Please select a role."; return; }
  // the role decides the placement, so read whichever row it is showing
  const hqType = roleHomeType(role);
  let districtId = "", locationId = "", rangeId = "", districtIds = null;
  if (hqType) {
    const hqId = $("#duHqLoc") ? $("#duHqLoc").value : "";
    if (!hqId) { errEl.textContent = hqType === "phq" ? "Select the PHQ for this account." : "Select the IG Range for this account."; return; }
    locationId = hqId;
    rangeId = hqType === "igRange" ? hqId : "";
    if (hqType === "igRange") {
      const inRange = districtsInRange(hqId);
      if (!inRange.length) { errEl.textContent = "That IG Range has no district under it yet."; return; }
      districtIds = inRange.map(function(d) { return d.id; });
      districtId = districtIds[0];
    }
  } else {
    const dSel = $("#duDistrict"), rSel = $("#duRange"), lSel = $("#duLocation");
    districtId = dSel ? dSel.value : "";
    locationId = lSel ? lSel.value : "";
    rangeId = rSel ? rSel.value : "";
    if (!districtId) { errEl.textContent = "Please select a district."; return; }
    if (!isDevAdmin() && districtId !== currentUser.districtId) { errEl.textContent = "You can only manage users in your own district."; return; }
    if (!locationId) { errEl.textContent = "Please select a location."; return; }
  }
  const btn = $("#devUserSubmit");
  __devBtnLoading(btn, true);
  setTimeout(() => {
    try {
      const us = getUsers();
      const place = function (user) {
        user.districtId = districtId;
        user.locationId = locationId;
        if (hqType) { user.state = STATE_NAME; user.locationType = hqType; }
        else { delete user.state; delete user.locationType; }
        if (rangeId) user.rangeId = rangeId; else delete user.rangeId;
        if (districtIds) user.districtIds = districtIds.slice();
        else delete user.districtIds;
      };
      if (editId) {
        const user = us.find(u => u.id === editId);
        if (!user) { errEl.textContent = "User not found."; return; }
        user.username = username;
        if (password) user.password = password;
        user.name = name;
        user.mobile = mobile;
        user.role = role;
        place(user);
        toast("User updated successfully.", "success");
        __audit("User Updated", name + " (" + (ROLE_LABELS[role] || role) + ")", { entity: "User" });
      } else {
        const rec = { id: "u_" + uid(), username, password, role, name, mobile, createdAt: Date.now() };
        place(rec);
        us.push(rec);
        toast("User created successfully.", "success");
        __audit("User Created", name + " (" + (ROLE_LABELS[role] || role) + ")", { entity: "User" });
      }
      saveUsers(us);
      closeModals();
      renderDevUsers();
      renderDevDaUsers();
      renderUsers();
    } finally {
      __devBtnLoading(btn, false);
    }
  }, 350);
}

/* ==================== USERS OF DISTRICT ADMIN PAGE ==================== */
function renderDevDaUsers() {
  const tbody = $("#devDauBody");
  if (!tbody) return;
  const pg = __devPg.dausers || {};
  // Two ways in to this one page. Opened from a District Admin row it lists that
  // admin's district; opened from a district row (a District Admin's own page
  // and an IG Admin's, which is where the Users button now sits) it lists that
  // district. Both produce the same table, so the page does not need to know
  // which door it came through.
  let distId = "";
  let ownerLabel = "";
  if (pg.daId) {
    const da = getUsers().find(u => u.id === pg.daId);
    if (!da) { tbody.innerHTML = '<tr><td colspan="7" class="dev-empty-cell">District Admin not found.</td></tr>'; return; }
    distId = da.districtId;
    ownerLabel = da.name;
  } else if (pg.districtId) {
    const d = getDistricts().find(x => x.id === pg.districtId);
    if (!d) { tbody.innerHTML = '<tr><td colspan="7" class="dev-empty-cell">District not found.</td></tr>'; return; }
    distId = d.id;
    ownerLabel = d.name;
  } else {
    tbody.innerHTML = '<tr><td colspan="7" class="dev-empty-cell">Nothing selected.</td></tr>';
    return;
  }
  const title = $("#devDauTitle");
  if (title) title.textContent = "Users of " + ownerLabel;
  const q = (pg.q || "").trim();
  const type = pg.type || "";
  const users = __devDistUsers(distId)
    .filter(u => __devUserMatches(u, q))
    .filter(u => !type || u.role === type);
  $("#devDauCount").textContent = users.length;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="dev-empty-cell">No users found for this district.</td></tr>'; return; }
  tbody.innerHTML = users.map(u =>
    '<tr data-devu-id="' + u.id + '">' +
    '<td data-th="Username"><span class="dev-u-user">' + esc(u.username) + '</span></td>' +
    '<td data-th="Display Name">' + esc(u.name) + '</td>' +
    '<td data-th="Mobile">' + esc(u.mobile || "—") + '</td>' +
    '<td data-th="Role"><span class="cons-badge cons-b-gray">' + esc(ROLE_LABELS[u.role] || u.role) + '</span></td>' +
    '<td data-th="District">' + esc(__devDistName(u.districtId)) + '</td>' +
    '<td data-th="Location">' + esc(__devLocName(u.districtId, u.locationId)) + '</td>' +
    '<td data-th="Actions" class="cell-actions">' +
    '<button type="button" class="btn btn-sm btn-outline" data-devu-edit="' + u.id + '">Edit</button>' +
    '<button type="button" class="btn btn-sm btn-red" data-devu-del="' + u.id + '">Delete</button>' +
    '</td></tr>').join("");
}

/* ==================== CONFIRM DIALOG ==================== */
let __devConfirmFn = null;
function __devConfirm(title, bodyHtml, okLabel, fn) {
  $("#devConfirmTitle").textContent = title;
  $("#devConfirmBody").innerHTML = bodyHtml;
  $("#devConfirmOk").textContent = okLabel || "Confirm";
  __devConfirmFn = fn;
  openModal("#devConfirmModal");
}

/* ==================== BINDING ==================== */
function bindDevAdmin() {
  if (__devBound) return;
  __devBound = true;
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  on("devAddDistBtn", "click", () => openDevDistModal());
  on("devDistForm", "submit", saveDevDistrict);
  on("devDistCancel", "click", closeModals);
  on("devDistSearch", "input", () => { __devPg.dists.q = $("#devDistSearch").value; renderDevDistricts(); });
  on("devAddLocBtn", "click", openDevLocAdd);
  on("devLocAddForm", "submit", saveDevLocAdd);
  on("devLocAddCancel", "click", closeModals);
  on("devLocClose", "click", closeModals);
  on("devLocList", "click", (e) => {
    const t = e.target.closest("[data-devloc-edit],[data-devloc-del]");
    if (!t) return;
    if (t.hasAttribute("data-devloc-edit")) openDevLocEdit(t.getAttribute("data-devloc-edit"));
    else if (t.hasAttribute("data-devloc-del")) devDeleteLoc(t.getAttribute("data-devloc-del"));
  });
  on("devAddUserBtn", "click", () => openDevUserModal());
  on("devUserForm", "submit", saveDevUser);
  on("devUserCancel", "click", closeModals);
  on("duDistrict", "change", __fillDevUserLocations);
  // the role picks the level, and the range picks the district: both redraw
  // the row below them so the form can never show a stale combination
  on("duRole", "change", duSyncRole);
  on("duRange", "change", duSyncDistrict);
  // Back returns to whichever list this page was opened from: the districts
  // table when it was reached from a district row, and the users list when it
  // was reached from a District Admin row. Sending an IG back to the Developer
  // Admin's users page - which they cannot open - used to be what happened.
  on("devDauBack", "click", () => {
    if (__devPg.dausers && __devPg.dausers.districtId) {
      __devPg.dausers = { daId: null, districtId: null, q: "", type: "" };
      if (isIg()) { history.replaceState(null, "", "#dev-ig-dists"); return switchTab("manage-districts"); }
      if (isDevAdmin()) { history.replaceState(null, "", "#dev-districts"); return switchTab("manage-districts"); }
      return switchTab("dashboard");
    }
    openDevUsers();
  });
  on("devIgsBack", "click", __devClosePage);
  on("devDistBack", "click", devDistrictsBack);
  // the searchable district dropdown, in both forms
  Object.keys(__igDd).forEach(function(pre) {
    const m = __igDd[pre];
    on(m.trigger.replace('#',''), "click", function(e) {
      e.preventDefault();
      __igDdOpen(pre, $(m.panel).classList.contains("hidden"));
    });
    on(m.search.replace('#',''), "input", function() {
      __igDdAbsorb(pre);   // fold in any tick made before the search moved the list
      __igDdRender(pre);
    });
    // search must not submit the form it lives in
    on(m.search.replace('#',''), "keydown", function(e) { if (e.key === "Enter") e.preventDefault(); });
    on(m.list.replace('#',''), "change", function(e) {
      const row = e.target.closest(".ig-dd-row");
      const c = e.target;
      if (pre === "igf" && c && c.checked) {
        const curDist = getDistricts().find(d => d.id === c.value);
        const selRangeId = $("#igfHqLoc") ? $("#igfHqLoc").value : "";
        if (curDist && curDist.rangeId && selRangeId && curDist.rangeId !== selRangeId) {
          const curRangeName = rangeNameOf(curDist.rangeId) || "another IG Range";
          const newRangeName = rangeNameOf(selRangeId) || "new IG Range";
          const ok = confirm('District "' + curDist.name + '" is already in ' + curRangeName + '. Still want to send it to ' + newRangeName + '?');
          if (!ok) {
            c.checked = false;
            if (row) row.classList.remove("is-on");
            __igDdAbsorb(pre);
            return;
          }
        }
      }
      if (row) row.classList.toggle("is-on", e.target.checked);
      __igDdAbsorb(pre);
    });
  });
  // click anywhere else closes the panel
  document.addEventListener("click", function(e) {
    if (e.target.closest(".ig-dd")) return;
    Object.keys(__igDd).forEach(function(pre) { __igDdOpen(pre, false); });
  });
  $("#igForm")?.addEventListener("submit", submitIgForm);
  // the district list is decided by the IG Range, never picked by hand
  on("igfHqLoc", "change", igfApplyRange);
  on("igfCancel", "click", () => openIgForm($("#igfEditId").value || null));
  on("devAddIgBtn", "click", devAddIgAdmin);
  on("devIgSearch", "input", () => { __devPg.igs.q = $("#devIgSearch").value; renderDevIgs(); });
  on("view-manage-igs", "click", (e) => {
    const dr = e.target.closest("[data-devig-del-range]");
    if (dr) return devDeleteRange(dr.getAttribute("data-devig-del-range"));
    const nr = e.target.closest("[data-devig-new-range]");
    if (nr) return openIgForm("", nr.getAttribute("data-devig-new-range"));
    const t = e.target.closest("[data-devig-dists],[data-devig-edit],[data-devig-del]");
    if (!t) return;
    if (t.hasAttribute("data-devig-dists")) devIgDistricts(t.getAttribute("data-devig-dists"));
    else if (t.hasAttribute("data-devig-edit")) devEditIg(t.getAttribute("data-devig-edit"));
    else if (t.hasAttribute("data-devig-del")) devDeleteIg(t.getAttribute("data-devig-del"));
  });
  on("devUsersBack", "click", __devClosePage);
  on("adminLocsBack", "click", __devClosePage);
  on("adminAddLocBtn", "click", openDevLocAdd);
  on("adminLocSearch", "input", () => { __devPg.adminLocs.q = $("#adminLocSearch").value; renderAdminLocs(); });
  on("adminLocList", "click", (e) => {
    const t = e.target.closest("[data-devloc-edit],[data-devloc-del]");
    if (!t) return;
    if (t.hasAttribute("data-devloc-edit")) openDevLocEdit(t.getAttribute("data-devloc-edit"));
    else if (t.hasAttribute("data-devloc-del")) devDeleteLoc(t.getAttribute("data-devloc-del"));
  });
  on("adminUsersBack", "click", __devClosePage);
  on("adminAddUserBtn", "click", () => openAdminUserModal());
  on("adminUserSearch", "input", () => { __devPg.adminUsers.q = $("#adminUserSearch").value; renderAdminUsers(); });
  on("adminUserType", "change", () => { __devPg.adminUsers.type = $("#adminUserType").value; renderAdminUsers(); });
  on("adminUsersBody", "click", (e) => {
    const t = e.target.closest("[data-devu-edit],[data-devu-del]");
    if (!t) return;
    if (t.hasAttribute("data-devu-edit")) openAdminUserModal(t.getAttribute("data-devu-edit"));
    else if (t.hasAttribute("data-devu-del")) devDeleteUser(t.getAttribute("data-devu-del"));
  });
  on("devUserSearch", "input", () => { __devPg.users.q = $("#devUserSearch").value; renderDevUsers(); });
  on("devUserType", "change", () => { __devPg.users.type = $("#devUserType").value; renderDevUsers(); });
  on("devDauSearch", "input", () => { __devPg.dausers.q = $("#devDauSearch").value; renderDevDaUsers(); });
  on("devDauType", "change", () => { __devPg.dausers.type = $("#devDauType").value; renderDevDaUsers(); });
  on("devConfirmOk", "click", () => { const fn = __devConfirmFn; __devConfirmFn = null; closeModals(); if (fn) fn(); });
  on("devConfirmCancel", "click", () => { __devConfirmFn = null; closeModals(); });
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-devdd-locs],[data-devdd-edit],[data-devdd-del],[data-devdd-detach],[data-devdu-users],[data-devda-users],[data-devda-edit],[data-devda-del],[data-devu-edit],[data-devu-del]");
    if (!t) return;
    else if (t.hasAttribute("data-devdd-locs")) openDevLocs(t.getAttribute("data-devdd-locs"));
    else if (t.hasAttribute("data-devdu-users")) openDevDistUsers(t.getAttribute("data-devdu-users"));
    else if (t.hasAttribute("data-devdd-edit")) openDevDistModal(t.getAttribute("data-devdd-edit"));
    else if (t.hasAttribute("data-devdd-detach")) devDetachDistrictRange(t.getAttribute("data-devdd-detach"));
    else if (t.hasAttribute("data-devdd-del")) devDeleteDistrict(t.getAttribute("data-devdd-del"));
    else if (t.hasAttribute("data-devda-users")) openDevDaUsers(t.getAttribute("data-devda-users"));
    else if (t.hasAttribute("data-devda-edit")) openDevUserModal(t.getAttribute("data-devda-edit"));
    else if (t.hasAttribute("data-devda-del")) devDeleteUser(t.getAttribute("data-devda-del"));
    else if (t.hasAttribute("data-devu-edit")) openDevUserModal(t.getAttribute("data-devu-edit"));
    else if (t.hasAttribute("data-devu-del")) devDeleteUser(t.getAttribute("data-devu-del"));
  });
}

function renderDevPagesTick() {
  if (!currentUser || !isAdmin()) return;
  // An Inspector General reaches the districts page and the users page too -
  // both renderers already narrow themselves to the districts of their IG Range
  // - so gating them on isDevAdmin() left those two pages blank for an IG.
  const v1 = $("#view-manage-districts");
  if ((isDevAdmin() || isIg()) && v1 && !v1.classList.contains("hidden")) renderDevDistricts();
  const vIg = $("#view-manage-igs");
  if (isDevAdmin() && vIg && !vIg.classList.contains("hidden")) renderDevIgs();
  const v2 = $("#view-manage-users");
  if (isDevAdmin() && v2 && !v2.classList.contains("hidden")) renderDevUsers();
  const v3 = $("#view-dausers");
  if ((isDevAdmin() || isIg()) && v3 && !v3.classList.contains("hidden")) renderDevDaUsers();
  const a1 = $("#view-admin-locs");
  if (a1 && !a1.classList.contains("hidden")) renderAdminLocs();
  const a2 = $("#view-admin-users");
  if (a2 && !a2.classList.contains("hidden")) renderAdminUsers();
}

document.addEventListener("hashchange", () => { if (currentUser) __devApplyRoute(); });
document.addEventListener("DOMContentLoaded", bindDevAdmin);
// The row counters watch the tables for changes, so they must be running
// before the first render rather than after it - init() draws the lists, and
// anything drawn before the observer exists would not be counted.
__startRowCounter();

document.addEventListener("DOMContentLoaded", init);
























/* manage-nav loader */
(function(){ if(window.__manageLoader)return; window.__manageLoader=true; var s=document.createElement('script'); s.src='manage-nav.js'; document.head.appendChild(s); })();


/* ui-fix loader */
(function(){ if(window.__uiFixLoader) return; window.__uiFixLoader=true; var s=document.createElement('script'); s.src='ui-fix.js'; document.head.appendChild(s); })();








document.addEventListener("click", (e) => {
  if (!e.target.closest(".row-combo-wrap")) {
    closeAllRowCombos();
  }
});
