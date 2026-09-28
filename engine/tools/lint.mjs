#!/usr/bin/env node
// lint.mjs — enforce the render contract on film code (film.js + scenes/**).
// A film must be a pure function of time. These patterns break determinism or look cheap.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = ['film.js'];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(m?js|html|css)$/.test(f) && files.push(p); } };
if (existsSync('scenes')) walk('scenes');

const RULES = [
  [/\bMath\.random\s*\(/, 'Math.random — use rng(seed) or hash(i, seed) from lib/motion.js'],
  [/\bDate\.now\s*\(|\bnew Date\s*\(/, 'wall clock — derive everything from t'],
  [/\bperformance\.now\s*\(/, 'wall clock — derive everything from t'],
  [/\bset(Timeout|Interval)\s*\(/, 'timers — derive everything from t'],
  [/\brequestAnimationFrame\s*\(/, 'requestAnimationFrame — the runtime owns the clock'],
  [/\.animate\s*\(/, 'Web Animations API — not seekable, use springs/tweens of t'],
  [/transition\s*:/, 'CSS transition — not seekable'],
  [/@keyframes|animation\s*:/, 'CSS animation — not seekable'],
  [/will-change/, 'will-change — blurs text under camera scale'],
];
// Module-level mutable state that draw() writes to = state carried between frames.
const STATEFUL = /^\s*(let|var)\s+([A-Za-z_$][\w$]*)/;

let problems = 0;
for (const f of files) {
  if (!existsSync(f)) { console.error(`✖ ${f} missing`); problems++; continue; }
  const lines = readFileSync(f, 'utf8').split('\n');
  let depth = 0;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
    for (const [re, msg] of RULES) if (msg && re.test(line)) { console.error(`✖ ${f}:${i + 1}  ${msg}\n    ${raw.trim()}`); problems++; }
    if (depth === 0 && STATEFUL.test(line)) {
      const name = STATEFUL.exec(line)[2];
      console.warn(`⚠ ${f}:${i + 1}  module-level \`${raw.trim().split('=')[0].trim()}\` — if draw() mutates it, frames depend on render order. Prefer const + pure functions.`);
    }
    depth += (line.match(/[{(\[]/g) || []).length - (line.match(/[})\]]/g) || []).length;
  });
}
// film must declare a duration
try {
  const src = readFileSync('film.js', 'utf8');
  if (!/duration\s*:/.test(src)) { console.error('✖ film.js: export default { duration: <seconds>, ... } is required'); problems++; }
} catch {}
if (problems) { console.error(`\n${problems} problem(s). Fix before rendering.`); process.exit(1); }
console.log(`✔ lint: ${files.length} file(s) clean`);
