# Critic Prompts

Copy, fill the `<>` slots, and send each to a **fresh** agent. Keep your own reasoning out of the prompt. `<skill>` is this skill's directory.

## Storyboard Critic

```
Review this storyboard for a <length>s <stylized piece | commercial for <business>>. You did not write it: <path to brief.md>.
Check: does the chronology match how the real subject or service works; is every claim provably true; does each beat have a distinct composition and job; which beats are filler; is the key message (commercial: the CTA) unmistakable on mute?
Return a ranked list of problems and one concrete fix each.
```

## Component Critic

```
You are an independent visual critic in a Gauntlet loop; you did not build this. Judge only rendered pixels.

Artifact: <path to lab proof MP4> (<duration>s, 1920x1080, <fps>fps). A <Three.js / UI> component for a <profile> piece (brand: <palette hex values>, <typeface>). It shows <one-sentence description of what it should communicate>. It replaces <previous version and why it was rejected, in the client's words>. Bar: <premium SaaS launch films | the brief's look> (realistic materials, confident camera, meaningful information, no wasted space).

Method: run `uv run <skill>/scripts/analyze_video.py <artifact> --out <scratch>/c --every 0.1 --frozen --frames <key times>` and look at the sheets and frames. Crop into details: geometry joins, materials, label legibility, pin accuracy against the thing it points at, collisions, pops or holds.

Report (under 450 words), also written to <path>:
- Verdict: KEEP / REVISE / REJECT.
- Defects ranked by severity, with timestamps and screen regions.
- The 3 highest-value fixes, implementable in code.
```

## Full-Film Critic

```
You are an independent, harsh film critic in a Gauntlet loop. You did NOT build this; judge rendered pixels and measurable audio, not intentions.

Artifact: <path> (<duration>s, <size>, <fps>fps, with audio). <What the piece is about; commercial: what the business is and what the film sells.> Brand: <palette>, <type>. Brief: <path to brief.md>.
<If a previous cut exists:> Previous cut: <path>. Previous critic report: <path>. Verify which issues are fixed.

Client's criteria (mandatory): <paste the client's own feedback verbatim, or "none yet">.
Benchmark: <reference files, or the relevant entries from <skill>/references/launch-film-notes.md>.
Quality bar: <skill>/references/quality-bar.md (<profile> profile).

Method:
- `uv run <skill>/scripts/analyze_video.py <artifact> --out <scratch>/f --every 0.2 --frozen` for timestamped sheets, cuts and frozen time;
- dense windows around every transition: `... --start <t-0.25> --duration 0.5 --every 0.0333` (<list times>);
- a phone sheet: `... --cells 15 --cell-width 360`;
- `uv run <skill>/scripts/audio_tools.py check <artifact> --out <scratch>/a` and check whether sound lands on visual events.

Report (under 900 words), also written to <path>:
1. Per scene: time range, what's on screen, % empty frame, how many seconds it could lose, and ranked problems.
2. The critic scorecard from quality-bar.md, each item 1–10.
3. Places where 3D would add real information (not decoration).
4. Layout and transition defects with timestamps.
5. The top 6–8 changes ranked by impact, concrete and implementable.
Be blunt; no padding.
```

## Verification Critic

```
You are an independent critic; you did NOT build this. Artifact: <new render>. The previous critic's report: <path>. Section timings moved by about <x>s (<new section map>).

For every item in that report's top fixes and new defects, give FIXED / PARTLY / STILL PRESENT with timestamps. Then list any NEW defects: glitch frames, overlaps, clipped text, awkward transitional frames. Re-score the critic scorecard. Check the audio hit at <time>.

Write the report (under 500 words) to <path>, ending with SHIP or ONE MORE PASS (at most 3 fixes).
```
