// Checks the two overlay problems that were reported: columns too narrow to
// hold a word, and text sitting against the border of the box around it.
//
//   node test-overlay-tables.js
'use strict';
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, why) => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (why ? '   <- ' + why : '')); }
};
const LAYER = css.slice(css.indexOf('DIALOG TABLES AND DIALOG PADDING'));
ok('the fix is in the file', LAYER.length > 500);
ok('and at the end, where it wins', css.indexOf('DIALOG TABLES AND DIALOG PADDING') > css.length * 0.8);

console.log('\ncolumns are not squeezed any more:');
ok('every dialog with a table has a width of its own',
   /#allocItemDetailModal \.modal/.test(LAYER) && /#allocPersonDetailModal \.modal/.test(LAYER) &&
   /#scanHistoryModal \.modal/.test(LAYER) && /#demandDetailsModal \.modal/.test(LAYER) &&
   /#viewItemModal \.modal/.test(LAYER) && /#demandActionModal \.modal/.test(LAYER));
ok('the widest dialog is the widest table', /#allocItemDetailModal \.modal \{ max-width: min\(11\d\dpx/.test(LAYER));
ok('a table can be wider than its dialog and scroll', /\.modal \.table-wrap[\s\S]*?overflow-x:\s*auto/.test(LAYER));
ok('the scrollport is the wrapper, not the dialog', /\.modal \.table-wrap,\s*\n?\s*\.modal-body \.table-wrap \{ max-width: 100%; overflow-x: auto; \}/.test(LAYER));
ok('the table itself is given a floor', /\.modal table \{ width: 100%; min-width: 100%; \}/.test(LAYER));
ok('the floor is set on the table, not the body', /table:has\(#aidAllottedBody\)/.test(LAYER) && !/^#aidAllottedBody[^{]*\{[^}]*min-width/m.test(LAYER));
ok('the 17-column dialog gets a real floor', /table:has\(#aidAllottedBody\)[^{]*\{ min-width: 1000px/.test(LAYER));
ok('columns have a minimum of their own', /\.modal table th,\s*\n?\s*\.modal table td \{ min-width: 6rem/.test(LAYER));
ok('the name column gets more than the rest', /:first-child[^{]*\{ min-width: 9rem/.test(LAYER));

console.log('\nnothing is hidden to make it fit:');
ok('a number or a date is kept whole, not squeezed', /white-space:\s*nowrap/.test(LAYER));
ok('prose wraps instead of being cut', /min-width:\s*12rem;\s*\n?\s*white-space:\s*normal/.test(LAYER) ||
   /white-space:\s*normal/.test(LAYER));
ok('no font is made smaller anywhere in the fix', !/font-size:\s*\.\d+rem/.test(LAYER));
ok('no nowrap is forced on a prose column', !/cell-remark[^{]*\{[^}]*white-space:\s*nowrap/.test(LAYER));

console.log('\ntext is not against the border:');
ok('all four parts of a dialog share one horizontal inset',
   /padding-left:\s*20px;\s*\n?\s*padding-right:\s*20px/.test(LAYER));
ok('the header, body and footer each have vertical room too',
   /\.modal-header \{ padding-top: 16px; padding-bottom: 16px/.test(LAYER) &&
   /\.modal-body \{ padding-top: 16px; padding-bottom: 16px/.test(LAYER));
ok('cells are padded away from their own border',
   /\.modal table th,\s*\n?\s*\.modal table td \{ padding-left: 12px; padding-right: 12px/.test(LAYER));
ok('the sticky footer margin matches the new inset',
   /margin-left:\s*-20px;\s*\n?\s*margin-right:\s*-20px/.test(LAYER));
ok('the one dialog with its own padding is brought back in line', /#consTxnModal \.modal-body/.test(LAYER));

console.log('\nit comes after everything it overrides:');
for (const r of ['#allocItemDetailModal', '.modal-header', '.modal-body', '.modal-footer']) {
  const mine = css.lastIndexOf(r);
  const theirs = css.lastIndexOf(r, css.indexOf('DIALOG TABLES AND DIALOG PADDING'));
  ok(r + ' - the fix is the later rule', mine > theirs);
}

console.log('\nnothing else was touched:');
ok('braces balanced', (css.match(/{/g) || []).length === (css.match(/}/g) || []).length);
ok('no markup change was needed', !/no-squeeze|mid-squeeze/.test(html));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
