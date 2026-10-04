# Quality Bar

Every review round checks a cut against these for its profile: critics judge, scripts measure the numeric ones. What still misses the bar after the last round (`gauntlet.md`) goes into the delivery note as a known weakness.

## Measured

| Check | Target | How |
|---|---|---|
| Frozen time | Commercial: total ≤ ~1s per 30s, no single hold > 0.6s except the final CTA. Stylized: every hold > 0.6s is intentional and listed in the brief | `analyze_video.py --frozen` |
| Loudness | Stylized and punchy commercial: -14 LUFS. Calm commercial: about -16 to -19 LUFS. True peak ≤ -1 dBFS | `audio_tools.py check` |
| Dynamics | Energetic scores: LRA ≥ ~3 LU (a flat wall of sound reads as stock). Calm scores: ~1.5–3 LU is fine, as long as the track doesn't die before the ending | `audio_tools.py check` |
| Effects vs music | ~+3–4 dB lift within each effect's own band over the music-only mix; never inaudible, never poking out (2–8 kHz lift ≤ ~4 dB) | `audio_tools.py mix` report |
| Text contrast | WCAG AA on all settled text (transitional fades excepted) | Sample pixels from stills |
| Brand colour | Sampled backgrounds match brand tokens (3D tone mapping and encoding shift colours) | Crop + average pixel |
| Determinism | Same frame from different seek orders gives identical pixels | `render.py --seek-test` |

## Critic Scorecard

Score each 1–10 from contact sheets and the phone sheet, as a critic, not the author. Ship at ≥8 on every item.

| Item | Check |
|---|---|
| Hook | Frame 0 a finished composition; an arresting image in the first 2s? |
| Mobile legibility | Text readable at 360px wide? |
| Motion | Any linear slides, or dead beats where nothing moves? |
| Variety | Something new every 2–4s; composition types varied? |
| Composition | Subject large enough; no large dead areas or clutter? |
| Source fidelity | Brand colors, fonts and facts match the brief? |
| A/V sync | Downbeats and SFX land on the action? |

## Visual (critic-judged)

- **No empty frames**, e.g. a blank colour band before a title lands, or a lone photo on an empty field.
- **No text collisions**, including mid-transition: one title over another, text flying through a heading, titles spliced by a wipe.
- **Equal spacing** in lists and rows (identical row height, shared left edges, separators). Clients notice this immediately.
- **Aligned left edges** across headline, image and supporting rows.
- **Lead subject** fills ≥1/3 (stylized) or 60–85% (commercial feature beats) of the frame.
- **3D reads as designed**: no toy-like gaps, floating parts, visible texture tiling, top-down "slab" angles, or pops.
- **Pins and callouts** sit on the thing they name, and each photo's label matches its content.
- **Transitions** keep a carried object or matched direction. No unrelated slide-in after unrelated slide-in.
- **Brightness** (commercial): home-services and consumer buyers rejected dark, moody openers. Keep imagery bright and clear unless the brand demands otherwise.
- Look especially for: default centered title over gradient, stray corner labels and borders, text blurred by scaling, stutter at loop seams. For loops, play twice: `ffmpeg -stream_loop 1 -i out/final.mp4 -c copy qa/loop_check.mp4`.

## Business (commercial, critic-judged on mute)

- By the end, a first-time viewer can say what the business does and the one next action.
- Every claim is true or clearly labelled as a concept.
- The CTA is readable at phone size for at least ~1.5s.

## Delivery Checklist

- [ ] Runtime, aspect ratio and frame rate match the brief; audio track present
- [ ] No blank frames on the contact sheet; no elements bleeding into the next shot
- [ ] All text within title-safe; no overflow or occlusion
- [ ] Characters and recurring elements on-model in every shot
- [ ] Facts match the source; uncertain ones listed separately for the user
- [ ] Loudness and true peak on target for the profile
- [ ] Commercial: concept label if fictional, poster frame, music-only fallback, generation ledger

## Common Rejection Reasons from Real Clients

- "Too basic: image, then video, then text."
- "So much space is being wasted."
- "Some parts linger too long."
- "Not spaced equally."
- "It's not elite; go harder."
- "The first image looks too dark."
- "The music doesn't match."
- "The sound effects feel unprofessional and jarring."
