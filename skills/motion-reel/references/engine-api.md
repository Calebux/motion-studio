# Engine API and recipes

## film.js shape
```js
export default {
  title: 'launch', duration: 20, fps: 60, size: '1080x1920',
  fonts:  [{ family: 'Inter', url: 'assets/fonts/Inter-700.woff2', weight: 700 }],
  assets: { hero: 'assets/img/home-desktop.png', logo: 'assets/img/logo-0.svg' },
  clips:  { kick: 'assets/clips/kick' },                             // from tools/clips.mjs (video → frames)
  cues:   [{ t: 2.0, type: 'whoosh' }, { t: 4.32, type: 'click' }],   // → tools/sfx.mjs
  setup(ctx) {},                        // optional, async, runs once after assets load (precompute layouts)
  draw(g, t, ctx) { /* pure */ },
};
```
`ctx`: `W H cx cy u` (1% of short side) `vertical square aspect assets beats fps duration frame`.
The runtime fully resets canvas state before every frame and clamps negative arc radii.

## Video footage (gameplay, generated clips, screen recordings)
- `node tools/clips.mjs video.mp4 --name kick [--from s --to s --width 1280 --fps 30]` → `assets/clips/kick/` frames + meta.
- `ctx.clip('kick', clipT, speed)` → the frame image for clip time `clipT` (draw with `image()`; null while loading in preview).
- Map scene time to clip time yourself: `start + localT` plays, a constant holds, `hitStop(t, at, hold)` freezes on impact.
- Align a clip's own peak (burst, flip) to a beat: `start = peakInClip - beatInScene`.
- Vertical from 16:9 footage: full-bleed `cover` with a focal `fx` for impact moments; a footage band + type above/below for readability.
- Renders wait for every requested frame, so output stays deterministic. Keep clips ≤ 1280px wide (browser memory).

## lib/motion.js
| Function | Use |
|---|---|
| `spring(t, preset)` | 0→1 from t=0. Presets: `snappy` (UI, leading edges), `default` (cards, camera), `heavy` (big type, logos), `playful` (visible overshoot), `gentle` (drifts), or `{k, d}` |
| `track(t, [[t0,v0],[t1,v1],…], preset)` | value with many targets, one spring per change; continuous and random-access |
| `trackN(t, keys, preset)` | same for `[x, y]` / arrays (cursor paths, camera) |
| `inOut(t, tIn, tOut, inP, outP)` | enter + exit envelope |
| `swapAlpha(t, tIn, tOut)` | content inside a morphing container: in after the morph starts, out before the next |
| `indicator(t, stops, width)` | stretchy tab indicator `{left, right}` |
| `tween(t, t0, t1, ease.fn)` | eased 0→1 between times (camera, wipes). Prefer springs for UI |
| `runScenes(SCENES, t, …args)` | scene `{from, to, draw(localT, dur, …args)}` |
| `cut(t, at, dur)` | transition progress around a cut |
| `beatGrid(ctx.beats)` | `{bpm, spb, beat(n), bar(n), pulse(t, decay), index(t)}` |
| `rng(seed)`, `hash(i, seed)`, `noise1(x, seed)`, `noise2(x, y, seed)` | deterministic randomness |
| `settleTime(preset)` | seconds until a spring settles — use to schedule the next state |
| `clamp lerp invlerp remap mix stagger loopT` | basics |

## lib/draw.js
| Function | Use |
|---|---|
| `kinetic(g, text, x, y, t, {size, family, weight, color, align, by:'char'|'word', each, preset, out, tracking})` | masked per-unit rise on springs; exits at `out` |
| `fitSize(g, text, maxW, family, weight, max)` | largest size that fits |
| `wrap(g, text, maxW)`, `typed(text, t, cps)` | multiline, typewriter |
| `font(size, family, weight, style)` | font string |
| `rr / fillRR(g, x, y, w, h, r, color)` | rounded rects (safe with negative sizes) |
| `image(g, img, x, y, w, h, 'cover'|'contain', radius, fx, fy, zoom)` | screenshots/logos/clip frames; `fx/fy` focal point, `zoom` punch-in |
| `cursor(g, x, y, scale, press)` + `press(t, tClick)` | cursor with click squash |
| `shadowed(g, fn, {blur, y, color})` | soft shadow around a draw call |
| `grain(g, W, H, ctx.frame, amount)` | deterministic film grain |

## Recipes

**Real UI assembling itself** — crop regions of a screenshot and spring each in on a stagger:
```js
const parts = [[0, 0, 1, 0.12], [0, 0.12, 0.25, 0.88], [0.25, 0.12, 0.75, 0.5]];   // normalized crops
parts.forEach(([sx, sy, sw, sh], i) => {
  const p = spring(t - 0.08 * i, 'default'), img = ctx.assets.hero;
  g.globalAlpha = Math.min(1, p * 1.5);
  g.drawImage(img, sx * img.width, sy * img.height, sw * img.width, sh * img.height,
    X + sx * Wd, Y + sy * Hd + (1 - p) * 6 * u, sw * Wd, sh * Hd);
});
```

**Camera** — one transform for the whole scene; move it with `trackN` keys, scale around a focus point:
```js
const [fx, fy, z] = trackN(t, [[0, [cx, cy, 1]], [1.2, [x1, y1, 1.8]], [2.4, [cx, cy, 1]]], 'heavy');
g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-fx, -fy); /* draw world */ g.restore();
```
Text under camera zoom: draw it at final size and scale down, not up, to keep it sharp.

**Cursor doing a real action** — path keys arrive ~0.15s before each click; `press(t, tClick)` squashes; a `click` cue at the same time; the UI state change keys at `tClick + 0.03`.

**Beat-locked changes** — `const B = beatGrid(ctx.beats); const k = { load: B.beat(9), done: B.beat(11) };` then key everything off `k`. `B.pulse(t)` for kick bumps (scale 1 + 0.04·pulse).

**Loop** — end every scene element with an exit spring before `duration`, return to the first frame's state; `critique` reports seam SSIM (>0.97 = seamless).

**Formats** — layout branches on `ctx.vertical` / `ctx.aspect`: e.g. vertical stacks headline above UI, 16:9 puts them side by side. Everything in `u`.

**Texture** — paper, grain, halftone, scanlines are drawn in code with `noise2`/`hash`, seeded by `ctx.frame` only if the texture should boil; otherwise static seed.

## Performance
- Iterate with `--stills` and `--draft`. Full renders are 60 fps × 4 subframes.
- Cache expensive pure precomputation in `setup(ctx)` (e.g. glyph layouts) — that's fine because it never changes per frame. Never cache per-frame drawing.
- `render.mjs --workers N` (defaults to cores−1, max 4); chunks are cached so `--from/--to` re-renders only changed seconds.
