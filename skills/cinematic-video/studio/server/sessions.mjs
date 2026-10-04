import path from 'node:path'
import { listJson, readJson } from './files.mjs'

// Short-lived state, outside Vite's watcher (D4): each mod writes its own
// session file, notify.mjs its permission file, render.py the render
// progress, the studio the assignments.
export const STATE_DIR = 'node_modules/.cinematic-studio'

// The mod heartbeats every 5 s: three missed beats and the session counts as
// gone, which covers a session that crashed without marking itself offline.
const OFFLINE_AFTER_MS = 15_000

function isOnline(session, now) {
  return session.online === true && now - Date.parse(session.heartbeatAt) < OFFLINE_AFTER_MS
}

function lastActivityAt(activity) {
  return Math.max(0, ...activity.flatMap(entry => [Date.parse(entry.startedAt), Date.parse(entry.endedAt ?? '')]).filter(Number.isFinite))
}

// notify.mjs records the prompt but nothing records the answer, so the file
// stays behind. A tool call that started or ended after the prompt means the
// user answered it.
function waitingPermission(state, name, activity) {
  const permission = readJson(path.join(state, 'permission', name))
  if (permission === undefined || Date.parse(permission.waitingSince) <= lastActivityAt(activity)) return null
  return { message: permission.message, waitingSince: permission.waitingSince }
}

export function readSessions(workspace, now = Date.now()) {
  const state = path.join(workspace, STATE_DIR)
  return listJson(path.join(state, 'sessions')).flatMap(name => {
    const session = readJson(path.join(state, 'sessions', name))
    if (typeof session?.sessionId !== 'string') return []
    const online = isOnline(session, now)
    const activity = Array.isArray(session.activity) ? session.activity : []
    return [
      {
        sessionId: session.sessionId,
        shortId: session.shortId,
        startedAt: session.startedAt,
        heartbeatAt: session.heartbeatAt,
        online,
        project: session.project ?? null,
        activity,
        permission: online ? waitingPermission(state, name, activity) : null,
      },
    ]
  })
}

export function isSessionOnline(workspace, sessionId) {
  return readSessions(workspace).some(session => session.sessionId === sessionId && session.online)
}

// render.py --progress-file, as the protocol has Claude point it (D9).
export function readRender(workspace, slug) {
  return readJson(path.join(workspace, STATE_DIR, 'render', `${slug}.json`)) ?? null
}

export function readRenders(workspace) {
  const dir = path.join(workspace, STATE_DIR, 'render')
  return Object.fromEntries(
    listJson(dir).flatMap(name => {
      const progress = readJson(path.join(dir, name))
      return progress === undefined ? [] : [[name.replace(/\.json$/, ''), progress]]
    }),
  )
}
