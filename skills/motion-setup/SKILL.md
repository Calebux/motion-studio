---
name: motion-setup
description: Sets up a motion studio project for code-rendered videos — scaffolds the seek(t) engine, installs Playwright/Chromium, checks ffmpeg, and renders a test film to prove the pipeline works. Use when the user says "set up motion studio", "new motion project", "install the video pipeline", "start a new film", or when /motion-reel finds no film.js in the working folder.
---

# Motion setup

Scaffold a studio project, verify the toolchain, and prove it with a test render. Do the work; don't hand the user a list of commands.

## 1. Pick the folder

Use the folder the user named. Otherwise create `./<slug>-film` in the current working directory (slug from the project or product name, or `motion-film`). One folder per brand/film series: the renderer, audio and assets get reused inside it.

## 2. Copy the engine

The engine template ships with this plugin at `${CLAUDE_PLUGIN_ROOT}/engine` (equivalently `../../engine` relative to this skill's base directory). Copy its contents into the project folder **without overwriting** existing files:

```bash
ENGINE="${CLAUDE_PLUGIN_ROOT}/engine"   # fall back to <this skill's base dir>/../../engine if unset
mkdir -p "$DEST" && cp -Rn "$ENGINE"/. "$DEST"/
```

If `film.js` already exists in the destination, stop and ask before touching it — it is someone's film.

What the project contains (tell the user only if asked):
- `film.js` — the film (ships as an 8s demo). `index.html` + `lib/runtime.js` boot it.
- `lib/motion.js` springs/tracks/noise/beats · `lib/draw.js` kinetic type, cursor, images, grain.
- `tools/` — render, music, sfx, mix, critique, capture, lint, determinism, preflight, beats.py, serve.
- `CLAUDE.md` — house rules every run follows. `score.json` — demo score. `assets/fonts` — bundled OFL fonts.

## 3. Install and check

```bash
cd "$DEST" && npm install && npx playwright install chromium
node tools/preflight.mjs
```

Fix blocking issues from the preflight output (it prints the exact command per OS: `brew install ffmpeg` on macOS, `apt install ffmpeg` on Linux). librosa is optional — only needed to measure a supplied track.

If Chromium download is blocked but a system Chrome exists, set `CHROMIUM_PATH` to it; `tools/lib/browser.mjs` also auto-detects common install paths.

## 4. Prove the pipeline

```bash
npm run test                                   # lint + determinism sweep
node tools/music.mjs score.json && node tools/sfx.mjs
node tools/render.mjs && node tools/mix.mjs && node tools/critique.mjs
```

Open `out/review/contact.png` and look at it. Report in two or three lines: toolchain status, render speed (from the render log), and where `out/final.mp4` is. Offer next step: `/motion-reel` for a real film.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Film failed to boot` | Syntax/runtime error in film.js — the message includes the page error. |
| `seek(t) threw` in the sweep | A value went invalid at that time (NaN, negative size). Clamp it. |
| `not deterministic at t=…` | State leaks between frames: module-level `let`, caching drawn results, Math.random. |
| Blank text in frames | Font not declared in `film.fonts`, or wrong family name. |
| Render slow | `--draft` while iterating; `--workers N`; stills before full renders. |
