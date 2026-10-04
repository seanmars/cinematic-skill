# brief.md Template

`brief.md` is generated from `storyboard.json` by `uv run <skill>/scripts/brief.py video/<slug>`; never edit it by hand. After approval, fill `storyboard.json` (schema: `<skill>/schema/storyboard.schema.json`) with everything confirmed, then regenerate. The brief drives this production and doubles as a reusable prompt: the user can swap the topic or run it in another tool as-is.

Rules: write approved items out in full in `storyboard.json`, no placeholders; mark anything unspecified by the user as a default inside the field it belongs to (`"specs": "30s (default), 1920×1080, 30fps (default)"`). List intentional holds longer than 0.6s, with their times, in `direction.pacing`. Leave out `business` and `cta` for stylized pieces.

`renderRoot` (optional) never appears in the brief: set it, relative to the project, when `render.py` needs `--root` because the page loads files outside its own folder (e.g. `previews/` sharing code with `lab/`), so every tool serves the page the same way.

## Field Mapping

| storyboard.json | brief.md |
|---|---|
| `inputs.*` | `<inputs>` lines, in the order below |
| `direction.*` | `<direction>` lines, interleaved with the fixed rules |
| `beatGrid` | `Beat grid / VO timeline:` |
| `shots[n].duration` | `Shot n \| start–end`, accumulated in array order |
| `shots[n].text.picture` / `job` / `action` | `Picture:` / `Job:` / `Action:` |
| `techniques.framing` + `techniques.angle` | `Shot:` technique names |
| `techniques.movement` + `text.camera` | `Camera:` |
| `tags` | `Techniques:` |
| `text.audio` | `Audio:` |
| `techniques.transition` + `text.transition` | `Transition:` (what carries across, at which pixel position) |
| `build.picture` / `render` / `audio` | `<build>` items 1, 4 and 5 |
| `gotchas` | `<gotchas>` list |

Technique names come from each technique file's `name`; an empty slot or field produces no line.

## Output

```text
<!-- generated from storyboard.json; edits will be overwritten -->
<role>
You are a motion designer and creative coder who crafts design-driven video in code.
</role>

<inputs>
Topic: ...
Key takeaway (one line): ...
Profile: stylized | commercial
Business and buyer (commercial): ... (what the business does, who buys, the viewer's problem)
CTA (commercial): ... (the single next action)
Provably true: ... (facts the piece may state, with source)
Never claim: ... (testimonials, ratings, savings, guarantees, confirmed appointments...)
Source material: ... (file paths or links; reference videos for mechanisms only)
Real assets: ... (client footage, product UI, photos; or "none: labelled concept")
Specs: ...s, ...×..., ...fps
Brand: primary ..., secondary ..., typeface ...
Audio: score ... (... BPM), SFX ..., VO ...; loudness target ... LUFS
</inputs>

<direction>
Look: ...
One style and one palette throughout; characters and recurring elements stay on-model in every shot.
One idea per shot; minimal, large type, readable at phone size.
Pacing: ... (stylized: shots ≥2–3s, each text block ≥2.5s; commercial: 1.4–3.5s beats, reading holds only on message frames)
The frame never freezes >0.6s; holds keep a slow 3–5% push.
Animate with easing or springs, never linear; transitions grow out of on-screen content, no default crossfades.
Persistent actor: ... (the object, cursor or shape that keeps its identity across shots)
Camera: ... (push in, pull out, track; subject large in frame)
Signature moves: ... (3 transformations)
Avoid: ... (piece-specific, e.g. default centered title over gradient, everything fading in at once, walls of small text, near-black transition frames)
</direction>

<structure>
Beat grid / VO timeline: ...

Shot 1 | 0.000–3.000s
Picture: ...
Job: ... (story beat; commercial: the business job of the beat)
Action: in ..., main action ..., out ...
Shot: Close-Up, Low Angle
Camera: Push In; ... (speed, easing, landing)
Techniques: Rim Light, Warm Amber
Audio: ...
Transition: Match Cut; ... (what carries across, at which pixel position)

Shot 2 | 3.000–...
</structure>

<build>
1. Picture: ... (stack); no external images or assets except user-supplied or ledgered AI generations.
2. Page exposes window.render(t), drawing second t; all visuals derived from t only, seeded randomness, no timers, no state between frames.
3. Custom components (3D, UI flows, logo marks) are built in an isolated lab; commercial pieces put each through a component critic before it joins the film.
4. Render: render.py calls render(t) per frame and captures; ffmpeg encodes MP4. Settings: ... (motion blur: ... subframes, ...° shutter).
5. Audio: ...; SFX on the frame of the on-screen action.
6. After each shot, render 3 stills and check text overflow, overlaps, subject scale, reading time; fix before the next shot.
</build>

<gotchas>
- ... (piece-specific pitfalls, e.g. wait for fonts before capture; confirm WebGL on one frame first; ACES tone mapping shifts brand colors; test-key one green-screen frame; loops need identical first and last frames)
</gotchas>

<start>
Get a storyboard critic pass on <structure>. Build components in labs, then shots in order with QC stills after each. Render the full cut, run one Gauntlet round and one verification round, then deliver.
</start>
```
