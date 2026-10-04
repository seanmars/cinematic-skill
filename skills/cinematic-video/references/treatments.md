# Treatment Format

Pitch all three treatments together for side-by-side comparison. Keep each to one screen so the user can judge at a glance. Store them in `video/<slug>/treatments.json` (schema: `<skill>/schema/treatments.schema.json`) and present them in the format below.

## Template

```markdown
### Treatment A: [Memorable title]

**Logline**: [How the piece tells it, and what the viewer takes away]
**Look**: [Visual language + palette (2–4 hex values) + typeface]
**Specs**: [runtime]s · [aspect ratio] · [frame rate]fps · [profile]
**Stack**: [e.g. HTML/CSS/SVG + spring animation + synthesized SFX]
**CTA** (commercial): [the single next action, readable on mute]

**Shot Breakdown**
1. 0–3s  [Opening shot, 1–2 sentences]
2. 3–8s  [...]
3. ...

**Signature moves**: [3 transformations describable without effect names, e.g. "the inspection photo becomes the report's hero image"]
**Audio**: [Score style and BPM / SFX / VO]
**Estimate**: ~[X] min render · Key risk: [one line]
**Why it fits**: [Why this treatment suits the source material]

Preview: previews/plan-a.png
```

## treatments.json

One entry in `options` per treatment, ids `A`, `B`, `C`:

| Presented as | Field |
|---|---|
| Treatment A: title | `id`, `title` |
| Logline | `logline` |
| Look | `look.description`, `look.palette` (2–4 hex), `look.typefaces` |
| Specs, Stack, CTA | `specs`, `stack`, `cta` (commercial only) |
| Shot Breakdown | `shots`: `{ "range": "0–3s", "text": "..." }` per line |
| Signature moves | `signatureMoves` (one string each) |
| Audio | `audio` |
| Estimate · Key risk | two fields: `estimate` is the render time only (a first guess now; update it once Step 3 has measured the per-frame time), `risk` is the key risk in one line |
| Why it fits | `whyItFits` |
| Preview | `preview`: the style frame; `motionTest`: the 2–4s motion test, only for motion-driven treatments (paths relative to the project) |

`chosen` stays `null` until sign-off, then records the pick: `{ "id": "B" }`, plus `mix` (`[{ "option": "A", "element": "Look" }]`) when the user combines treatments and `notes` for revisions. Keep all options after sign-off; the chosen content is expanded into `storyboard.json`.

## Shot Count by Profile

| Profile | Shot length | 15s | 30s | Longer |
|---|---|---|---|---|
| Stylized | ≥2–3s | 4–5 shots | 6–10 | Group into sequences |
| Commercial | 1.4–3.5s beats | 6–8 compositions | 12–15 | Group into acts |

Describe what's in frame, how it moves, and how it transitions to the next shot, including which object carries across.

## Differentiating the Three

- **A: Safe**: closest to source and reference; most complete information.
- **B: New visual language**: same content, different look, e.g. flat → pixel art, dark tech → colored-pencil hand-drawn.
- **C: New storytelling device**: structurally bold, e.g. a recurring visual hero, a single unbroken long take, reverse chronology, one extended metaphor.

Vary the stack across treatments where possible so previews diverge clearly. Pick 3–6 mechanisms from `motion-grammar.md` whose *mechanism* fits the story, not whose layout looks nice.

## Writing the Shot Breakdown

- Describe concrete images: "A black pill button is clicked and collapses into a loading spinner", not "showcase product features".
- Facts must match the source; never invent figures, names or features.
- One idea per shot; minimal, large type. If copy won't fit the runtime, cut shots or let visuals carry it; never shorten reading time.
- Vary composition types: macro → wide → overhead → UI close-up → type impact. Don't repeat "heading above three cards".
- 3D only where it explains something physical or spatial; type and UI stay crisp HTML/SVG.

## Previews

- Default: one style frame. Build only the shot that best represents the look (time starts at 0); render one PNG at the treatment's aspect ratio.
- Motion-driven treatments (morphs, beat sync, transitions): 2–4s motion test.
- Previews show the look, not completeness, but copy, palette and fonts must be final. No placeholder blocks; the user can't judge them.
- Review previews yourself before showing the user.
