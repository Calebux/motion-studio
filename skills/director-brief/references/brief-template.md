# Director's brief template → docs/brief.md

```markdown
You are the director, animator, sound designer and render engineer for a <DURATION> film made in code.
Treat this as a multi-session production. Don't rush to a final render.

## The film in one line
<LOGLINE. What the viewer should feel at the end.>

## References and inputs
- refs/: <video / frames / image library>. Take the grammar, never the content.
- audio/track.wav: <use unchanged — measure with tools/beats.py first> | <synthesize: score.json, <bpm> BPM, <mood>>
- APIs in .env: <ELEVENLABS_API_KEY, FAL_KEY, …> · budget <$X> · be economical.

## Look
<3–5 lines: palette hexes, display + UI faces, texture, camera language.>
Banned: <looks this film must avoid>

## Characters (if any)
- <Name>: proportions <…>, palette sampled from <sheet>, expressions <…>.
- Identity lock: <what never changes across any style shift>.

## Beat sheet
| Time | Act | Visual payoff | Text on screen | Sound |
|---|---|---|---|---|
| 0:00–0:02 | hook | <single most striking image> | | |
| 0:02–0:10 | act 1 | <…> | | |
| … | | a new payoff every 3–5s | | |
| <end> | outro | last frame sets up the first (loop) | | |

## Text on screen
- When lyrics/captions go huge vs sit like subtitles; composition leaves room for them; safe margins 6u.

## Workflow, with gates
1. docs/style_guide.md + docs/shotlist.md (every shot: frames, camera, text, SFX). Show. <Wait | continue after 10 min>.
2. Stills for every shot → contact sheet → critique (≥3 rounds, all scores 8+).
3. Animatic: `node tools/render.mjs --draft` with placeholder audio. Fix pacing before polish.
4. Full animation → polish pass → sound pass (score, cues, mix to -14 LUFS) → final render.
5. Chapters in scenes/chXX.js. Write docs/ANIMATION_GUIDE.md first so every chapter codes in the same style.

## Critique loop (every shot, at least 3 rounds)
Render 3–5 stills per shot; score 1–10: hook, readability at 360px wide, motion, composition, depth, sound sync, polish.
Log scores + 3 biggest problems in docs/review_log.md. Fix. Repeat until all are 8+.

## Deliverables
out/final.mp4 · out/final_1080x1080.mp4 · out/final_1920x1080.mp4 · out/poster.png · out/review/contact.png · README.md (how to re-render)
```
