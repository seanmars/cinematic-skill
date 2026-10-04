import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, exists, makeWorkspace, openGate, readJson, request, startStudio, writeReply } from './studio-helpers.mjs'

const REPLIES = 'video/demo/studio/replies'

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('gate replies', () => {
  it('approves an open gate: writes the reply file the mod delivers', async () => {
    openGate(workspace, '003-storyboard')

    const res = await studio.post('/api/projects/demo/replies/003-storyboard', {
      decision: 'approve',
      notes: 'ship it',
      changes: [],
    })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/003-storyboard.json`)).toEqual({
      decision: 'approve',
      notes: 'ship it',
      changes: [],
    })
  })

  it('fills in empty notes and changes', async () => {
    openGate(workspace, '003-storyboard')

    const res = await studio.post('/api/projects/demo/replies/003-storyboard', { decision: 'approve' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/003-storyboard.json`)).toEqual({ decision: 'approve', notes: '', changes: [] })
  })

  it('refuses a gate that was never opened', async () => {
    const res = await studio.post('/api/projects/demo/replies/003-storyboard', { decision: 'approve' })

    expect(res.status).toBe(404)
    expect(exists(workspace, REPLIES)).toBe(false)
  })

  it('refuses a gate that already has a reply, keeping the first one', async () => {
    openGate(workspace, '003-storyboard')
    writeReply(workspace, '003-storyboard', 'approve', 'first')

    const res = await studio.post('/api/projects/demo/replies/003-storyboard', { decision: 'approve', notes: 'second' })

    expect(res.status).toBe(409)
    expect(readJson(workspace, `${REPLIES}/003-storyboard.json`).notes).toBe('first')
  })

  it('refuses an auto-continue gate, which expects no reply', async () => {
    openGate(workspace, '006-audio', { autoContinue: true })

    const res = await studio.post('/api/projects/demo/replies/006-audio', { decision: 'approve' })

    expect(res.status).toBe(409)
    expect(exists(workspace, REPLIES)).toBe(false)
  })

  it.each([
    ['an unknown decision', { decision: 'bogus' }],
    ['a missing decision', { notes: 'hi' }],
    ['notes that are not text', { decision: 'approve', notes: 3 }],
    ['changes that are not a list of fields', { decision: 'approve', changes: 'shots[0]' }],
  ])('refuses %s', async (_, body) => {
    openGate(workspace, '003-storyboard')

    const res = await studio.post('/api/projects/demo/replies/003-storyboard', body)

    expect(res.status).toBe(400)
    expect(exists(workspace, REPLIES)).toBe(false)
  })

  it('refuses a malformed JSON body', async () => {
    openGate(workspace, '003-storyboard')

    const res = await request(studio.port, 'POST', '/api/projects/demo/replies/003-storyboard', {
      body: '{"decision": "appr',
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    expect(exists(workspace, REPLIES)).toBe(false)
  })

  it.each(['Demo', '..%2F..%2Fescape', '%2e%2e'])('refuses the project name %s', async slug => {
    const res = await studio.post(`/api/projects/${slug}/replies/003-storyboard`, { decision: 'approve' })

    expect(res.status).toBe(404)
  })
})
