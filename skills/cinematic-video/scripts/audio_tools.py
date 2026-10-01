#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.24", "scipy>=1.10"]
# ///
"""Audio toolkit. The model can't hear, so every command reports numbers or plots.

  sfx:        uv run audio_tools.py sfx timeline.json audio/sfx.wav              synthesized UI/motion SFX
  beats:      uv run audio_tools.py beats music.mp3 > source/beats.json          (--with librosa: better tracking)
  check:      uv run audio_tools.py check audio/mix.wav --out qa/audio [--target -14]
  normalize:  uv run audio_tools.py normalize in.wav out.wav [--lufs -14] [--tp -1]
  soften:     uv run audio_tools.py soften in.mp3 out.wav [--highpass 150] [--lowpass 10000] [--fade-out 0.15]
  screen:     uv run audio_tools.py screen "sfx/*.mp3"                           rank SFX candidates before listening
  gains:      uv run audio_tools.py gains music_only.wav events.json [--target 3.5] [--cap 4]
  mix:        uv run audio_tools.py mix picture.mp4 out.mp4 --score music.mp3 --music-lufs -24 --plan sfx/plan.json

timeline.json (sfx):
  {"duration": 12, "bpm": 120, "beat": "kick",            # optional soft pulse on every beat
   "events": [{"t": 1.0, "sound": "click"}, {"t": 2.0, "sound": "success", "gain": 0.8}]}
  sounds: click, pop, success, whoosh, impact, tick, kick, riser

beats.json: {"bpm": 120.0, "beats": [...], "downbeats": [...], "hits": [...]}
  beats = state changes, downbeats = big moments, hits = SFX.

events.json (gains): [["sfx/whoosh.mp3", 2.67], ["sfx/pop.mp3", 10.9], ...]   file, start time (s)

plan.json (mix): [[name, time_s, target_dB_over_music_in_band, note, (floor_dBFS), (peak_cap_dB)], ...]
  name resolves in --sfx-dir (default: the plan's folder), with or without .wav/.mp3.
  Each effect's gain is solved so its 50 ms in-band peak sits target dB over the music in the same window,
  then capped: 2-8 kHz lift <= --hf-cap, sample peak <= local music peak + peak_cap. The report lists
  in-band lift, 150 ms body and 2-8 kHz lift per event. --no-sfx renders the music-only fallback.
"""
import argparse, glob, json, re, subprocess, sys, tempfile, wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
HALF = SR // 2
MUSIC_CHAIN = ("lowshelf=f=90:g=-3,acompressor=threshold=-24dB:ratio=3:attack=4:release=140:knee=6:makeup=1,"
               "highshelf=f=5000:g=-3,acompressor=threshold=-30dB:ratio=2.5:attack=1:release=90:knee=4")


# ---------- shared ----------

def load(path, ch=1, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True).stdout
    y = np.frombuffer(raw, np.float32).copy()
    return y.reshape(-1, ch) if ch > 1 else y


def write_f32(path, x, ch):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "-", str(path)],
                   input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)


def ebur128(args, data=None):
    """Integrated loudness, LRA, true peak and short-term loudness per second."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         input=data, capture_output=True).stderr.decode("utf-8", "replace")
    summary = err[err.rfind("Summary:"):]
    num = lambda pat: float(m.group(1)) if (m := re.search(pat, summary)) else float("nan")
    frames = re.findall(r"t:\s*([\d.]+)\s.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)", err)
    per_sec = [(round(float(t)), m, s) for t, m, s in frames if abs(float(t) - round(float(t))) < 0.05 and round(float(t)) > 0]
    return {"I": num(r"I:\s+(-?[\d.]+) LUFS"), "LRA": num(r"LRA:\s+([\d.]+) LU"),
            "TP": num(r"Peak:\s+(-?[\d.]+) dBFS"), "MS": per_sec}


def lufs_of(x, ch):
    return ebur128(["-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "-"], np.clip(x, -1, 1).astype(np.float32).tobytes())


def peak50(y):
    """Loudest 50 ms RMS window, in dB."""
    h = int(.05 * SR)
    return max(10 * np.log10((y[i:i + h] ** 2).mean() + 1e-12) for i in range(0, max(1, len(y) - h), h // 2))


def band_of(m):
    """Band holding the middle 60% of a sound's energy."""
    F = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR); c = np.cumsum(F) / F.sum()
    lo = max(f[np.searchsorted(c, .2)], 40)
    return lo, min(max(f[np.searchsorted(c, .8)], lo * 2), SR / 2 - 500)


