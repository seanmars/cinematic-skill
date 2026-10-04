import fs from 'node:fs'
import path from 'node:path'
import { listJson, readJson } from './files.mjs'
import { HttpError } from './http-error.mjs'

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const STAGES = [
  'intake',
  'treatments',
  'storyboard',
  'assets',
  'build-animatic',
  'build-polish',
  'audio',
  'gauntlet',
  'deliver',
]
const GATE_ID = new RegExp(`^[0-9]{3}-(${STAGES.join('|')})$`)

// A studio project has a storyboard, or an intake sent from the studio; older
// projects under video/ have neither and are left alone.
function isStudioProject(dir) {
  return fs.existsSync(path.join(dir, 'storyboard.json')) || fs.existsSync(path.join(dir, 'studio/intake.json'))
}

export function findProjectDir(workspace, slug) {
  const dir = path.join(workspace, 'video', slug)
  return SLUG.test(slug) && isStudioProject(dir) ? dir : null
}

export function projectDir(workspace, slug) {
  const dir = findProjectDir(workspace, slug)
  if (dir === null) throw new HttpError(404, `no project ${slug}`)
  return dir
}

// open: waiting for the user. replied: the mod has yet to deliver the reply.
// delivered and auto: Claude has it.
function gateState(gate, reply) {
  if (gate.autoContinue) return 'auto'
  if (reply === undefined) return 'open'
  return gate.deliveredAt === undefined ? 'replied' : 'delivered'
}

function readGates(dir) {
  const studio = path.join(dir, 'studio')
  return listJson(path.join(studio, 'gates')).flatMap(name => {
    const gate = readJson(path.join(studio, 'gates', name))
    if (gate === undefined) return []
    const reply = readJson(path.join(studio, 'replies', name))
    return [{ ...gate, reply, state: gateState(gate, reply) }]
  })
}

// The page may edit project files only while the project waits at a gate;
// once the user replied, Claude has them again.
export function requireOpenGate(dir) {
  const gate = readGates(dir).at(-1)
  if (gate?.state !== 'open') throw new HttpError(409, 'the project is not waiting at a gate: Claude has it')
  return gate
}

export function listProjects(workspace) {
  const video = path.join(workspace, 'video')
  let entries
  try {
    entries = fs.readdirSync(video, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory() && SLUG.test(entry.name) && isStudioProject(path.join(video, entry.name)))
    .map(entry => entry.name)
    .sort()
    .map(slug => {
      const gate = readGates(path.join(video, slug)).at(-1)
      return { slug, gate: gate === undefined ? null : { gateId: gate.gateId, stage: gate.stage, state: gate.state } }
    })
}

export function readProject(workspace, slug) {
  const dir = projectDir(workspace, slug)
  const read = file => readJson(path.join(dir, file)) ?? null
  return {
    slug,
    intake: read('studio/intake.json'),
    storyboard: read('storyboard.json'),
    treatments: read('treatments.json'),
    plan: read('audio/plan.json'),
    progress: read('studio/progress.json'),
    gates: readGates(dir),
  }
}

// The gate file of a gateId, or a 404.
export function readGate(dir, gateId) {
  const gate = GATE_ID.test(gateId) ? readJson(path.join(dir, 'studio/gates', `${gateId}.json`)) : undefined
  if (gate === undefined) throw new HttpError(404, `no gate ${gateId}`)
  return gate
}

// Whether the user let the project past a stage: a gate of that stage that
// continued on its own, or a reply that moved on.
export function isStagePassed(dir, stage) {
  return readGates(dir).some(
    gate => gate.stage === stage && (gate.autoContinue || ['approve', 'pick', 'mix', 'ship'].includes(gate.reply?.decision)),
  )
}
