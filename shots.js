// Signs in and photographs the screens, so the UI can be looked at rather than
// reasoned about. Uses the Chrome already on the machine - nothing is
// downloaded.
//
//   node shots.js [outDir]
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:3210';
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'ims-shots');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const W = 1440, H = 1000;

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=' + W + ',' + H],
    defaultViewport: { width: W, height: H },
  });
  const page = await browser.newPage();
  const shot = async (name) => {
    await sleep(700);
    const p = path.join(OUT, name + '.png');
    await page.screenshot({ path: p });
    console.log('  ' + name + '.png');
  };

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 40000 });
  await shot('01-login');

  // One-click demo sign-in, the way a person would.
  const clicked = await page.evaluate(() => {
    const c = document.querySelector('[data-demo-user="developer"]');
    if (c) { c.click(); return 'developer'; }
    return null;
  });
  if (!clicked) { console.log('  no demo card found'); }
  await sleep(2500);
  await shot('02-dashboard');

  // Each tab in turn.
  const tabs = ['inventory', 'alloc', 'consumable', 'demand', 'maintenance', 'reports'];
  for (const t of tabs) {
    const ok = await page.evaluate((tab) => {
      const el = document.querySelector('[data-tab="' + tab + '"]');
      if (el) { el.click(); return true; }
      return false;
    }, t);
    if (ok) await shot('03-tab-' + t);
  }

  // Every dialog in the document, opened one at a time and photographed.
  const modals = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.modal-backdrop').forEach((m) => { if (m.id) out.push(m.id); });
    return out;
  });
  console.log('  dialogs found: ' + modals.length);
  for (const id of modals) {
    const ok = await page.evaluate((mid) => {
      const m = document.getElementById(mid);
      if (!m) return false;
      m.classList.remove('hidden');
      m.style.display = '';
      return true;
    }, id);
    if (ok) await shot('modal-' + id);
    await page.evaluate((mid) => {
      const m = document.getElementById(mid);
      if (m) { m.classList.add('hidden'); m.style.display = ''; }
    }, id);
  }

  await browser.close();
  console.log('\nscreenshots in ' + OUT);
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