def find(base, name):
    for p in (Path(name), Path(base) / name):
        for q in (p, p.with_suffix(".wav"), p.with_suffix(".mp3")):
            if q.is_file():
                return q
    sys.exit(f"sound not found: {name} (looked in . and {base})")


# ---------- synthesized SFX ----------

def env(n, attack=0.002, decay=0.1):
    x = np.arange(n) / SR
    return np.minimum(1, x / max(attack, 1e-4)) * np.exp(-x / decay)


def tone(freqs, length, decay, attack=0.003):
    n = int(length * SR); x = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * x) for f in freqs) / len(freqs) * env(n, attack, decay)


def noise(length, seed=1):
    return np.random.default_rng(seed).standard_normal(int(length * SR))


def sweep(f0, f1, length):
    n = int(length * SR); f = np.geomspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def lowpass(sig, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); out = np.zeros_like(sig); y = 0.0
    for i, s in enumerate(sig):
        y = (1 - a) * s + a * y; out[i] = y
    return out


SOUNDS = {
    "click": lambda: noise(0.04) * env(int(0.04 * SR), 0.0005, 0.005) * 0.6 + tone([2400], 0.04, 0.008) * 0.6,
    "tick": lambda: tone([3200], 0.03, 0.006),
    "pop": lambda: np.concatenate([tone([880], 0.06, 0.03), tone([1175, 1760], 0.4, 0.12)]),
    "success": lambda: np.concatenate([tone([1318.5], 0.09, 0.06), tone([1318.5, 1975.5], 0.5, 0.15)]),
    "whoosh": lambda: lowpass(noise(0.45, 7), 2500) * np.hanning(int(0.45 * SR)) * 2.2,
    "impact": lambda: sweep(160, 38, 0.6) * env(int(0.6 * SR), 0.001, 0.18) + lowpass(noise(0.6, 3), 900) * env(int(0.6 * SR), 0.001, 0.05),
    "kick": lambda: sweep(140, 45, 0.35) * env(int(0.35 * SR), 0.001, 0.12),
    "riser": lambda: sweep(200, 1800, 1.2) * np.linspace(0, 1, int(1.2 * SR)) ** 2 * 0.5 + lowpass(noise(1.2, 5), 4000) * np.linspace(0, 1, int(1.2 * SR)) ** 2 * 0.4,
}


def write_wav(path, sig):
    peak = np.abs(sig).max() or 1
    sig = sig / peak * 0.89
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig * 32767).astype(np.int16).tobytes())


def cmd_sfx(a):
    spec = json.loads(Path(a.timeline).read_text())
    out = np.zeros(int(spec["duration"] * SR) + SR)
    if spec.get("beat"):
        for t in np.arange(0, spec["duration"], 60 / spec.get("bpm", 120)):
            s = SOUNDS[spec["beat"]](); i = int(t * SR); out[i:i + len(s)] += s[:len(out) - i] * 0.3
    for ev in spec["events"]:
        if ev["sound"] not in SOUNDS:
            sys.exit(f"unknown sound {ev['sound']}; choose from {', '.join(SOUNDS)}")
        s = SOUNDS[ev["sound"]]()
        i = int(ev["t"] * SR); n = min(len(s), len(out) - i)
        out[i:i + n] += s[:n] * ev.get("gain", 0.7)
    write_wav(a.out, out[: int(spec["duration"] * SR)])
    print(f"{a.out}: {len(spec['events'])} events, {spec['duration']}s")


