#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.40"]
# ///
"""Frame-by-frame renderer for pages that expose window.render(t).

The page defines `window.render = (t) => {...}` drawing the frame at t seconds; it may return a Promise
(e.g. awaiting a texture), which is awaited before capture. Optionally it sets `window.ready = false`
while loading and flips it to true. Pages are served from a local HTTP server rooted at the page's
directory (or --root), so ES modules, fetch() and WebGL textures work.

Examples
  still:     uv run render.py page.html shot.png --still 2.5 --size 1920x1080
  video:     uv run render.py page.html out.mp4 --size 1920x1080 --fps 30 --duration 12 --audio mix.wav
  blur:      uv run render.py page.html out.mp4 --fps 60 --duration 14 --subframes 8 --shutter 270
  segment:   uv run render.py page.html seg.mp4 --fps 30 --start 8 --duration 4
  seek test: uv run render.py page.html qa/seek --seek-test 1.0 7.5 12.25
  progress:  uv run render.py page.html out.mp4 --fps 30 --duration 12 --progress-file progress.json
Query strings are allowed: render.py "page.html?raw=1" out.mp4 ...
"""
import argparse, datetime, functools, http.server, json, os, pathlib, subprocess, sys, threading, time, urllib.parse

from playwright.sync_api import sync_playwright

GPU_ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
if sys.platform == "darwin":
    GPU_ARGS.append("--use-angle=metal")

# Explicit types: the Windows registry can map .js to text/plain, which breaks ES modules.
MIME = {".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
        ".wasm": "application/wasm", ".svg": "image/svg+xml"}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **MIME}

    def log_message(self, *args):
        pass


def launch(p):
    """Prefer Playwright's own Chromium; fall back to an installed Chrome / Edge."""
    errors = []
    for kw in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
        try:
            return p.chromium.launch(headless=True, args=GPU_ARGS, **kw)
        except Exception as e:  # try the next browser
            errors.append(f"{kw or 'bundled chromium'}: {str(e).splitlines()[0]}")
    sys.exit("No usable browser. Run `uv run scripts/check_env.py --install-browser` or install Google Chrome.\n" + "\n".join(errors))


def serve(page_arg, root_arg):
    """Serve the page's directory (or --root) on a free localhost port; return the page URL."""
    path, _, query = page_arg.partition("?")
    page = pathlib.Path(path).resolve()
    root = pathlib.Path(root_arg).resolve() if root_arg else page.parent
    try:
        rel = page.relative_to(root).as_posix()
    except ValueError:
        sys.exit(f"{page} is not inside --root {root}")
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(root)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}/{urllib.parse.quote(rel)}" + (f"?{query}" if query else "")


def seek_test(pg, times, prefix):
    """Render each time ascending, then descending; any pixel difference means hidden frame state."""
    times = sorted(set(times)) if len(set(times)) > 1 else sorted({0.0, *times})
    shots = {}
    for order in (times, list(reversed(times))):
        for t in order:
            pg.evaluate("t => window.render(t)", t)
            shots.setdefault(t, []).append(pg.screenshot(type="png"))
    bad = [t for t, (x, y) in shots.items() if x != y]
    for t in bad:
        for tag, png in zip("ab", shots[t]):
            pathlib.Path(f"{prefix}-t{t:g}-{tag}.png").write_bytes(png)
    print(f"seek test: {len(times) - len(bad)}/{len(times)} times identical in both seek orders")
    if bad:
        print(f"  differs at {', '.join(f'{t:g}s' for t in bad)}; compare {prefix}-t<time>-a.png / -b.png")
    return not bad


