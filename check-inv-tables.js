// Exercises the two inventory tables end to end: column counts, the category
// column being gone, Status being back, and the checkbox category filter
// actually narrowing the rows.
//
//   node check-inv-tables.js
'use strict';
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:3210';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-application-cache', '--disk-cache-size=0'],
    defaultViewport: { width: 1440, height: 1000 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  page.on('requestfinished', () => {});
  await page.goto(BASE + '?cbust=' + Date.now(), { waitUntil: 'networkidle2', timeout: 40000 });
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
  await sleep(1500);

  const describe = () => page.evaluate(() => {
    const t = document.getElementById('allocStockTable');
    const ths = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim().replace(/\s+/g, ' '));
    const rows = [...document.querySelectorAll('#allocStockBody tr')]
      .filter(r => !r.className.match(/total|summary|empty|rowcount/));
    return {
      ths,
      headCount: ths.length,
      cellCounts: [...new Set(rows.map(r => r.children.length))],
      rowCount: rows.length,
      hasStatus: /Fully Issued|Out of Stock|Low|Available/.test(t.textContent),
      hasCategoryHdr: ths.some(h => /^category$/i.test(h)),
    };
  });

  console.log('--- ITEM STOCK ---');
  const a = await describe();
  console.log('headers (' + a.headCount + '): ' + a.ths.join(' | '));
  console.log('body cell counts: ' + JSON.stringify(a.cellCounts));
  console.log('status text present: ' + a.hasStatus);
  console.log('Category header present: ' + a.hasCategoryHdr + '  (want false)');

  // ---- the checkbox filter
  const menu = await page.evaluate(async () => {
    const input = document.getElementById('allocStockCatInput');
    const sel = document.getElementById('allocStockCat');
    return {
      hasInput: !!input,
      hasMenu: !!document.getElementById('allocStockCatMenu'),
      multiple: sel ? sel.multiple : null,
      options: sel ? [...sel.options].map(o => o.value).filter(Boolean).length : 0,
      label: input ? input.value : null,
    };
  });
  console.log('\ncategory filter control: ' + JSON.stringify(menu));

  // tick the first two categories
  const after = await page.evaluate(async () => {
    const input = document.getElementById('allocStockCatInput');
    input.click();
    await new Promise(r => setTimeout(r, 350));
    const menu = document.getElementById('allocStockCatMenu');
    const boxes = [...menu.querySelectorAll('.cb-ms-opt input')];
    if (boxes.length < 2) return { err: 'only ' + boxes.length + ' boxes' };
    boxes[0].click();
    boxes[1].click();
    await new Promise(r => setTimeout(r, 600));
    const sel = document.getElementById('allocStockCat');
    return {
      ticked: [...sel.options].filter(o => o.selected).length,
      label: input.value,
      visibleBoxes: boxes.length,
      rowsNow: [...document.querySelectorAll('#allocStockBody tr')].filter(r => !r.className.match(/total|summary|empty|rowcount/)).length,
    };
  });
  console.log('after ticking 2 boxes: ' + JSON.stringify(after));
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'ims-shots', 'multi-select-open.png') });

  // Clear button
  const cleared = await page.evaluate(async () => {
    const menu = document.getElementById('allocStockCatMenu');
    const c = menu.querySelector('.cb-ms-clear');
    if (!c) return { err: 'no Clear button' };
    c.click();
    await new Promise(r => setTimeout(r, 500));
    const sel = document.getElementById('allocStockCat');
    return {
      ticked: [...sel.options].filter(o => o.selected).length,
      label: document.getElementById('allocStockCatInput').value,
      rowsNow: [...document.querySelectorAll('#allocStockBody tr')].filter(r => !r.className.match(/total|summary|empty|rowcount/)).length,
    };
  });
  console.log('after Clear: ' + JSON.stringify(cleared));

  // ---- Stock History
  console.log('\n--- STOCK HISTORY ---');
  await page.evaluate(() => {
    const b = document.querySelector('[data-invt="history"]');
    if (b) b.click();
  });
  await sleep(1500);
  const b = await page.evaluate(() => {
    const t = document.querySelector('#inventoryBody').closest('table');
    const ths = [...t.querySelectorAll('thead th')].map(x => x.textContent.trim().replace(/\s+/g, ' '));
    const rows = [...document.querySelectorAll('#inventoryBody tr')]
      .filter(r => !r.className.match(/total|summary|empty|rowcount/));
    return {
      ths,
      headCount: ths.length,
      cellCounts: [...new Set(rows.map(r => r.children.length))],
      hasStatus: /Out of Stock|Low Stock|In Stock/.test(t.textContent),
      hasCategoryHdr: ths.some(h => /^category$/i.test(h)),
    };
  });
  console.log('headers (' + b.headCount + '): ' + b.ths.join(' | '));
  console.log('body cell counts: ' + JSON.stringify(b.cellCounts));
  console.log('status text present: ' + b.hasStatus);
  console.log('Category header present: ' + b.hasCategoryHdr + '  (want false)');
  await page.screenshot({ path: require('path').join(require('os').tmpdir(), 'ims-shots', 'stock-history-after.png') });

  console.log('\nJS errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await browser.close();
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
