// film.js — THE FILM. A pure function of time: draw(g, t, ctx) paints frame t.
// Rules (enforced by `npm run lint`): no Math.random, no timers, no Date/performance clocks,
// no state carried between frames. Everything derives from t.
//
// This file ships as a working 8-second demo so the pipeline can be tested end to end.
// Replace the scenes with your own film.

import { spring, track, trackN, inOut, swapAlpha, clamp, lerp, tween, ease, runScenes, beatGrid, hash, noise1 } from './lib/motion.js';
import { kinetic, font, fillRR, rr, cursor, press, fitSize } from './lib/draw.js';

const C = {
  bg: '#141413', ink: '#F0EEE6', dim: '#8A877D', accent: '#D97757', panel: '#1F1E1C', line: '#2C2A27',
};

export default {
  title: 'demo',
  duration: 8,
  fps: 60,
  size: '1080x1920', // override with ?size=1080x1080 or render --size
  fonts: [
    { family: 'Inter', url: 'assets/fonts/Inter-500.woff2', weight: 500 },
    { family: 'Inter', url: 'assets/fonts/Inter-700.woff2', weight: 700 },
    { family: 'Inter', url: 'assets/fonts/Inter-800.woff2', weight: 800 },
    { family: 'Instrument Serif', url: 'assets/fonts/InstrumentSerif-400.woff2', weight: 400 },
    { family: 'Instrument Serif', url: 'assets/fonts/InstrumentSerif-400-italic.woff2', weight: 400, style: 'italic' },
    { family: 'JetBrains Mono', url: 'assets/fonts/JetBrainsMono-400.woff2', weight: 400 },
  ],
  assets: {}, // { logo: 'assets/img/logo.png' } → ctx.assets.logo

  // Sound effects, placed next to the animation keys they belong to. `node tools/sfx.mjs` renders them.
  cues: [
    { t: 0.05, type: 'thump', gain: 0.6 },
    { t: 1.78, type: 'whoosh' }, { t: 3.78, type: 'whoosh' }, { t: 5.78, type: 'whoosh' },
    ...[2.0, 2.5, 3.0, 3.5].map((t, i) => ({ t, type: 'pop', gain: 0.5, pitch: 1 + i * 0.12, pan: 0.3 + i * 0.13 })),
    { t: 4.32, type: 'click' }, { t: 4.78, type: 'ding', gain: 0.8 }, { t: 4.98, type: 'pop', pitch: 0.8 },
    { t: 6.05, type: 'thump' }, { t: 7.45, type: 'swish', gain: 0.6 },
  ],

  draw(g, t, ctx) {
    const { W, H } = ctx;
    const B = beatGrid(ctx.beats || { bpm: 120 });
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    runScenes(SCENES, t, g, ctx, B, t);
    transitions(g, t, ctx);
  },
};

// ---------------------------------------------------------------------------
const SCENES = [
  { from: 0, to: 2, draw: hook },
  { from: 2, to: 4, draw: grid },
  { from: 4, to: 6, draw: morph },
  { from: 6, to: 8, draw: lockup },
];

// 0–2s · Hook: huge kinetic serif, accent underline on a spring, beat-driven counter.
function hook(t, d, g, { W, H, u, cx, cy }, B, T) {
  const size = fitSize(g, 'Made in', W * 0.8, 'Instrument Serif', 400, 40 * u);
  kinetic(g, 'Made in', cx, cy - size * 0.2, t - 0.05, { size, family: 'Instrument Serif', weight: 400, color: C.ink, each: 0.03, out: 1.55 });
  kinetic(g, 'code.', cx, cy + size * 0.75, t - 0.3, { size, family: 'Instrument Serif', weight: 400, color: C.accent, each: 0.05, out: 1.6 });
  const s = inOut(t, 0.55, 1.65, 'snappy', 'snappy');
  g.fillStyle = C.ink;
  g.fillRect(cx - W * 0.3 * s, cy + size * 1.02, W * 0.6 * s, 0.9 * u);
  // frame counter ticking on beats, top-left of the safe area (content, not a corner label)
  g.font = font(3.2 * u, 'JetBrains Mono', 400); g.fillStyle = C.dim; g.textAlign = 'center';
  g.globalAlpha = inOut(t, 0.2, 1.5);
  g.fillText(`seek(${(T).toFixed(2)})  ·  frame ${String(Math.round(T * 60)).padStart(3, '0')}`, cx, cy - size * 1.35);
  g.globalAlpha = 1; g.textAlign = 'left';
}

