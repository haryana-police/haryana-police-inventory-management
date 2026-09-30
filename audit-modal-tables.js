// Lists the dialogs that hold a table, with how many columns each one has, and
// how wide the dialog is allowed to be. A table that is wider than its dialog
// has to scroll, and a dialog that is narrower than its table squeezes every
// column until the words break across lines - which is what this is looking for.
//
//   node audit-modal-tables.js
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

// The width each dialog ends up with, from every rule that sets one.
const widths = {};
for (const m of css.matchAll(/([#\w.-]+)\s*\{([^}]*max-width:\s*([^;}]+)[^}]*)\}/g)) {
  for (const sel of m[1].split(',')) {
    const s = sel.trim();
    if (!s || !/Modal|modal|Detail|Review|Fulfill/.test(s)) continue;
    widths[s] = (widths[s] + ' | ' + m[3].trim()).slice(1);
  }
}

const modals = [];
const re = /<div class="modal-backdrop[^>]*id="([\w-]+)"/g;
let m;
while ((m = re.exec(html)) !== null) {
  const id = m[1];
  const start = m.index;
  // The next dialog, not the next mention of the class name - a reference to
  // it elsewhere in the document would otherwise cut this one short and the
  // table inside it would go uncounted.
  const next = html.indexOf('<div class="modal-backdrop', start + 10);
  const seg = html.slice(start, next < 0 ? html.length : next);
  const cols = (seg.match(/<th/g) || []).length;
  const bodies = (seg.match(/<tbody/g) || []).length;
  if (cols) modals.push({ id, cols, bodies });
}
modals.sort((a, b) => b.cols - a.cols);

console.log('dialogs holding a table, widest first:\n');
console.log('  cols  bodies  dialog                    max-width it gets');
for (const d of modals) {
  const w = widths['#' + d.id + ' .modal'] || widths['#' + d.id] || '(inherits .modal)';
  console.log('  ' + String(d.cols).padStart(4) + '  ' + String(d.bodies).padStart(6) + '  ' + d.id.padEnd(24) + ' ' + w);
}

// How many columns a dialog of a given width can hold at a readable minimum.
console.log('\nwhat size each of them is:');
const lines = html.split(/\r?\n/);
for (const d of modals) {
  const i = lines.findIndex(l => l.indexOf('id="' + d.id + '"') >= 0);
  let cls = '(not found)';
  if (i >= 0) {
    for (let j = i; j < i + 5 && j < lines.length; j++) {
      // The size is on the .modal child, not on the backdrop wrapper - reading
      // the wrapper would report every dialog as the same narrow size.
      const m = lines[j].match(/class="([^"]*\bmodal(?:-lg|-xl)?\b[^"]*)"/);
      if (m && !/modal-backdrop/.test(m[1])) { cls = m[1]; break; }
    }
  }
  const cap = /modal-xl/.test(cls) ? 1020 : /modal-lg/.test(cls) ? 660 : 520;
  const fits = Math.floor((cap - 48) / 130);
  const flag = d.cols > fits + 2 ? '   <-- squeezed' : '';
  console.log('  ' + d.id.padEnd(24) + String(d.cols).padStart(3) + ' cols  ' + cls.padEnd(18) +
    ' ~' + cap + 'px  fits ~' + fits + flag);
}

// Which table body sits inside each dialog, so a wide one can be given its
// column widths from CSS without editing the markup.
console.log('\nwhich table body sits in each dialog:');
const rows = html.split(/\r?\n/);
const IDS = ['allocItemDetailModal', 'allocPersonDetailModal', 'scanHistoryModal',
  'demandDetailsModal', 'viewItemModal', 'demandActionModal', 'distDetailModal',
  'consCitModal', 'catItemsModal'];
for (const id of IDS) {
  const i = rows.findIndex(l => l.indexOf('id="' + id + '"') >= 0);
  if (i < 0) { console.log(id + ': not found'); continue; }
  const seg = rows.slice(i, i + 60).join('\n');
  const tb = Array.from(seg.matchAll(/<tbody[^>]*id="([^"]+)"/g)).map(x => x[1]);
  const cols = (seg.match(/<th/g) || []).length;
  console.log('  ' + id.padEnd(24) + String(cols).padStart(3) + ' cols   tbody: ' + (tb.join(', ') || '(no id)'));
}

for (const px of [460, 520, 640, 720, 860, 940, 1020]) {
  console.log('  ' + String(px).padStart(5) + 'px dialog  ~' + Math.floor((px - 48) / 130) + ' columns at a 130px readable minimum');
}
console.log('\n  A column below about 110px cannot hold a word like "Consumable" or');
console.log('  "Return" without breaking it, and a broken word reads as a fault.');
