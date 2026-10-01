---
name: Object POV
category: camera-angles
slug: object-pov
source: https://melies.co/cinematic-techniques/camera-angles/object-pov
---

# Object POV

Summary: The camera is rigidly mounted to an object, so a tool, vehicle or device "sees" while the world moves around it.

## Narrative Function

- Shifts the viewer from an invisible observer to a tool, vehicle or device.
- The fixed point cannot drift on its own; the world moves around it, creating strongly tactile motion.

## How It Works

- Lock the camera to the object with a specialized rig (or a parent transform in 3D).
- Keep part of the object in frame as an anchor.
- Retain the object's own vibration without adding operator camera moves; works best close up with a wide lens.

## When to Use

- Use: When a prop needs to "see," such as a weapon, vehicle, thrown object or an in-story camera.
- Avoid: Purely decorative orbiting flights that ignore the object's physical limits.

## Compared With Similar Techniques

| Technique | Difference |
| --- | --- |
| [First-Person](first-person.md) | A human body owns the lens (hands, breath) |
| [POV](pov.md) | A character's subjective line of sight, usually without an object |
| [Locked-On](../camera-movement/locked-on.md) | Subject centered as the world flows past |
| [Trunk Shot](trunk-shot.md) | People open a container and look in; not a tool in flight |
| [FPV Drone](../camera-movement/fpv-drone.md) | An independently flying craft |

## Film Examples

- *Leviathan* (2012): Cameras strapped to fishing gear and bodies show the work from its own perspective.
- *Mad Max: Fury Road* (2015): Mechanical parts in the chase stay fixed in frame as the desert rushes past.

## Prompt Examples

```text
Object POV rigidly mounted on the side of a speeding freight train, a section of rusted steel car body locked in the left foreground. The countryside streaks past while the frame carries only the train's mechanical vibration, no free-floating drone movement.
```

## Common Mistakes

- Confused with first-person (hands, breathing appear), or letting the rig come loose and float freely → Mount the camera to a named prop, lock the prop's edge in frame and keep the connection rigid.

## Related Techniques

- [First-Person](first-person.md)
- [POV](pov.md)
- [Locked-On](../camera-movement/locked-on.md)
