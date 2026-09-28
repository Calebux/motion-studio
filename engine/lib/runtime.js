// runtime.js — boots film.js, exposes window.seek(t) for the renderer,
// and a scrubbable live preview when opened in a normal browser.
// You normally never edit this file. Edit film.js.

const params = new URLSearchParams(location.search);
const RENDER = params.has('render');

const film = (await import('../film.js?v=' + (params.get('v') || Date.now()))).default;

const size = (params.get('size') || film.size || '1080x1920').split('x').map(Number);
const [W, H] = size;
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const g = canvas.getContext('2d', { willReadFrequently: RENDER });

// Springs overshoot and undershoot. Clamp radii so a spring dipping below 0 never throws mid-render.
{
  const P = CanvasRenderingContext2D.prototype, arc = P.arc, ell = P.ellipse;
  P.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, Math.max(0, r), a0, a1, ccw); };
  P.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, Math.max(0, rx), Math.max(0, ry), ...rest); };
}

// ---- fonts ---------------------------------------------------------------
const fontJobs = (film.fonts || []).map(async (f) => {
  const face = new FontFace(f.family, `url(${f.url})`, { weight: String(f.weight || 400), style: f.style || 'normal' });
  await face.load(); document.fonts.add(face);
});

// ---- images --------------------------------------------------------------
const assets = {};
const imgJobs = Object.entries(film.assets || {}).map(([key, url]) => new Promise((res) => {
  const img = new Image();
  img.onload = () => { assets[key] = img; res(); };
  img.onerror = () => { console.error('[motion] asset failed:', key, url); res(); };
  img.src = url;
}));

// ---- beats ---------------------------------------------------------------
let beats = null;
const beatJob = fetch(film.beatsUrl || 'beats.json').then((r) => (r.ok ? r.json() : null)).then((b) => (beats = b)).catch(() => {});

// ---- video clips (frame sequences made by tools/clips.mjs) ---------------
// Frames load lazily; the renderer waits until every frame a draw asked for is decoded,
// so final renders are exact while the live preview just catches up.
const clipMeta = {};
const clipJobs = Object.entries(film.clips || {}).map(async ([name, dir]) => {
  try { clipMeta[name] = { ...(await (await fetch(`${dir}/meta.json`)).json()), dir }; }
  catch { console.error('[motion] clip failed (run tools/clips.mjs):', name, dir); }
});
const frameCache = new Map(), pending = new Map(), CACHE_MAX = 96;
function loadFrame(key, url) {
  if (pending.has(key)) return pending.get(key);
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => img.decode().catch(() => {}).then(() => {
      frameCache.set(key, img); pending.delete(key);
      if (frameCache.size > CACHE_MAX) frameCache.delete(frameCache.keys().next().value);
      res();
    });
    img.onerror = () => { pending.delete(key); console.error('[motion] missing clip frame', url); res(); };
    img.src = url;
  });
  pending.set(key, p);
  return p;
}
function clipFrame(name, index) {
  const m = clipMeta[name]; if (!m) return null;
  const i = Math.max(0, Math.min(m.frames - 1, Math.floor(index)));
  const key = name + ':' + i;
  const img = frameCache.get(key);
  if (img) { frameCache.delete(key); frameCache.set(key, img); return img; }   // LRU touch
  loadFrame(key, `${m.dir}/${String(i + 1).padStart(4, '0')}.${m.ext || 'jpg'}`);
  return null;
}

await Promise.all([...fontJobs, ...imgJobs, beatJob, ...clipJobs]);
await document.fonts.ready;

const ctx = {
  W, H, cx: W / 2, cy: H / 2,
  u: Math.min(W, H) / 100,            // 1u = 1% of the short side
  vertical: H > W, square: H === W, aspect: W / H,
  assets, beats, fps: film.fps || 60, duration: film.duration,
  frame: 0,
  // Video clips: ctx.clip('kick', localT, speed) → image for that moment (null until loaded in preview).
  clip: (name, t, speed = 1) => { const m = clipMeta[name]; return m ? clipFrame(name, Math.max(0, t) * m.fps * speed) : null; },
  clipFrame,
  clipInfo: (name) => clipMeta[name] || null,
};
if (film.setup) await film.setup(ctx);