# ---------- beats ----------

def beats_numpy(y, sr):
    hop, n_fft = 256, 1024
    frames = 1 + (len(y) - n_fft) // hop
    win = np.hanning(n_fft)
    spec = np.abs(np.fft.rfft(np.stack([y[i * hop:i * hop + n_fft] * win for i in range(frames)]), axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spec), axis=0)).sum(axis=1)
    onset = np.concatenate([[0], flux]); onset = (onset - onset.mean()) / (onset.std() + 1e-9)
    fps = sr / hop
    # tempo: autocorrelation of the onset envelope, 60-180 BPM, mild preference around 120,
    # refined to a fractional period so the grid does not drift over long tracks
    ac = np.correlate(onset, onset, mode="full")[len(onset) - 1:]
    lags = np.arange(int(fps * 60 / 180), int(fps * 60 / 60) + 1)
    score = ac[lags] * np.exp(-0.5 * (np.log2(60 * fps / lags / 120) / 0.9) ** 2)
    i = int(np.argmax(score)); period = float(lags[i])
    if 0 < i < len(score) - 1:
        l, c, r = score[i - 1], score[i], score[i + 1]
        period += 0.5 * (l - r) / (l - 2 * c + r) if (l - 2 * c + r) != 0 else 0
    n = len(onset)
    grid = lambda o: [int(round(o + k * period)) for k in range(int((n - o) / period) + 1) if round(o + k * period) < n]
    phase = max(range(int(period)), key=lambda o: onset[grid(o)].sum())
    # track: predict the next beat from the previous one, snap to a strong onset nearby
    beats, t, w = [], float(phase), max(2, int(period * 0.12))
    while t < n:
        c = int(round(t)); lo, hi = max(0, c - w), min(n, c + w + 1)
        j = lo + int(np.argmax(onset[lo:hi]))
        pos = j if onset[j] > 0.5 else c
        beats.append(pos); t = pos + period
    lag = n_fft / 2 / sr                       # frame index -> time at the window centre
    beat_t = np.array(beats) / fps + lag
    down0 = max(range(4), key=lambda k: onset[beats[k::4]].sum()) if len(beats) >= 4 else 0
    peaks = [i for i in range(1, n - 1) if onset[i] > 2 and onset[i] >= onset[i - 1] and onset[i] >= onset[i + 1]]
    hits, last = [], -10**9
    for i in peaks:
        if i - last > fps * 0.1: hits.append(i / fps + lag); last = i
    return 60 * fps / period, beat_t.tolist(), beat_t[down0::4].tolist(), hits


def cmd_beats(a):
    try:
        import librosa
        y, sr = librosa.load(a.inp, sr=None, mono=True)
        tempo, fr = librosa.beat.beat_track(y=y, sr=sr, units="frames")
        beats = librosa.frames_to_time(fr, sr=sr).tolist()
        env_ = librosa.onset.onset_strength(y=y, sr=sr)
        pk = librosa.util.peak_pick(env_, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
        bpm, downs, hits = float(np.atleast_1d(tempo)[0]), beats[::4], librosa.frames_to_time(pk, sr=sr).tolist()
    except ImportError:
        sr = 22050
        bpm, beats, downs, hits = beats_numpy(load(a.inp, sr=sr), sr)
    r = lambda xs: [round(x, 3) for x in xs]
    json.dump({"bpm": round(bpm, 2), "beats": r(beats), "downbeats": r(downs), "hits": r(hits)}, sys.stdout, indent=1)
    print(f"\nbpm {bpm:.1f}, {len(beats)} beats, {len(hits)} hits", file=sys.stderr)


# ---------- loudness ----------

def cmd_check(a):
    m = ebur128(["-i", a.inp])
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.inp, "-filter_complex", "showwavespic=s=1600x300:split_channels=0", "-frames:v", "1", f"{a.out}-wave.png"])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.inp, "-lavfi", "showspectrumpic=s=1600x500:legend=1", f"{a.out}-spectrum.png"])
    print(f"integrated: {m['I']} LUFS (target {a.target})   LRA: {m['LRA']} LU   true peak: {m['TP']} dBFS (keep <= -1)")
    print("momentary (0.4s) per second: " + " ".join(f"{t}:{mo}" for t, mo, _ in m["MS"]))
    print("short-term (3s) per second:  " + " ".join(f"{t}:{s}" for t, _, s in m["MS"] if t >= 3))
    print(f"images: {a.out}-wave.png, {a.out}-spectrum.png  (look for clipping, silence gaps, dips, low-frequency rumble)")


