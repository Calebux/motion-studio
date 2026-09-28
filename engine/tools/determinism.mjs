#!/usr/bin/env node
// determinism.mjs — prove the film is a pure function of time.
// 1) Sweep: seek every frame once (catches exceptions like negative radii, NaN, missing assets).
// 2) Order test: hash N frames in order, reload, hash them shuffled. Any mismatch = state carried between frames.
import { parseArgs, num } from './lib/args.mjs';
import { serve } from './lib/server.mjs';
import { launch, openFilm } from './lib/browser.mjs';

const a = parseArgs();
const { server, url } = await serve(process.cwd());
const browser = await launch();
let code = 0;
try {
  const { page, meta, errors } = await openFilm(browser, url, { size: a.size });
  const fps = num(a.fps, meta.fps), total = Math.round(meta.duration * fps);
  // 1) sweep
  const bad = await page.evaluate(([total, fps]) => {
    const out = [];
    for (let f = 0; f < total; f++) { try { window.seek(f / fps); } catch (e) { out.push(`${(f / fps).toFixed(3)}s: ${e.message}`); if (out.length > 5) break; } }
    return out;
  }, [total, fps]);
  if (bad.length) { console.error('✖ seek(t) threw:\n  ' + bad.join('\n  ')); code = 1; }
  else console.log(`✔ sweep: ${total} frames seek cleanly`);
  if (errors.length) { console.error('✖ page errors:\n  ' + errors.join('\n  ')); code = 1; }

  // 2) order independence
  const n = num(a.samples, 12);
  const times = Array.from({ length: n }, (_, i) => +(((i + 0.37) / n) * meta.duration).toFixed(4));
  const h1 = {};
  for (const t of times) h1[t] = await page.evaluate((t) => window.__hash(t), t);
  const second = await openFilm(browser, url, { size: a.size });
  const shuffled = [...times].sort((x, y) => ((x * 7919) % 1) - ((y * 7919) % 1)).reverse();
  const diffs = [];
  for (const t of shuffled) { const h = await second.page.evaluate((t) => window.__hash(t), t); if (h !== h1[t]) diffs.push(t); }
  // same page, same t twice with other frames in between
  for (const t of times.slice(0, 4)) { const h = await second.page.evaluate((t) => window.__hash(t), t); if (h !== h1[t] && !diffs.includes(t)) diffs.push(t); }
  if (diffs.length) { console.error(`✖ not deterministic at t = ${diffs.join(', ')} — frames depend on render order (carried state, Math.random, clocks)`); code = 1; }
  else console.log(`✔ determinism: ${n} frames identical across reload and shuffled order`);
} catch (e) { console.error('✖ ' + e.message); code = 1; }
await browser.close(); server.close();
process.exit(code);
