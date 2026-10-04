import { postAssignment, postUnlock, readAssignment } from './assignments.mjs'
import { postDurationEdit, postStoryboardEdit } from './edits.mjs'
import { validateMutationRequest } from './guard.mjs'
import { HttpError } from './http-error.mjs'
import { postIntake } from './intake.mjs'
import { previewBase } from './preview.mjs'
import { listProjects, projectDir, readProject } from './projects.mjs'
import { postReply } from './replies.mjs'
import { readRender, readSessions } from './sessions.mjs'
import { postSettings, readSettings } from './settings.mjs'
import { readTechniqueFile, readTechniques } from './techniques.mjs'

const BODY_LIMIT = 1024 * 1024

// Everything the page shows of one project: its files and settings, who
// holds it, its render, where its preview lives, what was edited at the
// current gate and which gates Claude may have skipped.
function readProjectView(workspace, slug, { changeLog, warnings }) {
  const project = readProject(workspace, slug)
  const dir = projectDir(workspace, slug)
  const gate = project.gates.at(-1)
  return {
    ...project,
    settings: readSettings(dir),
    assignment: readAssignment(workspace, slug),
    render: readRender(workspace, slug),
    previewBase: previewBase(workspace, slug),
    changes: gate === undefined ? [] : changeLog.list(slug, gate.gateId),
    warnings: warnings.list(slug, dir),
  }
}

// The API only reads and writes the files of the state contract (D3); the UI
// never touches the file system itself. Path segments are matched raw: a slug
// check that fails on %2e%2e or %2F keeps every route inside its project.
function routes(workspace, store) {
  const project = '/api/projects/([^/]+)'
  return [
    ['GET', /^\/api\/projects$/, () => ({ projects: listProjects(workspace) })],
    ['GET', new RegExp(`^${project}$`), ([slug]) => readProjectView(workspace, slug, store)],
    ['GET', new RegExp(`^${project}/techniques$`), ([slug]) => readTechniques(workspace, slug)],
    [
      'GET',
      new RegExp(`^${project}/techniques/([^/]+)/([^/]+)$`),
      ([slug, category, file]) => readTechniqueFile(workspace, slug, category, file),
    ],
    ['GET', /^\/api\/sessions$/, () => ({ sessions: readSessions(workspace) })],
    ['POST', /^\/api\/intake$/, (_, body) => postIntake(workspace, body, store.write)],
    [
      'POST',
      new RegExp(`^${project}/replies/([^/]+)$`),
      ([slug, gateId], body) => postReply(workspace, slug, gateId, body, store),
    ],
    ['POST', new RegExp(`^${project}/storyboard$`), ([slug], body) => postStoryboardEdit(workspace, slug, body, store)],
    [
      'POST',
      new RegExp(`^${project}/storyboard/duration$`),
      ([slug], body) => postDurationEdit(workspace, slug, body, store),
    ],
    [
      'POST',
      new RegExp(`^${project}/assignment$`),
      ([slug], body) => postAssignment(workspace, slug, body, store.write),
    ],
    ['POST', new RegExp(`^${project}/unlock$`), ([slug]) => postUnlock(workspace, slug)],
    ['POST', new RegExp(`^${project}/settings$`), ([slug], body) => postSettings(workspace, slug, body, store.write)],
  ]
}

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

async function readBody(req) {
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (text.length > BODY_LIMIT) throw new HttpError(413, 'body too large')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'body is not valid JSON')
  }
}

// Not mounted with use('/api'): connect also matches /api.ts there, which is
// one of the page's own modules.
export function createApi({ workspace, write, changeLog, warnings }) {
  const table = routes(workspace, { write, changeLog, warnings })
  return async function api(req, res, next) {
    const pathname = req.url.split('?')[0]
    if (!pathname.startsWith('/api/')) return next()
    const route = table.find(([method, pattern]) => method === req.method && pattern.test(pathname))
    if (route === undefined) return sendJson(res, 404, { error: `no route ${req.method} ${pathname}` })
    const [method, pattern, handle] = route
    try {
      let body
      if (method !== 'GET') {
        const refusal = validateMutationRequest(req)
        if (refusal !== undefined) return sendJson(res, refusal.status, { error: refusal.error })
        body = await readBody(req)
      }
      sendJson(res, 200, await handle(pattern.exec(pathname).slice(1), body))
    } catch (error) {
      if (error instanceof HttpError) sendJson(res, error.status, { error: error.message })
      else next(error)
    }
  }
}
