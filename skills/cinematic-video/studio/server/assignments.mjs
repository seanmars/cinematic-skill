import fs from 'node:fs'
import path from 'node:path'
import { readJson, removeFile } from './files.mjs'
import { HttpError } from './http-error.mjs'
import { gateNames, projectDir } from './projects.mjs'
import { STATE_DIR, isSessionOnline } from './sessions.mjs'

// The studio alone decides which session's mod handles a project (see
// schema/assignment.schema.json); no mod ever claims one by itself.

function assignmentPath(workspace, slug) {
  return path.join(workspace, STATE_DIR, 'assignments', `${slug}.json`)
}

export function readAssignment(workspace, slug) {
  return readJson(assignmentPath(workspace, slug)) ?? null
}

export function requireOnline(workspace, sessionId) {
  if (typeof sessionId !== 'string' || !isSessionOnline(workspace, sessionId)) {
    throw new HttpError(409, `session ${sessionId} is not online`)
  }
}

function refuseWhileHolderOnline(workspace, slug) {
  const current = readAssignment(workspace, slug)
  if (current !== null && isSessionOnline(workspace, current.sessionId)) {
    throw new HttpError(409, `${slug} is held by session ${current.sessionId}, which is online`)
  }
}

// intake makes the mod start Intake from intake.json; reassign makes it pick
// the project up where its gates stopped (D9).
function reasonFor(dir) {
  const hasGates = gateNames(dir).length > 0
  return !hasGates && fs.existsSync(path.join(dir, 'studio/intake.json')) ? 'intake' : 'reassign'
}

export async function assignProject(workspace, slug, sessionId, write) {
  const dir = path.join(workspace, 'video', slug)
  const assignment = { slug, sessionId, assignedAt: new Date().toISOString(), reason: reasonFor(dir) }
  await write(assignmentPath(workspace, slug), assignment)
  return assignment
}

export async function postAssignment(workspace, slug, body, { write }) {
  projectDir(workspace, slug)
  requireOnline(workspace, body?.sessionId)
  refuseWhileHolderOnline(workspace, slug)
  return { assignment: await assignProject(workspace, slug, body.sessionId, write) }
}

// Releases a project from a holder that went offline, so no session holds it
// until the user assigns it again.
export async function postUnlock(workspace, slug) {
  projectDir(workspace, slug)
  refuseWhileHolderOnline(workspace, slug)
  await removeFile(assignmentPath(workspace, slug))
  return { assignment: null }
}
