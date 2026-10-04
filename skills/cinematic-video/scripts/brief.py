#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Generate brief.md from storyboard.json (the single source of truth).

  uv run brief.py video/<slug>          writes video/<slug>/brief.md

Edit storyboard.json, then rerun; brief.md is overwritten. Shot times are derived from durations
in array order, and technique paths (<category>/<slug>.md) become their names. A path is looked up
in the library (references/techniques/) first, then in the project's techniques/ folder; if any path
is in neither, nothing is written. Schema: <skill>/schema/storyboard.schema.json.
"""
import json
import pathlib
import sys

TECHNIQUES = pathlib.Path(__file__).resolve().parents[1] / "references" / "techniques"
HEADER = "<!-- generated from storyboard.json; edits will be overwritten -->"

ROLE = "You are a motion designer and creative coder who crafts design-driven video in code."
ON_MODEL = "One style and one palette throughout; characters and recurring elements stay on-model in every shot."
ONE_IDEA = "One idea per shot; minimal, large type, readable at phone size."
NO_FREEZE = "The frame never freezes >0.6s; holds keep a slow 3–5% push."
EASING = "Animate with easing or springs, never linear; transitions grow out of on-screen content, no default crossfades."
BUILD_PAGE = "2. Page exposes window.render(t), drawing second t; all visuals derived from t only, seeded randomness, no timers, no state between frames."
BUILD_LABS = "3. Custom components (3D, UI flows, logo marks) are built in an isolated lab; commercial pieces put each through a component critic before it joins the film."
BUILD_QC = "6. After each shot, render 3 stills and check text overflow, overlaps, subject scale, reading time; fix before the next shot."
START = "Get a storyboard critic pass on <structure>. Build components in labs, then shots in order with QC stills after each. Render the full cut, run one Gauntlet round and one verification round, then deliver."
FIXED_LINES = [ROLE, ON_MODEL, ONE_IDEA, NO_FREEZE, EASING, BUILD_PAGE, BUILD_LABS, BUILD_QC, START]

INPUT_LABELS = [
    ("topic", "Topic"),
    ("keyTakeaway", "Key takeaway (one line)"),
    ("profile", "Profile"),
    ("business", "Business and buyer (commercial)"),
    ("cta", "CTA (commercial)"),
    ("provablyTrue", "Provably true"),
    ("neverClaim", "Never claim"),
    ("source", "Source material"),
    ("realAssets", "Real assets"),
    ("specs", "Specs"),
    ("brand", "Brand"),
    ("audio", "Audio"),
]


MISSING_HELP = """\
Check for typos against <skill>/references/techniques/INDEX.md. If the technique is not in the library:
research it on the web and write <project>/techniques/<category>/<slug>.md in the library's format
(front matter name, category, slug, source: <url>); if the web has nothing, ask the user how it works
and record source: user. Never add it to the skill's library. See references/shot-design.md."""


def find_technique(project, path):
    """The technique file for a storyboard path: the skill library first, then the project's own."""
    for root in (TECHNIQUES, project / "techniques"):
        if (root / path).is_file():
            return root / path
    return None


def referenced_techniques(sb):
    for shot in sb["shots"]:
        yield from (p for p in shot["techniques"].values() if p)
        yield from shot["tags"]


def technique_name(file):
    """Display name from the technique file's front matter, else its first heading, else the slug."""
    lines = file.read_text(encoding="utf-8").splitlines()
    for line in lines:
        if line.startswith("name:"):
            return line.split(":", 1)[1].strip()
    for line in lines:
        if line.startswith("# "):
            return line[2:].strip()
    return file.stem.replace("-", " ").title()


def joined(*parts, sep="; "):
    return sep.join(p for p in parts if p)


def shot_lines(n, shot, start, names):
    end = start + shot["duration"]
    tech, text = shot["techniques"], shot["text"]
    name = lambda key: names[tech[key]] if tech[key] else None
    lines = [f"Shot {n} | {start:.3f}–{end:.3f}s", f"Picture: {text['picture']}", f"Job: {text['job']}"]
    if text.get("action"):
        lines.append(f"Action: {text['action']}")
    labelled = [
        ("Shot", joined(name("framing"), name("angle"), sep=", ")),
        ("Camera", joined(name("movement"), text.get("camera"))),
        ("Techniques", joined(*(names[t] for t in shot["tags"]), sep=", ")),
        ("Audio", text.get("audio")),
        ("Transition", joined(name("transition"), text.get("transition"))),
    ]
    lines += [f"{label}: {value}" for label, value in labelled if value]
    return lines, end


def render_brief(sb, names):
    """names maps every technique path in the storyboard to its display name."""
    inputs, direction, build = sb["inputs"], sb["direction"], sb["build"]
    out = [HEADER, "<role>", ROLE, "</role>", "", "<inputs>"]
    out += [f"{label}: {inputs[key]}" for key, label in INPUT_LABELS if inputs.get(key)]
    out += ["</inputs>", "", "<direction>",
            f"Look: {direction['look']}", ON_MODEL, ONE_IDEA,
            f"Pacing: {direction['pacing']}", NO_FREEZE, EASING,
            f"Persistent actor: {direction['persistentActor']}",
            f"Camera: {direction['camera']}",
            f"Signature moves: {direction['signatureMoves']}",
            f"Avoid: {direction['avoid']}",
            "</direction>", "", "<structure>", f"Beat grid / VO timeline: {sb['beatGrid']}"]
    start = 0.0
    for n, shot in enumerate(sb["shots"], 1):
        lines, start = shot_lines(n, shot, round(start, 6), names)
        out += ["", *lines]
    out += ["</structure>", "", "<build>",
            f"1. Picture: {build['picture']}; no external images or assets except user-supplied or ledgered AI generations.",
            BUILD_PAGE, BUILD_LABS,
            f"4. Render: render.py calls render(t) per frame and captures; ffmpeg encodes MP4. Settings: {build['render']}.",
            f"5. Audio: {build['audio']}; SFX on the frame of the on-screen action.",
            BUILD_QC, "</build>", "", "<gotchas>"]
    out += [f"- {g}" for g in sb["gotchas"]] or ["None noted."]
    out += ["</gotchas>", "", "<start>", START, "</start>"]
    return "\n".join(out) + "\n"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    project = pathlib.Path(sys.argv[1])
    source = project / "storyboard.json"
    if not source.is_file():
        sys.exit(f"{source} not found")
    try:
        sb = json.loads(source.read_text(encoding="utf-8"))
        names, missing = {}, []
        for path in dict.fromkeys(referenced_techniques(sb)):
            file = find_technique(project, path)
            if file:
                names[path] = technique_name(file)
            else:
                missing.append(path)
        if missing:
            listed = "\n".join(f"  - {p}" for p in missing)
            sys.exit(f"{source} references techniques found neither in the library nor in "
                     f"{project / 'techniques'}:\n{listed}\n{MISSING_HELP}\nbrief.md was not written.")
        brief = render_brief(sb, names)
    except KeyError as e:
        sys.exit(f"{source} is missing required field {e}; see schema/storyboard.schema.json")
    target = project / "brief.md"
    target.write_text(brief, encoding="utf-8", newline="\n")
    print(f"{target}: generated from {source.name}")


if __name__ == "__main__":
    main()
