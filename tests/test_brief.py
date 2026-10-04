#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest>=8"]
# ///
"""brief.py turns storyboard.json into brief.md. Run: uv run tests/test_brief.py"""
import importlib.util
import json
import pathlib
import re
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "cinematic-video"
BRIEF = SKILL / "scripts" / "brief.py"
TEMPLATE = SKILL / "references" / "brief-template.md"
DEMO = ROOT / "fixtures" / "demo"
HEADER = "<!-- generated from storyboard.json; edits will be overwritten -->"
BLOCKS = ["role", "inputs", "direction", "structure", "build", "gotchas", "start"]


@pytest.fixture
def project(tmp_path):
    dst = tmp_path / "demo"
    shutil.copytree(DEMO, dst)
    return dst


def generate(project):
    subprocess.run([sys.executable, str(BRIEF), str(project)], check=True, capture_output=True, text=True)
    return (project / "brief.md").read_text(encoding="utf-8")


def shot_block(brief, n):
    m = re.search(rf"^Shot {n} \|.*?(?=^Shot {n + 1} \||^</structure>)", brief, re.S | re.M)
    assert m, f"Shot {n} missing"
    return m.group(0)


def test_derives_start_and_end_from_durations(project):
    brief = generate(project)
    assert "Shot 1 | 0.000–1.786s" in brief
    assert "Shot 2 | 1.786–2.550s" in brief
    assert "Shot 3 | 2.550–5.714s" in brief
    assert "Shot 4 | 5.714–8.000s" in brief


def test_regenerating_after_a_duration_change(project):
    generate(project)
    path = project / "storyboard.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["shots"][1]["duration"] = 1.0
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    brief = generate(project)
    assert brief.splitlines()[0] == HEADER
    assert "Shot 1 | 0.000–1.786s" in brief
    assert "Shot 2 | 1.786–2.786s" in brief
    assert "Shot 3 | 2.786–5.950s" in brief
    assert "Shot 4 | 5.950–8.236s" in brief


def test_brief_is_a_complete_prompt(project):
    brief = generate(project)
    assert brief.splitlines()[0] == HEADER
    positions = [brief.index(f"<{b}>") for b in BLOCKS]
    assert positions == sorted(positions), "blocks out of template order"
    for b in BLOCKS:
        assert f"</{b}>" in brief
    assert "..." not in brief, "unfilled placeholder"
    empty = [line for line in brief.splitlines() if re.fullmatch(r"[A-Z][\w /()-]*:\s*", line)]
    assert not empty, f"labels without content: {empty}"


def test_techniques_become_text(project):
    brief = generate(project)
    s1 = shot_block(brief, 1)
    assert "Shot: Wide Shot, Eye Level" in s1
    assert "Camera: Push In; Push in 1.00 -> 1.08 from frame 0." in s1
    assert "Transition: Match Cut; The note's corner lifts and matches into the fold insert." in s1
    assert "Techniques: Top Light" in s1
    s3 = shot_block(brief, 3)
    assert "Techniques: Rim Light, Warm Amber" in s3
    s4 = shot_block(brief, 4)
    assert "Shot: Close-Up" in s4, "a null slot is skipped, not printed"
    assert "Transition:" not in s4, "no transition name and no text means no line"


def set_slot(project, shot, slot, value):
    path = project / "storyboard.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["shots"][shot]["techniques"][slot] = value
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def test_misspelled_technique_path_fails_without_overwriting(project):
    before = generate(project)
    set_slot(project, 0, "movement", "camera-movement/push-inn.md")
    run = subprocess.run([sys.executable, str(BRIEF), str(project)], capture_output=True, text=True)
    assert run.returncode != 0
    assert "camera-movement/push-inn.md" in run.stderr
    assert (project / "brief.md").read_text(encoding="utf-8") == before


def test_project_custom_technique_is_found(project):
    custom = project / "techniques" / "camera-movement" / "whip-reveal.md"
    custom.parent.mkdir(parents=True)
    custom.write_text(
        "---\nname: Snap Whip Reveal\ncategory: camera-movement\nslug: whip-reveal\nsource: user\n---\n\n"
        "# Snap Whip Reveal\n\nSummary: A whip pan that lands on the subject.\n",
        encoding="utf-8",
    )
    set_slot(project, 0, "movement", "camera-movement/whip-reveal.md")
    brief = generate(project)
    # the name differs from the slug, so this only passes if the project file was read
    assert "Camera: Snap Whip Reveal; Push in 1.00 -> 1.08 from frame 0." in shot_block(brief, 1)


def test_template_contains_the_generators_fixed_text():
    spec = importlib.util.spec_from_file_location("brief", BRIEF)
    brief = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(brief)
    template = TEMPLATE.read_text(encoding="utf-8")
    missing = [line for line in brief.FIXED_LINES if line not in template]
    assert not missing, f"brief-template.md is missing: {missing}"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q", *sys.argv[1:]]))
