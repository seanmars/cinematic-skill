---
name: Datamosh
category: effects
slug: datamosh
source: https://melies.co/cinematic-techniques/effects/datamosh
---

# Datamosh

Summary: Deliberately corrupt the video encoding so pixels from the previous image flow into the next along residual motion vectors, creating a blocky melt.

## Narrative Function

- Presents a "digital ruin" aesthetic rather than a photographic or optical effect.
- Suits music videos, corrupted memories or signal-loss passages.
- Turns the glitch itself into a transition or an emotion.

## How It Works

- Remove or corrupt I-frames during encoding so P-frames / B-frames keep predicting motion from the wrong reference frame.
- Result: Blocky artifacts that spread over time, with clearly visible macroblocks.
- The codec tries to describe motion that no longer has a valid source frame.

## When to Use

- Use: When deliberate file corruption serves the story, e.g. a transition where the previous subject's pixels flow into the new scene via residual motion vectors.
- Avoid: When what you want is frame repetition (use stutter).
- Avoid: Long-shutter motion blur or color fringing.

## Compared With Similar Techniques

| Technique | Difference |
| --- | --- |
| [Stutter / Stop-Stutter](../time-and-motion/stutter.md) | Rhythmically repeats complete frames; datamosh corrupts the data between frames |
| [Altered State](altered-state.md) | A perceptual or photographic effect; datamosh is codec-specific debris |
| [Chromatic Aberration](chromatic-aberration.md) | Optical color separation; datamosh is a temporal collapse between frames |

## Film Examples

- Chairlift's music video *Evident Utensil* (2009): A landmark work using GOP collapse as its main visual language.
- Rarely sustained in features, because it destroys large amounts of shot content.

## Prompt Examples

```text
Datamosh transition in a music video: a dancer's pink jacket and face refuse to leave when the shot cuts to a crowded subway platform, her pixels smearing along the new crowd's motion in blocky macroblock trails because no fresh keyframe arrives. Pure codec breakdown, no motion blur, no RGB split, no repeated frames.
```

## Common Mistakes

- Confusing it with stutter, long-shutter blur or RGB split (clean repeated frames, motion blur, three-color copies) → let blocky temporal bleed carry across the cut.
- The new image's keyframe arrives too early → keep residual pixels from the previous image and don't let a new keyframe refresh it.

## Related Techniques

- [Stutter / Stop-Stutter](../time-and-motion/stutter.md)
- [Lens Flare](lens-flare.md)
- [Anamorphic Flare](anamorphic-flare.md)
