# Motion studio — house rules

This project makes videos from code. `film.js` is the film. Everything else is the studio.

## Render contract (enforced by `npm run test`)
- The film is a pure function of time: `draw(g, t, ctx)` paints frame t. Nothing else.
- No `Math.random`, `Date`, `performance.now`, timers, `requestAnimationFrame`, CSS transitions/animations,
  `will-change`, or module-level state that `draw` mutates. Use `rng(seed)` / `hash(i, seed)` / `noise1` from `lib/motion.js`.
- Motion uses closed-form springs (`spring`, `track`, `trackN`, `inOut`) from `lib/motion.js`. A value with several
  targets uses `track()` — one spring per change — never a restarted animation.
- Sizes derive from `ctx.u` (1% of the short side) and `ctx.W/H`, never fixed pixels, so every format renders from one timeline.
- Images and fonts are declared in `film.js` (`assets`, `fonts`) so they are loaded before frame 0. Canvas text needs loaded fonts.
- Sound cues live in `film.js → cues` next to the animation keys they belong to.

## Look
- Banned defaults: centered title on a gradient, everything fading in, corner labels and frame borders,
  glow on UI chrome, generic particle bursts, bouncy easing on type, dead time.
- One display face, one UI face. One accent color unless the brief says otherwise.
- Something new happens every 2–4 seconds. Hook lands in the first 2 seconds.
- Real product UI only (screenshots in `assets/`). Never invent product screens.

## Sound
- Score is synthesized (`score.json` → `tools/music.mjs`, which also writes exact `beats.json`) unless a track is supplied
  (then measure it: `tools/beats.py`). State changes land on `ctx.beats.beats`, big moments on `downbeats`.
- Loudness -14 LUFS, true peak ≤ -1 dBTP (`tools/mix.mjs` does this).

## Loop before showing anything
1. `npm run test` (lint + determinism sweep). Fix everything it reports.
2. `node tools/render.mjs --stills beats` → look at `out/contact.png`.
3. Score 1–10: hook, phone readability, motion quality, variety, composition, brand accuracy, sound sync.
4. Fix the 3 worst problems. Repeat until every score is 8+.
5. Only then: `npm run render && npm run mix && npm run critique`, and look at `out/review/*.png`.

## Commands
| | |
|---|---|
| `npm run dev` | live preview with scrubber (space, ←/→) |
| `npm run test` | lint + determinism |
| `node tools/render.mjs --stills beats` | one still per beat + contact sheet |
| `npm run draft` | fast 30fps render, no motion blur |
| `npm run render` | final 60fps, 4× motion-blur subframes, parallel |
| `node tools/render.mjs --from 4 --to 6` | re-render only those seconds |
| `node tools/render.mjs --size 1080x1080` | another format |
| `npm run music` / `npm run sfx` / `npm run mix` | audio |
| `npm run critique` | contact sheet, phone test, dead-time, sync, loop seam, loudness |
