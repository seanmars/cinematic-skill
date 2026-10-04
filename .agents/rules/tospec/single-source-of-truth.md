<!-- tospec:single-source-of-truth:v1 sha256=58c4a17e9265610c3347bbb9a3eb4678d6551c272bfa065e66f24323c54b74b4 -->
# Single Source of Truth

This rule takes precedence over any conflicting statement in documentation, comments, planning artifacts, or earlier conversation.

## 1. Source code is authoritative

The source code in this repository is the only authoritative description of how the system actually behaves. Specifications, design documents, READMEs, changelogs, code comments, and prior summaries are secondary: each records intent at the moment it was written, and each drifts as the code moves on.

- When a document contradicts the code, **the code is correct**. Report the discrepancy; do not change the code to match the document unless the user explicitly asks for that.
- Before asserting how something works, verify it in the code. An answer sourced from a document alone is unverified.

## 2. Archived documents are presumed stale

Do not read files under `tospec/changes/archive/` or `tospec/tickets/archive/` unless one of these holds:

- the task genuinely cannot be completed without them, or
- the user explicitly asks you to.

These directories store snapshots of finished work. Nothing updates them when the code changes, so treating them as current will make you describe behavior that no longer exists.
<!-- /tospec:single-source-of-truth -->
