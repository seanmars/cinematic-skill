#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest>=8"]
# ///
"""render.py: parallel video renders, stills, --progress-file. Run: uv run tests/test_render.py

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
SIZE = ["--size", "320x180"]
SHORT = [*SIZE, "--fps", "10", "--duration", "1"]


def run_render(out, *args):
    result = subprocess.run(
        ["uv", "run", str(RENDER), str(PAGE), str(out), *args],
        capture_output=True, text=True, timeout=300,
    )
    assert result.returncode == 0, result.stderr
    return result


def render(out_dir, *args, name="out.mp4"):
    return run_render(out_dir / name, *SHORT, *args)


def frame_hashes(video):
    """One md5 per decoded frame."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-map", "0:v", "-f", "framemd5", "-"],
                         capture_output=True, text=True, check=True).stdout
    return [line.rsplit(",", 1)[1].strip() for line in out.splitlines() if line and not line.startswith("#")]


def probe(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def png_size(path):
    header = path.read_bytes()[16:24]
    return int.from_bytes(header[:4], "big"), int.from_bytes(header[4:], "big")


def test_parallel_render_gives_the_same_frames_as_one_browser(tmp_path):
    # --crf 0 is lossless, so any difference is a frame rendered at the wrong time, not encoder noise.
    render(tmp_path, "--crf", "0", "--subframes", "2", "--workers", "1", name="one.mp4")
    result = render(tmp_path, "--crf", "0", "--subframes", "2", "--workers", "3", name="three.mp4")

    one, three = frame_hashes(tmp_path / "one.mp4"), frame_hashes(tmp_path / "three.mp4")
    assert len(one) == 10
    assert three == one
    assert result.stdout.splitlines()[-1].endswith(", --workers 3")


def test_parallel_render_muxes_the_audio(tmp_path):
    tone = tmp_path / "tone.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", str(tone)], check=True)

    render(tmp_path, "--workers", "2", "--audio", str(tone))

    info = probe(tmp_path / "out.mp4")
    assert sorted(s["codec_type"] for s in info["streams"]) == ["audio", "video"]
    assert float(info["format"]["duration"]) == pytest.approx(1.0, abs=0.1)


def test_stills_at_several_times_share_one_page_load(tmp_path):
    result = run_render(tmp_path / "stills" / "s", *SIZE, "--still", "0.2", "0.5")

    assert sorted(p.name for p in (tmp_path / "stills").iterdir()) == ["s-t0.2.png", "s-t0.5.png"]
    assert png_size(tmp_path / "stills" / "s-t0.2.png") == (320, 180)
    assert len(result.stdout.splitlines()) == 2


def test_a_single_still_is_written_to_out(tmp_path):
    run_render(tmp_path / "shot.png", *SIZE, "--still", "0.5")

    assert png_size(tmp_path / "shot.png") == (320, 180)


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
