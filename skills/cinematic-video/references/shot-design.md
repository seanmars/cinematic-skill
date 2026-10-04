# Shot Design

How to choose shot size, angle, camera move, composition and transitions for each beat, using the technique library in `techniques/`, then translate each choice into code.

## Technique Library

- `techniques/INDEX.md`: all 424 techniques by category, one row each (name, one-line visual effect). ~490 lines; search it rather than reading it whole.
- `techniques/<category>/<slug>.md`: one technique per file, with fixed sections: Narrative Function, How It Works, When to Use, Compared With Similar Techniques, Film Examples, Prompt Examples, Common Mistakes, Related Techniques.

| Folder | Contents | Decides |
|---|---|---|
| `framing` (25) | Shot sizes and types: Close-Up, Two-Shot, Insert, Establishing | How close this shot is |
| `camera-angles` (19) | High / Low / Dutch / POV / Bird's-Eye | Power relation between viewer and subject |
| `camera-movement` (86) | Dolly, Pan, Crane, Orbit, Crash Zoom, Dolly Zoom | Whether and how the camera moves |
| `lenses` (17) | 14–200mm, Anamorphic, Fisheye, Macro | Exaggerated or compressed space |
| `composition` (32) | Rule of Thirds, Negative Space, Frame within a Frame | Where the subject sits |
| `lighting` (41) | Low-Key, Rim Light, Silhouette, Volumetric Light | Scene lighting design |
| `color` (19) | Teal and Orange, Desaturation, Day for Night | Scene color design |
| `atmosphere` (13) | Rain, Fog, Dust Motes, Underwater | Atmospheric elements |
| `time-and-motion` (21) | Slow Motion, Speed Ramp, Freeze Frame, Long Take | Manipulating time |
| `effects` (57) | Rack Focus, Double Exposure, Morph, Film Grain | Focus shifts and special imagery |
| `editing` (23) | Match Cut, Smash Cut, Dissolve, J-Cut | How shots connect |
| `genre-looks` (27) | Film Noir, Wuxia, Found Footage, Pixel Art | Overall art direction |
| `viral-looks` (44) | Stylized looks from AI-video trends | A treatment's whole look |

Use `genre-looks`, `viral-looks`, `color` and `lighting` when writing a treatment's Look; the rest when storyboarding. For AI stills, adapt a technique's Prompt Examples.

## Finding Techniques

1. **Search INDEX.md** with Grep for effect or emotion words (`reveal`, `tension`, `isolation`, `scale`, `speed`); summaries describe the visual effect and mood, so emotion words find candidates.
2. **Read a category block** in INDEX.md when comparing options of one kind ("which shot size here?").
3. **Read only the techniques you will use**, usually 3–8 per scene, for Compared With Similar Techniques and Common Mistakes. Skip basics (Close-Up, Wide Shot, Eye Level); spend reads on key shots and close calls.
4. **Not in the library?** First rule out a different name: search INDEX.md for the effect and mood words. If it really is missing, search the web; when you find it, write it as a custom technique in the project (below) with the source URL. If the web has nothing either, ask the user how it should look and discuss the approach before writing it (`source: user`). Never add files to the skill's library.

General film knowledge is fine, but when the library has a matching technique, record its file in the shot's technique slots or tags in `storyboard.json`.

### Custom techniques
A technique the library lacks lives in the project at `video/<slug>/techniques/<category>/<slug>.md`, in the library's format, under one of the library's categories:

```markdown
---
name: Snap Whip Reveal
category: camera-movement
slug: snap-whip-reveal
source: https://example.com/where-you-found-it   # or: user
---

# Snap Whip Reveal

Summary: One sentence on the visual effect and mood.

## How It Works

- How to achieve it, and how to build it in code.
```

Reference it like a library technique (`camera-movement/snap-whip-reveal.md`). `brief.py` looks in the library first, then in the project, and stops with an error listing every path found in neither, so a typo never reaches the brief.

## Storyboarding

