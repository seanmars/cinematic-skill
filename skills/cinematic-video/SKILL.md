---
name: cinematic-video
description: >-
  Code-driven video production: stylized shorts and premium launch-style commercials built with Canvas / HTML-CSS-SVG /
  WebGL shaders / Three.js / Remotion / HyperFrames / Manim, rendered frame by frame (Playwright + FFmpeg), with
  synthesized or library audio. Pitches three treatments with style frames, storyboards from a 424-technique shot
  library, locks a creative brief after sign-off, builds shot by shot, and QCs with independent critic agents plus measured checks (frozen time, loudness, determinism).
  Use whenever someone wants Claude to make, animate, render or review a video, motion graphic, animated explainer,
  product promo, business ad, SaaS launch film, kinetic-typography piece, pixel-art or retro animation, UI motion demo,
  or recreate a reference video's look in code, in any language. Also use for compositing AI-generated stills, clips
  or green-screen characters into code-built scenes. Not for NLE editing (Premiere/CapCut/AE) or subtitling existing footage.
---

# Cinematic Video: Video as Code

Opus can't output video. It authors a self-animating page (or Manim scene) exposing `render(t)`; `render.py` captures it frame by frame and FFmpeg encodes the MP4.

The pipeline: **pre-production with one sign-off, autonomous production, independent QC.** Three treatments → style frames → approval → locked brief → shot-by-shot build → Gauntlet review → delivery.

`<skill>` below is this skill's directory. Scripts run with uv (dependencies declared inline): `uv run <skill>/scripts/<name>.py`.

## Profiles

Choose one at intake and say which; it sets pacing, audio and ship criteria.

| | Stylized | Commercial |
|---|---|---|
| For | Explainers, pixel/CRT/hand-drawn shorts, UI motion, reels, reference recreations | Ads, launch films, product promos for a real business or product |
| Pacing (30s) | 6–10 shots, ≥2–3s each | 12–15 compositions, 1.4–3.5s beats |
| Subject in frame | ≥1/3 | 60–85% in feature beats |
| Audio | Synthesized score and SFX allowed | Library or real recordings; per-band SFX levels |
| Loudness | -14 LUFS | -14 punchy, -16 to -19 calm |
| Gauntlet rounds | Storyboard, full film, verification | Plus asset and component rounds |
| Extra rules | | Purpose readable on mute, concept labelling, CTA ≥1.5s at phone size |

## Reference Routing

Read only what the current step needs:

| Step | Read |
|---|---|
| Treatments, previews | `references/treatments.md`, `schema/treatments.schema.json`, `references/code-stack.md` |
| Shot language: size, angle, camera move, lighting, color, transitions | `references/shot-design.md` → `references/techniques/` (424 techniques) |
| Storyboard, motion design | `references/motion-grammar.md`; `references/launch-film-notes.md` for concrete moments |
| Brief | `schema/storyboard.schema.json`, `references/brief-template.md` |
| Building pages, AI footage | `references/craft-rules.md`, `references/code-stack.md` |
| 3D components | `references/three-js-patterns.md`, `templates/` |
| 3D product that must move like the real one | `references/product-hero-realism.md` |
| Review rounds | `references/gauntlet.md`, `references/critic-prompts.md`, `references/quality-bar.md` |
| Music, SFX, mix | `references/audio.md` |
| Commercial: offer, pricing, worked examples | `references/commercial/` |

## Non-negotiables

1. **Truth.** Facts come only from the source. Never invent features, figures, dates, testimonials, ratings, results or guarantees. Concept films say so on screen ("Fictional brand · Concept film · AI-generated imagery").
2. **Picture is a pure function of time.** `window.render(t)` draws second t: no `requestAnimationFrame`, timers, `Date.now()`, CSS transitions, unseeded randomness or physics history. Any frame re-renders identically in any seek order.
3. **Builder ≠ judge.** Component and full-cut reviews go to a fresh critic agent that sees only the render, the brief and references.
4. **"No bugs" ≠ good.** Clean renders still fail for being basic, empty or static. Measure, then judge creatively.
5. **Borrow mechanisms, never assets.** References teach structure and technique; never lift footage, layouts, logos or copy.

## Project Directory

```
video/<slug>/
  source/        Source material, reference analysis, beats.json, ledger.md (AI generations)
  previews/      Treatment style frames / motion tests
  treatments.json  The three treatments and the user's choice
  storyboard.json  Locked brief and shots: the single source of truth
  brief.md       Generated from storyboard.json by brief.py; doubles as a reusable prompt
  lab/           Isolated component labs
  index.html     Picture code (or Remotion / HyperFrames / Manim project)
  audio/         Score, VO, plan.json, sfx/, mix
  qa/            Stills, contact sheets, critic reports, review_log.md
  out/final.mp4  Master
```

## Workflow

