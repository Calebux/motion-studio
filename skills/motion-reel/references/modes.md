# Modes and prompt patterns

Five ways into a film, from cheapest to most controlled. Pick one in the brief; they combine (a product film with a reference, a story with a spec).

## 1. Showreel (tests the engine, not an idea)
The model is the subject: every shot shows a different technique. Genre rules of a résumé reel: fast cuts, best work first, a new trick every shot.
- 15s, 6–8 shots, one accent, no product content to get wrong.
- Weakness: hundreds of people used the same one-liner and the reels rhyme ("brief contagion"). Always add a named look and one constraint that makes it yours: a palette, a texture, a theme ("a showreel as a niche branding studio for fintech founders").
- Variants: longer with an original piano score and every cut on it; "introduce yourself, no frames or corner text"; story instead of techniques ("the history of X from A to today, surprise me with the storyboard").

## 2. Product (point the reel at something you sell)
Three additions turn a showreel into a launch video: the URL, "use the actual product screenshots, logo, assets", and music.
Story, one beat each (2–4s):
1. Hook: the problem in ≤5 words of huge kinetic type.
2. Product appears; the UI assembles itself piece by piece (real screenshot, masked in by parts).
3. Three features, each a UI moment with a cursor doing a real action (click, type, drag).
4. One number that proves it works.
5. Logo lockup + CTA.
Keep one project folder per brand — the second film reuses the renderer, audio and assets and comes out faster.
Optional upgrade: a voiced character/mascot explaining the product (voice API key in `.env`).

## 3. Reference (name a look, feed a frame)
Without a reference the default look appears: centered text, gradient, everything fading in. Naming a style beats describing one.
- **A frame**: one still you love. Say what to take (palette, type, grain) and what not to take (subject).
- **A video**: extract frames at 2 fps, describe pacing shot by shot before writing code.
- **A library**: a folder of your own images/past work → write a style guide from it first. Your own library is a reference nobody else can copy.
Then: `docs/style_guide.md` + `docs/shotlist.md` in that style, grammar not content, show both, wait for OK. When a reference is given, pick the technique yourself (canvas, paper texture renderer, particles) — specify the look and constraints, not the library.

## 4. UI spec (write the state list, not the vibe)
The strongest product-UI pattern: **one shape, never cut**. A single container morphs size, radius and fill from state to state (button → field → loader → check → card → chart → command palette → toast → logo); a cursor drives each change with real clicks; the last frame equals the first so it loops.
Spec skeleton to fill with the user:
```
<inputs> product + URL, 8–12 UI states that tell its story, real data in each state, brand colors + fonts + one accent, track near 120 BPM, formats </inputs>
<direction> Product-film UI motion. One container never cuts; content swaps behind a short blur. Cursor drives every change. Warm neutral canvas, one accent. Springs with at most a tiny overshoot. Banned: bouncy easing, glows, gradients on UI chrome, particle bursts, dead time. </direction>
<structure> 120 BPM, 8 bars, something on every beat. logo → CTA → email typed → loader → success → dashboard card → chart draws → tooltip → ⌘K → toast → logo </structure>
<build> track() for every morphing value; text inside a morphing container enters after the morph starts, leaves before the next (swapAlpha); tab indicators with leading/trailing edges on different springs (indicator); start on a downbeat; UI sounds on measured hits. </build>
<gotchas> No will-change on anything the camera scales. Last frame == first frame, cursor position included. </gotchas>
```
Show the state list on the beat grid before writing code.

## 5. Story / long form (hire a crew)
For films over 30s or overnight runs, use the **director-brief** skill to write the brief first: logline, references, tools & keys, character bible, beat sheet, text-on-screen rules, workflow gates (plan → stills → animatic → full → polish → audio → render), critique loop, deliverables. Split scenes into `scenes/*.js` and write `docs/ANIMATION_GUIDE.md` first so any parallel work codes in one style.