// 2–4s · Grid: tiles spring in on a diagonal stagger, a wave of accent passes on each beat.
function grid(t, d, g, { W, H, u, cx, cy }, B, T) {
  const cols = 6, gap = 2 * u, cell = (W * 0.84 - gap * (cols - 1)) / cols;
  const rows = Math.floor((H * 0.62) / (cell + gap));
  const ox = cx - (cols * cell + (cols - 1) * gap) / 2, oy = cy - (rows * cell + (rows - 1) * gap) / 2;
  const pulse = B.pulse(T, 7);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, diag = r + c;
    const tin = diag * 0.035 + hash(i, 3) * 0.05;
    const tout = 1.45 + (rows + cols - diag) * 0.02;
    const s = spring(t - tin, 'playful') - spring(t - tout, 'snappy');
    if (s <= 0.001) continue;
    const wave = Math.exp(-Math.pow((diag - (t * 9) % (rows + cols + 6)) / 1.6, 2));
    const rad = lerp(cell * 0.5, cell * 0.16, clamp(s)) ;
    const sz = cell * s * (1 + 0.06 * pulse * (i % 3 === 0));
    const x = ox + c * (cell + gap) + (cell - sz) / 2, y = oy + r * (cell + gap) + (cell - sz) / 2;
    fillRR(g, x, y, sz, sz, rad, wave > 0.5 ? C.accent : i % 7 === 0 ? C.ink : C.panel);
  }
  kinetic(g, 'Springs, not fades.', cx, oy + rows * (cell + gap) + 9 * u, t - 0.25,
    { size: 6.4 * u, family: 'Inter', weight: 700, color: C.ink, by: 'word', out: 1.4 });
}

