// motion.js — pure functions of time. Everything here is deterministic:
// same inputs, same output, no state carried between calls.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => (b === a ? 0 : clamp((x - a) / (b - a)));
export const remap = (x, a, b, c, d) => lerp(c, d, invlerp(a, b, x));
export const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// ---------------------------------------------------------------------------
// Springs — closed form, so seek(t) never has to simulate earlier frames.
// k = stiffness, d = damping, mass = 1. Returns progress 0 → 1 (may overshoot).
// ---------------------------------------------------------------------------
export const SPRINGS = {
  snappy:  { k: 320, d: 30 }, // buttons, toggles, leading edges
  default: { k: 170, d: 26 }, // cards, containers, camera
  heavy:   { k: 90,  d: 20 }, // big type, 3D objects, logo lockups
  playful: { k: 220, d: 14 }, // mascots, stickers (visible overshoot)
  gentle:  { k: 60,  d: 16 }, // slow drifts, backgrounds
};

const resolve = (p) => (typeof p === 'string' ? SPRINGS[p] || SPRINGS.default : p || SPRINGS.default);

export function spring(t, preset = 'default') {
  if (t <= 0) return 0;
  const { k, d } = resolve(preset);
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  // overdamped
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s), r2 = -w0 * (z + s);
  const c2 = r1 / (r1 - r2), c1 = 1 - c2;
  return 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
}

// Time until a spring is visually settled (|1 - x| < eps and stays there).
export function settleTime(preset = 'default', eps = 0.002) {
  const { k, d } = resolve(preset);
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  return Math.log(1 / eps) / (Math.min(z, 1) * w0);
}

// A value with many targets over time: sum one spring per change.
// keys: [[time, value], ...] sorted by time. Continuous, random-access.
export function track(t, keys, preset = 'default') {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], preset);
  return v;
}

// Same as track() but for [x, y] or any numeric array.
export function trackN(t, keys, preset = 'default') {
  const out = keys[0][1].slice();
  for (let i = 1; i < keys.length; i++) {
    const s = spring(t - keys[i][0], preset);
    for (let j = 0; j < out.length; j++) out[j] += (keys[i][1][j] - keys[i - 1][1][j]) * s;
  }
  return out;
}

// Stretchy indicator: leading edge stiffer than trailing edge.
export function indicator(t, stops, width = 120) {
  const lead = track(t, stops, 'snappy');
  const trail = track(t, stops, { k: 140, d: 22 });
  return { left: Math.min(lead, trail), right: Math.max(lead, trail) + width };
}

// Enter/exit envelope: 0 → 1 with a spring at tIn, 1 → 0 with a spring at tOut.
export function inOut(t, tIn, tOut = Infinity, inP = 'default', outP = 'snappy') {
  return spring(t - tIn, inP) - spring(t - tOut, outP);
}

// Alpha for content inside a morphing container: in after the morph starts, out before the next.
export function swapAlpha(t, tIn, tOut = Infinity, lead = 0.08, fadeIn = 0.12, fadeOut = 0.1) {
  return Math.min(clamp((t - tIn - lead) / fadeIn), clamp((tOut - fadeOut - t) / fadeOut));
}

// Seamless loops: wrap time into [0, dur).
export const loopT = (t, dur) => ((t % dur) + dur) % dur;

// Stagger: start time of item i in a group.
export const stagger = (i, each = 0.04, from = 0) => from + i * each;

// ---------------------------------------------------------------------------
// Easing — for camera moves and linear-feeling things. Prefer springs for UI.
// ---------------------------------------------------------------------------
export const ease = {
  linear: (x) => x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
};
// Eased progress between two times.
export const tween = (t, t0, t1, fn = ease.inOutCubic) => fn(invlerp(t0, t1, t));

// ---------------------------------------------------------------------------
// Seeded randomness — never Math.random.
// ---------------------------------------------------------------------------
export function rng(seed = 1) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Stateless hash → [0, 1). Use when you need random-access randomness: hash(i, seed).
export function hash(i, seed = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Smooth 1D value noise in [-1, 1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}
// Smooth 2D value noise in [-1, 1].
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(a * 73856093 ^ b * 19349663, seed) * 2 - 1;
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

// ---------------------------------------------------------------------------
// Scenes and beats
// ---------------------------------------------------------------------------
// Run the scene whose [from, to) contains t. Scenes get local time and their duration.
export function runScenes(scenes, t, ...args) {
  for (const s of scenes) if (t >= s.from && t < s.to) s.draw(t - s.from, s.to - s.from, ...args);
}
// Cross-scene transition progress around a cut at time `at` (0 before, 1 after).
export const cut = (t, at, dur = 0.4, fn = ease.inOutExpo) => fn(invlerp(at - dur / 2, at + dur / 2, t));

// Beat helpers from a beats.json-like object { bpm, beats, downbeats } or just bpm.
export function beatGrid(beats, offset = 0) {
  const bpm = beats?.bpm || 120, spb = 60 / bpm;
  const list = beats?.beats?.length ? beats.beats : null;
  const beat = (n) => (list && n < list.length ? list[n] : offset + n * spb);
  return {
    bpm, spb,
    beat,
    bar: (n, perBar = 4) => beat(n * perBar),
    // Pulse that peaks on every beat and decays (for kicks, bumps, flashes).
    pulse: (t, decay = 10) => {
      const phase = ((t - offset) % spb + spb) % spb;
      return Math.exp(-phase * decay);
    },
    index: (t) => Math.floor((t - offset) / spb),
  };
}
