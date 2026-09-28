// draw.js — canvas helpers for type, shapes and images. All stateless.
import { spring, clamp, lerp } from './motion.js';

export const font = (size, family = 'Inter', weight = 600, style = 'normal') =>
  `${style} ${weight} ${Math.round(size)}px "${family}"`;

// Largest font size (<= max) so `text` fits in maxW.
export function fitSize(g, text, maxW, family, weight = 700, max = 400, min = 8) {
  g.save();
  g.font = font(100, family, weight);
  const w = g.measureText(text).width;
  g.restore();
  return clamp((100 * maxW) / Math.max(w, 1), min, max);
}

// Word-wrap into lines no wider than maxW (uses current g.font).
export function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Kinetic type: each unit (char or word) rises out of a mask on its own spring.
 * opts: { size, family, weight, color, align: 'center'|'left'|'right', by: 'char'|'word',
 *         each: 0.03 (stagger s), preset: 'heavy', rise: 1.0 (in line-heights),
 *         out: time when the text leaves (optional), mask: true, tracking: 0 (em) }
 */
export function kinetic(g, text, x, y, t, opts = {}) {
  const {
    size = 120, family = 'Inter', weight = 700, color = '#fff', align = 'center', by = 'char',
    each = by === 'char' ? 0.025 : 0.07, preset = 'heavy', rise = 1.05, out = Infinity,
    outPreset = 'snappy', mask = true, tracking = -0.02, baseline = 'alphabetic',
  } = opts;
  g.save();
  g.font = font(size, family, weight);
  g.fillStyle = color;
  g.textBaseline = baseline;
  const units = by === 'char' ? [...text] : text.split(/(\s+)/);
  const track = tracking * size;
  const widths = units.map((u) => g.measureText(u).width + (by === 'char' ? track : 0));
  const total = widths.reduce((a, b) => a + b, 0) - (by === 'char' ? track : 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  if (mask) {
    g.beginPath();
    g.rect(cx - size, y - size * 1.05, total + size * 2, size * 1.35);
    g.clip();
  }
  let k = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.trim()) {
      const p = spring(t - k * each, preset) - spring(t - out - k * each * 0.5, outPreset);
      const dy = (1 - p) * size * rise;
      if (p > 0.001) g.fillText(u, cx, y + dy);
      k++;
    }
    cx += widths[i];
  }
  g.restore();
  return total;
}

// Typewriter: reveal characters at `cps` chars/second from t=0. Returns visible string.
export function typed(text, t, cps = 18) {
  return text.slice(0, clamp(Math.floor(t * cps), 0, text.length));
}

// Rounded rect path (+ fill/stroke helpers).
export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, Math.max(w, 0), Math.max(h, 0), Math.max(0, Math.min(r, w / 2, h / 2)));
}
export function fillRR(g, x, y, w, h, r, color) { rr(g, x, y, w, h, r); g.fillStyle = color; g.fill(); }

// Draw an image to cover/contain a box. fit: 'cover' | 'contain'
// fx/fy pick the focal point for 'cover' crops (0 = left/top, 1 = right/bottom); zoom > 1 punches in.
export function image(g, img, x, y, w, h, fit = 'cover', radius = 0, fx = 0.5, fy = 0.5, zoom = 1) {
  if (!img) return;
  const ir = img.width / img.height, br = w / h;
  let dw = w, dh = h;
  if ((fit === 'cover') === ir > br) dw = h * ir; else dh = w / ir;
  dw *= zoom; dh *= zoom;
  g.save();
  rr(g, x, y, w, h, radius); g.clip();
  g.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
  g.restore();
}

// Soft drop shadow wrapper.
export function shadowed(g, fn, { blur = 40, y = 16, color = 'rgba(0,0,0,0.25)' } = {}) {
  g.save();
  g.shadowColor = color; g.shadowBlur = blur; g.shadowOffsetY = y;
  fn();
  g.restore();
}

// A cursor (arrow) at x,y; `press` 0..1 squashes it for clicks.
export function cursor(g, x, y, scale = 1, press = 0, color = '#111', stroke = '#fff') {
  const s = scale * (1 - 0.15 * press);
  g.save();
  g.translate(x, y); g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 34); g.lineTo(9, 26); g.lineTo(15, 40); g.lineTo(21, 37);
  g.lineTo(15, 24); g.lineTo(27, 24); g.closePath();
  g.fillStyle = color; g.fill();
  g.lineWidth = 2.5; g.strokeStyle = stroke; g.stroke();
  g.restore();
}

// Click envelope for a cursor: 0 → 1 → 0 around tClick.
export const press = (t, tClick) => clamp(1 - Math.abs(t - tClick) / 0.09);

// Film grain overlay, deterministic per frame (pass the frame index or t*fps).
export function grain(g, W, H, frame, amount = 0.06, cell = 3) {
  let s = (frame * 2654435761) >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  g.save();
  g.globalCompositeOperation = 'overlay';
  for (let i = 0; i < (W * H) / (cell * cell * 40); i++) {
    const v = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${amount})`;
    g.fillRect(Math.floor(r() * W), Math.floor(r() * H), cell, cell);
  }
  g.restore();
}

export { lerp };
