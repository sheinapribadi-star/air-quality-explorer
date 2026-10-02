// Capture README screenshots from a running preview server (npm run preview).
// Usage: node scripts/screenshots.mjs [baseUrl]   (default http://localhost:4173/air-quality-explorer/)
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4173/air-quality-explorer/';
const OUT = new URL('../screenshots/', import.meta.url).pathname;
const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const errors = [];

async function page(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr || 2, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return p;
}
async function ready(p) {
  await p.waitForSelector('.pin', { timeout: 30000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(1200);
}

// 1. Desktop overview
let p = await page({ width: 1440, height: 1000 });
await p.goto(BASE); await ready(p);
await p.screenshot({ path: OUT + '01-desktop-overview.png' });
await p.locator('#regions button[data-r="us"]').click();
await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + '01b-desktop-us.png' });
await p.locator('#regions button[data-r="bay"]').click();
await p.waitForTimeout(1000);

// 2. City panel open (click Berkeley marker)
await p.locator('.leaflet-marker-icon[title="Berkeley"]').click();
await p.mouse.move(1300, 120);
await p.waitForTimeout(1200);
await p.screenshot({ path: OUT + '02-city-panel.png' });
await p.locator('#panel').evaluate((el) => el.scrollTo(0, el.scrollHeight));
await p.waitForTimeout(500);
await p.screenshot({ path: OUT + '03-model-insight.png' });

// 3. Comparison view
await p.locator('#compare').scrollIntoViewIfNeeded();
await p.evaluate(() => document.querySelector('#compare').scrollIntoView({ block: 'start' }));
await p.waitForTimeout(900);
await p.screenshot({ path: OUT + '04-compare.png' });
await p.locator('#cmpLog').check();
await p.waitForTimeout(800);
await p.screenshot({ path: OUT + '04b-compare-log.png' });
await p.locator('#cmpLog').uncheck();
p = await page({ width: 1440, height: 1000 });
await p.goto(BASE); await ready(p);
await p.screenshot({ path: OUT + '00-desktop-fullpage.png', fullPage: true });

// 4. Mobile
p = await page({ width: 390, height: 844 }, { mobile: true, dpr: 3 });
await p.goto(BASE); await ready(p);
await p.screenshot({ path: OUT + '05-mobile.png' });
await p.goto(BASE + '?city=jakarta'); await ready(p);
await p.evaluate(() => document.querySelector('#panel').scrollIntoView({ block: 'start' }));
await p.waitForTimeout(800);
await p.screenshot({ path: OUT + '06-mobile-city.png' });
await p.screenshot({ path: OUT + '07-mobile-fullpage.png', fullPage: true });

await browser.close();
console.log(errors.length ? 'Page errors:\n' + errors.join('\n') : 'No page errors.');
