---
name: motion-reel
description: Makes a motion design video rendered from code — showreels, product launch videos, animated explainers, UI morph loops, motion ads, story films. Plans on a beat grid, builds a deterministic canvas film, synthesizes music and SFX, critiques its own frames until every score is 8+, and delivers MP4s in every format. Use when the user asks for a launch video, showreel, product reel, promo, motion graphics, animated explainer, "make a video for my product", or runs /motion-reel.
---

# Motion reel

Direct, animate, score and render a film in code. The prompt is 10% of the video; this pipeline is the other 90%. Never skip the look-at-your-own-frames loop.

## 0. Studio check

If the working folder has no `film.js` + `tools/render.mjs`, run the **motion-setup** skill first (it scaffolds and verifies). Read the project's `CLAUDE.md` — its rules bind every step below.

## 1. Brief — collect inputs once

Get these in one short exchange (use AskUserQuestion if available; skip anything the user already gave):

| Input | Default if not given |
|---|---|
| Mode: **showreel** / **product** / **reference** / **UI spec** / **story** | product if a URL is given, else showreel |
| Product + URL | — |
| Duration | 15s (showreel), 20s (product), 30–45s (story) |
| Formats | 9:16 first, then 1:1 and 16:9 |
| Reference (frame, video, image folder, named style) | none — then commit to a named style yourself |
| Music: synthesize / supplied track | synthesize |
| Brand: colors, fonts, one accent | from the site capture |
| CTA / end line | product name + URL |

Then write one line — the film in a sentence: what the viewer should feel at the end. Every later decision is checked against it.

Mode details and prompt patterns: `references/modes.md`.

## 2. Assets and style (before any animation code)

- **Product mode**: `node tools/capture.mjs <url> --mobile` (plus other key pages with `--name`). Look at every screenshot. If the capture warns the page is unstyled or blocked, ask for screenshots instead. List what you have. Never redraw product UI from imagination — crop and animate the real screenshots (`image()` in lib/draw.js, masked and moved by springs).
- **Reference mode**: extract frames (`ffmpeg -i refs/ref.mp4 -vf fps=2 refs/frames/%03d.png`), look at them, and write `docs/style_guide.md` from `references/style-guide-template.md`. Take the grammar (palette, type, pacing, transitions, camera, texture), never the content, logos or characters.
- **Otherwise**: pick a named look (e.g. "Swiss grid, one red accent", "editorial serif on warm paper", "brutalist mono") and write a 5-line style guide anyway. Named styles beat vague ones.
- **Footage** (gameplay recordings, generated clips): `node tools/clips.mjs <video> --name <n>`; find each clip's peak moment from a dense frame strip before timing shots.
- Fonts: brand fonts go in `assets/fonts/` only if licensed files are available; otherwise choose the closest bundled face (Inter, Instrument Serif, JetBrains Mono).

## 3. Music and the beat grid

- **Synthesize** (default): write `score.json` — bpm (110–128 for product, 90–100 for story), chords, sections that match the shot list, per-section layers. `node tools/music.mjs score.json` writes `out/music.wav` **and an exact `beats.json`**. Sections should start where acts start.
- **Supplied track**: `python3 tools/beats.py audio/track.wav` → `beats.json`. Use `--offset` if the film starts mid-track. Pass the track to mix with `--track`.

The film reads the grid through `ctx.beats` (`beats`, `downbeats`, `sections`, `hits.kick`…). State changes land on beats, big moments on downbeats, SFX on measured hits.

## 4. Shot list — show it, then wait

Write `docs/shotlist.md` from `references/shotlist-template.md`: one row per shot with time range (on the grid), what's on screen, the motion technique, text, and SFX. Rules:
- Hook lands in the first 2 seconds (the single most striking image, not a logo).
- Something new every 2–4 seconds; every shot uses a different technique.
- Product films: problem in ≤5 huge words → UI assembles → 3 features as real UI moments with a cursor doing real actions → one proof number → logo + CTA.
- If it loops, the last frame sets up the first.

Show the user the one-line film + shot list and **wait for OK** (unless they said to run unattended — then continue after stating assumptions).

## 5. Build film.js

Replace the demo in `film.js`. Engine API and recipes: `references/engine-api.md`. Non-negotiables:
- `draw(g, t, ctx)` is pure. Sizes from `ctx.u`, `ctx.W`, `ctx.H` so every format works from one timeline.
- One scene per shot in `SCENES` via `runScenes`; transitions keyed to cut times.
- Springs, not fades: `spring`, `track` (many targets, one spring per change), `inOut`, `swapAlpha` for content inside morphing containers. Tiny overshoot on UI, none on big type.
- Declare fonts and images in `fonts` / `assets`. Declare SFX in `cues` next to the keys they belong to.
- For films over ~30s, split scenes into `scenes/*.js` modules and keep film.js as the index.

Run `npm run test` after every substantial edit. Fix everything it reports before rendering anything.

## 6. Critique loop — at least 3 rounds before the full render

Each round:
1. `node tools/render.mjs --stills beats` (or `--stills every:0.5`) → **open `out/contact.png` and look at it.**
2. Run the **critique-pass** skill's scoring on the stills: score 1–10 on hook, phone readability, motion quality, variety, composition, brand accuracy, sound sync; name the 3 worst problems with timestamps.
3. Fix those 3. For motion problems you can't see in stills, `npm run draft` then `node tools/critique.mjs out/draft.mp4 --at <t>` and look at `out/review/strip.png`.

Log each round's scores in `docs/review_log.md`. Continue until every score is 8+.

## 7. Final render and delivery

```bash
node tools/sfx.mjs
node tools/render.mjs                    # 60fps, 4× motion-blur subframes, parallel workers
node tools/mix.mjs                       # -14 LUFS, true peak -1
node tools/critique.mjs                  # final automated checks + review sheets
```

Then look at `out/review/contact.png` and `phone.png` once more and read `report.md` flags (dead time, off-grid cuts, loudness, loop seam). Fix and re-render only the affected seconds: `node tools/render.mjs --from 4 --to 6`.

Other formats from the same timeline: `node tools/render.mjs --size 1080x1080` then `node tools/mix.mjs --video out/silent_1080x1080.mp4`; likewise `1920x1080`. Check each format's stills — reframe type/layout per format via `ctx.vertical` / `ctx.aspect`, never crop.

Deliver: `out/final*.mp4`, `out/review/contact.png`, a poster frame (`node tools/render.mjs --stills <best t>` → copy to `out/poster.png`), and 2–3 lines on what you'd improve next. Keep the project folder: the next film in it is faster.

## Effort guidance

New films and launch pieces warrant high effort; small fixes and re-renders don't. Stills are cheap, full renders are not — iterate on stills and drafts.

## Keys and APIs

Optional voice/image/video APIs read keys from `.env` (see `.env.example`). Refer to keys by variable name only; never print or paste a key into a prompt, file or screenshot.
