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

## License

MIT