function draw(t) {
  ctx.frame = Math.round(t * ctx.fps);
  // Full context reset every frame: no line widths, fonts, joins or transforms leak between frames.
  if (g.reset) g.reset();
  else {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    Object.assign(g, { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0,
      shadowColor: 'transparent', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', textAlign: 'start',
      textBaseline: 'alphabetic', font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000' });
    g.setLineDash([]);
  }
  film.draw(g, t, ctx);
}
window.seek = (t) => { draw(t); return true; };
// Draw until every clip frame the draw asked for is loaded (deterministic renders with lazy frames).
async function drawReady(t) {
  for (let i = 0; i < 6; i++) {
    draw(t);
    if (!pending.size) return;
    await Promise.all([...pending.values()]);
  }
  draw(t);
}

// ---- render hooks (used by tools/render.mjs) ----------------------------
let acc = null, accG = null;
window.__film = { duration: film.duration, fps: film.fps || 60, W, H, title: film.title || 'film' };
// Draw frame at time t with `sub` subframes blended over `shutter` of a frame (motion blur).
// Blending is a running average on a second canvas: frame k is composited at alpha 1/(k+1).
window.__frame = async (t, sub = 1, shutter = 0.5, fps = 60, type = 'image/png', quality = 0.95) => {
  if (sub <= 1) { await drawReady(t); return canvas.toDataURL(type, quality); }
  if (!acc) { acc = document.createElement('canvas'); acc.width = W; acc.height = H; accG = acc.getContext('2d'); }
  for (let s = 0; s < sub; s++) {
    await drawReady(t + (s / sub) * (shutter / fps));
    accG.globalAlpha = 1 / (s + 1);
    accG.drawImage(canvas, 0, 0);
  }
  accG.globalAlpha = 1;
  return acc.toDataURL(type, quality);
};
// Raw pixel hash for determinism checks.
window.__hash = async (t) => {
  await drawReady(t);
  const d = g.getImageData(0, 0, W, H).data;
  let h1 = 0x811c9dc5 | 0, h2 = 0;
  for (let i = 0; i < d.length; i += 1) { h1 = Math.imul(h1 ^ d[i], 16777619); h2 = (h2 + d[i]) | 0; }
  return (h1 >>> 0).toString(16) + ':' + (h2 >>> 0).toString(16);
};
window.__ready = true;

// ---- live preview ---------------------------------------------------------
if (!RENDER) {
  document.body.classList.add('preview');
  const bar = document.getElementById('bar'), time = document.getElementById('time'), btn = document.getElementById('play');
  const D = film.duration, fps = ctx.fps;
  bar.max = D; bar.step = 1 / fps;
  let playing = true, t = 0, last = performance.now();
  // beat ticks on the scrubber
  const ticks = document.getElementById('ticks');
  (beats?.beats || []).filter((b) => b < D).forEach((b, i) => {
    const el = document.createElement('i'); el.style.left = (b / D) * 100 + '%';
    if (beats.downbeats?.includes(b)) el.className = 'down';
    ticks.appendChild(el);
  });
  const audio = document.getElementById('audio');
  fetch('out/music.wav', { method: 'HEAD' }).then((r) => { if (r.ok) audio.src = 'out/music.wav'; }).catch(() => {});
  const show = () => { draw(t); bar.value = t; time.textContent = `${t.toFixed(2)}s · f${Math.round(t * fps)}`; };
  const toggle = () => {
    playing = !playing; btn.textContent = playing ? '❚❚' : '▶'; last = performance.now();
    if (audio.src) { if (playing) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause(); }
  };
  btn.onclick = toggle;
  bar.oninput = () => { t = +bar.value; if (audio.src) audio.currentTime = t; show(); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') { t = Math.min(D, t + (e.shiftKey ? 1 : 1 / fps)); show(); }
    if (e.code === 'ArrowLeft') { t = Math.max(0, t - (e.shiftKey ? 1 : 1 / fps)); show(); }
  });
  (function loop(now) {
    if (playing) {
      t += (now - last) / 1000;
      if (t >= D) { t = 0; if (audio.src) audio.currentTime = 0; }
    }
    last = now; show();
    requestAnimationFrame(loop);
  })(performance.now());
}
