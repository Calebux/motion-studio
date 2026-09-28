#!/usr/bin/env node
// music.mjs — synthesize an original score in code, locked to the same beat grid as the picture.
//
//   node tools/music.mjs score.json            → out/music.wav + beats.json
//   node tools/music.mjs score.json --out x.wav
//
// Because the score IS the grid, beats.json is exact (no detection needed): the film reads it
// through ctx.beats, so cuts, hits and state changes land on the music by construction.
//
// score.json:
// {
//   "bpm": 120, "seed": 7, "swing": 0,
//   "chords": ["Am", "F", "C", "G"],                 // one per bar, cycles
//   "sections": [ { "name": "intro", "bars": 1, "layers": ["pad", "hat"], "riser": true },
//                 { "name": "main",  "bars": 2, "layers": ["pad","kick","snare","hat","bass","arp"], "impact": true } ],
//   "patterns": { "kick": "x...x...x...x...", "snare": "....x.......x...", "hat": "..x...x...x...x.",
//                 "bass": "x..x..x...x..x..", "arp": "x.x.x.x.x.x.x.x." },   // 16 steps per bar; per-section override allowed
//   "mix": { "kick": 1, "snare": 0.7, "hat": 0.35, "bass": 0.6, "pad": 0.35, "arp": 0.3, "riser": 0.35, "impact": 0.8 },
//   "tail": 1.5
// }
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from './lib/args.mjs';
import { writeWav } from './lib/wav.mjs';

const a = parseArgs();
const file = a._[0] || 'score.json';
const S = JSON.parse(readFileSync(file, 'utf8'));
const SR = 48000;
const bpm = S.bpm || 120, spb = 60 / bpm, bar = spb * 4, step = bar / 16;
const sections = S.sections || [{ name: 'main', bars: 4, layers: ['pad', 'kick', 'snare', 'hat', 'bass', 'arp'] }];
const totalBars = sections.reduce((n, s) => n + s.bars, 0);
const musicDur = totalBars * bar;
const tail = S.tail ?? 1.5;
const N = Math.ceil((musicDur + tail) * SR);
const MIX = { kick: 1, snare: 0.7, hat: 0.35, clap: 0.6, bass: 0.6, pad: 0.35, arp: 0.3, riser: 0.35, impact: 0.8, ...(S.mix || {}) };
const PAT = {
  kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', clap: '....x.......x...',
  bass: 'x..x..x...x..x..', arp: 'x.x.x.x.x.x.x.x.', ...(S.patterns || {}),
};

// ---- seeded noise --------------------------------------------------------
let seed = (S.seed ?? 7) >>> 0;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// ---- buses ---------------------------------------------------------------
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N);   // reverb send
const duck = new Float32Array(N).fill(1);                           // sidechain from kick
const add = (i, l, r, send = 0) => { if (i < 0 || i >= N) return; L[i] += l; R[i] += r; if (send) { sendL[i] += l * send; sendR[i] += r * send; } };

