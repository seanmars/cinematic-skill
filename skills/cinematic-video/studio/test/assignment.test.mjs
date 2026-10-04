import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STALE,
  STATE,
  assign,
  cleanUp,
  exists,
  gate,
  makeWorkspace,
  readJson,
  startStudio,
  writeJson,
  writeSession,
} from './studio-helpers.mjs'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const DEMO_ASSIGNMENT = `${STATE}/assignments/demo.json`

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('assigning a project', () => {
  it('assigns an intake that waited for a session as intake', async () => {
    writeJson(workspace, 'video/kettle-news/studio/intake.json', { slug: 'kettle-news', brief: 'A kettle' })
    writeSession(workspace, 'session-a')

    const res = await studio.post('/api/projects/kettle-news/assignment', { sessionId: 'session-a' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${STATE}/assignments/kettle-news.json`)).toEqual({
      slug: 'kettle-news',
      sessionId: 'session-a',
      assignedAt: expect.stringMatching(ISO),
      reason: 'intake',
    })
  })

  it('assigns a project that already has gates as reassign, so the session picks it up where it stopped', async () => {
    writeJson(workspace, 'video/demo/studio/gates/003-storyboard.json', gate('003-storyboard'))
    writeSession(workspace, 'session-a')

    const res = await studio.post('/api/projects/demo/assignment', { sessionId: 'session-a' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, DEMO_ASSIGNMENT).reason).toBe('reassign')
  })

  it('持有者離線: reassigns the project to an online session', async () => {
    writeSession(workspace, 'session-crashed', { ...STALE, project: 'demo' })
    writeSession(workspace, 'session-a')
    assign(workspace, 'demo', 'session-crashed')

    const res = await studio.post('/api/projects/demo/assignment', { sessionId: 'session-a' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, DEMO_ASSIGNMENT)).toMatchObject({ sessionId: 'session-a', reason: 'reassign' })
  })

  it('refuses to take a project away from a holder that is still online', async () => {
    writeSession(workspace, 'session-holder', { project: 'demo' })
    writeSession(workspace, 'session-a')
    assign(workspace, 'demo', 'session-holder')

    const res = await studio.post('/api/projects/demo/assignment', { sessionId: 'session-a' })

    expect(res.status).toBe(409)
    expect(readJson(workspace, DEMO_ASSIGNMENT).sessionId).toBe('session-holder')
  })

  it.each([
    ['offline', () => writeSession(workspace, 'session-x', STALE)],
    ['unknown', () => {}],
  ])('refuses a session that is %s', async (_, arrange) => {
    arrange()

    const res = await studio.post('/api/projects/demo/assignment', { sessionId: 'session-x' })

    expect(res.status).toBe(409)
    expect(exists(workspace, DEMO_ASSIGNMENT)).toBe(false)
  })

  it('shows who holds the project', async () => {
    writeSession(workspace, 'session-a')
    assign(workspace, 'demo', 'session-a')

    const res = await studio.get('/api/projects/demo')

    expect(res.body.assignment).toMatchObject({ slug: 'demo', sessionId: 'session-a' })
  })
})

describe('manual unlock', () => {
  it('持有者離線: releases the project so no session holds it', async () => {
    writeSession(workspace, 'session-crashed', { ...STALE, project: 'demo' })
    assign(workspace, 'demo', 'session-crashed')

    const res = await studio.post('/api/projects/demo/unlock', {})

    expect(res.status, res.text).toBe(200)
    expect(exists(workspace, DEMO_ASSIGNMENT)).toBe(false)
    expect((await studio.get('/api/projects/demo')).body.assignment).toBeNull()
  })

  it('refuses while the holder is online', async () => {
    writeSession(workspace, 'session-holder', { project: 'demo' })
    assign(workspace, 'demo', 'session-holder')

    const res = await studio.post('/api/projects/demo/unlock', {})

    expect(res.status).toBe(409)
    expect(exists(workspace, DEMO_ASSIGNMENT)).toBe(true)
  })
})
