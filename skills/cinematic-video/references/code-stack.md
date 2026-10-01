# Code Stack

Rule: **lock the look first, then pick the simplest code that achieves it.** Don't mix three stacks when one will do. When layering, stack content → texture → audio; each layer runs and QCs on its own.

## Eight Stacks

| Stack | Strength | Typical Look | Avoid For |
|---|---|---|---|
| Canvas 2D | Stroke-by-stroke 2D drawing | Pixel art, flat illustration, hand-drawn line, particles, charts | Type-heavy layouts needing crisp text (blurs when scaled; size canvas by devicePixelRatio) |
| HTML / CSS / SVG | UI and typography | UI motion, kinetic type, cards, data viz, icon line-draw | Thousands of particles, complex texture |
| WebGL shaders | Per-pixel texture and look | CRT curvature and scanlines, film grain, halftone, water reflections, bloom | Drawing content directly (render content in Canvas, then feed the shader) |
| Three.js | 3D scenes that explain something physical or spatial | Product turntables, exploded layers, 3D type, point clouds, low-poly sets | Photoreal humans; decoration with no information (see `three-js-patterns.md`) |
| p5.js + p5.brush | Natural-media strokes | Colored pencil, watercolor, crayon storybook | Long pieces needing fast renders (brushes are slow; benchmark per-frame time first) |
| GSAP / HyperFrames | Timeline animation, fast-cut motion | Keynote-style, beat-synced motion | Don't introduce unless installed or requested |
| Remotion (React) | Long-form, multi-scene, reading product codebases | Product promos, explainers, retrospectives | One-off 10–20s motion pieces (single HTML is faster) |
| Manim (Python) | Math and concept explainers | Equation derivations, axes, geometric transforms | Design-heavy brand motion |

Audio layer: see `audio.md`. Stylized pieces may synthesize score and SFX in code; commercial pieces use library or real recordings.

## Defaults

- No framework named: **single HTML file + render(t)**; content in Canvas or HTML/CSS/SVG, plus a WebGL pass if texture is needed.
- Product codebase, long multi-scene piece, or React requested: Remotion. One component per scene; all animation computed from the current frame number.
- HyperFrames requested: install its skill first (`npx skills add heygen-com/hyperframes`) and follow its conventions; the critic loop and measurements here still apply.
- Math, physics, algorithm explainers: Manim. Renders outside the browser via Manim's CLI; mux audio with FFmpeg.

## Look → Stack Lookup

| Target Look | Stack | Reference Work (study technique, don't copy) |
|---|---|---|
| Pixel animation | Canvas 2D low-res canvas (e.g. 128×96) at integer upscale + poses stepped at 8–12fps | @majidmanzarpour's pixel wizard |
| Premium UI motion | HTML/CSS/SVG + closed-form springs + beat grid + 4-subframe motion blur + UI SFX | @twoclipping's open-source UI morph template |
| Motion reel / title sequence | HTML kinetic type + SVG handwritten annotations + Canvas particles + SFX | "15-second motion portfolio" one-line-prompt pieces |
| Retro game / CRT | Canvas pixel content → WebGL CRT shader (curvature, scanlines, phosphor mask, bloom) | @prasenx's video game history short |
| Era-spanning history | New rendering style per era (Canvas pixel, shader texture, Three.js 3D) under one continuous score | @prasenx's video game history short |
| Long-form explainer | Remotion + SVG/Canvas scenes + one recurring visual hero + VO + score | @kimmonismus's AI history |
| SaaS launch film / business ad | HTML/SVG UI + AI stills/clips + selective Three.js + projected callouts | `launch-film-notes.md`, `commercial/case-study-alder.md` |
| Physical product hero | Three.js device with measured motion keys + HTML type | `product-hero-realism.md`, `commercial/case-study-duo.md` |
| Product promo from a live site | Remotion or HTML + Playwright captures of the real page with element coordinates logged + camera pushes onto real buttons | @aiwarts's GoodCase promo |

## AI Footage + Code

Code can't render photoreal humans or complex choreography; video models can't hold exact type, UI or geometry. Split the work:

- **AI stills**: generate the key frame first, then animate it with image-to-video. Prompt as a production brief: lens, light, exposure ("bright, airy, nothing crushed to black"), negative space reserved for type, "no people / no text / no logos / no watermark" when needed.
- **AI clips**: 4–5s with restrained camera ("a steady gimbal dolly, about 25 cm of travel, preserve the exact geometry, no morphing"). Expect 720p/24fps; upscaling is not native detail. Reject clips whose geometry warps; regenerate rather than hide.
- **In the page**: draw footage from an image sequence (see `craft-rules.md`), or composite it as an FFmpeg layer.
- **Ledger** (`source/ledger.md`): model, prompt, seed, job id, accepted time window. Never commit API keys.

### Green-screen characters

1. The user generates character clips (Grok, Jimeng, Kling, Seedance, etc.) on a **solid green screen**, full body in frame, never exiting frame.
2. Key: `ffmpeg -i dancer.mp4 -vf "chromakey=0x19FF0A:0.16:0.08,despill=type=green" ...`; sample the key color from an actual frame grab. Key one frame first and show the user the edges.
3. Build background, type, stickers, split screens and 3D orbiting text as a code-rendered plate (render.py).
4. Composite with FFmpeg `overlay`; split screens = the same clip overlaid multiple times, offset by a few frames.
5. Beat sync: change background and type on every beat; the character clip stays untouched.

Reference work: @Gorden_Sun's dance piece (Grok green-screen character + web motion background), @AbaneChan's stock-themed self-intro (three Grok dance clips + motion-portfolio prompt).
