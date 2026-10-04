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
const ACTIVITY_LIMIT = 50
const STAGES = ['intake', 'treatments', 'storyboard', 'assets', 'build-animatic', 'build-polish', 'audio', 'gauntlet', 'deliver']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// /studio (D12): the launcher and the stop script beside this mod, run with
// Node. An install on the first start can take minutes.
const STUDIO_COMMAND = 'studio'
const SKILL_STUDIO = '.claude/skills/cinematic-video/studio'
const LAUNCH_TIMEOUT_MS = 600_000
const STATUS_MS = 2000
// The studio's own rule (server/sessions.mjs): three missed heartbeats and a
// session counts as gone.
const OFFLINE_AFTER_MS = 15_000
// The person left, logged out, or the process got a signal. A /clear or a
// resume goes on in the same process, so the studio stays.
const STOP_ON_END = ['prompt_input_exit', 'logout', 'other']
const STUDIO_USAGE = 'Usage: /studio start | stop [--force] | status'
const STUDIO_NOT_RUNNING = 'The studio is not running: tell the user to run /studio start to answer this gate.'

// The skill's render.py and what follows it up to the next shell separator.
const RENDER_CALL = /cinematic-video[\\/]scripts[\\/]render\.py\s+(.*?)(?:&&|\|\||;|\||$)/
const VIDEO_OUT = /(^|[\\/])out[\\/].+\.(mp4|mov|webm|mkv)$/i
// video/<slug>, but not the tail of .../cinematic-video/scripts.
const PROJECT_IN_COMMAND = /(?:^|[\s"'\\/])video[\\/]([a-z0-9]+(?:-[a-z0-9]+)*)(?=[\\/\s"']|$)/
// The script a shell command runs, for the activity log.
const SCRIPT_IN_COMMAND = /[\w.-]+\.(?:py|mjs|cjs|js|ts|sh|ps1)\b/

const PROTOCOL = `# Cinematic video: web studio mode

This workspace runs the cinematic-video web studio. These rules override the skill's single approval gate in SKILL.md:

- End every stage with a gate: call mcp__cinematic-video__open_gate with the project slug, the stage and the payload the studio shows. The stages, in order: intake, treatments, storyboard, assets (only when the project has generated assets), build-animatic, build-polish (before the high-quality render), audio, gauntlet (every round), deliver.
- Unless the tool answers that the gate is approved (auto-continue), end your turn right after it. Do not start the next stage: the reply arrives as a new message starting with [studio gate <gateId>].
- A reply for a gateId you have already handled is a duplicate: ignore it.
- A reply lists the fields the user changed in the studio. Re-read those files (storyboard.json, treatments.json, audio/plan.json) before going on, and regenerate brief.md after storyboard.json changed.
- A changed shots[<id>].techniques slot or shots[<id>].tags states the user's intent: rewrite that shot's free text (Picture, Camera, Transition as needed) and its code to match the new technique. A changed shots[<id>].text field: bring that shot's code in line with the new text.
- A changed shots[<id>].duration means the studio already moved every later shot: update the time points in the code and in the shots' text to the new timing. audio/plan.json[<row>].time entries are cues it already moved by exactly the difference; leave them.
- realign:audio/plan.json[<row>] is a cue inside the shot whose duration changed, left where it was: realign it to the shot's new action and rewrite its time in audio/plan.json.
- music-recut means the film's length changed under a score: recut the music to the new timing, then mix again.
- A message starting with [studio project <slug>] hands this session a project. A new one sent from the studio: start Intake from video/<slug>/studio/intake.json. One another session started: continue from the gate it names.
- The full high-quality render waits for an approved build-polish gate; stills, --seek-test, partial --start/--duration renders and the animatic (render it whole to qa/animatic.mp4, not out/) do not.
- During Build, keep video/<slug>/studio/progress.json current as each shot moves on, not storyboard.json: {"shots": {"<shot id>": {"status": "building" | "done", "stills": ["<path relative to the project>", ...]}}} (the skill's schema/progress.schema.json).
- Every render.py video render (not --still or --seek-test) adds --progress-file node_modules/.cinematic-studio/render/<slug>.json, so the studio can show frames done and time left.

## Gate payloads

Each gate's payload is what its studio panel shows. Reports are markdown text; files are paths relative to the project folder.
  intake: {"questions": [{"question": "...", "default": "..."}]} (at most 3; the default you will use if the user leaves it empty)
  treatments: {} (the panel reads treatments.json and each option's preview)
  storyboard: {"critic": "<storyboard critic report>"}
  assets: {"assets": ["<generated file>", ...], "critic": "<asset critic report>", "ledger": "source/ledger.md"}
  build-animatic: {"animatic": "<the 960x540 animatic>", "critic": "<component critic report; stylized: your own stills check>"}
  build-polish: {"critic": "<component critic results; stylized: your own stills check>", "renderEstimate": "<time the full render will take>"}
  audio: {"mix": "<the mix>", "loudness": "<loudness report>"}
  gauntlet: {"round": <n>, "critic": "<what the critics found>", "measurements": "<frozen time and loudness>", "reviewLog": "qa/review_log.md"}
  deliver: {"film": "out/final.mp4", "poster": "<the poster>", "notes": "<delivery notes>", "confirm": ["<fact the user must confirm>", ...]}

## Replies

- approve: the stage is done; go on. At build-polish it also starts the full render; at deliver it closes the project.
- revise: rework this stage as the notes say, then open its gate again. v1 never goes back a stage: a wish about an earlier one (another treatment's grade, say) comes as notes on the current stage; judge how much to redo and say what changed at the next gate.
- pick and mix carry a choice: {"id"} picks a treatment; {"id", "mix": [{"option", "element"}]} builds on one and takes elements from others. Record the choice in treatments.json chosen, then go on to the storyboard.
- redo: write three new treatments from the notes and open the treatments gate again.
- regenerate carries a choice {"regenerate": [<files>]}: make those assets again, then open the assets gate again.
- another-round may carry a choice {"priorities": [...]}: run another Gauntlet round with those first. ship: the film is done; go on to deliver.`

type Gate = {
  gateId: string
  stage: string
  openedAt: string
  autoContinue: boolean
  payload: Record<string, unknown>
  deliveredAt?: string
}

// choice: what a deciding reply chose (a treatment, a mix, priorities,
// assets to regenerate); see schema/reply.schema.json.
type Reply = { decision: string; notes: string; changes: string[]; choice?: unknown }

type Assignment = { slug: string; sessionId: string; assignedAt: string; reason: string }

type Activity = { tool: string; summary: string; startedAt: string; endedAt: string | null }

type Session = {
  sessionId: string
  shortId: string
  startedAt: string
  heartbeatAt: string
  online: boolean
  project: string | null
  activity: Activity[]
}

type GateInput = { project?: unknown; stage?: unknown; payload?: unknown }

type ToolCall = { tool: string; command?: unknown; description?: unknown }

type RenderCall = { output: string | undefined; isStillOrSeek: boolean; start: number; duration: number }

// What the studio writes in server.json once it listens (D12).
type Server = { pid: number; url: string }

// prompt.submit resolves only once the session is idle, so a poll can outlast
// the interval; overlapping polls would send the same reply twice.
let isPolling = false

let session: Session | undefined

// A heartbeat that fires after session.end must not bring the session back
// online.
let endedSessionId: string | undefined

// The status line as last shown, so a refresh that finds nothing new leaves
// it alone; a refresh still waiting on the studio is not overlapped.
let statusText: string | undefined
let isRefreshing = false

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

  const root = await $.session.root()
  const studio = `${root}/video/${project}/studio`
  const autoContinue = await isAutoContinue($, studio, stage)
  const gateId = `${String(await nextGateNumber($, studio)).padStart(3, '0')}-${stage}`
  const gate: Gate = { gateId, stage, openedAt: await now($), autoContinue, payload: (payload ?? {}) as Gate['payload'] }
  await $.fs.write(`${studio}/gates/${gateId}.json`, toJson(gate))

  if (autoContinue) return { result: `Gate ${gateId} is approved: ${stage} is set to auto-continue. Go on to the next stage.` }
  const reminder = (await servingStudio($, root)) === undefined ? ` ${STUDIO_NOT_RUNNING}` : ''
  return {
    result:
      `Gate ${gateId} is open in the studio. End your turn now and wait; do not start the next stage. ` +
      `The user's reply arrives as a new message starting with [studio gate ${gateId}].${reminder}`,
  }
}

function wakePrompt(project: string, gate: Gate, reply: Reply) {
  const changes = reply.changes?.length ? reply.changes.join(', ') : '(none)'
  return [
    `[studio gate ${gate.gateId}] The user replied to the ${gate.stage} gate of ${project}.`,
    `decision: ${reply.decision}`,
    ...(reply.choice === undefined ? [] : [`choice: ${JSON.stringify(reply.choice)}`]),
    `notes: ${reply.notes || '(none)'}`,
    `changes: ${changes}`,
    `If you have already handled gate ${gate.gateId}, ignore this message.`,
  ].join('\n')
}

function intakePrompt(project: string) {
  return (
    `[studio project ${project}] The user started ${project} in the studio. Read video/${project}/studio/intake.json ` +
    '(their brief, specs, profile and local paths to brand and assets) and run Intake; end it with the intake gate.'
  )
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
// started, which project it took over and what it has been doing.
async function openSession($: EngineInterface, root: string, sessionId: string): Promise<Session> {
  const saved: Session | undefined = await readJson($, sessionPath(root, sessionId))
  const isSame = saved?.sessionId === sessionId
  const startedAt = isSame ? saved.startedAt : await now($)
  return {
    sessionId,
    shortId: sessionId.slice(0, 6),
    startedAt,
    heartbeatAt: startedAt,
    online: true,
    project: isSame ? saved.project : null,
    activity: isSame && Array.isArray(saved.activity) ? saved.activity : [],
  }
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

// The first poll that sees a project assigned here takes it over. A project
// reassigned from another session wakes Claude to pick up its current gate; an
// Intake sent from the studio, with no gate yet, wakes it to start Intake.
// Submit first, then record, as with replies.
async function takeOver($: EngineInterface, root: string, assignment: Assignment) {
  if (session === undefined || session.project === assignment.slug) return
  const studio = `${root}/video/${assignment.slug}/studio`
  const gates = await jsonFiles($, `${studio}/gates`)
  if (assignment.reason === 'reassign') {
    await $.prompt.submit({ text: continuePrompt(assignment.slug, gates.at(-1)?.replace(/\.json$/, '')) })
  } else if (assignment.reason === 'intake' && gates.length === 0 && (await $.fs.exists(`${studio}/intake.json`))) {
    await $.prompt.submit({ text: intakePrompt(assignment.slug) })
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

// A shell call reads as its first word and the script it runs, a subagent as
// what it is for, any other tool as its name.
function summarize(call: ToolCall) {
  if (call.tool === 'Bash' || call.tool === 'PowerShell') {
    const command = String(call.command ?? '').trim()
    const script = SCRIPT_IN_COMMAND.exec(command)?.[0]
    const first = command.split(/\s+/)[0] ?? ''
    return script === undefined ? first : `${first} ${script}`
  }
  if (call.tool === 'Agent' && typeof call.description === 'string') return call.description
  return call.tool
}

// What Claude is doing, for the studio (D8): every tool call's start, then its
// end, in this session's file. Written whether the call runs or is refused.
async function logActivity<T>($: EngineInterface, call: ToolCall, run: () => T | Promise<T>): Promise<T> {
  if (session === undefined) return run()
  const root = await $.session.root()
  const entry: Activity = { tool: call.tool, summary: summarize(call), startedAt: await now($), endedAt: null }
  session.activity = [...session.activity, entry].slice(-ACTIVITY_LIMIT)
  await writeSession($, root, session)
  try {
    return await run()
  } finally {
    entry.endedAt = await now($)
    await writeSession($, root, session)
  }
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

// server.json names the studio last started here; it still serves the
// workspace only while the process answering at its URL is that same one
// (D12), the check start.mjs and stop.mjs make too.
async function servingStudio($: EngineInterface, root: string): Promise<Server | undefined> {
  const server = await readJson($, `${root}/${STATE_DIR}/server.json`)
  if (typeof server?.url !== 'string') return undefined
  try {
    const response = await $.http.fetch(`${server.url.replace(/\/$/, '')}/api/studio`)
    return JSON.parse(response.text).pid === server.pid ? server : undefined
  } catch {
    return undefined
  }
}

// The short ids of the other sessions here that are online by the studio's
// own rule; a crashed one stops counting once its heartbeat is stale.
async function otherOnlineSessions($: EngineInterface, root: string) {
  const sessionId = await $.session.id()
  const nowMs = await $.clock.now()
  const dir = `${root}/${STATE_DIR}/sessions`
  const shortIds: string[] = []
  for (const name of await jsonFiles($, dir)) {
    const other: Session | undefined = await readJson($, `${dir}/${name}`)
    if (other === undefined || other.sessionId === sessionId || other.online !== true) continue
    if (nowMs - Date.parse(other.heartbeatAt) < OFFLINE_AFTER_MS) shortIds.push(other.shortId)
  }
  return shortIds
}

function runStudioScript($: EngineInterface, root: string, script: string, timeoutMs?: number) {
  return $.process.run(['node', `${root}/${SKILL_STUDIO}/${script}`, '--workspace', root], { timeoutMs })
}

async function refreshStatus($: EngineInterface, root: string) {
  if (session === undefined || isRefreshing) return
  isRefreshing = true
  try {
    const server = await servingStudio($, root)
    const text = `studio ${session.shortId} · ${server?.url ?? 'not running'}`
    if (text !== statusText) {
      statusText = text
      $.ui.status(text)
    }
  } finally {
    isRefreshing = false
  }
}

async function startStudio($: EngineInterface, root: string) {
  try {
    const result = await runStudioScript($, root, 'start.mjs', LAUNCH_TIMEOUT_MS)
    if (result.exitCode !== 0) return `The studio did not start.\n${result.stderr.trim()}`
    const { status, url, opened } = JSON.parse(result.stdout)
    if (status === 'running') return `The studio is already running at ${url}`
    return `The studio is running at ${url}${opened ? ' (opened in your browser)' : ''}`
  } catch (error) {
    return `The studio did not start: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function stopStudio($: EngineInterface, root: string, isForced: boolean) {
  const server = await servingStudio($, root)
  if (server === undefined) return 'The studio is not running.'
  const others = await otherOnlineSessions($, root)
  if (others.length > 0 && !isForced) {
    return (
      `Sessions ${others.join(', ')} are still online here and may be using the studio at ${server.url}. ` +
      'Run /studio stop --force to stop it anyway.'
    )
  }
  const result = await runStudioScript($, root, 'stop.mjs')
  return result.exitCode === 0 ? `The studio at ${server.url} is stopped.` : `The studio could not be stopped.\n${result.stderr.trim()}`
}

async function studioStatus($: EngineInterface, root: string) {
  const server = await servingStudio($, root)
  return server === undefined ? 'The studio is not running. Start it with /studio start.' : `The studio is running at ${server.url}`
}

async function runStudioCommand($: EngineInterface, args: string) {
  const root = await $.session.root()
  const [action = 'status', ...flags] = args.trim().split(/\s+/).filter(Boolean)
  let text = STUDIO_USAGE
  if (action === 'start') text = await startStudio($, root)
  else if (action === 'stop') text = await stopStudio($, root, flags.includes('--force'))
  else if (action === 'status') text = await studioStatus($, root)
  await refreshStatus($, root)
  return { text }
}

// The last session out stops the studio. Whether it still serves is the stop
// script's to check: one process fits the end's short budget.
async function stopIfLast($: EngineInterface, root: string) {
  if (!(await $.fs.exists(`${root}/${STATE_DIR}/server.json`))) return
  if ((await otherOnlineSessions($, root)).length > 0) return
  await runStudioScript($, root, 'stop.mjs')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Web mode only where init left its marker, even if a manifest ever
    // reached a global copy of the skill.
    const root = await $.session.root()
    if (!(await $.fs.exists(`${root}/studio.config.json`))) return next(e)

    session = await openSession($, root, await $.session.id())
    await writeSession($, root, session)
    await refreshStatus($, root)
    await $.command.register({
      name: STUDIO_COMMAND,
      description: 'Start, stop or check the web studio of this workspace.',
      argumentHint: 'start|stop [--force]|status',
    })

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
    // Apart from the poll, which can wait on a busy session: the line follows
    // a studio another session starts or stops.
    $.clock.every(STATUS_MS, () => {
      void refreshStatus($, root)
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (session?.sessionId === e.sessionId) {
      endedSessionId = e.sessionId
      const root = await $.session.root()
      await writeSession($, root, { ...session, heartbeatAt: await now($), online: false })
      if (STOP_ON_END.includes(e.reason)) await stopIfLast($, root)
    }
    return next(e)
  })

  // A run with nothing after the name may come with no args at all.
  on('command.run', { command: STUDIO_COMMAND }, ($, e, next) => (session === undefined ? next(e) : runStudioCommand($, e.args ?? '')))

  // The protocol rides the mod, so a stale global SKILL.md cannot override it.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (session === undefined) return composed
    return { sections: [...composed.sections, { id: `${PLUGIN}:web-mode`, text: PROTOCOL, scope: 'session' }] }
  })

  // First, so it wraps the hooks below: the gate tool and refused renders are
  // logged too.
  on('tool.call', ($, e, next) => logActivity($, e as ToolCall, () => next(e)))

  on('tool.call', { tool: 'mcp__cinematic-video__open_gate' }, ($, e) => openGate($, e as GateInput))

  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    const refusal = await renderRefusal($, e.command)
    return refusal === undefined ? next(e) : { deny: refusal }
  })
}