// 4–6s · Morph: one container that never cuts — button → loader → check → card. Cursor drives it.
function morph(t, d, g, { W, H, u, cx, cy }, B, T) {
  const k = { press: 0.32, load: 0.42, done: 0.78, card: 0.98 };
  const w = track(t, [[0, 0], [0.05, 46 * u], [k.load, 14 * u], [k.card, 78 * u]], 'default');
  const h = track(t, [[0, 0], [0.05, 14 * u], [k.card, 52 * u]], 'default');
  const r = track(t, [[0, 7 * u], [k.load, 7 * u], [k.card, 4 * u]], 'snappy');
  const exit = spring(t - 1.74, 'snappy');
  const x = cx - w / 2, y = cy - h / 2 - 4 * u + exit * 8 * u;
  const hover = clamp((t - 0.3) / 0.1) * (1 - clamp((t - k.load) / 0.05));
  const fill = t < k.done ? (hover ? '#E68A6C' : C.accent) : t < k.card ? '#3E8E5E' : C.panel;
  g.globalAlpha = 1 - exit;
  fillRR(g, x, y, w, h, r, fill);

  g.textAlign = 'center'; g.textBaseline = 'middle';
  // label: "Render"
  g.globalAlpha = swapAlpha(t, 0.05, k.load) * (1 - exit);
  g.font = font(5 * u, 'Inter', 700); g.fillStyle = '#fff'; g.fillText('Render film', cx, y + h / 2);
  // loader ring
  const la = swapAlpha(t, k.load, k.done);
  if (la > 0) {
    g.globalAlpha = la * (1 - exit); g.strokeStyle = '#fff'; g.lineWidth = 1.1 * u; g.lineCap = 'round';
    const a0 = t * 9;
    g.beginPath(); g.arc(cx, y + h / 2, 3.4 * u, a0, a0 + 4.2); g.stroke();
  }
  // check
  const ca = swapAlpha(t, k.done, k.card);
  if (ca > 0) {
    const p = spring(t - k.done - 0.05, 'snappy');
    g.globalAlpha = ca * (1 - exit); g.strokeStyle = '#fff'; g.lineWidth = 1.3 * u; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - 3 * u, y + h / 2); g.lineTo(cx - 0.8 * u, y + h / 2 + 2.4 * u * p); g.lineTo(cx - 0.8 * u + 4 * u * p, y + h / 2 + 2.4 * u - 5 * u * p); g.stroke();
  }
  // card content: a chart that draws itself
  const cardA = swapAlpha(t, k.card, 9);
  if (cardA > 0) {
    g.globalAlpha = cardA * (1 - exit); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = font(3 * u, 'JetBrains Mono', 400); g.fillStyle = C.dim; g.fillText('out/final.mp4', x + 5 * u, y + 8 * u);
    g.font = font(7 * u, 'Inter', 800); g.fillStyle = C.ink; g.fillText('60 fps', x + 5 * u, y + 16 * u);
    const bars = 12;
    for (let i = 0; i < bars; i++) {
      const s = spring(t - k.card - 0.1 - i * 0.025, 'playful');
      const bh = (0.35 + 0.65 * hash(i, 11)) * 24 * u * s;
      const bw = (w - 10 * u - (bars - 1) * 1.4 * u) / bars;
      fillRR(g, x + 5 * u + i * (bw + 1.4 * u), y + h - 5 * u - bh, bw, bh, 0.8 * u, i === 8 ? C.accent : C.line);
    }
  }
  g.globalAlpha = 1; g.textAlign = 'left'; g.textBaseline = 'alphabetic';

  // cursor path: enters, clicks the button, leaves
  const [px, py] = trackN(t, [[0, [cx + 30 * u, cy + 40 * u]], [0.08, [cx + 8 * u, cy - 2 * u]], [0.85, [cx + 30 * u, cy + 34 * u]]], 'default');
  g.globalAlpha = inOut(t, 0.05, 1.0);
  cursor(g, px, py, u * 0.2, press(t, k.press));
  g.globalAlpha = 1;
}

// 6–8s · Lockup and loop: title settles, then everything clears so frame 8.0 == frame 0.
function lockup(t, d, g, { W, H, u, cx, cy }, B, T) {
  const out = 1.45;
  const size = fitSize(g, 'motion studio', W * 0.8, 'Inter', 800, 16 * u);
  kinetic(g, 'motion studio', cx, cy + size * 0.35, t - 0.05, { size, family: 'Inter', weight: 800, color: C.ink, each: 0.022, tracking: -0.045, out });
  const dot = inOut(t, 0.45, out + 0.05, 'playful', 'snappy');
  g.fillStyle = C.accent;
  g.beginPath(); g.arc(cx + W * 0.4 * 0.98, cy - size * 0.3, 1.6 * u * dot, 0, Math.PI * 2); g.fill();
  g.globalAlpha = inOut(t, 0.6, out - 0.1);
  g.font = font(3.4 * u, 'Inter', 500); g.fillStyle = C.dim; g.textAlign = 'center';
  g.fillText('/motion-reel  ·  springs  ·  beats  ·  critique loop', cx, cy + size * 1.25);
  g.globalAlpha = 1; g.textAlign = 'left';
}

// Accent wipes on the cuts at 2s, 4s, 6s.
function transitions(g, t, { W, H }) {
  for (const at of [2, 4, 6]) {
    const p = tween(t, at - 0.22, at + 0.22, ease.inOutExpo);
    if (p <= 0 || p >= 1) continue;
    const y0 = H * (p < 0.5 ? 0 : (p - 0.5) * 2), y1 = H * (p < 0.5 ? p * 2 : 1);
    g.fillStyle = C.accent; g.fillRect(0, y0, W, y1 - y0);
  }
}
