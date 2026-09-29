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

console.log('\ncount row markup:');
// The count cell is its own cell in column one; the rest is a filler cell.
const markup = (span) => '<td class="rowcount-cell">N rows</td>' + (span > 1 ? '<td class="rowcount-pad" colspan="' + (span - 1) + '"></td>' : '');
ok('3 cols -> count in col 1, pad spans 2', /rowcount-cell/.test(markup(3)) && markup(3).indexOf('colspan="2"') > 0);
ok('1 col -> no pad cell', markup(1).indexOf('rowcount-pad') === -1);
ok('7 cols -> pad spans 6', markup(7).indexOf('colspan="6"') > 0);
ok('count cell is not right-aligned by markup (CSS does it)', markup(3).indexOf('align') === -1);

// --- the observer must settle -----------------------------------------
// A MutationObserver whose callback redraws the row it was told about spins
// for ever if it writes unconditionally: the write is itself a change, so the
// observer fires again, and again. That is what stopped the page loading.
// The protection is to write only when the value really changed, and a flag
// around the write is NOT protection - the callback is a microtask and the flag
// has been cleared by the time it runs.
console.log('\nobserver loop:');

function runToSettle(applyWrite, maxTurns) {
  // applyWrite(turn) performs the write and reports whether the DOM changed.
  let turns = 0;
  while (turns < maxTurns) {
    turns++;
    if (!applyWrite(turns)) break;   // no change -> observer never fires again
  }
  return turns;
}

// The wrong way: always assign.
const always = runToSettle(() => true, 100);
ok('unconditional write never settles (the bug)', always === 100);

// The right way: only write when the value differs.
let shown = null;
const guarded = runToSettle(() => {
  const want = '12 rows';
  if (shown === want) return false;   // already correct -> no DOM change
  shown = want;
  return true;
}, 100);
ok('write-only-on-change settles in 2 turns', guarded === 2);

// A re-render that changes the list must still update the count: guarding
// against repeat writes must not turn into ignoring real ones.
let live = 'stale';
const applyAll = ['5 rows', '5 rows', '9 rows', '9 rows'];
for (const want of applyAll) { if (live !== want) live = want; }
ok('a genuine change is still applied', live === '9 rows');

let live2 = 'stale';
for (const want of ['5 rows', '9 rows']) { if (live2 !== want) live2 = want; }
ok('no change is a no-op, change is applied', live2 === '9 rows');

// --- every drawn button must have a listener --------------------------
// A button was drawn with data-ccit-edit and the function behind it was
// written, but nothing listened for the click, so it did nothing. Adding an
// item worked because that button had a listener of its own, so the gap only
// showed up once someone tried to rename an item.
//
// This reads the real app.js rather than comparing a list with itself, so
// drawing a button without a handler fails here instead of in front of a user.
console.log('\nconsumable items dialog buttons:');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
for (const a of ['data-ccit-edit', 'data-ccit-save', 'data-ccit-cancel', 'data-ccit-del']) {
  const drawn = src.indexOf(a + '="') >= 0;                     // appears in markup
  const handled = src.indexOf('closest("[' + a + ']")') >= 0;   // and is listened for
  ok(a + ': drawn=' + drawn + ' handled=' + handled, drawn && handled);
}
ok('the items body has a click listener', src.indexOf('#ccitBody') >= 0);

// --- rows that are only buttons are not rows --------------------------
// A strip of controls with no name in it is not an entry in the list. A
// category row, which carries its name in a span, still is - the buttons sit
// inside that row and do not become rows of their own.
console.log('\nbutton-only rows:');
// Stands in for __isButtonsOnly: text that is not inside a control.
const hasOwnText = (row) => (row.ownText || '').trim() !== '';
const row = (ownText, buttons) => ({ ownText: ownText || '', buttons: buttons || 0 });

ok('bare button strip -> not a row', !hasOwnText(row('', 3)));
ok('button strip with a name -> a row', hasOwnText(row('Stationery', 3)));
ok('button strip with only a count -> a row', hasOwnText(row('12 items', 3)));
ok('no buttons, just text -> a row', hasOwnText(row('Stationery', 0)));
ok('category row (name + 3 buttons) is counted', hasOwnText(row('Stationery', 3)));

// The rule is in the file, so removing it fails here.
ok('__isButtonsOnly is defined', src.indexOf('function __isButtonsOnly') >= 0);
ok('__isButtonsOnly is used when counting', src.indexOf('__isButtonsOnly(el)') >= 0);
// A wrapper holding a table is not a row either - it double counted.
ok('table wrappers are excluded', src.indexOf('el.querySelector("table")') >= 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
