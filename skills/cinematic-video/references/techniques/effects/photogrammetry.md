---
name: Photogrammetry
category: effects
slug: photogrammetry
source: https://melies.co/cinematic-techniques/effects/photogrammetry
---

# Photogrammetry

Summary: A real location is reconstructed from many photos into a 3D model, and the camera orbits to inspect this digital space with its scan artifacts.

## Narrative Function

- Presents a place as "measured and inspected," keeping the traces of digital capture.
- Turns a real location into freely navigable geometry with a sense of evidence and investigation.

## How It Works

- Shoot many overlapping photos from multiple angles.
- Software triangulates the mesh geometry.
- Photos are projected as textures wrapped onto the reconstructed mesh.
- Artifacts arise naturally: stretched textures, holes in the geometry, visible seams.

## When to Use

- Use: When a place should feel "captured first, then modeled."
- Use: When you need inspectable, slightly imperfect geometry.
- Avoid: Handmade miniatures, or computational phenomena that were never photographed.

## Compared With Similar Techniques

| Technique | Difference |
| --- | --- |
| [Diorama](diorama.md) | A handbuilt miniature; photogrammetry wraps photos onto a mesh |
| [Video Game](../genre-looks/video-game.md) | Engine lighting and handmade assets; photogrammetry is photo textures with scan errors |

## Film Examples

- *Interstellar* (2014): The source page references its black hole imagery but labels it as simulation-driven, not photogrammetry.

## Prompt Examples

```text
A slow orbiting camera circles a 3D-scanned abandoned chapel reconstructed from photographs. The walls carry real photo textures but the mesh is slightly off: stretched pixels on the pews, jagged holes in the ceiling, and floating fragments where the scan lost data.
```

## Common Mistakes

- Looks like a miniature or a clean game-engine render → use photographic textures and keep imperfect geometry.
- The model is too complete and flawless → add scan traces such as holes, stretching and seams.

## Related Techniques

- [Diorama](diorama.md)
- [Video Game](../genre-looks/video-game.md)
- [Lens Flare](lens-flare.md)
