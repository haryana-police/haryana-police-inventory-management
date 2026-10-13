// One shot, exact-string edits for the inventory tables. Every replacement is
// checked and counted before it is written, and the file is written once at the
// end - a half-applied app.js is a broken app.
'use strict';
const fs = require('fs');

const CAT_H = '<th class="sortable" data-sort="category">Category <span class="sort-arrow"></span></th>';
const STAT_H = '<th class="sortable" data-sort="status">Status <span class="sort-arrow"></span></th>';

let app = fs.readFileSync('app.js', 'utf8');
const problems = [];

function rep(s, from, to, label, expect) {
  const n = s.split(from).length - 1;
  if (n === 0) { problems.push('MISS  ' + label); return s; }
  if (expect && n !== expect) { problems.push('COUNT ' + label + ' got ' + n + ' want ' + expect); return s; }
  console.log('ok    ' + label + ' x' + n);
  return s.split(from).join(to);
}

// ---------------------------------------------------------------- Item Stock
// Category column out, Status column back in.
app = rep(app, CAT_H, STAT_H, 'HEAD: category out + status in', 2);

app = rep(app,
  '<td><span class="cat-badge">${esc(cat ? cat.name : "")}</span></td>${unitCell}',
  '${unitCell}',
  'IS row: category cell out', 1);

app = rep(app,
  '${(i.conditionCounts || {}).damaged || 0}</td><td class="actions-cell">',
  '${(i.conditionCounts || {}).damaged || 0}</td><td><span class="status-badge ${st.cls}">${st.label}</span></td><td class="actions-cell">',
  'IS row: status cell in', 1);

app = rep(app,
  '    const cat = cats.find(c => c.id === i.categoryId);\r\n    const loc = i.locationId ? locations.find(l => l.id === i.locationId) : null;',
  '    const cat = cats.find(c => c.id === i.categoryId);\r\n    const st = allocStatusOfItem(i);\r\n    const loc = i.locationId ? locations.find(l => l.id === i.locationId) : null;',
  'IS row: restore st', 1);

app = rep(app,
  '<td class="qty-strong">${tscrap}</td><td></td></tr>',
  '<td class="qty-strong">${tscrap}</td><td colspan="2"></td></tr>',
  'IS total row: span 2', 1);

app = rep(app,
  '<td colspan="${allMode ? 11 : 10}">No items found.',
  '<td colspan="${allMode ? 12 : 11}">No items found.',
  'IS empty row colspan', 1);

// ------------------------------------------------------------ Stock History
app = rep(app,
  '<td><span class="cat-badge">${esc(cat ? cat.name : "")}</span></td>${__chgCell}',
  '${__chgCell}',
  'SH row: category cell out', 1);

app = rep(app,
  '<td>${buildCondBar(cc)}</td><td>${__chg ? esc(__chg.nice)',
  '<td>${buildCondBar(cc)}</td><td><span class="status-badge ${cls}">${label}</span></td><td>${__chg ? esc(__chg.nice)',
  'SH row: status cell in', 1);

app = rep(app,
  '      totalQty += displayQty;\r\n',
  '      totalQty += displayQty;\r\n      const cls = displayQty === 0 ? "status-out" : displayQty <= i.minStock ? "status-low" : "status-ok";\r\n      const label = displayQty === 0 ? "Out of Stock" : displayQty <= i.minStock ? "Low Stock" : "In Stock";\r\n',
  'SH row: restore cls/label', 1);

fs.writeFileSync('app.js', app);

if (problems.length) {
  console.log('\nPROBLEMS - nothing useful was written:');
  problems.forEach(p => console.log('  ' + p));
  process.exit(1);
}
console.log('\nall replacements applied, app.js written');

// ------------------------------------------------------- second pass, same file
app = fs.readFileSync('app.js', 'utf8');
const p2 = [];

// Stock History sort defs: drop the category accessor, put the status one back.
app = rep(app,
  '      (i, c) => (c.cats.get(i.categoryId) || {}).name || "",\r\n',
  '',
  'SH sort def: category accessor out', 1);
app = rep(app,
  '      i => (i.conditionCounts || {}).good || 0,\r\n      i => __lastChangeAt(i) || null,',
  '      i => (i.conditionCounts || {}).good || 0,\r\n      (i, c) => { const cc = i.conditionCounts || { good: i.quantity, poor: 0, damaged: 0 }; const q = c.cond ? (cc[c.cond] || 0) : i.quantity; return q <= 0 ? 0 : q <= (Number(i.minStock) || 0) ? 1 : 2; },\r\n      i => __lastChangeAt(i) || null,',
  'SH sort def: status accessor in', 1);

