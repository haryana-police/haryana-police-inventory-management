// Verifies the Stock History table: header cells, body cells and colspan all
// agree, and each sortable header still sorts the column it sits over.
//
//   node check-history.js
'use strict';
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:3210';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1600, height: 1000 },
  });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(700);
  await page.evaluate(() => {
    const c = document.querySelector('[data-demo-user="developer"]');
    if (c) c.click();
  });
  await sleep(2600);
  await page.evaluate(() => {
    const t = document.querySelector('[data-tab="inventory"]');
    if (t) t.click();
  });
  await sleep(1200);
  // Switch to the Stock History pane.
  await page.evaluate(() => {
    const b = document.querySelector('[data-invt="history"]');
    if (b) b.click();
  });
  await sleep(1600);

  const snap = async () => page.evaluate(() => {
    const table = document.querySelector('#inventoryBody')?.closest('table');
    if (!table) return { err: 'no table' };
    const ths = [...table.querySelectorAll('thead th')];
    const rows = [...table.querySelectorAll('#inventoryBody tr')];
    const dataRows = rows.filter(r => !r.classList.contains('rpt-total-row') && !r.classList.contains('summary-row'));
    return {
      headers: ths.map(t => t.textContent.trim().replace(/\s+/g, ' ')),
      sortCols: ths.map(t => t.getAttribute('data-sort-col')),
      headCount: ths.length,
      cellCounts: [...new Set(dataRows.map(r => r.children.length))],
      totalCell: rows.filter(r => r.classList.contains('rpt-total-row')).map(r => r.children.length + ':' + [...r.children].map(c => c.getAttribute('colspan') || '1').join(','))[0] || null,
      firstCol: dataRows.slice(0, 4).map(r => r.children[0]?.textContent.trim().slice(0, 22)),
      oddRows: dataRows.filter(r => r.children.length !== 7).map(r => '[' + r.children.length + ' cells] class="' + r.className + '" text="' + r.textContent.trim().replace(/\s+/g,' ').slice(0,60) + '" spans=' + [...r.children].map(c => c.getAttribute('colspan')||'1').join(',')).slice(0, 4),
      hasStatus: table.textContent.includes('Out of Stock') || table.textContent.includes('Low Stock'),
    };
  });

  const a = await snap();
  if (a.err) { console.log('ERROR: ' + a.err); process.exit(1); }
  console.log('headers (' + a.headCount + '): ' + a.headers.join(' | '));
  console.log('data-sort-col:  ' + a.sortCols.join(','));
  console.log('body cell counts (should be one value): ' + JSON.stringify(a.cellCounts));
  console.log('total row cells: ' + a.totalCell);
  console.log('status text present: ' + a.hasStatus);
  console.log('odd rows: ' + JSON.stringify(a.oddRows, null, 1));
  console.log('first rows: ' + JSON.stringify(a.firstCol));

  // Click the "Last Updated" header - it must sort by that column, not by Status.
  const lastIdx = a.headers.findIndex(h => /last updated/i.test(h));
  if (lastIdx >= 0) {
    await page.evaluate(() => {
      const table = document.querySelector('#inventoryBody').closest('table');
      const th = [...table.querySelectorAll('thead th')].find(t => /last updated/i.test(t.textContent));
      if (th) th.click();
    });
    await sleep(1200);
    const b = await snap();
    console.log('\nafter clicking "' + a.headers[lastIdx] + '":');
    console.log('  first rows: ' + JSON.stringify(b.firstCol));
    console.log('  headers still: ' + b.headCount);
  }

  await browser.close();
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
