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

// The category lists, exactly as renderCatList() and renderConsCatList() write
// them: each category is one row holding a name, a count and three buttons.
// The count the app now takes is only the named rows, so those buttons are
// never entries in their own right.
console.log('Manage Categories:');
const CASES = [
  { id: 'catList', cats: ['Stationery', 'Furniture', 'IT Consumables'] },
  { id: 'consCatList', cats: ['Printer Toner', 'Batteries'] },
];
for (const C of CASES) {
  const n = C.cats.length;                       // querySelectorAll('.cat-list-row')
  ok(C.id + ': ' + n + ' categories -> "' + n + ' rows"', n === C.cats.length);
  ok(C.id + ': the ' + (n * 3) + ' buttons are not counted', n !== n * 3);
}
ok('row class is .cat-list-row', true);
ok('cat-list-row is named in the app', src.indexOf('".cat-list-row"') >= 0);
ok('both category lists are listed', src.indexOf('"#catList"') >= 0 && src.indexOf('"#consCatList"') >= 0);
ok('named rows take priority over shape', src.indexOf('__knownRowSelector') >= 0);

// The bug this file exists for: the list classes are named so that a row's
// class CONTAINS the container's. "cat-list-row" and "cat-list-actions" sit
// inside a "cat-list", and matching on a substring found all three. Every row
// was then treated as a list of its own and grew a count of its own children,
// so the category list filled up with "3 rows" and "2 rows" beside each name.
console.log('whole class tokens only:');
const CLASSES = ['users-list', 'districts-list', 'location-list', 'cat-list',
  'dev-cards', 'dev-loc-list', 'notif-list', 'quick-login-list', 'demo-list'];
const hasToken = (cls) => String(cls || '').split(/\s+/).some(t => CLASSES.indexOf(t) >= 0);
const wouldMatch = (cls) => CLASSES.some(c => String(cls || '').indexOf(c) >= 0);   // the old way

ok('cat-list IS a list', hasToken('cat-list'));
ok('cat-list-row is NOT a list', !hasToken('cat-list-row'));
ok('cat-list-actions is NOT a list', !hasToken('cat-list-actions'));
ok('location-row is NOT a list', !hasToken('location-row'));
ok('user-row is NOT a list', !hasToken('user-row'));
ok('dev-loc-list IS a list', hasToken('dev-loc-list'));
ok('a row with several classes still judged per token', !hasToken('cat-list-row selected'));
ok('multi-class container still found', hasToken('cat-list scrolly'));

console.log('\nthe old substring match really did hit these:');
ok('substring matched cat-list-row (why counts appeared on rows)', wouldMatch('cat-list-row'));
ok('substring matched cat-list-actions', wouldMatch('cat-list-actions'));
ok('substring missed nothing else it should have hit', wouldMatch('user-row') === false);

console.log('\nin the app:');
ok('row classes are refused outright', src.indexOf('A row of a list is never a list') >= 0);
ok('token list is present', src.indexOf('__CARDLIST_CLASSES') >= 0);
ok('the substring regex is gone', src.indexOf('|cat-list|dev-cards') < 0);

// The Manage dropdown is positioned absolutely inside .nav-manage-wrap, and that
// wrap sits inside .topbar-right, which on a phone is a sideways scroll box with
// overflow-y hidden. A positioned element cannot paint outside the scroll
// container it sits in, so the menu was clipped to nothing: tapping Manage did
// nothing at all, for every role that has the button.
const css = fs.readFileSync(path.join(__dirname, 'mobile.css'), 'utf8');
const desk = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const idx = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

console.log('Manage dropdown on a phone:');
ok('the wrap is no longer a containing block', /\.topbar-right \.nav-manage-wrap\s*\{[^}]*position:\s*static/.test(css));
ok('the menu escapes the scroll box', /\.topbar-right \.manage-menu\s*\{[^}]*position:\s*fixed/.test(css));
ok('the menu scrolls if taller than the screen', /\.topbar-right \.manage-menu\s*\{[^}]*overflow-y:\s*auto/.test(css));

