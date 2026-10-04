import { expect, test } from 'claude-code/testing'
import { START, fakeEngine, startSession } from './fake-engine'

const SESSION = 'baf24fd7-416c-4f59-806f-d89f9bf237db'
const SESSION_FILE = `node_modules/.cinematic-studio/sessions/${SESSION}.json`
const RENDER =
  'uv run .claude/skills/cinematic-video/scripts/render.py video/demo/index.html video/demo/out/final.mp4 --fps 30'

const iso = (ms: number) => new Date(ms).toISOString()

function studioSession(on: Parameters<typeof fakeEngine>[0]) {
  const engine = fakeEngine(on, { sessionId: SESSION })
  engine.writeJson('studio.config.json', { skillVersion: '0.1.0' })
  return engine
}

test('Claude 派出 critic: the activity log shows the subagent while it runs, then when it ended', async ($, on) => {
  const engine = studioSession(on)
  on('tool.call', { tool: 'Agent' }, async () => {
    await engine.clock.sleep(30_000)
    return { result: 'critic report' }
  })
  await startSession($)

  const job = $.tool.call({
    tool: 'Agent',
    description: 'storyboard critic',
    subagent_type: 'general-purpose',
    prompt: 'Review the storyboard against the brief.',
  })
  await engine.clock.advance(1000)

  expect(engine.readJson(SESSION_FILE).activity).toEqual([
    { tool: 'Agent', summary: 'storyboard critic', startedAt: iso(START), endedAt: null },
  ])

  await engine.clock.advance(30_000)
  await job
  expect(engine.readJson(SESSION_FILE).activity).toEqual([
    { tool: 'Agent', summary: 'storyboard critic', startedAt: iso(START), endedAt: iso(START + 30_000) },
  ])
})

test('sums up a shell call by its command and script, any other tool by its name', async ($, on) => {
  const engine = studioSession(on)
  on('tool.call', { tool: ['Bash', 'Read'] }, () => ({ result: 'ok' }))
  await startSession($)

  await $.tool.call({ tool: 'Bash', command: RENDER })
  await $.tool.call({ tool: 'Bash', command: 'git status' })
  await $.tool.call({ tool: 'Read', file_path: 'video/demo/storyboard.json' })

  expect(engine.readJson(SESSION_FILE).activity.map((entry: { summary: string }) => entry.summary)).toEqual([
    'uv render.py',
    'git',
    'Read',
  ])
})

test('keeps the 50 latest calls', async ($, on) => {
  const engine = studioSession(on)
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }))
  await startSession($)

  for (let call = 0; call < 55; call++) {
    await $.tool.call({ tool: 'Read', file_path: `notes-${call}.md` })
    await engine.clock.advance(1000)
  }

  const activity = engine.readJson(SESSION_FILE).activity
  expect(activity).toHaveLength(50)
  expect(activity[0].startedAt).toBe(iso(START + 5000))
  expect(activity.at(-1).startedAt).toBe(iso(START + 54_000))
})

test('logs a call the render guard refuses, too', async ($, on) => {
  const engine = studioSession(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'rendered' }))
  engine.writeJson('video/demo/storyboard.json', { shots: [{ duration: 8 }] })
  await startSession($)

  const answer = await $.tool.call({ tool: 'Bash', command: `${RENDER} --duration 8` })

  expect(answer.deny).toMatch(/build-polish/)
  expect(engine.readJson(SESSION_FILE).activity).toMatchObject([{ tool: 'Bash', summary: 'uv render.py' }])
  expect(engine.readJson(SESSION_FILE).activity[0].endedAt).not.toBeNull()
})
