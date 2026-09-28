// Launch headless Chromium via Playwright, with fallbacks for pinned/preinstalled browsers.
import { existsSync } from 'node:fs';

// withProxy: route through HTTP(S)_PROXY — only for fetching the open web (capture). Renders stay local.
export async function launch({ withProxy = false } = {}) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium'); }
  const args = ['--disable-gpu-vsync', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars'];
  // Respect HTTP(S)_PROXY so asset capture works behind corporate/sandbox proxies.
  const px = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  const proxy = withProxy && px ? { proxy: { server: px, bypass: '127.0.0.1,localhost' } } : {};
  const tries = [{}];
  if (process.env.CHROMIUM_PATH) tries.unshift({ executablePath: process.env.CHROMIUM_PATH });
  for (const p of ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) if (existsSync(p)) tries.push({ executablePath: p });
  let err;
  for (const extra of tries) {
    try { return await chromium.launch({ args, ...proxy, ...extra }); } catch (e) { err = e; }
  }
  throw new Error('Could not launch Chromium. Run: npx playwright install chromium\n' + err?.message);
}

// Open the film page and wait until the runtime is ready.
export async function openFilm(browser, url, { size } = {}) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 800, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
  const q = new URLSearchParams({ render: '1', v: String(Date.now()) });
  if (size) q.set('size', size);
  await page.goto(`${url}/index.html?${q}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }); }
  catch { throw new Error('Film failed to boot:\n' + (errors.join('\n') || 'timeout waiting for window.__ready')); }
  const meta = await page.evaluate(() => window.__film);
  if (errors.length) console.warn('[motion] page errors:\n  ' + errors.join('\n  '));
  return { page, ctx, meta, errors };
}