### 0. Environment
Run `uv run <skill>/scripts/check_env.py` once. It checks ffmpeg and its filters, a headless browser, WebGL2 and H.264. If anything is missing, tell the user and install only with consent (`--install-browser` installs Playwright's Chromium).

### 1. Intake
Accept any mix of: an idea; source material (article, VO script, product URL, codebase, dataset); a reference video.

Ask only what changes the treatment, max 3 questions: runtime, aspect ratio, VO, brand colors/fonts; for commercial, the buyer and the single CTA. Otherwise default (30s, 1920×1080, 30fps or 60fps for commercial motion, no VO), state the defaults and let the user override.

- **Source material:** extract key message, audience and must-include facts; for commercial, also what is provably true and what must never be claimed. With no real assets, agree on a labelled concept.
- **Reference video:** download only with consent. `uv run <skill>/scripts/analyze_video.py <video> --out source/ref` gives info, cut points and a contact sheet; log shot structure, pacing, palette, typography, stack and transition mechanisms with timestamps.
- **Supplied music:** `uv run <skill>/scripts/audio_tools.py beats <music> > source/beats.json`; time everything to it.

### 2. Treatments
Write three treatments per `treatments.md` into `treatments.json` (schema: `<skill>/schema/treatments.schema.json`). They must differ in look, structure or stack, not palette: one safe, one new visual language, one new storytelling device. Draw each Look from the genre, viral-look, color and lighting techniques (`shot-design.md`).

### 3. Previews and sign-off
One style frame per treatment, built from its most representative shot on shot-local time: `uv run <skill>/scripts/render.py previews/plan-a.html previews/plan-a.png --still 2.0 --size 1920x1080`. Motion-driven treatments get a 2–4s motion test (`--fps 30 --duration 3`). Fix obvious issues before showing. Estimate render time: per-frame time × frames × subframes × 1.3.

Present all three with preview paths; the user picks, mixes or revises. Record the choice in `treatments.json` (`chosen`); keep the other options as a record. **This is the only approval gate.** After it, build without asking for step-by-step approval and report status in one line during long work. Web mode is the exception: when the studio mod is loaded, its web studio protocol is in your system prompt; follow it instead (it gates every stage).

### 4. Brief
Write `storyboard.json` (schema: `<skill>/schema/storyboard.schema.json`), expanding the chosen treatment with every approved detail. Its `shots` are the storyboard: duration → picture → job of the beat → transition out, including which object survives it. Fill each shot's four technique slots (framing, angle, movement, transition) per `shot-design.md`, saving the strongest technique for the key moment. A technique the library lacks becomes a custom technique file in the project (`shot-design.md`, Custom techniques); if neither the library nor the web explains it, ask the user, even after sign-off, rather than inventing one. Then generate the brief: `uv run <skill>/scripts/brief.py video/<slug>`. Never edit `brief.md` by hand: change `storyboard.json` and regenerate (`brief-template.md` shows the output). Send `brief.md` to a fresh storyboard critic (`critic-prompts.md`) before building.

### 5. Assets (if needed)
AI stills and clips, green-screen characters and the generation ledger: see `code-stack.md`. Commercial: run an asset critic round on generations before they enter the film.

### 6. Build
Read `craft-rules.md` first.
- **Components in isolation:** each custom component (3D scene, UI flow, logo mark) gets a lab page from `templates/component-lab.html`, rendered as stills plus a 3–4s proof, and needs a component critic's KEEP before joining the film.
- **Shot by shot:** after each shot, render 3 stills (`--still`) and check text overflow, overlaps, subject scale and reading time. For 30s+ pieces, once all shots are blocked in, render a 960×540 animatic without motion blur; lock pacing and transitions before polishing.
- **One root timeline:** scenes map film time → local time; carried objects hand off at exact pixel coordinates.
- **Keep the camera moving:** push in, pull out, track. Without camera direction, frames default to a locked-off camera and feel empty.

Use the framework the user names; otherwise a single HTML file (`code-stack.md`).

### 7. Render
`uv run <skill>/scripts/render.py index.html out/picture.mp4 --size 1920x1080 --fps 30 --duration 30`. Motion blur: `--subframes 4` (4× render time; warn the user) and `--shutter 180–360`. Partial re-renders: `--start` / `--duration`. Determinism: `--seek-test 1 7.5 12.25`.

### 8. Audio
Per `audio.md` and the profile. Stylized: synthesize score and SFX, mix, normalize, mux into `out/final.mp4`. Commercial: `audio_tools.py mix out/picture.mp4 out/final.mp4 --score ... --music-lufs ... --plan audio/plan.json --sfx-dir audio/sfx`, plus a music-only fallback (`--no-sfx`).

### 9. Gauntlet
1. Measure: frozen time, contact sheets, phone sheet, loudness (commands in `gauntlet.md`).
2. Send the render to a fresh full-film critic (`critic-prompts.md`); never pass your own reasoning.
3. Fix the highest-impact items, re-render only the affected seconds, re-measure.
4. A *new* verification critic checks each prior item FIXED / PARTLY / STILL PRESENT and flags regressions.
5. Stop at the quality bar (`quality-bar.md`), at diminishing returns, or when the user says stop; usually 3–5 rounds. Log every round in `qa/review_log.md`.

### 10. Deliver
Master MP4, `brief.md`, project directory and `qa/review_log.md`, with a short note: key creative decisions, known weaknesses, render time, what was measured versus listened to, sampled versus exhaustive review. Commercial adds a poster frame, the music-only fallback and the generation ledger. List uncertain facts separately for the user to verify.

## Edge Cases

- **Photoreal characters:** code can't produce them; use green-screen video-model clips (`code-stack.md`).
- **Slow renders:** proof at lower resolution or frame rate; motion blur and WebGL post are the biggest costs.
- **WebGL unavailable:** `check_env.py` flags it; confirm the shader on one frame before a full render.
- **No fresh agent available:** say at delivery that the review was self-assessed.
- **User only wants the prompt:** skip Steps 5–10 and deliver `brief.md`.
