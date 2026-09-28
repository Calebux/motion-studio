# motion-studio

Motion design videos rendered from code. Claude writes the film as a pure function of time, renders it frame-by-frame in headless Chromium, scores it with synthesized music and SFX on a beat grid, then looks at its own frames and fixes them until every score is 8+.

## Skills

| Skill | What it does |
|---|---|
| `/motion-setup` | Scaffolds a film project, installs Playwright/Chromium, checks ffmpeg, renders a test film |
| `/motion-reel` | The full pipeline: brief → assets → beat grid → shot list → build → critique loop → render in every format |
| `/critique-pass` | Contact sheets, phone test, frame strips, automated checks, 7-criterion scoring, fix the 3 worst |
| `/director-brief` | Interview → long-form director's brief for flagship/overnight films |

## Requirements
Node 20+, ffmpeg (with libx264), and Chromium via Playwright (`/motion-setup` installs it). Optional: Python + librosa to measure a supplied track.
macOS: `brew install node ffmpeg`. Linux: `apt install nodejs ffmpeg`.

## The engine (copied into each film project)
- `film.js` — the film: `draw(g, t, ctx)` paints frame t. Ships as an 8s demo.
- `lib/motion.js` — closed-form springs, `track()` (one spring per target change), seeded noise, beat grid.
- `lib/draw.js` — kinetic type, cursor, images, grain.
- `tools/render.mjs` — parallel, chunk-cached render; 60fps with 4× motion-blur subframes; `--stills`, `--draft`, `--from/--to`, `--size`.
- `tools/music.mjs` — synthesizes an original score from `score.json` and writes an exact `beats.json`.
- `tools/sfx.mjs` — UI sound effects from `film.js → cues`.
- `tools/mix.mjs` — music + SFX, two-pass loudnorm to -14 LUFS / -1 dBTP, muxed.
- `tools/critique.mjs` — review sheets + dead-time, cut-to-beat sync, loop seam, loudness checks.
- `tools/clips.mjs` — turns videos (gameplay, generated clips) into frame sequences the film draws deterministically.
- `tools/capture.mjs` — real screenshots, logo candidates, colors and fonts from a product URL.
- `tools/lint.mjs` + `tools/determinism.mjs` — enforce the render contract (no randomness, clocks, timers or carried state).
- `tools/beats.py` — beat/downbeat/onset detection for supplied tracks.

## Sharing with friends
Push this folder to a GitHub repo. Then each person runs:
```
claude plugin marketplace add <you>/motion-studio
claude plugin install motion-studio@calbridge-motion
```
Or share the `.plugin` file and install it from the Claude app.

Fonts bundled under the SIL Open Font License (see `engine/assets/fonts/LICENSE.md`).