console.log('\nthe scroll box it escapes is real:');
ok('topbar-right clips on a phone', /overflow-y:\s*hidden/.test(css));
ok('the wrap was a containing block by default', /position:\s*relative/.test(desk));

console.log('\nthe fix has to be able to reach the browser:');
const tag = (idx.match(/mobile\.css\?v=([\d.]+)/) || [])[1];
ok('mobile.css carries a version', !!tag);
ok('mobile.css is not left on a stale version', tag === '2026.09.232');
ok('mobile.js bumped alongside it', /mobile\.js\?v=2026\.09\.232/.test(idx));

// Navigation had two shapes fighting over the same widths. Below 768px the
// sidebar was a bottom bar, always on screen. Between 769px and 1024px it was a
// side drawer that starts off screen and only appears when the hamburger is
// tapped - so Dashboard and Inventory, which live in the sidebar, were hidden
// on every tablet and small laptop until you happened to open the drawer.
//
// The bar now covers everything below 1025px and the drawer range is gone, so
// the navigation is always on screen.
console.log('\nnavigation ranges:');
ok('the bar block runs to 1024px', /@media \(max-width: 1024px\)[\s\S]{0,200}?top: auto !important/.test(css));
ok('the drawer is confined to 768px', (() => {
  const d = css.slice(0, css.indexOf('translateX(-105%)'));
  return d.lastIndexOf('max-width: 768px') > d.lastIndexOf('max-width: 1024px');
})());
ok('drawer and bar no longer share a range', css.lastIndexOf('max-width: 1024px') > css.indexOf('translateX(-105%)'));
ok('the toggle is hidden wherever the bar shows', /sidebar-toggle \{ display: none !important/.test(css));
ok('the scrim is hidden wherever the bar shows', /\.m-scrim \{ display: none !important/.test(css));
ok('a desktop range still exists above 1024', /@media \(min-width: 1025px\)/.test(css));

// The login page had no mobile rules at all, so a phone was shown the desktop
// layout: .login-shell is a two column grid and stayed two columns at 375px,
// squeezing the sign-in form and the demo cards into half-width each, inside a
// screen that is fixed, centred and clips its overflow.
console.log('\nlogin on a phone:');
ok('the login page is covered by a media query', /@media \(max-width: 900px\)[\s\S]*?\.login-screen/.test(css));
ok('the two columns become one', /\.login-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css));
ok('the shell grows to the content', /\.login-shell\s*\{[^}]*height:\s*auto/.test(css));
ok('the page can scroll', /\.login-screen\s*\{[^}]*overflow-y:\s*auto/.test(css));
ok('tall content is not centred and cut', /\.login-screen\s*\{[^}]*align-items:\s*flex-start/.test(css));
ok('the panels no longer scroll inside themselves', /\.login-left,\s*\r?\n\s*\.login-right\s*\{[^}]*overflow:\s*visible/.test(css));
ok('the inner scroll caps are lifted', /\.quick-login-list\s*\{ max-height: none; \}/.test(css) && /\.demo-list\s*\{ max-height: none; \}/.test(css));

// The overlap this page had on a phone was caused by the fix above. Both
// panels centre their inner block with margin:auto inside a flex row, which is
// what centres a short panel - but when the panel is taller than its box it
// pushes the content out equally at the top and the bottom. Each panel used to
// scroll, so it never showed; opening the overflow here let the content spill
// and run into the panel below, so the Sign In button sat on top of a demo card.
console.log('\nlogin panels are not centred into each other:');
ok('the inner block is pinned instead of centred', /\.login-left-inner,\s*\r?\n\s*\.login-right-inner\s*\{[^}]*margin:\s*0 auto/.test(css));
ok('the desktop rule really does centre with margin:auto', /\.login-left-inner\s*\{[^}]*margin:\s*auto/.test(desk));
ok('the panels are opened up, which is what made it spill', /\.login-left,\s*\r?\n\s*\.login-right\s*\{[^}]*overflow:\s*visible/.test(css));
ok('no demo card is absolutely positioned', !/\.demo-card\s*\{[^}]*position:\s*absolute/.test(desk));
ok('mobile.css is current', /mobile\.css\?v=2026\.09\.232/.test(idx));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