### Beats
Break the piece into beats; each beat gets 1–3 shots (commercial: compositions). Find the **key moment** (reveal, reversal, emotional peak, product payoff) and save the strongest technique for it. Many Common Mistakes sections warn that overuse kills impact (Dolly Zoom, Crash Zoom, Dutch Angle, Smash Cut); spend them early and the key moment has no contrast left.

After building suspense for a reveal, follow with a shot that shows the subject **clearly**. A silhouette or fragment alone doesn't pay it off; the viewer doesn't know what to feel.

### Per-shot choices
Decide in order: shot size → angle → camera move → focal length → composition → transition. Lighting, color and atmosphere are usually scene-level; change them only at emotional turns.

Every choice must answer "why does this beat need it". Unmotivated camera moves add render cost and visual clutter. Use Compared With Similar Techniques to choose between close options.

Record the choices in each shot of `storyboard.json`. Fill all four technique slots with a technique path (`camera-movement/push-in.md`, from the library or a custom technique): `framing` from `framing/`, `angle` from `camera-angles/`, `movement` from `camera-movement/`, `transition` from `editing/`. Use `null` only when no technique fits, and describe the choice in the shot's text instead; `transition` is also `null` when the shot does not end on a cut (a continuous take carried into the next beat, or the last shot). Other techniques (lens, composition, lighting, color, atmosphere, effects) go in `tags`. Timing, speed and how the move lands go in the free-text `camera` and `transition` fields. If a slot and the text disagree, the slot is the intent: rewrite the text and the code to match it.

Plan sound with the shots: many transitions and reveals are sound-led (hear the source before seeing it; a J-cut brings audio in early). SFX land on the frame of the action.

### Rhythm and continuity
- **Contrast creates rhythm:** alternate wide ↔ close, still ↔ moving, long ↔ short. Several shots in a row with the same size and move lose attention.
- **Continuity:** keep the 180-degree line, screen direction and eyeline match. Code-built shots are composed separately, which makes line jumps easy.
- **Readability:** give each camera move a readable landing; keep holds alive with a slow push (`craft-rules.md`).
- **Runtime:** shot durations must sum to the target length.

## Translating Techniques to Code

Live-action techniques describe a physical camera. In code, pick the 2D or 3D equivalent; all values are functions of t (noise seeded, no frame state).

| Technique | 2D (HTML / CSS / Canvas / SVG) | 3D (Three.js) |
|---|---|---|
| Pan / Tilt | Translate an oversized background layer | Rotate the camera |
| Zoom (slow / crash) | Scale the whole frame (flat, no parallax) | Animate `camera.fov` or `setFocalLength()` |
| Dolly / Push In / Truck | Multiplane: foreground, midground and background layers scale and translate at different rates for parallax | Move the camera position |
| Tracking / Follow | Subject cycle in place + looping background pan | Camera follows a target with an offset |
| Crane / Pedestal | Vertical pan + layer parallax | Move camera Y and adjust pitch |
| Arc / Orbit / 360 | Needs real 3D; fake only small arcs with per-layer offset | Camera on a circular path, `lookAt` the subject |
| Dolly Zoom | Subject layer keeps its size while the background layer scales inversely | Move the camera and change FOV together so the subject's size stays constant |
| Handheld / Shake | Seeded noise on the frame transform | Seeded noise on camera position and rotation |
| Whip Pan | Directional blur, smeared frames or speed lines | Fast rotation + `render.py --subframes` |
| Rack / Shallow Focus | Per-layer `filter: blur()` animated over t | DOF pass with animated focus distance |
| Slow Motion / Speed Ramp | Remap time: drive the shot with `local = ease(t)` instead of `t` | Same time remap |
| Freeze Frame | Hold local time constant; keep a slow push so the frame isn't frozen | Same |
| Focal length (14–200mm) | Express it in layer spacing: wide exaggerates depth, long flattens layers | `camera.setFocalLength(mm)` |
| Match Cut / Graphic Match | Hand off a shape at exact pixel coordinates across the cut | Shared pose function on both sides of the cut |

## Output

Shot choices go into `brief.md` `<structure>`: for each shot, the size, angle, move and transition, plus a one-line reason. For key shots, link the technique file (e.g. `references/techniques/camera-movement/push-in.md`) and name the Common Mistake to avoid.
