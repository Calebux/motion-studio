---
name: director-brief
description: Interviews the user and writes a long-form director's brief for a flagship or overnight code-rendered film — logline, references, tools and keys, character bible, beat sheet, on-screen text rules, workflow gates, critique loop and deliverables. Use when the user wants a music video, a story film, a 30s+ launch film, "an overnight run", "a proper brief", or says the one-liner results look generic.
---

# Director brief

Long, strong films don't come from a one-line prompt; they come from a brief that hires a crew. This skill writes that brief to `docs/brief.md`, then hands off to **motion-reel** (which executes it with gates).

## 1. Interview (one round, then fill gaps with opinionated defaults)

Ask only what isn't known. Group questions; accept "you decide".

1. **The film in one line** — logline + the feeling at the end. The joke, if there is one.
2. **References** — a video, song, image folder, prior repo, named style. What to keep, what to push.
3. **Audio** — supplied track (path) or synthesized score; vocals/voiceover?
4. **Characters** (if any) — who, proportions, palette, expressions, what must never change.
5. **Duration and formats.**
6. **Tools & budget** — optional APIs available in `.env` (voice, image, video generation) and a spend cap. "Spend it economically."
7. **Autonomy** — wait for approval at the shot-list gate, or continue after 10 minutes of silence.

If the user dictates freely (voice memo style), accept it and structure it yourself.

## 2. Write docs/brief.md

Use `references/brief-template.md`. Be concrete: timestamps, hex colors, font names, file paths. Beat sheet on the real grid (measure the track or write the score first). A visual payoff every 3–5 seconds; hook in the first 2.

Techniques worth offering when they fit:
- **Generate-then-trace**: if a video model API is available, render base shots for motion that is hard to hand-code, then redraw the whole film in code on top so the viewer only sees the code-drawn layer — consistent, ownable look.
- **Own-library reference**: the user's own image gallery as the style source; it can't be copied.
- **Chapters**: films > 45s split into `scenes/chXX.js`; write `docs/ANIMATION_GUIDE.md` first so all chapters share one style and one motion vocabulary; `docs/STORYBOARD.md` after the first stills pass.

## 3. Hand off

Show the brief. On approval, run **motion-reel** in story mode with the brief as the source of truth, honoring its gates:

plan → stills for every shot + contact sheet + critique → animatic (`--draft`, placeholder audio) → pacing fixes → full animation → polish → audio → final render → deliverables.

For long unattended runs, keep `docs/review_log.md` updated after every gate so progress is visible, and never skip the critique loop.
