---
name: critique-pass
description: Reviews a code-rendered motion film like a harsh motion director — renders contact sheets, phone-size and frame strips, runs automated checks (dead time, off-beat cuts, loop seam, loudness), scores seven criteria 1–10, and fixes the three worst problems. Use when the user says "critique this", "review the video", "make it better", "it looks mid", "score the frames", or as the loop inside /motion-reel.
---

# Critique pass

Look at what was actually rendered, not at the code. Be a harsh motion director, not a proud author. Iteration is the method: good films take several rounds.

## 1. Produce the evidence

In the film project folder:

- **Before a full render** (cheap): `node tools/render.mjs --stills beats` → `out/contact.png` (one frame just after each beat). Use `--stills every:0.5` if there's no beats.json.
- **After a render**: `node tools/critique.mjs [file] --at <t>` → `out/review/contact.png` (2 fps), `phone.png` (1 fps at 360px wide), `strip.png` (12 consecutive frames around `t`, for pops and overlaps), `report.md` + `report.json` (automated flags).
- For motion questions without a full render: `npm run draft` then critique `out/draft.mp4`.

## 2. Look — actually open the images

Open every generated PNG with the Read tool. Read `out/review/report.md` flags. Hunt specifically for (details in `references/rubric.md`):

- text overlapping during swaps; text clipped by a mask or the frame
- anything sliding linearly instead of springing; motion that stops dead with no settle
- a beat with nothing happening; a first 2 seconds without a hook
- centered-title-on-gradient shots, everything fading in, corner labels, frame borders, glows on UI chrome
- blurry scaled text; unreadable text at 360px wide (below ~3.5u body / 6u headline on 9:16)
- invented UI instead of the real product; wrong colors vs brand
- stutter at the loop seam; cuts off the beat grid; loudness off target

## 3. Score

Score 1–10 with one sentence of evidence each (cite timestamps):

| Criterion | What an 8 means |
|---|---|
| Hook (first 2s) | the most striking image is on screen by 1.0s and moving |
| Readability at phone size | every word readable in `phone.png` |
| Motion quality | springs with settle, no linear slides, no dead frames, no pops in the strip |
| Variety | a new technique or state every 2–4s |
| Composition | clear focal point every frame; safe margins; intentional negative space |
| Brand accuracy | real UI, real logo, brand palette, one accent |
| Sound sync | cuts and state changes on the grid (report shows no off-grid cuts), SFX on actions |

Append the round to `docs/review_log.md`: date, scores, 3 worst problems with timestamps, what you changed.

## 4. Fix the three worst

Fix the three lowest-scoring problems — not everything at once. Then:
- re-render only what changed: stills again, or `node tools/render.mjs --from <a> --to <b>`
- `npm run test` if film.js changed
- produce the new contact sheet and new scores

## 5. Stop rule

Repeat until **every score is 8+** (minimum 3 rounds on a new film). If a score stays below 8 after two focused attempts, tell the user what's limiting it (e.g. missing real assets, no reference, weak copy) and what input would unblock it.

Report to the user briefly: round count, final scores, what changed. Show the final contact sheet.
