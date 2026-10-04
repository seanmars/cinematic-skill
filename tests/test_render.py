#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest>=8"]
# ///
"""render.py's --progress-file, and render.py without it. Run: uv run tests/test_render.py

Renders the demo fixture for real (small and short), so it needs what render.py needs:
uv, ffmpeg and a headless browser (check_env.py).
"""
import json
import pathlib
import re
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
RENDER = ROOT / "skills" / "cinematic-video" / "scripts" / "render.py"
PAGE = ROOT / "fixtures" / "demo" / "index.html"
SHORT = ["--size", "320x180", "--fps", "10", "--duration", "1"]


def render(out_dir, *args):
    result = subprocess.run(
        ["uv", "run", str(RENDER), str(PAGE), str(out_dir / "out.mp4"), *SHORT, *args],
        capture_output=True, text=True, timeout=300,
    )
    assert result.returncode == 0, result.stderr
    return result


def test_progress_file_records_frames_eta_and_done(tmp_path):
    progress = tmp_path / "state" / "render" / "demo.json"

    render(tmp_path, "--subframes", "2", "--progress-file", str(progress))

    record = json.loads(progress.read_text(encoding="utf-8"))
    assert record["frame"] == record["frames"] == 10
    assert record["sample"] == record["samples"] == 20
    assert record["eta"] == 0
    assert record["elapsed"] >= 0
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z", record["updatedAt"])
    assert record["done"] is True
    assert sorted(p.name for p in progress.parent.iterdir()) == ["demo.json"], "no temp file left behind"


def test_cli_mode_render_is_unchanged(tmp_path):
    result = render(tmp_path)

    assert sorted(p.name for p in tmp_path.iterdir()) == ["out.mp4"]
    assert result.stdout.splitlines()[-1].startswith(
        f"{tmp_path / 'out.mp4'}: 10 frames x 1 samples, 320x180 @ 10fps, rendered in "
    )


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q", *sys.argv[1:]]))
