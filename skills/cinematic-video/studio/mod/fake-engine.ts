import type { FsEntry, On } from 'claude-code'
import { type MockClock, mock } from 'claude-code/testing'

// Answers, from memory, every call the studio mod makes on `$`: under
// `claude plugin test` nothing else sits beneath the plugin. The workspace is
// a map of files keyed by path, so a test reads and writes the same state
// files (D2) a real session would.

export const WORKSPACE = '/ws'
export const START = Date.parse('2026-10-04T05:00:00.000Z')
// A time before the session started, for files already there.
export const EARLIER = '2026-10-04T04:00:00.000Z'

export const iso = (ms: number) => new Date(ms).toISOString()

export type FakeEngine = {
  files: Map<string, string>
  writeJson: (file: string, value: unknown) => void
  readJson: (file: string) => any
  // The workspace marker init writes; without it the mod stays out of the way.
  markStudio: () => void
  // The state files the studio and Claude write, as each writes them.
  assign: (slug: string, sessionId: string, reason?: string) => void
  openGate: (slug: string, gateId: string, extra?: Record<string, unknown>) => void
  reply: (slug: string, gateId: string, decision?: string) => void
  submitted: string[]
  tools: string[]
  status: (string | undefined)[]
  clock: MockClock
}

// Paths reach the fs hooks native and absolute: '/ws/x' arrives as 'C:\ws\x'
// on Windows.
function normalize(path: string) {
  return path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
}

function inWorkspace(file: string) {
  return `${WORKSPACE}/${file}`
}

function list(files: Map<string, string>, dir: string): FsEntry[] {
  const entries = new Map<string, FsEntry>()
  for (const [path, text] of files) {
    if (!path.startsWith(`${dir}/`)) continue
    const [name, ...rest] = path.slice(dir.length + 1).split('/')
    const isFile = rest.length === 0
    entries.set(name!, { name: name!, kind: isFile ? 'file' : 'dir', size: isFile ? text.length : 0, mtimeMs: 0, isLink: false })
  }
  return [...entries.values()]
}

export function fakeEngine(on: On, { sessionId = 'session-a' } = {}): FakeEngine {
  const files = new Map<string, string>()
  const submitted: string[] = []
  const tools: string[] = []
  const status: (string | undefined)[] = []

  on('fs.read', ($, e) => {
    const text = files.get(normalize(e.path))
    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(normalize(e.path), e.text)
    return { value: undefined }
  })
  on('fs.exists', ($, e) => {
    const path = normalize(e.path)
    return { value: files.has(path) || list(files, path).length > 0 }
  })
  on('fs.list', ($, e) => {
    const entries = list(files, normalize(e.path))
    return entries.length === 0 ? { deny: `ENOENT: ${e.path}` } : { value: entries }
  })
  on('session.id', () => ({ value: sessionId }))
  on('session.root', () => ({ value: WORKSPACE }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('tool.register', ($, e) => {
    tools.push(e.name)
    return { value: { tool: `mcp__cinematic-video__${e.name}` } }
  })
  on('ui.status', ($, e) => {
    status.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  const clock = mock.clock(on, { now: START })
  const writeJson = (file: string, value: unknown) => files.set(inWorkspace(file), JSON.stringify(value))

  return {
    files,
    writeJson,
    readJson: file => {
      const text = files.get(inWorkspace(file))
      return text === undefined ? undefined : JSON.parse(text)
    },
    markStudio: () => writeJson('studio.config.json', { skillVersion: '0.1.0' }),
    assign: (slug, sessionId, reason = 'intake') =>
      writeJson(`node_modules/.cinematic-studio/assignments/${slug}.json`, { slug, sessionId, assignedAt: EARLIER, reason }),
    openGate: (slug, gateId, extra = {}) =>
      writeJson(`video/${slug}/studio/gates/${gateId}.json`, {
        gateId,
        stage: gateId.slice(4),
        openedAt: EARLIER,
        autoContinue: false,
        payload: {},
        ...extra,
      }),
    reply: (slug, gateId, decision = 'approve') =>
      writeJson(`video/${slug}/studio/replies/${gateId}.json`, { decision, notes: '', changes: [] }),
    submitted,
    tools,
    status,
    clock,
  }
}

export async function startSession($: { session: { start: (e: any) => Promise<unknown> } }) {
  await $.session.start({ cwd: WORKSPACE, surface: 'terminal', isInteractive: true })
}
