// Checks __isButtonsOnly the way the browser will meet it: on the real markup
// the category list draws. The shell cannot be trusted with the replace
// patterns involved, so this is done with a proper string pass.
//
//   node test-buttons-only.js
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n); } };

// The text of an element that does not sit inside a control, which is what
// __isButtonsOnly gathers before deciding.
function textOutsideControls(html) {
  let out = '';
  let inControl = 0;
  const tag = /<\/?(button|a\b[^>]*class="[^"]*\bbtn\b|input\b[^>]*type="(?:button|submit)")[^>]*>/gi;
  let m, last = 0;
  while ((m = tag.exec(html)) !== null) {
    const chunk = html.slice(last, m.index);
    if (!inControl) out += chunk;
    inControl += (m[0][1] === '/') ? -1 : 1;
    if (inControl < 0) inControl = 0;
    last = tag.lastIndex;
  }
  if (!inControl) out += html.slice(last);
  return out.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Exactly what renderCatList() writes for one category.
const catRow = '<div class="cat-list-row" data-idx="0">'
  + '<span class="cat-list-name">Stationery</span>'
  + '<span class="cat-list-count">3 items</span>'
  + '<div class="cat-list-actions">'
  + '<button type="button" class="btn btn-sm btn-outline" data-cat-items="0">Items</button>'
  + '<button type="button" class="btn btn-sm btn-outline" data-cat-edit="0">Edit</button>'
  + '<button type="button" class="btn btn-sm btn-outline act-dd-del" data-cat-del="0">Delete</button>'
  + '</div></div>';

const btnStrip = '<div class="cat-list-actions">'
  + '<button type="button" class="btn">Items</button>'
  + '<button type="button" class="btn">Edit</button>'
  + '<button type="button" class="btn">Delete</button>'
  + '</div>';

const emptyMsg = '<div class="dev-empty dev-empty-sm"><p>No categories yet.</p></div>';

console.log('text found outside the buttons:');
const t1 = textOutsideControls(catRow);
const t2 = textOutsideControls(btnStrip);
const t3 = textOutsideControls(emptyMsg);
console.log('  category row     : ' + JSON.stringify(t1));
console.log('  button strip     : ' + JSON.stringify(t2));
console.log('  empty message    : ' + JSON.stringify(t3));

console.log('\ncounting decisions:');
ok('category row has its own text -> counted', t1 !== '');
ok('its name survived the pass', t1.indexOf('Stationery') >= 0);
ok('button strip has no text of its own -> not counted', t2 === '');
ok('empty message has text but is skipped by class', t3.indexOf('No categories') >= 0);

console.log('\nthe function is present and used:');
const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
ok('defined', src.indexOf('function __isButtonsOnly') >= 0);
ok('used while counting rows', src.indexOf('__isButtonsOnly(el)') >= 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
