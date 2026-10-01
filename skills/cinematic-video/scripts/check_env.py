#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.40"]
# ///
"""Check the tools this skill needs and say how to install what is missing.

  uv run check_env.py                     check ffmpeg, its filters, a headless browser and WebGL2
  uv run check_env.py --install-browser   also install Playwright's Chromium (matches this playwright version)
"""
import argparse, pathlib, shutil, subprocess, sys

ok = True


def report(name, good, fix=""):
    global ok
    ok &= good
    print(f"[{'ok' if good else 'missing'}] {name}" + ("" if good else f"  ->  {fix}"))


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--install-browser", action="store_true")
a = ap.parse_args()

if a.install_browser:
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)

has_ff = bool(shutil.which("ffmpeg"))
report("ffmpeg", has_ff, "Windows: winget install Gyan.FFmpeg | macOS: brew install ffmpeg | Linux: apt install ffmpeg")
report("ffprobe", bool(shutil.which("ffprobe")), "comes with ffmpeg")

if has_ff:
    filters = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    names = {line.split()[1] for line in filters.splitlines() if len(line.split()) > 2}
    for f, use in [("ebur128", "loudness"), ("loudnorm", "normalize"), ("tmix", "motion blur"),
                   ("tblend", "frozen-time"), ("signalstats", "frozen-time")]:
        report(f"ffmpeg filter {f} ({use})", f in names, "install a full ffmpeg build")
    if "chromakey" not in names:
        print("[warn] ffmpeg has no chromakey filter; green-screen compositing needs a fuller build")

sys.dont_write_bytecode = True  # keep the skill folder free of __pycache__
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from render import GPU_ARGS  # same flags the renderer uses
from playwright.sync_api import sync_playwright

browser_ok, webgl, skipped = False, False, []
with sync_playwright() as p:
    for kw in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
        name = kw.get("channel", "playwright chromium")
        try:
            b = p.chromium.launch(headless=True, args=GPU_ARGS, **kw)
        except Exception:
            skipped.append(name); continue
        pg = b.new_page()
        pg.set_content("<canvas id=c></canvas>")
        webgl = pg.evaluate("!!document.getElementById('c').getContext('webgl2')")
        h264 = pg.evaluate("document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.42E01E\"') !== ''")
        if skipped:
            print(f"[info] not available: {', '.join(skipped)} -> using {name}")
        print(f"[ok] browser: {name} {b.version}, WebGL2: {'yes' if webgl else 'no'}, H.264 video: {'yes' if h264 else 'no'}")
        if not h264:
            print("  note: no H.264 in this browser; draw footage from image sequences (see craft-rules.md)")
        b.close(); browser_ok = True
        break
report("headless browser", browser_ok, "uv run scripts/check_env.py --install-browser   (or install Google Chrome)")
if browser_ok and not webgl:
    print("  note: WebGL2 unavailable; shader and Three.js treatments fall back to Canvas 2D")

print("\nready" if ok else "\nsome tools are missing, see above")
sys.exit(0 if ok else 1)
