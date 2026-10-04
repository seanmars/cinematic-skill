import fs from 'node:fs'
import path from 'node:path'
import { listDir, listJson, readJson } from './files.mjs'
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

export function gateNames(dir) {
  return listJson(path.join(dir, 'studio/gates'))
}

// A gate with its reply, or undefined while its file is half-written.
function readGateWithReply(dir, name) {
  const gate = readJson(path.join(dir, 'studio/gates', name))
  if (gate === undefined) return undefined
  const reply = readJson(path.join(dir, 'studio/replies', name))
  return { ...gate, reply, state: gateState(gate, reply) }
}

function readGates(dir) {
  return gateNames(dir).flatMap(name => readGateWithReply(dir, name) ?? [])
}

// The last readable gate, without reading the ones before it.
function readLatestGate(dir) {
  for (const name of gateNames(dir).reverse()) {
    const gate = readGateWithReply(dir, name)
    if (gate !== undefined) return gate
  }
  return undefined
}

// The page may edit project files only while the project waits at a gate;
// once the user replied, Claude has them again.
export function requireOpenGate(dir) {
  const gate = readLatestGate(dir)
  if (gate?.state !== 'open') throw new HttpError(409, 'the project is not waiting at a gate: Claude has it')
  return gate
}

export function listProjects(workspace) {
  const video = path.join(workspace, 'video')
  return listDir(video)
    .filter(name => SLUG.test(name) && isStudioProject(path.join(video, name)))
    .sort()
    .map(slug => {
      const gate = readLatestGate(path.join(video, slug))
      return { slug, gate: gate === undefined ? null : { gateId: gate.gateId, stage: gate.stage, state: gate.state } }
    })
}

// The project files the page shows, by the key it reads them under.
export const PROJECT_FILES = {
  intake: 'studio/intake.json',
  storyboard: 'storyboard.json',
  treatments: 'treatments.json',
  plan: 'audio/plan.json',
  progress: 'studio/progress.json',
}

export function readProject(dir, slug) {
  const files = Object.entries(PROJECT_FILES).map(([key, file]) => [key, readJson(path.join(dir, file)) ?? null])
  return { slug, ...Object.fromEntries(files), gates: readGates(dir) }
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
