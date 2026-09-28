# Critique rubric — detailed

## Common failures and their fixes

| Seen in frames | Likely cause | Fix |
|---|---|---|
| Two labels overlapping mid-swap | content swap not gated to the morph | `swapAlpha(t, tIn, tOut)`; out before next in |
| Element slides at constant speed | `lerp` on raw t | `spring`/`track`; `tween` with ease only for camera |
| Element jumps between two frames | key times too close / restarted animation | `track()` with one spring per change; spread keys ≥ settleTime |
| Type wobbles | playful/overshooting spring on big type | `heavy` preset, no overshoot on type |
| Nothing moves for > 1.2s (report: dead time) | hold too long | add a secondary motion (count-up, cursor move, parallax, pulse on beat) or cut sooner |
| Hook appears at 1.5s+ | slow intro | open on motion at t≈0.05; logo never first |
| Everything fades in | alpha-only entrances | masked rises, scale from anchor, wipes, morphs |
| Title centered on gradient | default look | named style, off-center grid, real UI as the background |
| Text blurry | text scaled up by camera / drawn small | draw at final size; scale down, not up |
| Unreadable at 360px | body < 3.5u on 9:16 | bigger type, fewer words, one idea per shot |
| Crowded frame | too many elements | one focal point; dim or remove the rest |
| Cut off the grid (report) | keys not derived from beats | `beatGrid(ctx.beats).beat(n)` for all key times |
| Seam SSIM < 0.97 on a loop | last frame differs | exit springs finish before `duration`; state returns to frame 0 |
| Loudness off target | mix gains | `mix.mjs --music-gain / --sfx-gain`, loudnorm handles the rest |
| SFX late/early | cue time ≠ key time | cue at the same constant as the key (`k.press`) |
| Product UI looks generic | invented screens | capture.mjs screenshots; crop and animate the real thing |

## Scoring anchors
- **10**: would be bookmarked; you'd show it as a portfolio piece.
- **8**: shippable launch video; no visible mistakes; one or two things you'd still polish.
- **6**: competent but generic, or one visible mistake.
- **4**: default look (fade-ins, centered text) or broken moments.
- **≤3**: unreadable, broken, off-brand.

Be stingy with 9–10. A proud author gives 8s to a first draft; a motion director doesn't.
