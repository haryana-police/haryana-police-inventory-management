// Photographs the Stock History pane specifically - shots.js leaves the app on
// the default tab, so the pane has to be opened before the shot.
//
//   node shot-history.js [out]
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:3210';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'ims-shots');
const W = Number(process.argv[3]) || 1440;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: W, height: 1000 },
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
  await page.evaluate(() => {
    const b = document.querySelector('[data-invt="history"]');
    if (b) b.click();
  });
  await sleep(1600);
  const p = path.join(OUT, 'stock-history-' + W + '.png');
  await page.screenshot({ path: p });
  console.log('wrote ' + p);
  await browser.close();
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
