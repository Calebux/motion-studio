#!/usr/bin/env node
// capture.mjs — gather real brand assets from a live site: screenshots, logo candidates, colors, fonts.
//
//   node tools/capture.mjs https://product.com
//   node tools/capture.mjs https://product.com/pricing --name pricing --mobile
//
// Writes assets/img/<name>-desktop.png, <name>-mobile.png, <name>-full.png, logo-*.{png,svg}
// and assets/brand.json { url, title, colors: [...], fonts: [...], logos: [...] }. Never redraw UI — animate these.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { parseArgs } from './lib/args.mjs';
import { launch } from './lib/browser.mjs';

const a = parseArgs();
const url = a._[0];
if (!url) { console.error('usage: node tools/capture.mjs <url> [--name home] [--mobile]'); process.exit(1); }
const name = a.name || 'home';
mkdirSync('assets/img', { recursive: true });
const browser = await launch({ withProxy: true });
const shots = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.waitForLoadState('load'));
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => (document.body?.innerText || '').trim().length);
  if (!text) throw new Error(`Page at ${url} rendered empty (blocked, proxy, or needs login). Nothing captured.`);
  // dismiss common cookie banners without accepting tracking
  for (const t of ['Reject all', 'Decline', 'Only necessary', 'Necessary only', 'Close']) {
    const b = page.getByRole('button', { name: t }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; }
  }
  await page.screenshot({ path: `assets/img/${name}-desktop.png` }); shots.push(`${name}-desktop.png`);
  await page.screenshot({ path: `assets/img/${name}-full.png`, fullPage: true }); shots.push(`${name}-full.png`);

  const brand = await page.evaluate(() => {
    const count = new Map();
    const bump = (c, w) => { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; count.set(c, (count.get(c) || 0) + w); };
    const fonts = new Map();
    for (const el of document.querySelectorAll('body, body *')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.top > 3000) continue;
      const s = getComputedStyle(el), area = Math.min(r.width * r.height, 400000) / 1000;
      bump(s.backgroundColor, area);
      if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
        bump(s.color, 5);
        const f = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        fonts.set(f, (fonts.get(f) || 0) + (parseFloat(s.fontSize) || 16));
      }
      if (el.matches('a, button, [role=button]')) bump(s.backgroundColor, 60);
    }
    const hex = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return c; const [r, g, b] = m.map(Number); return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(); };
    const logos = [...document.querySelectorAll('header img, header svg, nav img, nav svg, a[href="/"] img, a[href="/"] svg, [class*=logo] img, [class*=logo] svg, img[alt*=logo i]')]
      .slice(0, 6).map((el, i) => {
        const r = el.getBoundingClientRect();
        return { i, tag: el.tagName.toLowerCase(), src: el.currentSrc || el.src || null, svg: el.tagName.toLowerCase() === 'svg' ? el.outerHTML : null, box: [r.x, r.y, r.width, r.height] };
      }).filter((l) => l.box[2] > 8 && l.box[3] > 8);
    return {
      title: document.title,
      colors: [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([c]) => hex(c)),
      fonts: [...fonts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([f]) => f),
      logos,
    };
  });
  const logos = [];
  for (const l of brand.logos) {
    if (l.svg) { const f = `logo-${l.i}.svg`; writeFileSync(`assets/img/${f}`, l.svg.includes('xmlns') ? l.svg : l.svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')); logos.push(f); }
    else { const f = `logo-${l.i}.png`; await page.screenshot({ path: `assets/img/${f}`, clip: { x: l.box[0], y: l.box[1], width: l.box[2], height: l.box[3] }, omitBackground: true }).catch(() => {}); logos.push(f); }
  }
  if (a.mobile) {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await mp.waitForTimeout(1000);
    await mp.screenshot({ path: `assets/img/${name}-mobile.png` }); shots.push(`${name}-mobile.png`);
    await m.close();
  }
  const file = 'assets/brand.json';
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const out = { ...prev, url: prev.url || url, title: brand.title, colors: brand.colors, fonts: brand.fonts, logos, shots: [...new Set([...(prev.shots || []), ...shots])] };
  writeFileSync(file, JSON.stringify(out, null, 1));
  if (brand.colors.includes('#0000EE') || /^Times/.test(brand.fonts[0] || ''))
    console.warn('⚠ The page looks UNSTYLED (default blue links / Times). Its CSS probably failed to load (network, proxy, bot wall). Do not animate these screenshots — retry, or ask for screenshots.');
  console.log(`✔ ${shots.length} screenshots, ${logos.length} logo candidates → assets/img/\n✔ assets/brand.json  colors: ${brand.colors.slice(0, 5).join(' ')}  fonts: ${brand.fonts.join(', ')}`);
  console.log('  Check the logo candidates by eye. Brand fonts: download the real files into assets/fonts/ if licensed; otherwise pick the closest bundled face.');
} catch (e) { console.error('✖ ' + e.message); process.exitCode = 1; }
await browser.close();
