import path from 'node:path'
import { TMP_SUFFIX } from './files.mjs'
import { SLUG } from './projects.mjs'
import { skippedStage } from './skipped-gates.mjs'

// Files whose change the page re-reads a project for.
const PROJECT_FILES = new Set([
  'storyboard.json',
  'treatments.json',
  'audio/plan.json',
  'studio/intake.json',
  'studio/settings.json',
  'studio/progress.json',
])
const GATE_FILE = /^studio\/(gates|replies)\/[^/]+\.json$/
// What changes all the time without changing the picture: the studio's own
// files, QA stills and rendered output.
const NOT_PICTURE = /^(studio|qa|out)(\/|$)/

// A burst of edits to a page reloads its preview once.
const PREVIEW_DEBOUNCE_MS = 300

// A change under video/ as its project's slug and the file within it.
function projectFile(video, changed) {
  const [slug, ...rest] = path.relative(video, changed).split(path.sep)
  if (rest.length === 0 || !SLUG.test(slug) || changed.endsWith(TMP_SUFFIX)) return undefined
  return { slug, file: rest.join('/') }
}

function eventFor(file) {
  if (GATE_FILE.test(file)) return 'studio:gate'
  if (PROJECT_FILES.has(file)) return 'studio:project'
  if (!NOT_PICTURE.test(file)) return 'studio:preview'
  return undefined
}

// video/ joins Vite's watcher and its changes go out as custom WS events
// (D4); a file the studio just wrote itself is not pushed back. A new output
// that got ahead of an unpassed gate also goes out as a warning (D10).
export function pushFileChanges(server, { workspace, recentWrites, warnings }) {
  const video = path.join(workspace, 'video')
  const previewTimers = new Map()

  function pushPreview(slug) {
    clearTimeout(previewTimers.get(slug))
    previewTimers.set(
      slug,
      setTimeout(() => {
        previewTimers.delete(slug)
        server.ws.send('studio:preview', { slug })
      }, PREVIEW_DEBOUNCE_MS),
    )
  }

  function warnIfSkipped({ slug, file }) {
    const skipped = skippedStage(path.join(video, slug), file)
    if (skipped === undefined) return
    warnings.add(slug, { skipped, file })
    server.ws.send('studio:warning', { slug, skipped, file })
  }

  server.watcher.add(video)
  server.watcher.on('all', (kind, changed) => {
    const change = projectFile(video, changed)
    if (change === undefined || recentWrites.has(changed)) return
    if (kind === 'add' || kind === 'change') warnIfSkipped(change)
    const event = eventFor(change.file)
    if (event === 'studio:preview') pushPreview(change.slug)
    else if (event !== undefined) server.ws.send(event, change)
  })
  server.httpServer?.on('close', () => {
    for (const timer of previewTimers.values()) clearTimeout(timer)
  })
}
