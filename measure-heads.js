// Measures the real geometry of the Item Stock headers at several window
// widths, so "the text is breaking" can be confirmed or dismissed with
// numbers instead of a guess.
//
//   node measure-heads.js
'use strict';
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:3210';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WIDTHS = [1920, 1440, 1280, 1100, 960];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(700);
  await page.evaluate(() => {
    const c = document.querySelector('[data-demo-user="developer"]');
    if (c) c.click();
  });
  await sleep(2600);
  // Land on the Item Stock tab if we are not already on it.
  await page.evaluate(() => {
    const t = document.querySelector('[data-tab="inventory"]');
    if (t) t.click();
  });
  await sleep(1400);

  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 1000 });
    await sleep(700);
    const data = await page.evaluate(() => {
      const table = document.getElementById('allocStockTable');
      if (!table) return { err: 'no table' };
      const ths = [...table.querySelectorAll('thead th')];
      const lineH = parseFloat(getComputedStyle(ths[0]).lineHeight) || 16;
      return {
        wrap: table.closest('.table-wrap') ? getComputedStyle(table.closest('.table-wrap')).overflowX : 'n/a',
        cols: ths.map(th => {
          const range = document.createRange();
          range.selectNodeContents(th);
          const rects = [...range.getClientRects()];
          const cs = getComputedStyle(th);
          const box = th.getBoundingClientRect();
          // Real content height = box height minus vertical padding. One line of
          // this font is lineHeight ("normal" => fontSize * ~1.2). Anything past
          // a whole number of lines means the header really wrapped.
          const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
          const contentH = box.height - padY;
          const lineH = (cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight)) || 14;
          const realLines = Math.max(1, Math.round(contentH / lineH));
          // Does any text stick out past the cell's padding box?
          const left = Math.min.apply(null, rects.map(r => r.left));
          const right = Math.max.apply(null, rects.map(r => r.right));
          const innerL = box.left + parseFloat(cs.paddingLeft);
          const innerR = box.right - parseFloat(cs.paddingRight);
          return {
            text: th.textContent.trim().replace(/\s+/g, ' '),
            w: Math.round(box.width),
            h: Math.round(box.height),
            realLines: realLines,
            innerW: Math.round(innerR - innerL),
            textW: Math.round(right - left),
            overflows: right > innerR + 1 || left < innerL - 1,
          };
        }),
      };
    });
    if (data.err) { console.log(w + ' -> ' + data.err); continue; }
    console.log('\n=== viewport ' + w + 'px  (table-wrap overflow-x: ' + data.wrap + ') ===');
    let bad = 0;
    for (const c of data.cols) {
      if (!c.w) { console.log('  ' + c.text.padEnd(16) + ' (not visible at this width)'); continue; }
      const problem = c.realLines > 1 || c.overflows;
      if (problem) bad++;
      const flag = c.realLines > 1 ? '  <-- WRAPS to ' + c.realLines + ' lines'
        : (c.overflows ? '  <-- SPILLS past cell (' + c.textW + 'px in ' + c.innerW + 'px)' : '');
      console.log('  ' + c.text.padEnd(16) + ' w=' + String(c.w).padStart(4) + ' h=' + String(c.h).padStart(3) + ' lines=' + c.realLines + flag);
    }
    console.log('  --> problem columns: ' + bad);
  }

  await browser.close();
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
