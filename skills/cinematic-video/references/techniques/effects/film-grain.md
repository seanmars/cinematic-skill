---
name: Film Grain
category: effects
slug: film-grain
source: https://melies.co/cinematic-techniques/effects/film-grain
---

# Film Grain

Summary: A random grain texture that changes every frame, making the image look like exposed and developed film.

## Narrative Function

- Conveys the feel of "really shot and lab-processed" rather than the cleanness of a digital render.
- Grain density varies by image region (denser in shadows and midtones, sparser in highlights), adding tactility.
- Heightens a period, documentary or gritty mood.

## How It Works

- Film stock choice determines grain size: higher speed means coarser grain, smaller gauge makes it more visible; push processing enlarges grain.
- Digital emulation: Generate temporally unstable, monochrome, density-weighted grain.
- Avoid sharpening after adding grain.

## When to Use

- Use: Atmospheric shots that need a film feel, such as dusk interiors, bad weather or handheld sequences.
- Grain size should scale with the chosen film gauge.
- Avoid: Pasting identical grain on every shot, or adding coarse grain to sharp product close-ups.

## Compared With Similar Techniques

| Technique | Difference |
| --- | --- |
| [Halation](halation.md) | A glow around highlights caused by reflection off the film base, not grain structure |
| [Filmic Faded](../color/filmic-faded.md) | A grading choice (lifted blacks, desaturation) that can be combined with grain |
| [Lens Flare](lens-flare.md) | An optical artifact caused by strong light |

## Film Examples

- *The Revenant* (2015): Natural-light texture reads like developed film rather than a sensor.
- *Roma* (2018): Large-format, serene images with a photochemical finish.
- *Saving Private Ryan* (1998): Grain in the battle scenes becomes part of the visual language.

## Prompt Examples

```text
Dusk interior shot on 16mm film stock: organic monochrome grain that changes every frame, clumping densely in the shadows and midtones while thinning out in the bright window highlights. Grain is part of the image itself, not a static overlay, with no digital sharpening.
```

## Common Mistakes

- A repeating looped grain texture, digital noise or identical texture on every frame → use grain that changes randomly every frame.
- Grain in blown-out highlights too, or grain that doesn't move with the image → weight grain by density and don't use an overlay.

## Related Techniques

- [Halation](halation.md)
- [Filmic Faded](../color/filmic-faded.md)
- [Lens Flare](lens-flare.md)
