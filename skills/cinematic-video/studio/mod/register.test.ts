import { expect, test } from 'claude-code/testing'
import { fakeEngine, startSession } from './fake-engine'

test('沒有 workspace 標記: registers nothing and never wakes Claude', async ($, on) => {
  const engine = fakeEngine(on)
  engine.writeJson('node_modules/.cinematic-studio/assignments/demo.json', {
    slug: 'demo',
    sessionId: 'session-a',
    assignedAt: '2026-10-04T04:00:00.000Z',
    reason: 'intake',
  })
  engine.writeJson('video/demo/studio/gates/001-intake.json', {
    gateId: '001-intake',
    stage: 'intake',
    openedAt: '2026-10-04T04:00:00.000Z',
    autoContinue: false,
    payload: {},
  })
  engine.writeJson('video/demo/studio/replies/001-intake.json', { decision: 'approve', notes: '', changes: [] })

  await startSession($)
  await engine.clock.advance(6000)

  expect(engine.tools).toEqual([])
  expect(engine.status).toEqual([])
  expect(engine.submitted).toEqual([])
})
