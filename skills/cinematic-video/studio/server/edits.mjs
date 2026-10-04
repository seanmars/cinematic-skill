import fs from 'node:fs'
import path from 'node:path'
import { readJson } from './files.mjs'
import { HttpError, badRequest } from './http-error.mjs'
import { projectDir, requireOpenGate } from './projects.mjs'
import { ripple } from './ripple.mjs'
import { isKnownTechnique } from './techniques.mjs'

// The four main technique slots, one technique of its category each (or
// null); every other category goes into the shot's tags.
const SLOTS = { framing: 'framing', angle: 'camera-angles', movement: 'camera-movement', transition: 'editing' }
const MAIN_CATEGORIES = new Set(Object.values(SLOTS))
const TEXT_FIELDS = new Set(['picture', 'job', 'action', 'camera', 'audio', 'transition'])
const REQUIRED_TEXT = new Set(['picture', 'job'])

// The fields edited at each open gate, kept until its reply carries them to
// Claude. In memory: a reloaded page still finds them; a restarted studio
// does not.
export function createChangeLog() {
  const pending = new Map()
  const key = (slug, gateId) => `${slug}/${gateId}`
  return {
    add(slug, gateId, change) {
      const changes = pending.get(key(slug, gateId)) ?? []
      if (!changes.includes(change)) pending.set(key(slug, gateId), [...changes, change])
    },
    list: (slug, gateId) => pending.get(key(slug, gateId)) ?? [],
    clear: (slug, gateId) => pending.delete(key(slug, gateId)),
  }
}

function isTechnique(dir, value, category) {
  return typeof value === 'string' && value.startsWith(`${category}/`) && isKnownTechnique(dir, value)
}

function editSlot(dir, shot, slot, value) {
  if (value !== null && !isTechnique(dir, value, SLOTS[slot])) {
    throw badRequest(`${slot} takes a ${SLOTS[slot]}/ technique the library or the project has, or null`)
  }
  shot.techniques[slot] = value
}

function editTags(dir, shot, value) {
  const isTag = tag =>
    typeof tag === 'string' && !MAIN_CATEGORIES.has(tag.split('/')[0]) && isKnownTechnique(dir, tag)
  if (!Array.isArray(value) || !value.every(isTag) || new Set(value).size !== value.length) {
    throw badRequest('tags take distinct techniques outside the four main slots')
  }
  shot.tags = value
}

// An optional text emptied is dropped; Picture and Job must keep some text.
function editText(shot, name, value) {
  if (typeof value !== 'string') throw badRequest(`text.${name} takes text`)
  if (value !== '') shot.text[name] = value
  else if (REQUIRED_TEXT.has(name)) throw badRequest(`text.${name} cannot be empty`)
  else delete shot.text[name]
}

function applyEdit(dir, shot, field, value) {
  const [group, name, ...rest] = String(field).split('.')
  if (group === 'techniques' && Object.hasOwn(SLOTS, name) && rest.length === 0) editSlot(dir, shot, name, value)
  else if (group === 'tags' && name === undefined) editTags(dir, shot, value)
  else if (group === 'text' && TEXT_FIELDS.has(name) && rest.length === 0) editText(shot, name, value)
  else throw badRequest(`the studio does not edit ${field}`)
}

const SCORE_FILE = /(music|score)[^/\\]*\.(wav|mp3|m4a|aac|flac|ogg)$/i

// A recut is due when audio/ holds a music file or the storyboard plans a
// score (D6).
function hasScore(dir, storyboard) {
  const planned = String(storyboard.inputs?.audio ?? '')
  if (/\bscore\b/i.test(planned) && !/\bno score\b/i.test(planned)) return true
  try {
    return fs.readdirSync(path.join(dir, 'audio'), { recursive: true }).some(name => SCORE_FILE.test(String(name)))
  } catch {
    return false
  }
}

// A shot's duration, while the project waits at a gate: the storyboard and
// then the plan, rippled together (D6).
export async function postDurationEdit(workspace, slug, body, { write, changeLog }) {
  const dir = projectDir(workspace, slug)
  const gate = requireOpenGate(dir)
  const { shot: shotId, duration } = body ?? {}
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    throw badRequest('duration takes seconds above 0')
  }
  const storyboardFile = path.join(dir, 'storyboard.json')
  const storyboard = readJson(storyboardFile)
  if (!storyboard?.shots?.some(shot => shot.id === shotId)) throw new HttpError(404, `no shot ${shotId} in the storyboard`)
  const planFile = path.join(dir, 'audio/plan.json')
  const plan = readJson(planFile) ?? null

  const result = ripple(storyboard.shots, plan, shotId, duration, { hasScore: hasScore(dir, storyboard) })
  await write(storyboardFile, { ...storyboard, shots: result.shots })
  if (result.plan !== null) await write(planFile, result.plan)
  for (const change of result.changes) changeLog.add(slug, gate.gateId, change)
  return { changes: result.changes }
}

// One field of one shot, while the project waits at a gate (D3). Claude
// rewrites the free text and the code to match when it reads the change.
export async function postStoryboardEdit(workspace, slug, body, { write, changeLog }) {
  const dir = projectDir(workspace, slug)
  const gate = requireOpenGate(dir)
  const file = path.join(dir, 'storyboard.json')
  const storyboard = readJson(file)
  const shot = storyboard?.shots?.find(candidate => candidate.id === body?.shot)
  if (shot === undefined) throw new HttpError(404, `no shot ${body?.shot} in the storyboard`)

  applyEdit(dir, shot, body.field, body.value)
  await write(file, storyboard)
  const change = `shots[${shot.id}].${body.field}`
  changeLog.add(slug, gate.gateId, change)
  return { changes: [change] }
}