// ---- theory --------------------------------------------------------------
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function chord(name) {
  const m = /^([A-G])([#b]?)(m(?!aj))?(maj7|m7|7|sus2|sus4|add9)?$/.exec(name.trim());
  if (!m) throw new Error('Unknown chord: ' + name);
  const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  let iv = m[3] ? [0, 3, 7] : [0, 4, 7];
  if (m[4] === 'sus2') iv = [0, 2, 7]; if (m[4] === 'sus4') iv = [0, 5, 7];
  if (m[4] === '7') iv = [...iv, 10]; if (m[4] === 'maj7') iv = [...iv, 11]; if (m[4] === 'add9') iv = [...iv, 14];
  return { root, iv };
}
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const chords = (S.chords || ['Am', 'F', 'C', 'G']).map(chord);

// ---- voices --------------------------------------------------------------
function kick(t0, g) {
  const n = 0.45 * SR, i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 48 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    const v = (Math.sin(ph) * Math.exp(-t * 7.5) + (i < 90 ? rnd() * 0.25 * (1 - i / 90) : 0)) * g;
    add(i0 + i, v, v);
  }
  // sidechain pump
  for (let i = 0; i < 0.35 * SR; i++) { const j = i0 + i; if (j < N) duck[j] = Math.min(duck[j], 1 - 0.55 * Math.exp(-(i / SR) * 9)); }
}
function snare(t0, g) {
  const n = 0.3 * SR, i0 = Math.round(t0 * SR); let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = rnd(), hp = w - prev; prev = w;
    const v = (hp * 0.6 * Math.exp(-t * 16) + Math.sin(2 * Math.PI * 185 * t) * 0.5 * Math.exp(-t * 30)) * g;
    add(i0 + i, v, v, 0.25);
  }
}
function clap(t0, g) {
  const i0 = Math.round(t0 * SR); let prev = 0;
  for (let i = 0; i < 0.25 * SR; i++) {
    const t = i / SR, w = rnd(), hp = w - prev; prev = w;
    const env = [0, 0.011, 0.022].reduce((e, d) => e + (t >= d ? Math.exp(-(t - d) * 90) : 0), 0) * 0.5 + Math.exp(-t * 14) * 0.5;
    const v = hp * env * g; add(i0 + i, v * 0.9, v, 0.3);
  }
}
function hat(t0, g, open = false) {
  const n = (open ? 0.25 : 0.06) * SR, i0 = Math.round(t0 * SR); let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = rnd(), h1 = w - p1; p1 = w; const h2 = h1 - p2; p2 = h1;
    const v = h2 * 0.35 * Math.exp(-t * (open ? 14 : 70)) * g;
    add(i0 + i, v * 0.8, v, 0.05);
  }
}
function bass(t0, dur, midi, g) {
  const n = Math.floor(dur * SR), i0 = Math.round(t0 * SR), f = hz(midi);
  let ph = 0, lp = 0;
  for (let i = 0; i < n + 0.02 * SR; i++) {
    const t = i / SR; ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1, sub = Math.sin(2 * Math.PI * ph);
    const cutoff = 180 + 900 * Math.exp(-t * 14), a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    lp += a * (saw - lp);
    const env = Math.min(1, t / 0.004) * (i < n ? 1 : Math.max(0, 1 - (i - n) / (0.02 * SR)));
    const v = (lp * 0.55 + sub * 0.6) * env * g;
    add(i0 + i, v, v);
  }
}
function pad(t0, dur, notes, g) {
  const i0 = Math.round(t0 * SR), n = Math.floor(dur * SR), rel = 0.5 * SR;
  const osc = notes.flatMap((m) => [[hz(m) * 1.004, 0.35], [hz(m) * 0.996, 0.65]]).map(([f, pan]) => ({ f, pan, ph: rnd() * 0.5 + 0.5, lp: 0 }));
  for (let i = 0; i < n + rel; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.35) * (i < n ? 1 : Math.max(0, 1 - (i - n) / rel));
    let l = 0, r = 0;
    for (const o of osc) {
      o.ph = (o.ph + o.f / SR) % 1;
      const saw = 2 * o.ph - 1, a = 1 - Math.exp((-2 * Math.PI * (700 + 500 * Math.sin(t * 1.3))) / SR);
      o.lp += a * (saw - o.lp);
      l += o.lp * (1 - o.pan); r += o.lp * o.pan;
    }
    const k = (env * g) / osc.length;
    add(i0 + i, l * k, r * k, 0.5);
  }
}
function pluck(t0, midi, g, pan = 0.5) {
  const f = hz(midi), len = Math.max(2, Math.round(SR / f)), buf = new Float32Array(len).map(() => rnd());
  const i0 = Math.round(t0 * SR), n = Math.floor(0.9 * SR);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const nxt = (idx + 1) % len, v = buf[idx];
    buf[idx] = 0.5 * (buf[idx] + buf[nxt]) * 0.996; idx = nxt;
    const s = v * g * 0.6;
    add(i0 + i, s * (1 - pan) * 2 * 0.5, s * pan * 2 * 0.5, 0.45);
  }
}
function riser(t0, dur, g) {
  const i0 = Math.round(t0 * SR), n = Math.floor(dur * SR); let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n, w = rnd(), a = 1 - Math.exp((-2 * Math.PI * (300 + 7000 * p * p)) / SR);
    lp += a * (w - lp);
    ph += (2 * Math.PI * (200 + 1200 * p * p)) / SR;
    const v = (lp * 0.8 + Math.sin(ph) * 0.12) * p * p * g;
    add(i0 + i, v * (0.5 + 0.5 * p), v, 0.3);
  }
}
function impact(t0, g) {
  const i0 = Math.round(t0 * SR); let ph = 0, lp = 0;
  for (let i = 0; i < 1.6 * SR; i++) {
    const t = i / SR, f = 38 + 60 * Math.exp(-t * 6); ph += (2 * Math.PI * f) / SR;
    const w = rnd(); lp += 0.08 * (w - lp);
    const v = (Math.sin(ph) * Math.exp(-t * 2.2) + lp * 1.5 * Math.exp(-t * 5)) * g;
    add(i0 + i, v, v, 0.35);
  }
}

