# brief.md Template

After approval, fill in everything confirmed. It drives this production and doubles as a reusable prompt: the user can swap the topic or run it in another tool as-is.

Rules: write approved items out in full, no bracketed placeholders; mark anything unspecified by the user as a default. Drop lines marked (commercial) for stylized pieces.

```text
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
Shot 1 | 0.0–3.0s
Picture: ...
Job: ... (story beat; commercial: the business job of the beat)
Action: in ..., main action ..., out ...
Shot: size ..., angle ..., lens ...
Camera: ... (move, speed, easing; technique file for key shots)
Audio: ...
Transition: ... (what carries across, at which pixel position)
Shot 2 | ...
...
</structure>

<build>
1. Picture: ... (stack); no external images or assets except user-supplied or ledgered AI generations.
2. Page exposes window.render(t), drawing second t; all visuals derived from t only, seeded randomness, no timers, no state between frames.
3. Custom components (3D, UI flows, logo marks) are built in an isolated lab and pass a component critic before joining the film.
4. Render: render.py calls render(t) per frame and captures; ffmpeg encodes MP4. (Motion blur: ... subframes, ...° shutter.)
5. Audio: ...; SFX on the frame of the on-screen action; VO synthesized in one pass; mix to ... LUFS, true peak ≤ -1 dBTP.
6. After each shot, render 3 stills and check text overflow, overlaps, subject scale, reading time; fix before the next shot.
</build>

<gotchas>
... (piece-specific pitfalls, e.g. wait for fonts before capture; confirm WebGL on one frame first; ACES tone mapping shifts brand colors; test-key one green-screen frame; loops need identical first and last frames)
</gotchas>

<start>
Get a storyboard critic pass on <structure>. Build components in labs, then shots in order with QC stills after each. Render the full cut, run the Gauntlet until the quality bar holds, then deliver.
</start>
```
