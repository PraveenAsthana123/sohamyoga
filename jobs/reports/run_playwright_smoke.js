#!/usr/bin/env node
/**
 * SohamYoga Playwright smoke — browser-driven E2E across the public site.
 * Renders 7 pages, asserts no "Page not found" in the visible body,
 * grabs title + heading + screenshot for each. Exits 0 if all pass.
 *
 * Run: npx --yes playwright@latest exec -- node jobs/reports/run_playwright_smoke.js
 *   or: node jobs/reports/run_playwright_smoke.js  (when playwright is available)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8085';
const TS = new Date().toISOString().replace(/[:.]/g, '-').replace(/-\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname);
const SCREENS_DIR = path.join(OUT_DIR, `playwright_${TS}`);
fs.mkdirSync(SCREENS_DIR, { recursive: true });

const ROUTES = [
  { label: 'home',                 url: '/',                                expectInTitle: 'SohamYoga' },
  { label: 'about',                url: '/about',                           expectInTitle: 'About' },
  { label: 'blog-list',            url: '/blog',                            expectInTitle: 'Blog' },
  { label: 'industries-banking',   url: '/industries/banking-finance',      expectInTitle: 'Banking' },
  { label: 'industries-oil-gas',   url: '/industries/oil-gas',              expectInTitle: 'Oil' },
  { label: 'services-sharepoint',  url: '/services/sharepoint',             expectInTitle: 'SharePoint' },
  { label: 'contact',              url: '/contact',                         expectInTitle: 'Contact' },
];

const NEG_NOT_FOUND_MARKERS = [
  'This page could not be found',
  'Industry Not Found',
  'Service Not Found',
  'Post Not Found',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const results = [];
  let pass = 0;

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));

    const t0 = Date.now();
    let status = 0, title = '', heading = '', bodyText = '', errMsg = '';
    try {
      const resp = await page.goto(BASE + route.url, { waitUntil: 'networkidle', timeout: 15000 });
      status = resp ? resp.status() : 0;
      title = await page.title();
      heading = await page.locator('h1').first().textContent({ timeout: 2000 }).catch(() => '') || '';
      // innerText excludes hidden + script content — avoids false positives from
      // Next.js bundled not-found template strings.
      bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
    } catch (e) {
      errMsg = String(e).slice(0, 300);
    }
    const ms = Date.now() - t0;

    const notFoundHit = NEG_NOT_FOUND_MARKERS.find(m => bodyText.includes(m));
    const titleHasExpect = title.includes(route.expectInTitle);
    const ok = status === 200 && titleHasExpect && !notFoundHit && !errMsg;

    const png = path.join(SCREENS_DIR, `${route.label}.png`);
    try { await page.screenshot({ path: png, fullPage: false }); } catch { /* ignore */ }

    results.push({
      label: route.label,
      url: BASE + route.url,
      status,
      title,
      heading: (heading || '').slice(0, 100),
      expectInTitle: route.expectInTitle,
      ok,
      notFoundHit: notFoundHit || null,
      consoleErrors: consoleErrors.slice(0, 5),
      ms,
      err: errMsg || null,
      screenshot: path.relative(OUT_DIR, png),
    });
    if (ok) pass++;
    await page.close();
  }

  await browser.close();

  const total = results.length;
  const fail = total - pass;
  const json = path.join(OUT_DIR, `playwright_smoke_${TS}.json`);
  const md = path.join(OUT_DIR, `playwright_smoke_${TS}.md`);
  fs.writeFileSync(json, JSON.stringify({ ts: TS, total, pass, fail, results }, null, 2));

  const lines = [
    `# Playwright Smoke Report`,
    ``,
    `**Run:** ${TS}  `,
    `**Total:** ${total}  **Pass:** ${pass}  **Fail:** ${fail}  `,
    `**Screenshots:** \`playwright_${TS}/\``,
    ``,
    `| Label | URL | Status | OK | Title | H1 | ms | Console errors | 404 marker |`,
    `|---|---|---:|:---:|---|---|---:|---:|---|`,
    ...results.map(r =>
      `| ${r.label} | \`${r.url}\` | ${r.status} | ${r.ok ? '✓' : '✗'} | ${(r.title || '').slice(0, 60)} | ${r.heading} | ${r.ms} | ${r.consoleErrors.length} | ${r.notFoundHit || '—'} |`
    ),
  ];
  fs.writeFileSync(md, lines.join('\n') + '\n');

  console.log(`json: ${json}`);
  console.log(`md  : ${md}`);
  console.log(`summary: total=${total} pass=${pass} fail=${fail}`);
  if (fail) {
    console.log('\nFAILS:');
    for (const r of results) {
      if (!r.ok) {
        console.log(`  ${r.label.padEnd(28)} status=${r.status} title="${(r.title || '').slice(0, 40)}" 404=${r.notFoundHit || '—'} err=${r.err || '—'}`);
      }
    }
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
