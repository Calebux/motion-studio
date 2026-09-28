#!/usr/bin/env node
// sfx.mjs — synthesize UI sound effects on exact times.
//
//   node tools/sfx.mjs                 cues from film.js → export `cues` (preferred: keep cues next to the keys)
//   node tools/sfx.mjs cues.json       cues from a file
//
// cue: { t: 1.25, type: 'click', gain: 1, pan: 0.5, pitch: 1 }
// types: click tick pop thump whoosh swish riser impact ding type glitch snap
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { writeWav } from './lib/wav.mjs';

const a = parseArgs();
const SR = 48000;
let cues, duration;
if (a._[0] && existsSync(a._[0])) cues = JSON.parse(readFileSync(a._[0], 'utf8'));
const film = (await import(pathToFileURL(process.cwd() + '/film.js').href)).default;
duration = film.duration;
if (!cues) cues = typeof film.cues === 'function' ? film.cues() : film.cues || [];
if (!cues.length) { console.log('No cues (add `cues` to film.js or pass cues.json). Nothing to do.'); process.exit(0); }

const N = Math.ceil((Math.max(duration, ...cues.map((c) => c.t)) + 2) * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 42;
const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2147483648 - 1);
const TAU = Math.PI * 2;

// Each voice: [lengthSeconds, (t, state) => sample]
const VOICES = {
  click:  [0.05, (t, p) => Math.sin(TAU * 1800 * p * t) * Math.exp(-t * 90) * 0.5 + noise() * Math.exp(-t * 400) * 0.2],
  tick:   [0.03, (t, p) => Math.sin(TAU * 3200 * p * t) * Math.exp(-t * 160) * 0.35],
  pop:    [0.15, (t, p) => Math.sin(TAU * (500 + 1100 * t) * p * t) * Math.exp(-t * 28) * 0.45],
  thump:  [0.5,  (t, p) => Math.sin(TAU * (90 - 55 * t) * p * t) * Math.exp(-t * 9) * 0.9],
  whoosh: [0.45, (t) => { const e = Math.sin(Math.PI * Math.min(1, t / 0.45)); return noise() * e * e * 0.3; }],
  swish:  [0.22, (t) => noise() * Math.sin(Math.PI * Math.min(1, t / 0.22)) * 0.25],
  riser:  [1.0,  (t, p) => (noise() * 0.25 + Math.sin(TAU * (200 + 900 * t * t) * p * t) * 0.1) * t * t],
  impact: [1.4,  (t, p) => Math.sin(TAU * (40 + 50 * Math.exp(-t * 6)) * p * t) * Math.exp(-t * 2.5) * 0.9 + noise() * Math.exp(-t * 12) * 0.35],
  ding:   [0.9,  (t, p) => (Math.sin(TAU * 1320 * p * t) + 0.5 * Math.sin(TAU * 1980 * p * t)) * Math.exp(-t * 5) * 0.25],
  type:   [0.04, (t, p) => (noise() * 0.5 + Math.sin(TAU * 900 * p * t)) * Math.exp(-t * 180) * 0.3],
  glitch: [0.18, (t) => (Math.floor(t * 180) % 2 ? 1 : -1) * (noise() > 0 ? 0.3 : 0.1) * Math.exp(-t * 10)],
  snap:   [0.08, (t) => noise() * Math.exp(-t * 70) * 0.6],
};

// Filtered-noise voices get a one-pole lowpass so they don't sound like static.
const LOWPASS = { whoosh: 0.12, swish: 0.3, riser: 0.2, snap: 0.5 };

for (const c of cues) {
  const v = VOICES[c.type];
  if (!v) { console.warn(`  skip unknown sfx type "${c.type}" at ${c.t}s. Types: ${Object.keys(VOICES).join(' ')}`); continue; }
  const [len, fn] = v, start = Math.floor(c.t * SR), g = c.gain ?? 1, pan = c.pan ?? 0.5, p = c.pitch ?? 1, lpA = LOWPASS[c.type];
  let lp = 0;
  for (let i = 0; i < len * SR && start + i < N; i++) {
    let s = fn(i / SR, p);
    if (lpA) { lp += lpA * (s - lp); s = lp * 2.2; }
    L[start + i] += s * g * Math.cos((pan * Math.PI) / 2) * 1.414;
    R[start + i] += s * g * Math.sin((pan * Math.PI) / 2) * 1.414;
  }
}
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
if (peak > 0.95) { const k = 0.95 / peak; for (let i = 0; i < N; i++) { L[i] *= k; R[i] *= k; } }
mkdirSync('out', { recursive: true });
const out = a.out || 'out/sfx.wav';
writeWav(out, [L, R], SR);
console.log(`✔ ${out}  (${cues.length} cues)`);
