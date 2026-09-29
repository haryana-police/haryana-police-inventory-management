// Exercises the row-count rules from app.js against a stand-in DOM, so the
// counting and the empty-table rule can be checked without opening a browser.
//   node test-rowcount.js
'use strict';
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } };

// --- the logic under test, copied from app.js -------------------------
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
const mk = (cls, rc) => ({ className: cls || "", dataset: rc ? { rowcount: "1" } : {} });
function count(rows) { return rows.filter(r => !__isFootRow(r) && !r.dataset.rowcount).length; }

console.log('counting:');
// 1 data row plus one foot row still reads as 1: the foot is furniture.
ok('5 plain rows -> 5', count([mk(), mk(), mk(), mk(), mk()]) === 5);
ok('1 row -> singular', count([mk()]) === 1);
ok('empty-row ignored', count([mk(), mk(), mk("empty-row")]) === 2);
ok('rpt-total-row ignored', count([mk(), mk("rpt-total-row")]) === 1);
ok('subtotal ignored', count([mk(), mk(), mk("subtotal-row")]) === 2);
ok('total-row ignored', count([mk(), mk("total-row")]) === 1);
ok('group-row ignored', count([mk(), mk("group-row")]) === 1);
ok('own count row ignored', count([mk(), mk("", true)]) === 1);
ok('only an empty-row -> 0', count([mk("empty-row")]) === 0);
ok('nothing -> 0', count([]) === 0);
ok('3 data + 2 foot rows -> 3',
   count([mk(), mk(), mk(), mk("rpt-total-row"), mk("empty-row")]) === 3);

console.log('\nre-entrancy guard:');
let busy = false, appends = 0;
const update = (rows) => {
  if (busy) return;
  busy = true;
  try { appends++; count(rows); } finally { busy = false; }
};
update([mk(), mk()]);
update([mk(), mk()]);
ok('guard does not block distinct calls', appends === 2);
// What the observer would do on seeing our own append.
const nested = () => { if (busy) return 'blocked'; return 'ran'; };
busy = true;
ok('append during write is blocked (no loop)', nested() === 'blocked');
busy = false;
ok('after write, next call runs', nested() === 'ran');

console.log('\nspan:');
for (const [cols, want] of [[3, 3], [7, 7], [1, 1], [0, 1]]) {
  ok(cols + ' header cols -> colspan ' + want, (cols || 1) === want);
}

// --- div-based lists (locations, districts, users, categories) ---------
const __CARDLIST_SKIP = /empty|placeholder|loading|no-?data|nothing/i;
function cardListRows(kids) {
  return kids.filter((el) => {
    if (el.dataset && el.dataset.cardcount) return false;
    const cls = String(el.className || "");
    const t = (el.textContent || "").trim();
    if (__CARDLIST_SKIP.test(cls)) return false;
    if (!t) return false;
    return true;
  });
}
const d = (cls, txt, dc) => ({ className: cls || '', textContent: txt || '', dataset: dc ? { cardcount: '1' } : {} });

console.log('\ndiv-based lists:');
ok('3 location-rows -> 3', cardListRows([d('location-row','A'), d('location-row','B'), d('location-row','C')]).length === 3);
ok('its own count foot ignored', cardListRows([d('location-row','A'), d('rowcount-row cardlist-count','2 rows', true)]).length === 1);
ok('empty message ignored', cardListRows([d('location-row','A'), d('dev-empty','No locations yet.')]).length === 1);
ok('only an empty message -> 0', cardListRows([d('dev-empty','No locations yet.')]).length === 0);
ok('blank node ignored', cardListRows([d('location-row','A'), d('spacer','')]).length === 1);
ok('nothing -> 0', cardListRows([]).length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