def cmd_normalize(a):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.inp, "-af", f"loudnorm=I={a.lufs}:TP={a.tp}:LRA=11", "-ar", str(SR), a.out])
    sys.exit(r.returncode)


# ---------- library SFX ----------

def cmd_soften(a):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.inp],
                               capture_output=True, text=True).stdout)
    fs = max(0.0, dur - a.fade_out)
    af = f"highpass=f={a.highpass},lowpass=f={a.lowpass},afade=t=in:d=0.01,afade=t=out:st={fs}:d={a.fade_out}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.inp, "-af", af, "-ar", str(SR), a.out], check=True)
    print(a.out)


def cmd_screen(a):
    files = [f for pat in a.files for f in (sorted(glob.glob(pat)) or [pat])]
    for f in files:
        y = load(f)
        if not len(y):
            print(f, "unreadable"); continue
        e = np.sqrt(np.convolve(y ** 2, np.ones(SR // 100) / (SR // 100), "same")); pk = e.max()
        act = np.where(e > pk * .05)[0]; dur = (act[-1] - act[0]) / SR; rise = (np.argmax(e) - act[0]) / SR * 1000
        F = np.abs(np.fft.rfft(y)) ** 2; fr = np.fft.rfftfreq(len(y), 1 / SR); tot = F.sum()
        cen = (F * fr).sum() / tot; lo = F[fr < 150].sum() / tot; hi = F[fr > 6000].sum() / tot
        why = [w for w, bad in [("boomy", lo > .5), ("hissy/clicky", hi > .4), ("long", dur > .8)] if bad]
        print(f"{f}: {dur:.2f}s rise {rise:.0f}ms centroid {cen:.0f}Hz <150Hz {lo * 100:.0f}% >6k {hi * 100:.0f}%"
              f"  -> {'REJECT: ' + ', '.join(why) if why else 'ok'}")


def cmd_gains(a):
    music = np.concatenate([np.zeros(SR, np.float32), load(a.music), np.zeros(SR, np.float32)])
    events = json.loads(Path(a.events).read_text())
    HB = butter(4, [2000, 8000], btype="band", fs=SR, output="sos"); W = int(.3 * SR)
    for path, t in events:
        s = load(find(Path(a.events).parent, path))
        sos = butter(4, band_of(s), btype="band", fs=SR, output="sos")
        i = int(t * SR) + SR; base = music[i - HALF:i + SR + HALF]
        # floors: over near-silent music, "+N dB over the music" would leave the effect inaudible or block it entirely
        b0 = max(peak50(sosfilt(sos, base)[HALF:HALF + W]), a.mfloor)
        h0 = max(peak50(sosfilt(HB, base)[HALF:HALF + W]), a.hfloor); g = prev = .005
        for x in np.geomspace(.005, 1.2, 140):
            seg = base.copy(); n = min(len(s), len(seg) - HALF); seg[HALF:HALF + n] += x * s[:n]
            if peak50(sosfilt(HB, seg)[HALF:HALF + W]) - h0 > a.cap: g = prev; break
            if peak50(sosfilt(sos, seg)[HALF:HALF + W]) - b0 >= a.target: g = x; break
            prev = x
        print(json.dumps([path, t, round(float(g), 3)]))


# ---------- mix ----------

def ramp_gain(n, s0, s1, level, ramp):
    g = np.ones(n, np.float32); i0, i1, r = int(s0 * SR), min(n, int(s1 * SR)), int(ramp * SR)
    g[i0:i1] = level
    g[i0:i0 + r] = np.linspace(1, level, len(g[i0:i0 + r]))
    if i1 < n:
        g[max(i0, i1 - r):i1] = np.linspace(level, 1, len(g[max(i0, i1 - r):i1]))
    return g


def cmd_mix(a):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.picture],
                               capture_output=True, text=True).stdout)
    N = int(dur * SR)
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "music.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.score, "-af", MUSIC_CHAIN if a.chain else "anull",
                        "-ar", str(SR), "-ac", "2", "-t", str(dur), str(raw)], check=True)
        mus = load(raw, ch=2)[:N]; mus = np.pad(mus, ((0, N - len(mus)), (0, 0)))
        mg = 10 ** ((a.music_lufs - lufs_of(mus, 2)["I"]) / 20); mus *= mg
        g = np.ones(N, np.float32)
        if a.fade > 0:
            f0 = max(0, N - int(a.fade * SR)); g[f0:] *= np.linspace(1, 0, N - f0) ** 1.5
        for s0, s1, db in a.dip or []:          # post-chain dip, e.g. before a drop (pre-chain dips get compressed away)
            g *= ramp_gain(N, s0, s1, 10 ** (db / 20), .01)
        if a.ring:                               # lift a ring-out that sits too far under the bed
            g *= ramp_gain(N, a.ring[0], dur + 1, 10 ** (a.ring[1] / 20), .1)
        mus *= g[:, None]

        mono = mus.mean(1); fx = np.zeros_like(mus); rows = []
        plan = [] if a.no_sfx or not a.plan else json.loads(Path(a.plan).read_text())
        sfx_dir = a.sfx_dir or (Path(a.plan).parent if a.plan else Path("."))
        HB = butter(4, [2000, 8000], btype="band", fs=SR, output="sos")
        WMAX = int(.4 * SR)
        mp = np.pad(mono, (HALF, WMAX + HALF))  # 0.5 s of context on each side of every event
        for ev in plan:
            name, t, target, note = ev[:4]
            floor = ev[4] if len(ev) > 4 else a.mfloor   # in-band reference floor over near-silent music
            pkc = ev[5] if len(ev) > 5 else a.pkcap      # peak cap, dB over the local music peak
            if t >= dur:
                print(f"skip {name} at {t}s: past the end ({dur:.2f}s)", file=sys.stderr); continue
            s = load(find(sfx_dir, name), ch=2); m1 = s.mean(1)
            lo, hi = band_of(m1); sos = butter(4, [lo, hi], btype="band", fs=SR, output="sos")
            i = int(t * SR); W = min(len(m1), WMAX); win = slice(HALF, HALF + W)
            seg = mp[i:i + W + 2 * HALF]
            mpk = peak50(sosfilt(sos, seg)[win]); epk = peak50(sosfilt(sos, m1)[:W])
            gain = 10 ** ((max(mpk, floor) + target - epk) / 20)

            def with_fx(x):
                y = seg.copy(); y[win] += x * m1[:W]; return y
            hf_ref = max(peak50(sosfilt(HB, seg)[win]), a.hfloor)
            hf = lambda x: peak50(sosfilt(HB, with_fx(x))[win]) - hf_ref
            hl = hf(gain)
            while hl > a.hf_cap and gain > 1e-4:
                gain *= .85; hl = hf(gain)
            mloc = max(20 * np.log10(np.abs(seg[win]).max() + 1e-9), a.pkfloor)
            while 20 * np.log10(gain * np.abs(m1[:W]).max() + 1e-9) > mloc + pkc and gain > 1e-4:
                gain *= .9
            j = min(N, i + len(s)); fx[i:j] += gain * s[:j - i]
            y = with_fx(gain); b = slice(HALF, HALF + int(.15 * SR))
            rms = lambda z: 10 * np.log10((z[b] ** 2).mean() + 1e-12)
            lift = peak50(sosfilt(sos, y)[win]) - mpk
            body = rms(sosfilt(sos, y)) - rms(sosfilt(sos, seg))
            rows.append(f"{t:6.2f} {name:14s} band {int(lo):5d}-{int(hi):5d} Hz  target +{target:.0f}  in-band {lift:+5.1f} dB"
                        f"  body {body:+5.1f} dB  2-8k {hl:+5.1f} dB  gain {gain:.4f}  {note}")

        mix = mus + fx
        peak = np.abs(mix).max(); lim = 10 ** (-1.5 / 20)
        if peak > lim:
            mix *= lim / peak  # safety only; levels are set per event
        wav = Path(td) / "mix.wav"; write_f32(wav, mix, 2)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.picture, "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", a.out], check=True)
    m, x = lufs_of(mus, 2), lufs_of(mix, 2)
    hdr = (f"score {a.score}: music-only {m['I']:.1f} LUFS (gain {20 * np.log10(mg):+.1f} dB); "
           f"mix {x['I']:.1f} LUFS, LRA {x['LRA']} LU, true peak {x['TP']} dBFS; {len(rows)} effects")
    report = Path(a.report or Path(a.out).with_suffix(".mix.txt"))
    report.write_text(hdr + "\n" + "\n".join(rows) + "\n", encoding="utf-8")
    print(hdr); print("\n".join(rows)); print(f"report: {report}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("sfx"); p.add_argument("timeline"); p.add_argument("out"); p.set_defaults(fn=cmd_sfx)
    p = sp.add_parser("beats"); p.add_argument("inp"); p.set_defaults(fn=cmd_beats)
    p = sp.add_parser("check"); p.add_argument("inp"); p.add_argument("--out", required=True)
    p.add_argument("--target", type=float, default=-14); p.set_defaults(fn=cmd_check)
    p = sp.add_parser("normalize"); p.add_argument("inp"); p.add_argument("out")
    p.add_argument("--lufs", type=float, default=-14); p.add_argument("--tp", type=float, default=-1); p.set_defaults(fn=cmd_normalize)
    p = sp.add_parser("soften"); p.add_argument("inp"); p.add_argument("out")
    p.add_argument("--highpass", type=float, default=150); p.add_argument("--lowpass", type=float, default=10000)
    p.add_argument("--fade-out", type=float, default=0.15); p.set_defaults(fn=cmd_soften)
    p = sp.add_parser("screen"); p.add_argument("files", nargs="+"); p.set_defaults(fn=cmd_screen)
    p = sp.add_parser("gains"); p.add_argument("music"); p.add_argument("events")
    p.add_argument("--target", type=float, default=3.5); p.add_argument("--cap", type=float, default=4)
    p.add_argument("--mfloor", type=float, default=-50); p.add_argument("--hfloor", type=float, default=-50); p.set_defaults(fn=cmd_gains)
    p = sp.add_parser("mix"); p.add_argument("picture"); p.add_argument("out")
    p.add_argument("--score", required=True); p.add_argument("--music-lufs", type=float, required=True, help="music-only level after the chain")
    p.add_argument("--plan"); p.add_argument("--sfx-dir"); p.add_argument("--no-sfx", action="store_true")
    p.add_argument("--no-chain", dest="chain", action="store_false", help="skip the shelf + compressor music chain")
    p.add_argument("--fade", type=float, default=1.2, help="music fade-out at the end (s)")
    p.add_argument("--dip", type=float, nargs=3, action="append", metavar=("START", "END", "DB"))
    p.add_argument("--ring", type=float, nargs=2, metavar=("START", "DB"))
    p.add_argument("--hf-cap", type=float, default=4); p.add_argument("--pkcap", type=float, default=6)
    p.add_argument("--mfloor", type=float, default=-50); p.add_argument("--hfloor", type=float, default=-50)
    p.add_argument("--pkfloor", type=float, default=-20); p.add_argument("--report")
    p.set_defaults(fn=cmd_mix)
    a = ap.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
