import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { EARLIER, type FakeEngine, fakeEngine, startSession } from './fake-engine'

const SLUG = 'lunelle-promo'
const STUDIO = `video/${SLUG}/studio`
const RENDER = `cd video/${SLUG} && uv run .claude/skills/cinematic-video/scripts/render.py index.html`
const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const
const FULL_RENDER = `${RENDER} out/picture.mp4 --size 1920x1080 --fps 30 --duration 8`

// A Build-stage project: storyboard of 8s, animatic approved, polish gate not yet.
function buildStage(engine: FakeEngine) {
  engine.markStudio()
  engine.writeJson(`video/${SLUG}/storyboard.json`, {
    shots: [{ duration: 1.786 }, { duration: 0.764 }, { duration: 3.164 }, { duration: 2.286 }],
  })
  engine.openGate(SLUG, '005-build-animatic', { deliveredAt: EARLIER })
  engine.reply(SLUG, '005-build-animatic')
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
  engine.openGate(SLUG, '006-build-polish')
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

test('run from the workspace root: the animatic in qa/ runs, the full render in out/ is refused', async ($, on) => {
  const engine = fakeEngine(on)
  const ran = shell(on)
  buildStage(engine)
  await startSession($)
  const script = 'uv run .claude/skills/cinematic-video/scripts/render.py'
  const animatic = `${script} video/${SLUG}/index.html video/${SLUG}/qa/animatic.mp4 --size 960x540 --fps 30 --duration 8`
  const full = `${script} video/${SLUG}/index.html video/${SLUG}/out/picture.mp4 --size 1920x1080 --fps 30 --duration 8`

  await $.tool.call({ tool: 'Bash', command: animatic })
  await $.tool.call({ tool: 'Bash', command: full })

  expect(ran).toEqual([animatic])
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
  engine.openGate(SLUG, '006-build-polish', { deliveredAt: EARLIER })
  engine.reply(SLUG, '006-build-polish')
  await startSession($)

  await $.tool.call({ tool: 'Bash', command: FULL_RENDER })

  expect(ran).toEqual([FULL_RENDER])
})

test('prompt.compose adds the web-mode protocol', async ($, on) => {
  const engine = fakeEngine(on)
  engine.markStudio()
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core prompt', scope: 'shared' }] }))
  await startSession($)

  const { sections } = await $.prompt.compose(COMPOSE)

  const protocol = sections.find(section => section.id === 'cinematic-video:web-mode')
  expect(protocol?.scope).toBe('session')
  expect(protocol?.text).toContain('mcp__cinematic-video__open_gate')
  expect(protocol?.text).toMatch(/overrides?/i)
  expect(protocol?.text).toMatch(/already handled/i)
  expect(protocol?.text).toMatch(/\[studio project <slug>\][^\n]*studio\/intake\.json/)
  expect(protocol?.text).toMatch(/video\/<slug>\/studio\/progress\.json[^\n]*not[^\n]*storyboard\.json/)
  expect(protocol?.text).toContain('--progress-file node_modules/.cinematic-studio/render/<slug>.json')
  expect(protocol?.text).toMatch(/shots\[<id>\]\.techniques[^\n]*free text[^\n]*code/)
  expect(protocol?.text).toMatch(/shots\[<id>\]\.duration[^\n]*time/)
  expect(protocol?.text).toMatch(/realign:audio\/plan\.json\[<row>\][^\n]*realign/)
  expect(protocol?.text).toMatch(/music-recut[^\n]*recut[^\n]*mix/)
  // The payload each gate's panel reads.
  for (const [stage, keys] of Object.entries({
    intake: ['questions', 'default'],
    treatments: ['treatments.json'],
    storyboard: ['critic'],
    assets: ['assets', 'critic', 'ledger'],
    'build-animatic': ['animatic', 'critic'],
    'build-polish': ['critic', 'renderEstimate'],
    audio: ['mix', 'loudness'],
    gauntlet: ['round', 'critic', 'measurements', 'reviewLog'],
    deliver: ['film', 'poster', 'notes', 'confirm'],
  })) {
    const line = protocol?.text.split('\n').find(candidate => candidate.trimStart().startsWith(`${stage}: {`))
    for (const key of keys) expect(line, `${stage} payload`).toContain(key)
  }
  // What each reply asks of Claude.
  for (const decision of ['revise', 'pick', 'mix', 'redo', 'regenerate', 'another-round', 'ship']) {
    expect(protocol?.text, decision).toMatch(new RegExp(`\\b${decision}\\b`))
  }
  expect(protocol?.text).toMatch(/choice[^\n]*treatments\.json[^\n]*chosen/)
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
