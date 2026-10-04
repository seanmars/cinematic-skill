import fs from 'node:fs'
import path from 'node:path'
import { assignProject } from './assignments.mjs'
import { HttpError } from './http-error.mjs'
import { SLUG } from './projects.mjs'
import { readSessions } from './sessions.mjs'

const PROFILES = ['stylized', 'commercial']
const SLUG_WORDS = 4

function isText(value) {
  return typeof value === 'string'
}

// The form: the brief (draft, prompt or idea) is the only required field;
// what is left empty Claude asks about or defaults at Intake. Brand and
// assets are local paths: v1 has no uploads.
function parseIntake(body) {
  const { brief, specs = '', profile = null, brand = '', assets = [], slug, sessionId } = body ?? {}
  if (!isText(brief) || brief.trim() === '') throw new HttpError(400, 'brief must not be empty')
  if (!isText(specs) || !isText(brand)) throw new HttpError(400, 'specs and brand must be text')
  if (profile !== null && !PROFILES.includes(profile)) throw new HttpError(400, `profile must be one of ${PROFILES.join(', ')}`)
  if (!Array.isArray(assets) || !assets.every(asset => isText(asset) && asset !== '')) {
    throw new HttpError(400, 'assets must list local paths')
  }
  if (slug !== undefined && !(isText(slug) && SLUG.test(slug))) throw new HttpError(400, 'slug must be kebab-case')
  if (sessionId !== undefined && !isText(sessionId)) throw new HttpError(400, 'sessionId must be text')
  return { form: { brief, specs, profile, brand, assets }, slug, sessionId }
}

// The brief's first latin words, or the date when it has none.
function slugFromBrief(brief, now) {
  const words =
    brief
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  if (words.length > 0) return words.slice(0, SLUG_WORDS).join('-')
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('')
  return `film-${date}`
}

function isTaken(workspace, slug) {
  return fs.existsSync(path.join(workspace, 'video', slug))
}

function freeSlug(workspace, base) {
  let slug = base
  for (let n = 2; isTaken(workspace, slug); n++) slug = `${base}-${n}`
  return slug
}

// Who gets the project: the session the user picked, else the only one
// online; with none or several online the project waits for the user.
function chooseSession(workspace, picked) {
  const online = readSessions(workspace).filter(session => session.online)
  if (picked === undefined) return online.length === 1 ? online[0].sessionId : undefined
  if (!online.some(session => session.sessionId === picked)) throw new HttpError(409, `session ${picked} is not online`)
  return picked
}

// The project folder and its intake.json exist from the moment the user
// sends the form, so nothing typed is lost if no session is there to take it.
export async function postIntake(workspace, body, write) {
  const { form, slug: typed, sessionId: picked } = parseIntake(body)
  const sessionId = chooseSession(workspace, picked)
  const now = new Date()
  if (typed !== undefined && isTaken(workspace, typed)) throw new HttpError(409, `video/${typed} already exists`)
  const slug = typed ?? freeSlug(workspace, slugFromBrief(form.brief, now))

  await write(path.join(workspace, 'video', slug, 'studio/intake.json'), { slug, submittedAt: now.toISOString(), ...form })
  const assignment = sessionId === undefined ? null : await assignProject(workspace, slug, sessionId, write)
  return { slug, assignment }
}