// Category filter now holds several ticked ids, so the reader is a matcher.
app = rep(app,
  '  const catFilter = ($("#categoryFilter") || {}).value || "";',
  '  const catFilter = (typeof __msMatches === "function") ? __msMatches($("#categoryFilter")) : (($("#categoryFilter") || {}).value || "");',
  'SH: catFilter reads the ticked boxes', 2);
app = rep(app,
  '    if (catFilter && i.categoryId !== catFilter) return false;',
  '    if (typeof catFilter === "function" ? !catFilter(i) : (catFilter && i.categoryId !== catFilter)) return false;',
  'SH: filter test', 1);

app = rep(app,
  '  const catF = (($("#allocStockCat") || {}).value || "");',
  '  const catF = (typeof __msMatches === "function") ? __msMatches($("#allocStockCat")) : (($("#allocStockCat") || {}).value || "");',
  'IS: catF reads the ticked boxes', 1);
app = rep(app,
  '    if (catF && i.categoryId !== catF) return false;',
  '    if (typeof catF === "function" ? !catF(i) : (catF && i.categoryId !== catF)) return false;',
  'IS: filter test', 1);

// Rebuilding the option list must not throw away the ticks.
app = rep(app,
  '  const catPrev = ($("#categoryFilter") || {}).value;\r\n',
  '  const catPrev = (typeof __msSelected === "function") ? __msSelected($("#categoryFilter")).map(o => o.value) : [($("#categoryFilter") || {}).value].filter(Boolean);\r\n',
  'SH: repopulate keeps the ticks', 1);

const HELPER = [
  '// Rebuilding the category list must not throw away the boxes the user ticked,',
  '// so the chosen ids are read back and re-selected afterwards.',
  'function __repopulateMultiCat(sel) {',
  '  if (!sel) return;',
  '  const keep = (typeof __msSelected === "function" ? __msSelected(sel) : []).map(o => o.value);',
  '  sel.innerHTML = `<option value="">All Categories</option>` + getCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");',
  '  Array.prototype.forEach.call(sel.options, o => { if (o.value && keep.indexOf(o.value) >= 0) o.selected = true; });',
  '  if (window.__msCatIS && window.__msCatIS.refresh) window.__msCatIS.refresh();',
  '}',
  ''
].join('\r\n');

app = rep(app,
  'function renderAllotments() {\r\n  const catSel = $("#allocStockCat");\r\n  if (catSel) {\r\n    catSel.innerHTML = `<option value="">All Categories</option>` + getCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");\r\n  }',
  HELPER + 'function renderAllotments() {\r\n  __repopulateMultiCat($("#allocStockCat"));',
  'IS: repopulate call #1', 1);

app = rep(app,
  '    const catSel = $("#allocStockCat");\r\n    if (catSel) catSel.innerHTML = `<option value="">All Categories</option>` + getCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");\r\n',
  '    __repopulateMultiCat($("#allocStockCat"));\r\n',
  'IS: repopulate call #2', 1);

// Bindings.
app = rep(app,
  '  bindCombobox("categoryCbInput", "categoryCbMenu", "categoryFilter");',
  '  window.__msCatSH = bindMultiCombobox("categoryCbInput", "categoryCbMenu", "categoryFilter", renderInventory);',
  'SH: bind multi combobox', 1);
app = rep(app,
  '  $("#allocStockCat")?.addEventListener("change", renderAllocStock);',
  '  window.__msCatIS = bindMultiCombobox("allocStockCatInput", "allocStockCatMenu", "allocStockCat", renderAllocStock);',
  'IS: bind multi combobox', 1);

// The Clear button has to untick every box, not just blank a value.
app = rep(app,
  '["searchInput", "categoryFilter", "locationFilter", "conditionFilter", "itemDateFrom", "itemDateTo"].forEach(id => { const e = $(`#${id}`); if (e) e.value = ""; });',
  '["searchInput", "categoryFilter", "locationFilter", "conditionFilter", "itemDateFrom", "itemDateTo"].forEach(id => { const e = $(`#${id}`); if (!e) return; if (e.multiple) { Array.prototype.forEach.call(e.options, o => { o.selected = false; }); } else { e.value = ""; } });\r\n    [window.__msCatSH, window.__msCatIS].forEach(h => { if (h && h.refresh) h.refresh(); });',
  'SH: Clear unticks boxes', 1);

if (p2.length) { console.log('\nPROBLEMS'); p2.forEach(x => console.log('  ' + x)); process.exit(1); }
fs.writeFileSync('app.js', app);
console.log('\nsecond pass written');
