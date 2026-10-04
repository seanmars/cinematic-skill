import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STALE,
  STATE,
  cleanUp,
  connectEvents,
  makeWorkspace,
  startStudio,
  writeJson,
  writeSession,
  writeText,
} from './studio-helpers.mjs'

const PERMISSION = {
  sessionId: 'session-a',
  message: 'Claude needs your permission to use Bash',
  waitingSince: '2026-10-04T04:00:00.000Z',
}

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

function byId(sessions) {
  return Object.fromEntries(sessions.map(session => [session.sessionId, session]))
}

describe('session status', () => {
  it('reports each session online or not, with its short id, start and project', async () => {
    writeSession(workspace, 'session-a', { project: 'demo', startedAt: '2026-10-04T03:00:00.000Z' })
    writeSession(workspace, 'session-crashed', STALE)
    writeSession(workspace, 'session-ended', { online: false })

    const res = await studio.get('/api/sessions')

    expect(res.status, res.text).toBe(200)
    const sessions = byId(res.body.sessions)
    expect(sessions['session-a']).toMatchObject({
      shortId: 'sessio',
      startedAt: '2026-10-04T03:00:00.000Z',
      online: true,
      project: 'demo',
      permission: null,
    })
    expect(sessions['session-crashed'].online).toBe(false)
    expect(sessions['session-ended'].online).toBe(false)
  })

  it('Claude 等待授權: reports the permission prompt a session waits on', async () => {
    writeSession(workspace, 'session-a')
    writeJson(workspace, `${STATE}/permission/session-a.json`, PERMISSION)

    const res = await studio.get('/api/sessions')

    expect(byId(res.body.sessions)['session-a'].permission).toEqual({
      message: PERMISSION.message,
      waitingSince: PERMISSION.waitingSince,
    })
  })

  it('skips a session file caught half-written', async () => {
    writeSession(workspace, 'session-a')
    writeText(workspace, `${STATE}/sessions/session-b.json`, '{"sessionId": "sess')

    const res = await studio.get('/api/sessions')

    expect(res.status).toBe(200)
    expect(res.body.sessions.map(session => session.sessionId)).toEqual(['session-a'])
  })

  it('pushes studio:sessions when a session appears or starts waiting for permission', async () => {
    const listener = await connectEvents(studio)

    writeSession(workspace, 'session-a')
    const appeared = await listener.waitFor(
      e => e.event === 'studio:sessions' && e.data.sessions.some(session => session.sessionId === 'session-a'),
    )
    expect(byId(appeared.data.sessions)['session-a'].permission).toBeNull()

    writeJson(workspace, `${STATE}/permission/session-a.json`, PERMISSION)
    await listener.waitFor(
      e => e.event === 'studio:sessions' && byId(e.data.sessions)['session-a']?.permission?.message === PERMISSION.message,
    )
  })
})
