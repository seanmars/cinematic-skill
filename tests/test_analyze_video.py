#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest>=8"]
# ///
"""analyze_video.py's --crop. Run: uv run tests/test_analyze_video.py

Needs ffmpeg and ffprobe, as analyze_video.py does.
"""
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ANALYZE = ROOT / "skills" / "cinematic-video" / "scripts" / "analyze_video.py"


def png_size(path):
    header = path.read_bytes()[16:24]
    return int.from_bytes(header[:4], "big"), int.from_bytes(header[4:], "big")


@pytest.fixture
def video(tmp_path):
    path = tmp_path / "test.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=2",
                    "-pix_fmt", "yuv420p", str(path)], check=True)
    return path


def analyze(video, *args):
    return subprocess.run(["uv", "run", str(ANALYZE), str(video), *args], capture_output=True, text=True, timeout=120)


def test_crop_zooms_the_sheet_and_the_frames(tmp_path, video):
    out = tmp_path / "qa" / "c"

    result = analyze(video, "--out", str(out), "--crop", "100:50:10:20", "--every", "0.5",
                     "--cols", "2", "--rows", "2", "--cell-width", "100", "--frames", "0.5")

    assert result.returncode == 0, result.stderr
    assert png_size(tmp_path / "qa" / "c-t0.5.png") == (100, 50)
    assert png_size(tmp_path / "qa" / "c-sheet-01.png") == (200, 100)


def test_crop_must_be_four_numbers(tmp_path, video):
    result = analyze(video, "--out", str(tmp_path / "c"), "--crop", "100x50")

    assert result.returncode != 0
    assert "W:H:X:Y" in result.stderr


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q", *sys.argv[1:]]))