class Progress:
    """Frame progress for --progress-file, about once a second: what the web studio shows during a render.

    Written whole (temp file + os.replace) so a reader never sees half of it. A write that fails is
    skipped; the next one tries again, and a render never stops over its progress file."""

    def __init__(self, path, frames, sub, t0):
        self.path, self.frames, self.sub, self.t0 = pathlib.Path(path), frames, sub, t0
        self.written_at = None

    def write(self, sample, done=False):
        now = time.time()
        if not done and self.written_at is not None and now - self.written_at < 1:
            return
        self.written_at = now
        samples, elapsed = self.frames * self.sub, now - self.t0
        eta = 0 if done else (elapsed / sample * (samples - sample) if sample else None)
        record = {"frame": sample // self.sub, "frames": self.frames, "sample": sample, "samples": samples,
                  "elapsed": round(elapsed, 2), "eta": None if eta is None else round(eta, 2),
                  "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                  "done": done}
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_name(self.path.name + ".tmp")
            tmp.write_text(json.dumps(record), encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError:
            pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page"); ap.add_argument("out", help="output file, or file prefix for --seek-test")
    ap.add_argument("--size", default="1920x1080", help="WIDTHxHEIGHT")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float, help="seconds to render (video mode)")
    ap.add_argument("--start", type=float, default=0.0, help="first second to render")
    ap.add_argument("--still", type=float, help="render a single PNG at this time")
    ap.add_argument("--subframes", type=int, default=1, help="samples per frame averaged into motion blur")
    ap.add_argument("--shutter", type=float, default=360, help="shutter angle in degrees for motion blur (180 = crisp, 360 = smear)")
    ap.add_argument("--seek-test", type=float, nargs="+", metavar="T", help="check determinism at these times")
    ap.add_argument("--audio", help="audio file to mux (trimmed to the video)")
    ap.add_argument("--crf", type=int, default=16)
    ap.add_argument("--root", help="HTTP root directory (default: the page's directory)")
    ap.add_argument("--progress-file", help="video mode: keep frame progress and ETA in this JSON file (the web studio reads it)")
    a = ap.parse_args()
    W, H = map(int, a.size.lower().split("x"))
    url = serve(a.page, a.root)

    with sync_playwright() as p:
        browser = launch(p)
        pg = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        pg.goto(url)
        pg.wait_for_function("typeof window.render === 'function' && (window.ready === undefined || window.ready === true)", timeout=60000)
        pg.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true")

        if a.seek_test:
            ok = seek_test(pg, a.seek_test, a.out)
            browser.close(); sys.exit(0 if ok else 1)

        if a.still is not None:
            pg.evaluate("t => window.render(t)", a.still)
            pg.screenshot(path=a.out, type="png")
            print(f"{a.out}: still at t={a.still}s")
            browser.close(); return

        if not a.duration:
            sys.exit("--duration is required for video output")
        sub = max(1, a.subframes)
        frames = round(a.fps * a.duration)
        span = a.shutter / 360 / a.fps  # time covered by one frame's samples
        # tmix outputs from the first input, so the frame whose samples are complete is the last of each group
        blur = f"tmix=frames={sub}:weights={' '.join(['1'] * sub)},select='eq(mod(n\\,{sub})\\,{sub - 1})'," if sub > 1 else ""
        cmd = ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(a.fps * sub), "-i", "-"]
        if a.audio:
            cmd += ["-ss", str(a.start), "-i", a.audio]
        cmd += ["-vf", f"{blur}setpts=N/({a.fps}*TB),format=yuv420p", "-r", str(a.fps), "-c:v", "libx264", "-crf", str(a.crf)]
        if a.audio:
            cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
        cmd.append(a.out)
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

        t0 = time.time()
        total = frames * sub
        progress = Progress(a.progress_file, frames, sub, t0) if a.progress_file else None
        for i in range(total):
            if progress:
                progress.write(i)
            f, j = divmod(i, sub)
            pg.evaluate("t => window.render(t)", a.start + f / a.fps + j * span / sub)
            ff.stdin.write(pg.screenshot(type="png"))
            if i and i % max(1, total // 10) == 0:
                print(f"  {i}/{total} samples, {time.time() - t0:.0f}s", flush=True)
        browser.close()
    ff.stdin.close()
    if ff.wait() != 0:
        sys.exit("ffmpeg failed")
    if progress:
        progress.write(total, done=True)
    print(f"{a.out}: {frames} frames x {sub} samples, {a.size} @ {a.fps}fps, rendered in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
