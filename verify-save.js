// Logs in, then makes the client save its state - the step that used to fail
// with "value is not defined" in api/_rbac.js. Reports any 5xx.
//
//   node verify-save.js
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
    defaultViewport: { width: 1440, height: 1000 },
  });
  const page = await browser.newPage();

  const serverErrors = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/state') && r.request().method() === 'POST') {
      serverErrors.push('POST /api/state -> ' + r.status());
    }
  });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 40000 });
  await sleep(800);

  // Sign in through the demo card, exactly as a person would.
  const who = await page.evaluate(() => {
    const c = document.querySelector('[data-demo-user="developer"]');
    if (!c) return null;
    c.click();
    return 'developer';
  });
  console.log('signed in as: ' + who);
  await sleep(3000);

  // Ask the app to put its state on the server.
  const saved = await page.evaluate(async () => {
    if (typeof __apiPersist === 'function') { __apiPersist(); return '__apiPersist'; }
    if (typeof pushState === 'function') { await pushState(); return 'pushState'; }
    if (typeof saveState === 'function') { await saveState(); return 'saveState'; }
    return 'no save function found';
  });
  console.log('save called via: ' + saved);
  await sleep(2500);

  console.log('\nPOST /api/state results: ' + (serverErrors.length ? serverErrors.join(', ') : 'none seen'));
  const rbac = serverErrors.filter(s => s.includes('500'));
  console.log('500s: ' + rbac.length);
  console.log('console errors: ' + (consoleErrors.length ? consoleErrors.join(' | ') : 'none'));

  await browser.close();
  process.exit(rbac.length ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e && e.message || e)); process.exit(2); });
