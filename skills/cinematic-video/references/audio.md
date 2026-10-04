# Audio

Audio makes otherwise strong visuals feel amateur more than anything else. The model can't hear: it reads loudness numbers, waveforms and spectrograms, and states honestly whether anyone actually listened.

Commands below are `uv run <skill>/scripts/audio_tools.py <command>`.

## Shared Rules

- **One timeline for picture and sound.** Set the beat grid or VO timeline first; land cuts and key actions on it. Copy SFX cue times from the keyframe times in the picture code.
- **User-supplied music:** `beats` for a beat map; state changes on beats, big changes on downbeats, SFX on hits.
- **VO:** TTS (edge-tts, Kokoro, or the user's paid voice) synthesized in one pass; get per-line timestamps, then cut picture to VO. Never synthesize line by line and splice. Duck music under VO.
- **Check:** `check` prints integrated loudness, LRA, true peak, momentary and short-term loudness per second, plus waveform and spectrogram images. Look for clipping, near-silent intros, dips under key scenes, decay before the logo, constant low-end rumble.
- True peak ≤ -1 dBFS. AAC 256k; copy the video stream untouched.

## Stylized Profile

- **Score:** write per project in numpy; synthesize drums (downward-swept sine + fast decay), bass, chord pad and melody as stems, then mix. Pure sines sound thin; add harmonics, slight detune and reverb to chords and melody. Chiptune, synth and lo-fi styles suit this well.
- **SFX:** `sfx timeline.json audio/sfx.wav` synthesizes click, tick, pop, success, whoosh, impact, kick and riser at timeline cues.
- **Master:** sum the stems (`ffmpeg -i audio/score.wav -i audio/sfx.wav -filter_complex amix=inputs=2:normalize=0 audio/mix.wav`), `normalize` to -14 LUFS, then mux: `ffmpeg -i out/picture.mp4 -i audio/mix_norm.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest out/final.mp4`. Under 10s, single-pass normalization may land 1–2 LU off target; that's normal.

## Commercial Profile

These rules came from direct client rejections.

### Music

- **Match the music to the buyer's customer, not to "tech launch".** An energetic SaaS-launch score was rejected for a roofing/homeowner film. For home services, warm, chill, acoustic-leaning music fits: felt piano, clean or nylon guitar, a soft steady pulse (brushed kit, shaker), ~84–88 BPM, major key.
- **Chill still needs a pulse.** Beatless ambient or very sparse tracks feel sleepy against fast cuts and need heavy gain to be heard.
- **Structure the track to the film.** With generative music (e.g. ElevenLabs composition plans), write one section per scene group with exact durations that sum to the film length. Minimum section length is often 3s, so merge short sections. Ask for "starts immediately on the first beat, no long intro" and "clear resolved final chord at the start of the last section, then natural ring-out".
- **Check the generated track's loudness over time** with `check`. Reject tracks with a near-silent intro, dips under key scenes, or decay seconds before the logo. Regenerate with a different seed; some styles (e.g. tremolo electric guitar + Rhodes) repeatedly produced slow intros.
- **Avoid:** vocals/humming, lo-fi vinyl crackle, ukulele/whistling corporate stock, trailer hits, EDM drops, risers, anything "epic".
- **Deliver 2–3 options** cut to the same picture at identical integrated loudness, so the client compares music, not volume.

### Sound Effects

What the reference launch films do: the music carries the sound design, with punchy rhythmic beds and cuts on beats. Effects are whooshes, pitched sweeps, sub hits on hard cuts, and crisp UI/product clicks. That density suits punchy tech tracks. **Copying it onto a calm score was rejected** as "too loud… not clean… annoying throughout".

What a client finally approved for a calm home-services film, after eight rounds:
- **One short, soft, rumble-free whoosh on every real transition:** scene changes, visible wipes, and the headline slam. Never long, boomy "air/wind" whooshes. Choose whooshes with little energy below 150 Hz and a gentle ~80–400 ms rise. The rejected ones had 35–83% of their energy below 150 Hz and sounded like a repeated boom.
- **Small clean UI sounds only on real actions:** clicks on cursor clicks, pops on pins/badges, light ticks on labels, a check when something seats, one soft chime on confirmation, tiny taps when a logo locks together.
- **3D reveals get a musical accent:** a clean rising three-note pluck as layers lift apart, and soft wooden taps as new parts land. Pitch-shift tonal accents to the score's key.
- Music chosen: lo-fi (Rhodes + soft dusty drums), about 30% quieter than first mixed, so effects read clearly.

Rules:
1. **Clean sources.** A standard library (Mixkit Sound Effects Free License, HyperFrames' bundled SFX), prepared with `soften` (high-pass ~150–220 Hz, low-pass ~9–11 kHz, click-free fades). Loosely prompted AI effects and synthesized sine sweeps/ticks were rejected. Targeted AI effects work when you **generate several candidates and reject by analysis** with `screen`: drop anything boomy (>50% below 150 Hz), hissy or clicky (>40% above 6 kHz), or noise-like (it will read as a whoosh).
2. **Set levels per event, in each effect's own frequency band,** against a music-only render (`gains`, or `mix` with a plan). Target about +3–4 dB in-band, and cap the ear-sensitive 2–8 kHz lift at ~4 dB. Full-band loudness is useless here: effects barely move it, yet ticks can spike 12–17 dB at 2–8 kHz and sound annoying.
3. **Keep repeated sounds consistent.** When the solver collapses a gain because the music is momentarily quiet, override it to match the sound's other occurrences. Soften sounds that cluster within ~0.15s (×0.6) so they don't stack.
4. **Isolate complaints with a music-only render** (`mix --no-sfx`). When the client says "that whoosh", first check whether it's in the music (brushed snares and risers sound like whooshes). Ask them to play the music-only version at that moment, then fix the right layer.
5. **Change one thing per round and name it by timestamp.** The window between "I can't hear anything" and "I want to break my laptop" is a few dB.
6. **Always deliver a music-only fallback,** and keep previous versions in an `older versions/` folder.
7. If the music resolves on the logo, don't add a separate musical sting (key clashes), and don't cut the music out before the logo on calm pieces.

### Mix & Master

- `mix out/picture.mp4 out/final.mp4 --score audio/music.mp3 --music-lufs <level> --plan audio/plan.json --sfx-dir audio/sfx`: keep the plan at `audio/plan.json` and the effect files in `audio/sfx/`. Shelf + compressor music chain (`--no-chain` to skip), music set to `--music-lufs`, every effect solved in its own band with floors and caps, video copied untouched, per-event report written next to the output.
- Set the master level through `--music-lufs` and the plan, not `normalize`: loudnorm is dynamic and shifts the SFX balance.
- **Loudness:** reference launch films master around -14 LUFS (some at -7 to -10). The approved calm film landed at -19 LUFS integrated once the client lowered the music 30%, with effects clearly audible on top. A dense effects layer at -14 was rejected as too loud.

### Energetic Product Films (from a 40s Three.js product spec)

- **Library music beat the AI scores.** The client called two rounds of generated "brand-style" scores "a bit off". A human-made library track, **edited to picture**, landed well. Mixkit stock music is reachable at `https://assets.mixkit.co/music/<id>/<id>.mp3` (IDs come from the `data-audio-player-preview-url-value` attributes on the tag pages). Check the licence and credit the tracks.
- **Edit it like a music editor:**
  - time-stretch to a tempo where every cut falls on a beat (120 BPM puts cuts at x.0 and x.5);
  - measure the real onset at each cut and stretch ≤0.5% between cuts (a generic beat-warp locked onto the off-beat);
  - a sparse or filtered intro, with the groove arriving on the hero moment;
  - a dead stop (about 0.4s) and the track's own drop on the biggest cut;
  - the track's own final hit spliced on the end card, with equal-power crossfades on bar lines;
  - a 5 ms fade-in, because a full-level first sample clicks.
- **Make the drop land.** A drop that measured only +0.2 LU needed two things: a 40→300 Hz high-pass build over the 2s before it, and a -2.5 dB dip applied **after** the bus compressors (`mix --dip START END -2.5`; before them, the compressors flatten it out). Result: +2.7 LU, and the bass +9 dB into the drop.
- **Brand study, for grammar only.** The reference brand film measured about 124 BPM, four-on-the-floor, with flat and confident density, a restrained 2–5 kHz, dead stops and a button ending. Don't name brands or artists in generator prompts; they get rejected.
- **Levels the client approved:**
  - music at about -30 LUFS (the client asked for 10% less than -29);
  - whooshes as a soft "air pass" at about +2–3 dB in-band, raising short-term loudness ≤0.5 LU. A bundled whoosh at +7 dB was "too loud" and unprofessional;
  - micro sounds on **every small mechanical move** (screws backing out, parts re-seating, detents, panes docking): real recordings, each peaking **at or below** the local music peak.
- **Mixer guards** (built into `mix`):
  - **Level floors** (`--mfloor`, or per event): over a dead stop or a sparse intro, "+N dB over the music" makes an effect inaudible.
  - **A high-frequency floor** (`--hfloor`): the 2–8 kHz cap is measured against a floor, or a bass-only intro lets nothing through.
  - **A peak cap** (`--pkcap`, or per event): no effect may peak more than about 6 dB over the local music peak (8 dB for a signature hit). Without it, a key-press thock spiked to -2.8 dBFS in a -29 LUFS mix.
  - **"Body" in the report:** the 150 ms in-band RMS lift, alongside the 50 ms peak lift, which alone over-reported a 0.15s thock by 8 dB.
  - **Ring-out** (`--ring START DB`): lift a final resolve that sits too far under the bed.
- **Synthesised thocks were rejected** as "a pitched tom" or not professional. Layered real recordings worked, e.g. a laptop key press plus a soft body punch, about 100 ms long.
