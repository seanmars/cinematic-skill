import { expect, test } from 'claude-code/testing'
import { EARLIER, type FakeEngine, START, WORKSPACE, fakeEngine, startSession } from './fake-engine'

const SLUG = 'lunelle-promo'
const GATES = `video/${SLUG}/studio/gates`
const REPLIES = `video/${SLUG}/studio/replies`
const OPEN_GATE = 'mcp__cinematic-video__open_gate'
const REPLY = { decision: 'approve', notes: 'tighten shot 3', changes: ['shots[2].duration'] }

function studioWorkspace(engine: FakeEngine) {
  engine.markStudio()
  engine.assign(SLUG, 'session-a')
}

test('一般 gate: writes the next gate file and tells Claude to end the turn', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.openGate(SLUG, '001-intake', { deliveredAt: EARLIER })
  engine.openGate(SLUG, '002-treatments', { deliveredAt: EARLIER })
  await startSession($)

  const answer = await $.tool.call({ tool: OPEN_GATE, project: SLUG, stage: 'storyboard', payload: { shots: 12 } })

  expect(engine.readJson(`${GATES}/003-storyboard.json`)).toEqual({
    gateId: '003-storyboard',
    stage: 'storyboard',
    openedAt: new Date(START).toISOString(),
    autoContinue: false,
    payload: { shots: 12 },
  })
  expect(String(answer.result)).toMatch(/end your turn/i)
  expect(engine.submitted).toEqual([])
})

test('Treatments 混搭: the wake-up carries the choice the user made', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.openGate(SLUG, '002-treatments')
  await startSession($)
  const choice = { id: 'A', mix: [{ option: 'C', element: 'structure' }] }

  engine.writeJson(`${REPLIES}/002-treatments.json`, { decision: 'mix', notes: 'Warmer grade.', changes: [], choice })
  await engine.clock.advance(2000)

  expect(engine.submitted).toHaveLength(1)
  expect(engine.submitted[0]).toContain(`choice: ${JSON.stringify(choice)}`)
})

test('a reply without a choice wakes Claude without a choice line', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.openGate(SLUG, '003-storyboard')
  await startSession($)

  engine.writeJson(`${REPLIES}/003-storyboard.json`, REPLY)
  await engine.clock.advance(2000)

  expect(engine.submitted[0]).not.toContain('choice:')
})

test('auto-continue 的 gate: still writes the gate and answers approved', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.writeJson(`video/${SLUG}/studio/settings.json`, { autoContinue: ['audio'] })
  await startSession($)

  const answer = await $.tool.call({ tool: OPEN_GATE, project: SLUG, stage: 'audio', payload: {} })

  expect(engine.readJson(`${GATES}/001-audio.json`)).toMatchObject({ gateId: '001-audio', autoContinue: true })
  expect(String(answer.result)).toMatch(/approved/i)
  expect(String(answer.result)).not.toMatch(/end your turn/i)
})

test('回覆檔出現: wakes Claude once and records deliveredAt', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.openGate(SLUG, '003-storyboard')
  await startSession($)

  engine.writeJson(`${REPLIES}/003-storyboard.json`, REPLY)
  await engine.clock.advance(2000)

  expect(engine.submitted).toHaveLength(1)
  const prompt = engine.submitted[0]!
  expect(prompt.startsWith('[studio gate 003-storyboard]')).toBe(true)
  for (const part of [SLUG, 'approve', 'tighten shot 3', 'shots[2].duration']) expect(prompt).toContain(part)
  expect(engine.readJson(`${GATES}/003-storyboard.json`).deliveredAt).toBe(new Date(START + 2000).toISOString())

  await engine.clock.advance(6000)
  expect(engine.submitted).toHaveLength(1)
})

test('清除暫存資料後重新開啟 session: a delivered reply is never sent again', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.openGate(SLUG, '003-storyboard', { deliveredAt: EARLIER })
  engine.writeJson(`${REPLIES}/003-storyboard.json`, REPLY)

  await startSession($)
  await engine.clock.advance(6000)

  expect(engine.submitted).toEqual([])
})

test('讀到寫一半的回覆檔: skips it and delivers on a later poll', async ($, on) => {
  const engine = fakeEngine(on)
  studioWorkspace(engine)
  engine.openGate(SLUG, '003-storyboard')
  await startSession($)

  engine.files.set(`${WORKSPACE}/${REPLIES}/003-storyboard.json`, '{ "decision": "appro')
  await engine.clock.advance(2000)
  expect(engine.submitted).toEqual([])
  expect(engine.readJson(`${GATES}/003-storyboard.json`).deliveredAt).toBeUndefined()

  engine.writeJson(`${REPLIES}/003-storyboard.json`, REPLY)
  await engine.clock.advance(2000)
  expect(engine.submitted).toHaveLength(1)
})
