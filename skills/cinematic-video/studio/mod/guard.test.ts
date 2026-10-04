import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { type FakeEngine, fakeEngine, startSession } from './fake-engine'

const SLUG = 'lunelle-promo'
const STUDIO = `video/${SLUG}/studio`
const EARLIER = '2026-10-04T04:00:00.000Z'
const RENDER = `cd video/${SLUG} && uv run .claude/skills/cinematic-video/scripts/render.py index.html`
const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const
const FULL_RENDER = `${RENDER} out/picture.mp4 --size 1920x1080 --fps 30 --duration 8`

// A Build-stage project: storyboard of 8s, animatic approved, polish gate not yet.
function buildStage(engine: FakeEngine) {
  engine.writeJson('studio.config.json', { skillVersion: '0.1.0' })
  engine.writeJson(`video/${SLUG}/storyboard.json`, {
    shots: [{ duration: 1.786 }, { duration: 0.764 }, { duration: 3.164 }, { duration: 2.286 }],
  })
  engine.writeJson(`${STUDIO}/gates/005-build-animatic.json`, {
    gateId: '005-build-animatic',
    stage: 'build-animatic',
    openedAt: EARLIER,
    autoContinue: false,
    payload: {},
    deliveredAt: EARLIER,
  })
  engine.writeJson(`${STUDIO}/replies/005-build-animatic.json`, { decision: 'approve', notes: '', changes: [] })
}

function polishGate(engine: FakeEngine, extra: Record<string, unknown> = {}) {
  engine.writeJson(`${STUDIO}/gates/006-build-polish.json`, {
    gateId: '006-build-polish',
    stage: 'build-polish',
    openedAt: EARLIER,
    autoContinue: false,
    payload: {},
    ...extra,
  })
}

// Stands for the shell beneath the mod: records what actually ran.
function shell(on: On) {
  const ran: string[] = []
  for (const tool of ['Bash', 'PowerShell'] as const) {
    on('tool.call', { tool }, ($, e) => {
      ran.push(e.command)
      return { result: 'ok' }
    })
  }
  return ran
}

test('跳過精修 gate 直接 render: the full render is refused with a pointer to the gate', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  polishGate(engine)
  await startSession($)

  const answer = await $.tool.call({ tool: 'Bash', command: FULL_RENDER })

  expect(ran).toEqual([])
  expect(String(answer.deny ?? answer.text)).toMatch(/build-polish/)
  expect(String(answer.deny ?? answer.text)).toContain('open_gate')
})

test('the refusal holds for PowerShell too, and before the polish gate is even opened', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  await startSession($)

  await $.tool.call({ tool: 'PowerShell', command: FULL_RENDER })

  expect(ran).toEqual([])
})

test('渲染 stills: stills and seek tests run', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  await startSession($)

  const commands = [`${RENDER} qa/s3.png --still 4.2`, `${RENDER} out/check.mp4 --seek-test 1 7.5 --duration 8`]
  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('partial renders run', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  await startSession($)

  const commands = [`${RENDER} out/tail.mp4 --fps 30 --start 4 --duration 8`, `${RENDER} out/head.mp4 --fps 30 --duration 3`]
  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('auto-continue counts as approved', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  engine.writeJson(`${STUDIO}/settings.json`, { autoContinue: ['build-polish'] })
  await startSession($)

  await $.tool.call({ tool: 'Bash', command: FULL_RENDER })

  expect(ran).toEqual([FULL_RENDER])
})

test('an approved polish gate lets the full render run', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  polishGate(engine, { deliveredAt: EARLIER })
  engine.writeJson(`${STUDIO}/replies/006-build-polish.json`, { decision: 'approve', notes: '', changes: [] })
  await startSession($)

  await $.tool.call({ tool: 'Bash', command: FULL_RENDER })

  expect(ran).toEqual([FULL_RENDER])
})

test('prompt.compose adds the web-mode protocol', async ($, on) => {
  const engine = fakeEngine(on)
  engine.writeJson('studio.config.json', { skillVersion: '0.1.0' })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core prompt', scope: 'shared' }] }))
  await startSession($)

  const { sections } = await $.prompt.compose(COMPOSE)

  const protocol = sections.find(section => section.id === 'cinematic-video:web-mode')
  expect(protocol?.scope).toBe('session')
  expect(protocol?.text).toContain('mcp__cinematic-video__open_gate')
  expect(protocol?.text).toMatch(/overrides?/i)
  expect(protocol?.text).toMatch(/already handled/i)
})

test('no protocol and no guard without the workspace marker', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core prompt', scope: 'shared' }] }))
  await startSession($)

  const { sections } = await $.prompt.compose(COMPOSE)
  await $.tool.call({ tool: 'Bash', command: FULL_RENDER })

  expect(sections.map(section => section.id)).toEqual(['intro'])
  expect(ran).toEqual([FULL_RENDER])
  expect(engine.submitted).toEqual([])
})
