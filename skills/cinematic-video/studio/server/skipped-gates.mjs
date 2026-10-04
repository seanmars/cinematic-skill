import { isStagePassed } from './projects.mjs'
import { readSettings } from './settings.mjs'

// Outputs that only belong after a stage's gate (D10): a storyboard after
// Treatments, picture code and shot stills after the storyboard. A
// heuristic, so it only ever warns.
const GUARDED = [
  { file: /^storyboard\.json$/, after: 'treatments' },
  { file: /^(index\.html|qa\/stills\/.+)$/, after: 'storyboard' },
]

// The stage whose gate a new file got ahead of, if any.
export function skippedStage(dir, file) {
  const rule = GUARDED.find(candidate => candidate.file.test(file))
  if (rule === undefined) return undefined
  const isPassed = readSettings(dir).autoContinue.includes(rule.after) || isStagePassed(dir, rule.after)
  return isPassed ? undefined : rule.after
}

// The warnings seen per project, in memory. A reader re-checks them, so one
// clears itself once the user lets the project past that stage.
export function createWarnings() {
  const byProject = new Map()
  return {
    add(slug, warning) {
      const warnings = byProject.get(slug) ?? []
      const isKnown = warnings.some(known => known.skipped === warning.skipped && known.file === warning.file)
      if (!isKnown) byProject.set(slug, [...warnings, warning])
    },
    list: (slug, dir) => (byProject.get(slug) ?? []).filter(warning => skippedStage(dir, warning.file) !== undefined),
  }
}
