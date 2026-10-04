import { isStagePassed } from './projects.mjs'
import { readSettings } from './settings.mjs'

// Outputs that only belong after a stage's gate (D10): a storyboard after
// Treatments, picture code and shot stills after the storyboard. A
// heuristic, so it only ever warns.
const GUARDED = [
  { file: /^storyboard\.json$/, after: 'treatments' },
  { file: /^(index\.html|qa\/stills\/.+)$/, after: 'storyboard' },
]

function isPassed(dir, stage) {
  return readSettings(dir).autoContinue.includes(stage) || isStagePassed(dir, stage)
}

// The stage whose gate a new file got ahead of, if any.
export function skippedStage(dir, file) {
  const stage = GUARDED.find(rule => rule.file.test(file))?.after
  return stage === undefined || isPassed(dir, stage) ? undefined : stage
}

// The warnings seen per project, in memory. A reader re-checks them, so one
// clears itself once the user lets the project past that stage.
export function createWarnings() {
  const byProject = new Map()
  return {
    // Whether the warning is new.
    add(slug, warning) {
      const warnings = byProject.get(slug) ?? []
      const isKnown = warnings.some(known => known.skipped === warning.skipped && known.file === warning.file)
      if (!isKnown) byProject.set(slug, [...warnings, warning])
      return !isKnown
    },
    // Each guarded stage is checked once, however many files it warns about.
    list(slug, dir) {
      const passed = new Map()
      const isSkipped = stage => {
        if (!passed.has(stage)) passed.set(stage, isPassed(dir, stage))
        return !passed.get(stage)
      }
      return (byProject.get(slug) ?? []).filter(warning => isSkipped(warning.skipped))
    },
  }
}