// ---- sequence ------------------------------------------------------------
const beats = [], downbeats = [], hits = { kick: [], snare: [], clap: [], hat: [], bass: [], arp: [] }, sectionTimes = [];
const swing = S.swing || 0;
const stepTime = (b, s) => b * bar + s * step + (s % 2 === 1 ? swing * step : 0);
let barIdx = 0;
for (const sec of sections) {
  const start = barIdx * bar;
  sectionTimes.push({ name: sec.name || 'section', start: +start.toFixed(4), end: +((barIdx + sec.bars) * bar).toFixed(4), layers: sec.layers });
  const layers = new Set(sec.layers || []);
  const pats = { ...PAT, ...(sec.patterns || {}) };
  if (sec.riser && start > 0) riser(start - bar, bar, MIX.riser);
  if (sec.impact) { impact(start, MIX.impact); hits.impact = [...(hits.impact || []), +start.toFixed(4)]; }
  for (let b = 0; b < sec.bars; b++, barIdx++) {
    const ch = chords[barIdx % chords.length];
    const t0 = barIdx * bar;
    downbeats.push(+t0.toFixed(4));
    for (let q = 0; q < 4; q++) beats.push(+(t0 + q * spb).toFixed(4));
    if (layers.has('pad')) pad(t0, bar, ch.iv.map((iv) => 52 + ((ch.root - 4 + 12) % 12) + iv), MIX.pad);
    for (let s = 0; s < 16; s++) {
      const t = stepTime(barIdx, s);
      const on = (k) => layers.has(k) && pats[k][s % pats[k].length] !== '.';
      if (on('kick')) { kick(t, MIX.kick); hits.kick.push(+t.toFixed(4)); }
      if (on('snare')) { snare(t, MIX.snare); hits.snare.push(+t.toFixed(4)); }
      if (on('clap')) { clap(t, MIX.clap); hits.clap.push(+t.toFixed(4)); }
      if (on('hat')) { hat(t, MIX.hat, pats.hat[s] === 'o'); hits.hat.push(+t.toFixed(4)); }
      if (on('bass')) { bass(t, step * 1.6, 36 + ((ch.root + 12) % 12) + (pats.bass[s] === 'o' ? 12 : 0), MIX.bass); hits.bass.push(+t.toFixed(4)); }
      if (on('arp')) {
        const tones = [...ch.iv, ...ch.iv.map((x) => x + 12)];
        const k = hits.arp.length;
        pluck(t, 60 + ((ch.root + 12) % 12) + tones[k % tones.length], MIX.arp, k % 2 ? 0.3 : 0.7);
        hits.arp.push(+t.toFixed(4));
      }
    }
  }
}

// ---- reverb (Schroeder: 4 combs + 2 allpasses per side) -----------------
function reverb(inp, delays, fb = 0.8, damp = 0.3) {
  const out = new Float32Array(N);
  for (const d of delays) {
    const len = Math.round((d / 1000) * SR), buf = new Float32Array(len); let idx = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[idx]; lp = y * (1 - damp) + lp * damp; buf[idx] = inp[i] + lp * fb; idx = (idx + 1) % len; out[i] += y / delays.length; }
  }
  for (const d of [5.0, 1.7]) {
    const len = Math.round((d / 1000) * SR), buf = new Float32Array(len); let idx = 0;
    for (let i = 0; i < N; i++) { const b = buf[idx], y = -out[i] + b; buf[idx] = out[i] + b * 0.5; out[i] = y; idx = (idx + 1) % len; }
  }
  return out;
}
const wetL = reverb(sendL, [29.7, 37.1, 41.1, 43.7]), wetR = reverb(sendR, [30.9, 36.3, 40.7, 45.1]);

// ---- master --------------------------------------------------------------
// duck everything except the kick itself approximately by applying the pump to the reverb and the full mix lightly
let peak = 0;
for (let i = 0; i < N; i++) {
  const d = 0.35 + 0.65 * duck[i];
  L[i] = Math.tanh((L[i] * (0.6 + 0.4 * d) + wetL[i] * 0.5 * d) * 1.1);
  R[i] = Math.tanh((R[i] * (0.6 + 0.4 * d) + wetR[i] * 0.5 * d) * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / (peak || 1);
for (let i = 0; i < N; i++) { L[i] *= norm; R[i] *= norm; }
// fade the reverb tail
const fadeN = Math.floor(tail * SR);
for (let i = 0; i < fadeN; i++) { const j = N - fadeN + i, g = 1 - i / fadeN; L[j] *= g; R[j] *= g; }

mkdirSync('out', { recursive: true });
const out = a.out || 'out/music.wav';
writeWav(out, [L, R], SR);
const beatsJson = { bpm, spb, duration: +musicDur.toFixed(4), beats, downbeats, sections: sectionTimes, hits, source: 'synth' };
writeFileSync(a.beats || 'beats.json', JSON.stringify(beatsJson, null, 1));
console.log(`✔ ${out}  (${musicDur.toFixed(2)}s + ${tail}s tail, ${bpm} BPM, ${totalBars} bars)  ✔ beats.json`);
