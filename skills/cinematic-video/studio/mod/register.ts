import type { EngineInterface, Register } from 'claude-code'

// Studio mod: loaded from the workspace's project-level skill folder, where
// init writes the manifest that names this module. It talks to the studio
// through files only (one writer per file, see schema/):
//   video/<slug>/studio/gates/<gateId>.json     written here
//   video/<slug>/studio/replies/<gateId>.json   written by the studio
//   node_modules/.cinematic-studio/assignments/<slug>.json   written by the studio
//   node_modules/.cinematic-studio/sessions/<sessionId>.json written here
//
// `$` may only be handed to functions declared at the top of this file, and
// module variables reset on every hot reload: whether a reply was delivered
// lives in the gate file (deliveredAt), and which project this session has
// taken over lives in its session file, never in memory alone.

const PLUGIN = 'cinematic-video'
const OPEN_GATE = 'open_gate'
const POLL_MS = 2000
const HEARTBEAT_MS = 5000
const STATE_DIR = 'node_modules/.cinematic-studio'
const STAGES = ['intake', 'treatments', 'storyboard', 'assets', 'build-animatic', 'build-polish', 'audio', 'gauntlet', 'deliver']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// The skill's render.py and what follows it up to the next shell separator.
const RENDER_CALL = /cinematic-video[\\/]scripts[\\/]render\.py\s+(.*?)(?:&&|\|\||;|\||$)/
const VIDEO_OUT = /(^|[\\/])out[\\/].+\.(mp4|mov|webm|mkv)$/i
// video/<slug>, but not the tail of .../cinematic-video/scripts.
const PROJECT_IN_COMMAND = /(?:^|[\s"'\\/])video[\\/]([a-z0-9]+(?:-[a-z0-9]+)*)(?=[\\/\s"']|$)/

const PROTOCOL = `# Cinematic video: web studio mode

This workspace runs the cinematic-video web studio. These rules override the skill's single approval gate in SKILL.md:

- End every stage with a gate: call mcp__cinematic-video__open_gate with the project slug, the stage and the payload the studio shows. The stages, in order: intake, treatments, storyboard, assets (only when the project has generated assets), build-animatic, build-polish (before the high-quality render), audio, gauntlet (every round), deliver.
- Unless the tool answers that the gate is approved (auto-continue), end your turn right after it. Do not start the next stage: the reply arrives as a new message starting with [studio gate <gateId>].
- A reply for a gateId you have already handled is a duplicate: ignore it.
- A reply lists the fields the user changed in the studio. Re-read those files (storyboard.json, treatments.json, audio/plan.json) before going on, and regenerate brief.md after storyboard.json changed.
- A message starting with [studio project <slug>] hands this session a project another session started: continue from the gate it names.
- The full high-quality render waits for an approved build-polish gate; stills, --seek-test and partial --start/--duration renders do not.`

type Gate = {
  gateId: string
  stage: string
  openedAt: string
  autoContinue: boolean
  payload: Record<string, unknown>
  deliveredAt?: string
}

type Reply = { decision: string; notes: string; changes: string[] }

type Assignment = { slug: string; sessionId: string; assignedAt: string; reason: string }

type Session = {
  sessionId: string
  shortId: string
  startedAt: string
  heartbeatAt: string
  online: boolean
  project: string | null
}

type GateInput = { project?: unknown; stage?: unknown; payload?: unknown }

type RenderCall = { output: string | undefined; isStillOrSeek: boolean; start: number; duration: number }

// prompt.submit resolves only once the session is idle, so a poll can outlast
// the interval; overlapping polls would send the same reply twice.
let isPolling = false

let session: Session | undefined

// A heartbeat that fires after session.end must not bring the session back
// online.
let endedSessionId: string | undefined

function toJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function isReply(value: unknown): value is Reply {
  return typeof value === 'object' && value !== null && typeof (value as Reply).decision === 'string'
}

async function readJson($: EngineInterface, path: string): Promise<any> {
  try {
    return JSON.parse((await $.fs.read(path)) as string)
  } catch {
    return undefined // missing, or caught half-written: the next poll reads it again
  }
}

async function jsonFiles($: EngineInterface, dir: string): Promise<string[]> {
  try {
    const entries = await $.fs.list(dir)
    return entries.filter(entry => entry.kind === 'file' && entry.name.endsWith('.json')).map(entry => entry.name).sort()
  } catch {
    return []
  }
}

async function now($: EngineInterface) {
  return new Date(await $.clock.now()).toISOString()
}

async function nextGateNumber($: EngineInterface, studio: string) {
  const numbers = (await jsonFiles($, `${studio}/gates`)).map(name => Number.parseInt(name.slice(0, 3), 10))
  return Math.max(0, ...numbers.filter(Number.isFinite)) + 1
}

async function isAutoContinue($: EngineInterface, studio: string, stage: string) {
  const settings = await readJson($, `${studio}/settings.json`)
  return Array.isArray(settings?.autoContinue) && settings.autoContinue.includes(stage)
}

async function openGate($: EngineInterface, input: GateInput) {
  const { project, stage, payload } = input
  if (typeof project !== 'string' || !SLUG.test(project)) return { deny: `${PLUGIN}: project must be a slug under video/` }
  if (typeof stage !== 'string' || !STAGES.includes(stage)) return { deny: `${PLUGIN}: stage must be one of ${STAGES.join(', ')}` }

  const studio = `${await $.session.root()}/video/${project}/studio`
  const autoContinue = await isAutoContinue($, studio, stage)
  const gateId = `${String(await nextGateNumber($, studio)).padStart(3, '0')}-${stage}`
  const gate: Gate = { gateId, stage, openedAt: await now($), autoContinue, payload: (payload ?? {}) as Gate['payload'] }
  await $.fs.write(`${studio}/gates/${gateId}.json`, toJson(gate))

  return {
    result: autoContinue
      ? `Gate ${gateId} is approved: ${stage} is set to auto-continue. Go on to the next stage.`
      : `Gate ${gateId} is open in the studio. End your turn now and wait; do not start the next stage. ` +
        `The user's reply arrives as a new message starting with [studio gate ${gateId}].`,
  }
}

function wakePrompt(project: string, gate: Gate, reply: Reply) {
  const changes = reply.changes?.length ? reply.changes.join(', ') : '(none)'
  return [
    `[studio gate ${gate.gateId}] The user replied to the ${gate.stage} gate of ${project}.`,
    `decision: ${reply.decision}`,
    `notes: ${reply.notes || '(none)'}`,
    `changes: ${changes}`,
    `If you have already handled gate ${gate.gateId}, ignore this message.`,
  ].join('\n')
}

function continuePrompt(project: string, currentGate: string | undefined) {
  const head = `[studio project ${project}] This session now holds ${project}, reassigned from another session.`
  return currentGate === undefined
    ? `${head} Pick the project up from its files under video/${project}/.`
    : `${head} Continue from gate ${currentGate}: read video/${project}/studio/ and the project files to see ` +
        'where the previous session stopped. A reply to that gate, if any, follows as its own message.'
}

function sessionPath(root: string, sessionId: string) {
  return `${root}/${STATE_DIR}/sessions/${sessionId}.json`
}

// After a hot reload the session file already exists: keep when the session
// started and which project it took over.
async function openSession($: EngineInterface, root: string, sessionId: string): Promise<Session> {
  const saved: Session | undefined = await readJson($, sessionPath(root, sessionId))
  const isSame = saved?.sessionId === sessionId
  const startedAt = isSame ? saved.startedAt : await now($)
  return { sessionId, shortId: sessionId.slice(0, 6), startedAt, heartbeatAt: startedAt, online: true, project: isSame ? saved.project : null }
}

async function writeSession($: EngineInterface, root: string, current: Session) {
  await $.fs.write(sessionPath(root, current.sessionId), toJson(current))
}

async function heartbeat($: EngineInterface, root: string) {
  const sessionId = await $.session.id()
  if (sessionId === endedSessionId) return
  // A /clear goes on under a new session id.
  if (session?.sessionId !== sessionId) session = await openSession($, root, sessionId)
  session.heartbeatAt = await now($)
  session.online = true
  await writeSession($, root, session)
}

async function assignmentsFor($: EngineInterface, root: string) {
  const sessionId = await $.session.id()
  const dir = `${root}/${STATE_DIR}/assignments`
  const assignments: Assignment[] = []
  for (const name of await jsonFiles($, dir)) {
    const assignment = await readJson($, `${dir}/${name}`)
    if (assignment?.sessionId === sessionId && SLUG.test(assignment.slug)) assignments.push(assignment)
  }
  return assignments
}

// The first poll that sees a project assigned here takes it over; a project
// reassigned from another session also wakes Claude to pick up its current gate.
// Submit first, then record, as with replies.
async function takeOver($: EngineInterface, root: string, assignment: Assignment) {
  if (session === undefined || session.project === assignment.slug) return
  if (assignment.reason === 'reassign') {
    const gates = await jsonFiles($, `${root}/video/${assignment.slug}/studio/gates`)
    await $.prompt.submit({ text: continuePrompt(assignment.slug, gates.at(-1)?.replace(/\.json$/, '')) })
  }
  session.project = assignment.slug
  await writeSession($, root, session)
}

// Submit first, then record deliveredAt: a crash in between costs a duplicate
// (which the gateId lets Claude recognise), never a lost reply.
async function deliverReplies($: EngineInterface, root: string, project: string) {
  const studio = `${root}/video/${project}/studio`
  for (const name of await jsonFiles($, `${studio}/replies`)) {
    const gatePath = `${studio}/gates/${name}`
    const gate: Gate | undefined = await readJson($, gatePath)
    if (gate === undefined || gate.autoContinue || gate.deliveredAt !== undefined) continue
    const reply = await readJson($, `${studio}/replies/${name}`)
    if (!isReply(reply)) continue
    await $.prompt.submit({ text: wakePrompt(project, gate, reply) })
    await $.fs.write(gatePath, toJson({ ...gate, deliveredAt: await now($) }))
  }
}

function parseRender(command: string): RenderCall | undefined {
  const args = RENDER_CALL.exec(command)?.[1]
  if (args === undefined) return undefined
  const [, output] = args.trim().split(/\s+/) // render.py <page> <out> [options]
  return {
    output: output?.replace(/^["']|["']$/g, ''),
    isStillOrSeek: /--(still|seek-test)\b/.test(args),
    start: Number(/--start[=\s]+([\d.]+)/.exec(args)?.[1] ?? 0),
    duration: Number(/--duration[=\s]+([\d.]+)/.exec(args)?.[1] ?? Number.NaN),
  }
}

async function filmLength($: EngineInterface, root: string, project: string) {
  const storyboard = await readJson($, `${root}/video/${project}/storyboard.json`)
  if (!Array.isArray(storyboard?.shots)) return undefined
  return storyboard.shots.reduce((total: number, shot: { duration?: unknown }) => total + Number(shot.duration), 0)
}

// Full only when it is known to be: a film whose length cannot be read is let
// through, as the narrow rule is the one that never blocks the wrong render.
async function isFullRender($: EngineInterface, root: string, project: string, call: RenderCall) {
  if (call.isStillOrSeek || call.output === undefined || !VIDEO_OUT.test(call.output) || call.start > 0) return false
  const length = await filmLength($, root, project)
  return length !== undefined && call.duration >= length - 0.05
}

async function isPolishApproved($: EngineInterface, studio: string) {
  if (await isAutoContinue($, studio, 'build-polish')) return true
  const latest = (await jsonFiles($, `${studio}/gates`)).filter(name => name.endsWith('-build-polish.json')).at(-1)
  if (latest === undefined) return false
  const gate: Gate | undefined = await readJson($, `${studio}/gates/${latest}`)
  const reply = await readJson($, `${studio}/replies/${latest}`)
  return gate?.autoContinue === true || reply?.decision === 'approve'
}

async function renderRefusal($: EngineInterface, command: string) {
  if (session === undefined) return undefined
  const call = parseRender(command)
  const project = PROJECT_IN_COMMAND.exec(command)?.[1] ?? session.project
  if (call === undefined || project === null) return undefined
  const root = await $.session.root()
  if (!(await isFullRender($, root, project, call))) return undefined
  if (await isPolishApproved($, `${root}/video/${project}/studio`)) return undefined
  return (
    `${PLUGIN}: the full high-quality render of ${project} waits for the build-polish gate. ` +
    'Call mcp__cinematic-video__open_gate with stage "build-polish" and end your turn; ' +
    'stills, --seek-test and partial --start/--duration renders are not blocked.'
  )
}

async function poll($: EngineInterface) {
  if (isPolling) return
  isPolling = true
  try {
    const root = await $.session.root()
    for (const assignment of await assignmentsFor($, root)) {
      await takeOver($, root, assignment)
      await deliverReplies($, root, assignment.slug)
    }
  } finally {
    isPolling = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Web mode only where init left its marker, even if a manifest ever
    // reached a global copy of the skill.
    const root = await $.session.root()
    if (!(await $.fs.exists(`${root}/studio.config.json`))) return next(e)

    session = await openSession($, root, await $.session.id())
    await writeSession($, root, session)
    $.ui.status(`studio ${session.shortId}`)

    await $.tool.register({
      name: OPEN_GATE,
      description:
        'Open a stage gate in the web studio. Call it at the end of every stage with the project slug, ' +
        'the stage, and the payload the studio shows. Unless the stage is set to auto-continue, end your ' +
        'turn right after: the reply arrives later as a new message starting with [studio gate <gateId>].',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'The project slug: the folder name under video/.' },
          stage: { type: 'string', enum: STAGES },
          payload: { type: 'object', description: 'What the studio shows for this stage.' },
        },
        required: ['project', 'stage', 'payload'],
      },
    })
    $.clock.every(POLL_MS, () => {
      void poll($)
    })
    // On its own timer, so a render that runs for minutes never starves it.
    $.clock.every(HEARTBEAT_MS, () => {
      void heartbeat($, root)
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (session?.sessionId === e.sessionId) {
      endedSessionId = e.sessionId
      await writeSession($, await $.session.root(), { ...session, heartbeatAt: await now($), online: false })
    }
    return next(e)
  })

  // The protocol rides the mod, so a stale global SKILL.md cannot override it.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (session === undefined) return composed
    return { sections: [...composed.sections, { id: `${PLUGIN}:web-mode`, text: PROTOCOL, scope: 'session' }] }
  })

  on('tool.call', { tool: 'mcp__cinematic-video__open_gate' }, ($, e) => openGate($, e as GateInput))

  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    const refusal = await renderRefusal($, e.command)
    return refusal === undefined ? next(e) : { deny: refusal }
  })
}
