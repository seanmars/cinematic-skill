import { expect, test } from 'claude-code/testing'
import { EARLIER, STUDIO_URL, WORKSPACE, fakeEngine, startSession } from './fake-engine'

// /studio and the studio's lifecycle (D12): the mod runs the launcher and the
// stop script, and decides when a session's end stops the studio.

const SESSION = 'baf24fd7-416c-4f59-806f-d89f9bf237db'
const OTHER = 'c71e09aa-5d2b-4c8e-9f11-3a4b5c6d7e8f'
const SLUG = 'lunelle-promo'
const STUDIO = `${WORKSPACE}/.claude/skills/cinematic-video/studio`
const START_ARGV = ['node', `${STUDIO}/start.mjs`, '--workspace', WORKSPACE]
const STOP_ARGV = ['node', `${STUDIO}/stop.mjs`, '--workspace', WORKSPACE]
const OPEN_GATE = 'mcp__cinematic-video__open_gate'

const launched = (status: string, url = STUDIO_URL) => ({
  exitCode: 0,
  stdout: `${JSON.stringify({ status, url, opened: status === 'started' })}\n`,
  stderr: '',
})

const end = (reason: string) => ({ reason, sessionId: SESSION, resume: { id: SESSION } }) as any

test('registers /studio in a studio workspace', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()

  await startSession($)

  expect(engine.commands).toEqual(['studio'])
})

test('在 workspace 啟動 studio: runs the launcher, reports the url and shows it in the status line', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.onProcess(argv => {
    engine.serveStudio()
    return launched('started')
  })
  await startSession($)

  const answer = await $.command.run({ command: 'studio', args: 'start' })

  expect(engine.processes).toEqual([START_ARGV])
  expect(answer.text).toContain(STUDIO_URL)
  expect(answer.text).toMatch(/browser/i)
  expect(engine.status.at(-1)).toBe(`studio baf24f · ${STUDIO_URL}`)
})

test('studio 已經在執行: reports the studio already serving the workspace', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  engine.onProcess(() => launched('running'))
  await startSession($)

  const answer = await $.command.run({ command: 'studio', args: 'start' })

  expect(answer.text).toMatch(/already running/i)
  expect(answer.text).toContain(STUDIO_URL)
})

test('a launcher that fails: passes its message on', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.onProcess(() => ({ exitCode: 1, stdout: '', stderr: 'studio: run pnpm install in that repo\n' }))
  await startSession($)

  const answer = await $.command.run({ command: 'studio', args: 'start' })

  expect(answer.text).toContain('run pnpm install in that repo')
  expect(engine.status.at(-1)).toBe('studio baf24f · not running')
})

test('status, also with no argument: says whether the studio runs and where', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  await startSession($)

  expect((await $.command.run({ command: 'studio' })).text).toMatch(/not running/i)
  engine.serveStudio()
  expect((await $.command.run({ command: 'studio', args: 'status' })).text).toContain(STUDIO_URL)
  expect(engine.processes).toEqual([])
})

test('還有其他線上 session 時停止: refuses and names the sessions', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  engine.writeSession(OTHER)
  await startSession($)

  const answer = await $.command.run({ command: 'studio', args: 'stop' })

  expect(engine.processes).toEqual([])
  expect(answer.text).toContain('c71e09')
  expect(answer.text).toContain('--force')
})

test('stop --force: stops the studio even with other sessions online', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  engine.writeSession(OTHER)
  engine.onProcess(() => {
    engine.stopServing()
    return { exitCode: 0, stdout: '{"status":"stopped"}\n', stderr: '' }
  })
  await startSession($)

  const answer = await $.command.run({ command: 'studio', args: 'stop --force' })

  expect(engine.processes).toEqual([STOP_ARGV])
  expect(answer.text).toMatch(/stopped/i)
  expect(engine.status.at(-1)).toBe('studio baf24f · not running')
})

test('stop as the only session: stops the studio; a crashed session does not count', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  engine.writeSession(OTHER, EARLIER)
  await startSession($)

  await $.command.run({ command: 'studio', args: 'stop' })

  expect(engine.processes).toEqual([STOP_ARGV])
})

test('最後一個 session 離開: stops the studio', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  await startSession($)

  await $.session.end(end('prompt_input_exit'))

  expect(engine.processes).toEqual([STOP_ARGV])
})

test('還有其他 session 時離開: leaves the studio running', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  engine.writeSession(OTHER)
  await startSession($)

  await $.session.end(end('prompt_input_exit'))

  expect(engine.processes).toEqual([])
})

test('執行 /clear, or a resume: leaves the studio running', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.serveStudio()
  await startSession($)

  await $.session.end(end('clear'))
  await $.session.end(end('resume'))

  expect(engine.processes).toEqual([])
})

test('a session ending in a workspace that never started the studio runs nothing', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  await startSession($)

  await $.session.end(end('prompt_input_exit'))

  expect(engine.processes).toEqual([])
})

test('the status line follows a studio another session starts or stops', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  await startSession($)
  expect(engine.status.at(-1)).toBe('studio baf24f · not running')

  engine.serveStudio()
  await engine.clock.advance(2000)
  expect(engine.status.at(-1)).toBe(`studio baf24f · ${STUDIO_URL}`)

  engine.stopServing()
  await engine.clock.advance(2000)
  expect(engine.status.at(-1)).toBe('studio baf24f · not running')
})

test('studio 沒有在執行時開 gate: the gate opens and Claude is told to remind the user', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.assign(SLUG, SESSION)
  await startSession($)

  const answer = await $.tool.call({ tool: OPEN_GATE, project: SLUG, stage: 'intake', payload: {} })

  expect(engine.readJson(`video/${SLUG}/studio/gates/001-intake.json`)).toBeDefined()
  expect(String(answer.result)).toContain('/studio start')
})

test('a gate opened while the studio runs carries no reminder', async ($, on) => {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.markStudio()
  engine.assign(SLUG, SESSION)
  engine.serveStudio()
  await startSession($)

  const answer = await $.tool.call({ tool: OPEN_GATE, project: SLUG, stage: 'intake', payload: {} })

  expect(String(answer.result)).not.toContain('/studio start')
})
