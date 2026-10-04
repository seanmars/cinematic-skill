import { expect, test } from 'claude-code/testing'
import { EARLIER, START, fakeEngine, iso, startSession } from './fake-engine'

const SESSION = 'baf24fd7-416c-4f59-806f-d89f9bf237db'
const SLUG = 'lunelle-promo'
const STUDIO = `video/${SLUG}/studio`
const SESSION_FILE = `node_modules/.cinematic-studio/sessions/${SESSION}.json`
test('同一個 workspace 有兩個 session: only the assigned session is woken', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.assign(SLUG, 'another-session')
  engine.openGate(SLUG, '003-storyboard')
  engine.reply(SLUG, '003-storyboard')

  await startSession($)
  await engine.clock.advance(6000)

  expect(engine.submitted).toEqual([])
  expect(engine.readJson(`${STUDIO}/gates/003-storyboard.json`).deliveredAt).toBeUndefined()
})

test('重新指派給新的 session: wakes it to continue the current gate, then delivers the reply', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.openGate(SLUG, '002-treatments', { deliveredAt: EARLIER })
  engine.openGate(SLUG, '003-storyboard')
  engine.reply(SLUG, '003-storyboard')
  engine.assign(SLUG, 'offline-session')
  await startSession($)
  await engine.clock.advance(2000)
  expect(engine.submitted).toEqual([])

  engine.assign(SLUG, SESSION, 'reassign')
  await engine.clock.advance(2000)

  expect(engine.submitted).toHaveLength(2)
  expect(engine.submitted[0]).toMatch(/^\[studio project lunelle-promo\]/)
  expect(engine.submitted[0]).toContain('003-storyboard')
  expect(engine.submitted[1]).toMatch(/^\[studio gate 003-storyboard\]/)
  expect(engine.readJson(SESSION_FILE).project).toBe(SLUG)

  await engine.clock.advance(6000)
  expect(engine.submitted).toHaveLength(2)
})

test('a reloaded mod does not repeat the continuation', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.openGate(SLUG, '003-storyboard', { deliveredAt: EARLIER })
  engine.assign(SLUG, SESSION, 'reassign')
  engine.writeJson(SESSION_FILE, {
    sessionId: SESSION,
    shortId: 'baf24f',
    startedAt: EARLIER,
    heartbeatAt: EARLIER,
    online: true,
    project: SLUG,
  })

  await startSession($)
  await engine.clock.advance(6000)

  expect(engine.submitted).toEqual([])
  expect(engine.readJson(SESSION_FILE).startedAt).toBe(EARLIER)
})

test('只有一個線上 session: an Intake sent from the studio wakes Claude to start it', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.writeJson(`${STUDIO}/intake.json`, { slug: SLUG, brief: 'A kettle that sings the morning news' })
  await startSession($)

  engine.assign(SLUG, SESSION, 'intake')
  await engine.clock.advance(2000)

  expect(engine.submitted).toHaveLength(1)
  expect(engine.submitted[0]).toMatch(/^\[studio project lunelle-promo\]/)
  expect(engine.submitted[0]).toContain(`video/${SLUG}/studio/intake.json`)
  expect(engine.readJson(SESSION_FILE).project).toBe(SLUG)

  await engine.clock.advance(6000)
  expect(engine.submitted).toHaveLength(1)
})

test('an intake assignment does not restart Intake once the project has gates', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.writeJson(`${STUDIO}/intake.json`, { slug: SLUG, brief: 'A kettle' })
  engine.openGate(SLUG, '001-intake', { deliveredAt: EARLIER })
  engine.assign(SLUG, SESSION, 'intake')

  await startSession($)
  await engine.clock.advance(2000)

  expect(engine.submitted).toEqual([])
  expect(engine.readJson(SESSION_FILE).project).toBe(SLUG)
})

test('writes the session file and shows the short id in the status line', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.assign(SLUG, SESSION)

  await startSession($)
  await engine.clock.advance(2000)

  expect(engine.readJson(SESSION_FILE)).toEqual({
    sessionId: SESSION,
    shortId: 'baf24f',
    startedAt: iso(START),
    heartbeatAt: iso(START),
    online: true,
    project: SLUG,
    activity: [],
  })
  expect(engine.status.at(-1)).toContain('baf24f')
})

test('session 正常結束: marks the session file offline at once', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  await startSession($)

  await $.session.end({ reason: 'prompt_input_exit', sessionId: SESSION, resume: { id: SESSION } })

  expect(engine.readJson(SESSION_FILE).online).toBe(false)
})

test('長時間 render 期間: the heartbeat keeps going while a tool runs', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  on('tool.call', { tool: 'Bash' }, async () => {
    await engine.clock.sleep(120_000)
    return { result: 'done' }
  })
  await startSession($)

  const job = $.tool.call({ tool: 'Bash', command: 'uv run scripts/long_job.py' })
  await engine.clock.advance(30_000)

  expect(engine.readJson(SESSION_FILE)).toMatchObject({ heartbeatAt: iso(START + 30_000), online: true })
  await engine.clock.advance(90_000)
  await job
})
