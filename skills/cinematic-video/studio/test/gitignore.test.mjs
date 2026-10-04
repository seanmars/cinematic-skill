import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// `npx skills add` only fetches git-tracked files, so a source file that the
// repo's .gitignore swallows (lib/, build/, out, ...) works locally but goes
// missing for everyone who installs the skill.

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Ignored on purpose: the link-mode manifest, the tsconfig.json the engine lays
// beside a loaded manifest, and caches.
const ALLOWED = [
  /^\.claude-plugin\//,
  /^hooks\/hooks\.json$/,
  /^tsconfig\.json$/,
  /(^|\/)__pycache__\//,
  /\.pyc$/,
  /(^|\/)node_modules\//,
]

function git(args) {
  return execFileSync('git', args, { cwd: skillDir, encoding: 'utf8' })
}

function isInGitRepo() {
  try {
    return git(['rev-parse', '--is-inside-work-tree']).trim() === 'true'
  } catch {
    return false
  }
}

describe.skipIf(!isInGitRepo())('gitignore trap', () => {
  it('ignores nothing in the skill besides the manifest and caches', () => {
    // File by file: --directory would fold hooks/ (holding only the ignored
    // hooks.json) into one entry that hides whatever else lands there.
    const ignored = git(['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '.'])
      .split('\0')
      .filter(Boolean)
    const trapped = ignored.filter(file => !ALLOWED.some(pattern => pattern.test(file)))

    expect(trapped).toEqual([])
  })
})
