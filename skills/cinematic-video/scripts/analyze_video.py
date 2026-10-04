#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Inspect a video: metadata, cut points, contact sheets, single frames and near-frozen time.
Works for reference videos and for QC of your own render.

  uv run analyze_video.py ref.mp4 --out source/ref                        # sheet + cuts + info
  uv run analyze_video.py out/final.mp4 --out qa/r1 --frozen              # + frozen-time report
  uv run analyze_video.py out/final.mp4 --out qa/phone --cells 15 --cell-width 360    # phone legibility
  uv run analyze_video.py out/final.mp4 --out qa/r1 --every 0.2           # one cell per 0.2s, paged sheets
  uv run analyze_video.py out/final.mp4 --out qa/cut7 --start 6.8 --duration 0.5 --every 0.0333   # dense window
  uv run analyze_video.py ref.mp4 --out source/ref --frames 1.5 4 9.2     # also export these seconds as PNG
  uv run analyze_video.py lab/proof.mp4 --out qa/c-logo --crop 320:360:1000:370 --every 0.1 --frames 1.2   # zoom into a region

Writes <out>-sheet.png (or <out>-sheet-01.png ... with --every), <out>-info.txt, and prints the summary.
Sheets read left-to-right, top-to-bottom. Frozen time = 10fps samples whose frame-to-frame luma
difference is below the threshold (0-255 scale).
"""
import argparse, json, math, pathlib, re, subprocess


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def frozen_report(video, start, dur, threshold, hold=0.6):
    vf = "fps=10,scale=320:-1,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG"
    err = run(["ffmpeg", "-hide_banner", "-ss", str(start), "-t", str(dur), "-i", video, "-vf", vf, "-an", "-f", "null", "-"]).stderr
    diffs = [float(x) for x in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", err)]
    runs, cur = [], None  # (first sample, last sample) of consecutive frozen samples
    for i, d in enumerate(diffs, 1):
        if d < threshold:
            cur = (cur[0], i) if cur else (i, i)
        elif cur:
            runs.append(cur); cur = None
    if cur:
        runs.append(cur)
    span = lambda r: (r[1] - r[0] + 1) / 10
    total = sum(span(r) for r in runs)
    longest = max(runs, key=span, default=None)
    holds = [r for r in runs if span(r) > hold]
    fmt = lambda r: f"{start + (r[0] - 1) / 10:.1f}-{start + r[1] / 10:.1f}s ({span(r):.1f}s)"
    lines = [f"frozen time: {total:.1f}s of {dur:.1f}s (threshold {threshold})"]
    lines.append(f"longest hold: {fmt(longest)}" if longest else "longest hold: none")
    lines.append(f"holds > {hold}s ({len(holds)}): " + (", ".join(map(fmt, holds)) or "none"))
    return lines


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video"); ap.add_argument("--out", required=True, help="output prefix, e.g. source/ref")
    ap.add_argument("--cells", type=int, default=20, help="frames in the contact sheet")
    ap.add_argument("--every", type=float, help="one cell per N seconds instead of --cells; writes paged sheets")
    ap.add_argument("--cols", type=int, help="sheet columns (default 5 or 4; 6 with --every)")
    ap.add_argument("--rows", type=int, default=5, help="rows per page with --every")
    ap.add_argument("--start", type=float, default=0.0, help="window start in seconds")
    ap.add_argument("--duration", type=float, help="window length in seconds (default: to the end)")
    ap.add_argument("--scene", type=float, default=0.3, help="cut-detection threshold (0-1)")
    ap.add_argument("--frames", type=float, nargs="*", default=[], help="seconds to export as full-size PNG")
    ap.add_argument("--crop", metavar="W:H:X:Y", help="zoom the sheets and --frames into this region (ffmpeg crop order, source pixels)")
    ap.add_argument("--cell-width", type=int, help="width of each sheet cell; 360 = phone test")
    ap.add_argument("--frozen", action="store_true", help="report near-frozen stretches")
    ap.add_argument("--frozen-threshold", type=float, default=0.35)
    a = ap.parse_args()
    if a.crop and not re.fullmatch(r"\d+:\d+:\d+:\d+", a.crop):
        ap.error("--crop takes W:H:X:Y in pixels, e.g. 320:360:1000:370")
    crop = f"crop={a.crop}," if a.crop else ""
    out = pathlib.Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)

    probe = json.loads(run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", a.video]).stdout)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in probe["streams"])
    total = float(probe["format"]["duration"])
    num, den = map(int, v["r_frame_rate"].split("/"))
    fps = num / den if den else 0
    start = a.start
    dur = min(a.duration or total - start, total - start)
    window = ["-ss", str(start), "-t", str(dur), "-i", a.video]

    if a.every:
        cols = a.cols or 6
        cells = math.ceil(dur / a.every)
        pages = math.ceil(cells / (cols * a.rows))
        width = a.cell_width or 1920 // cols
        sheet = f"{out}-sheet-%02d.png"
        run(["ffmpeg", "-v", "error", "-y", *window, "-vf", f"fps=1/{a.every},{crop}scale={width}:-2,tile={cols}x{a.rows}", sheet])
        sheet_line = f"contact sheets: {sheet} ({pages} page(s) of {cols}x{a.rows}, one cell every {a.every:g}s from {start:g}s)"
    else:
        cols = a.cols or (5 if a.cells > 12 else 4)
        rows = -(-a.cells // cols)
        width = a.cell_width or 1600 // cols
        sheet = f"{out}-sheet.png"
        run(["ffmpeg", "-v", "error", "-y", *window, "-vf", f"fps={a.cells}/{dur},{crop}scale={width}:-2,tile={cols}x{rows}", "-frames:v", "1", sheet])
        sheet_line = f"contact sheet: {sheet} ({cols}x{rows}, one cell every {dur / a.cells:.2f}s from {start:g}s)"

    det = run(["ffmpeg", "-v", "info", *window, "-vf", f"select='gt(scene,{a.scene})',showinfo", "-an", "-f", "null", "-"])
    cuts = [round(start + float(m), 2) for m in re.findall(r"pts_time:([\d.]+)", det.stderr)]

    for t in a.frames:
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", a.video, *(["-vf", f"crop={a.crop}"] if a.crop else []), "-frames:v", "1", f"{out}-t{t:g}.png"])

    lines = [
        f"file: {a.video}",
        f"duration: {total:.2f}s  size: {v['width']}x{v['height']}  fps: {fps:.2f}  audio: {'yes' if has_audio else 'no'}",
        sheet_line,
        f"cuts ({len(cuts)}): {', '.join(map(str, cuts)) or 'none detected'}",
    ]
    if cuts:
        bounds = [start] + cuts + [start + dur]
        lens = [b - a_ for a_, b in zip(bounds, bounds[1:])]
        lines.append(f"average shot length: {sum(lens) / len(lens):.2f}s")
    if a.frames:
        lines.append("frames: " + ", ".join(f"{out}-t{t:g}.png" for t in a.frames))
    if a.frozen:
        lines += frozen_report(a.video, start, dur, a.frozen_threshold)
    text = "\n".join(lines)
    pathlib.Path(f"{out}-info.txt").write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
