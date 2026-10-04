# cinematic-skill

A Claude Code skill for code-driven video production: authors animated scenes (Canvas, HTML/CSS/SVG, Three.js, Manim, etc.) and renders them frame by frame to MP4 with Playwright + FFmpeg.

## Requirements

- [uv](https://docs.astral.sh/uv/)
- FFmpeg

## Installation

Install with [skills](https://github.com/vercel-labs/skills):

```bash
npx skills add seanmars/cinematic-skill
```

Add `-g` to install globally, or `--agent claude-code` to target a specific agent.

## Usage

Ask Claude to make a video, e.g. "make a 30s launch film for my app".

## Web studio

The skill also ships a web studio: Claude stops at a gate after every stage, and you review it in the browser (treatments, storyboard with a `render(t)` preview and timeline, builds, audio, Gauntlet rounds, delivery), edit shots, then send Claude on.

Extra requirements:

- Node.js 22.12 or later, and pnpm (npm works too)
- A Claude Code version that loads plugin mods (function hooks)

Create a workspace with the skill copied into it, then open Claude Code there:

```bash
node <skill>/studio/init.mjs my-studio
cd my-studio
claude          # accept the workspace trust prompt
```

Then, in Claude Code:

```
/studio start   # installs the studio's dependencies the first time, starts it and opens it in the browser
/studio stop    # stops it; add --force while other sessions here are online
/studio         # whether it runs, and where
```

The studio also stops by itself when the last Claude Code session in the workspace exits.

`<skill>` is where `npx skills add` put the skill (for example `~/.claude/skills/cinematic-video`). Start a project from the studio's **New project** form; with one Claude Code session open it is assigned to that session, with several you pick one. Without the studio, the skill keeps working as before (one approval gate, in the chat).

## Developing this repo

```bash
pnpm install
pnpm playground   # once: a playground/ workspace linked to skills/, seeded with fixtures/demo
pnpm test         # studio (vitest), mod (claude plugin test), scripts (pytest via uv)
```

Open `claude` inside `playground/` and run `/studio start`; edits to `skills/cinematic-video` take effect there without another init. After changing the studio's server code, restart it with `/studio stop` and `/studio start`. The studio's output goes to `playground/node_modules/.cinematic-studio/studio.log`.

## License

MIT
