# Craft Rules

## Page Skeleton

```html
<script>
window.ready = false;                       // set true after fonts, images, models load
window.render = function (t) {              // t in seconds; may return a Promise
  // 1. Derive each element's state from t (position, scale, opacity, color...)
  // 2. Draw / write to style
};
document.fonts.ready.then(() => { window.render(0); window.ready = true; });
</script>
```

render.py serves the page over local HTTP (rooted at the page's folder, or `--root`), so ES modules, `fetch()` and WebGL textures work. Keep every asset inside that root.

## Fonts

- CJK fonts vary by OS: macOS has PingFang, Windows has Microsoft JhengHei / YaHei, Linux usually Noto Sans CJK. Use a fallback stack, e.g. `"PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans TC", sans-serif` (SC variants for Simplified).
- For identical output across machines, bundle font files next to the page and load via `@font-face` (e.g. Source Han Sans / Noto Sans TC); no web fonts. Headless Chrome renders `-apple-system` as Times, so bind family names to local files. Set `window.ready` only after `document.fonts.ready`.
- CJK in pixel art: draw with a normal font on the small canvas, then threshold alpha (e.g. alpha > 0.5 = solid) for hard pixel edges. Keep CJK glyphs ≥18px on the logical canvas or strokes smear.
- Canvas text must wait for font load, or the first frames fall back to the default font.

## Time Determinism

The renderer calls render(t) in any order, any number of times (stills, partial re-renders, motion-blur subframes, seek tests). Any state carried from a previous frame (accumulated positions, timers, unseeded randomness, physics history) makes re-renders diverge. Verify with `render.py --seek-test`.

- Randomness: seeded PRNG such as `rnd(seed)`, never `Math.random()`.
- Accumulating sims (particle physics, water): step from 0 to t at a fixed timestep, or use an analytic solution. Cache for sequential renders if needed, but single stills must still compute correctly.
- CSS: no transitions or animations; set all styles inside render(t).
- Retiming: map film time → local time (`(t - start) * speed`); never a free-running clock.
- Hand-drawn texture: seed strokes with `floor(t * 12)` so lines boil 12 times/sec, while camera moves stay smooth every frame.

## Animation Toolkit

- Easing: `smoothstep` or cubic in-out suffices; linear motion reads as mechanical. For lifts and separations use smootherstep (`x*x*x*(x*(x*6-15)+10)`): a cubic ease-out starts at full velocity and pops in one frame.
- Change speed, don't drift: readable target → fast exit → slowing arrival.
- Springs (closed-form, independent of previous frames):
  ```js
  function spring(x, w = 16, z = 0.72) {            // x = seconds since target changed
    if (x <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }
  // Retargeting: v(t) = v0 + Σ (v_i − v_{i−1}) · spring(t − t_i)
  ```
  Four tiers by role; same element type uses the same tier within a piece:

  | Role | Feel | Params |
  |---|---|---|
  | Button, toggle, indicator leading edge | Snappy | w 22–26, z 0.75–0.85 |
  | Cards, containers, camera | Default | w 14–16, z 0.7–0.75 |
  | Hero type, 3D objects, logo lockup | Heavy, near-zero overshoot | w 9–11, z 0.85–1 |
  | Mascots, stickers | Bouncy, visible overshoot | w 16–20, z 0.4–0.5 |

  When a value retargets repeatedly (cursor position, container width), don't restart the spring; use the summation above so motion stays continuous and frame 812 still computes standalone.
- Beats: seconds per beat = `60 / BPM`; key actions on beats, biggest changes on downbeats (beat 1 of each bar).
- Motion blur: `render.py --subframes 4` (4× render time), `--shutter 180–300` for crisper or smeared blur. Use only where fast motion needs it.

## Scenes and Handoffs

- One root timeline; each scene is a function of local time. Three.js scenes render from the same root clock.
- Hand carried objects across scenes at **exact pixel coordinates**: the last frame of scene A equals the first frame of scene B for that object. Share pose functions across the cut so both sides compute identical states.
- Pre-position the destination so the carried object lands on it; check each cut with a frame-difference against its neighbours.
- Keep one wipe direction and one title position through a run of similar shots. The outgoing title leaves before the wipe; the incoming title enters after it.

## Picture

- Camera: specify push in, pull out, track. Subject fills ≥1/3 of frame (stylized) or 60–85% of the usable frame in feature beats (commercial). Unspecified → locked-off camera and empty frames.
- Frame 0 is a finished composition, never a half-entered word.
- Text: one line per screen max. Text swapping inside a morphing container needs its own in/out timing, or old and new text overlap. Never fly text through other text; fade out, then in at the destination.
- No `will-change` on scaled or text-rendering elements; text blurs. An overlay on a pushed parent must share the push, or it drifts off alignment.
- Canvas: size by devicePixelRatio; for pixel art disable smoothing (`imageSmoothingEnabled = false`) and round coordinates.
- WebGL: `getContext('webgl2', { preserveDrawingBuffer: true })`, call `gl.finish()` after each frame; render one frame to confirm the shader works before the full render. Measure brand colors on the rendered pixel (tone mapping shifts them).
- Loops: last frame matches first exactly, including cursor position and velocity.
- Multi-aspect (9:16 / 1:1 / 16:9): lay out scenes with layout functions, no hard-coded pixels; reposition type and UI per aspect, then render each from the same timeline. Never crop a 16:9 master to vertical.
- Avoid the default look: dark background + centered hero text + everything fading in/out. If the style calls for dark (CRT, night, neon), keep it but design the layout and motion; avoid near-black transition frames, which hide the story on phones.

## Footage

- Don't seek `<video>` elements: seeks are async and some browsers lack H.264 (`check_env.py` reports it). Extract to an image sequence (`ffmpeg -i clip.mp4 -q:v 2 frames/%04d.jpg`), preload, and draw `frames[floor((t - start) * clipFps)]`.
- Or composite in FFmpeg: overlay keyed footage onto the code-rendered plate (green-screen workflow in `code-stack.md`).
- Long sequences: preload only the frames a scene needs, and set `window.ready` after they decode.
