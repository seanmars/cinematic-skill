import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStudioServer } from '../server/index.mjs'

// Shared by the studio server tests: the seam is the HTTP API plus the files
// it reads and writes, against a throwaway workspace seeded from fixtures/demo.

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const DEMO = path.join(repoDir, 'fixtures/demo')

const tempDirs = []
const studios = []

export async function cleanUp() {
  for (const studio of studios.splice(0)) await studio.close()
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
}

export function makeWorkspace({ seed = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-studio-'))
  tempDirs.push(dir)
  writeJson(dir, 'studio.config.json', { skillVersion: '0.1.0' })
  fs.mkdirSync(path.join(dir, 'video'))
  if (seed) fs.cpSync(DEMO, path.join(dir, 'video/demo'), { recursive: true })
  return dir
}

export function writeJson(root, file, value) {
  writeText(root, file, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeText(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}

export function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

export function exists(root, file) {
  return fs.existsSync(path.join(root, file))
}

export function listFiles(root, dir = root) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(root, full) : [path.relative(root, full).split(path.sep).join('/')]
  })
}

export const STATE = 'node_modules/.cinematic-studio'

// A session file as its mod writes it; by default one that is online now.
export function writeSession(root, sessionId, extra = {}) {
  const now = new Date().toISOString()
  writeJson(root, `${STATE}/sessions/${sessionId}.json`, {
    sessionId,
    shortId: sessionId.slice(0, 6),
    startedAt: now,
    heartbeatAt: now,
    online: true,
    project: null,
    ...extra,
  })
}

// A session that stopped heartbeating a minute ago, as a crashed one does.
export const STALE = { heartbeatAt: new Date(Date.now() - 60_000).toISOString() }

export function assign(root, slug, sessionId, reason = 'intake') {
  writeJson(root, `${STATE}/assignments/${slug}.json`, {
    slug,
    sessionId,
    assignedAt: '2026-10-04T04:00:00.000Z',
    reason,
  })
}

const DEMO_STUDIO = 'video/demo/studio'
export const DELIVERED = { deliveredAt: '2026-10-04T04:01:00.000Z' }

// A gate Claude opened in the demo project.
export function openGate(root, gateId, extra = {}) {
  writeJson(root, `${DEMO_STUDIO}/gates/${gateId}.json`, {
    gateId,
    stage: gateId.slice(4),
    openedAt: '2026-10-04T04:00:00.000Z',
    autoContinue: false,
    payload: {},
    ...extra,
  })
}

// The user's reply to a gate of the demo project.
export function writeReply(root, gateId, decision, notes = '') {
  writeJson(root, `${DEMO_STUDIO}/replies/${gateId}.json`, { decision, notes, changes: [] })
}

// The watcher scans folders already under video/ for a while after start; a
// test that writes into one at once would race that scan.
async function untilWatched(server, workspace) {
  const video = path.join(workspace, 'video')
  const dirs = fs
    .readdirSync(video, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(entry.parentPath, entry.name))
    .concat(video)
  const deadline = Date.now() + 3000
  while (Date.now() < deadline) {
    const watched = server.watcher.getWatched()
    if (dirs.every(dir => watched[dir] !== undefined)) return
    await sleep(20)
  }
  throw new Error('the studio never finished watching video/')
}

export async function startStudio(workspace) {
  const server = await createStudioServer({ workspace, port: 0 })
  await untilWatched(server, workspace)
  const port = server.httpServer.address().port
  const studio = {
    server,
    port,
    close: () => server.close(),
    get: urlPath => request(port, 'GET', urlPath),
    // Sent the way a page served by the studio itself would send it; a header
    // given as undefined drops that default.
    post: (urlPath, body, headers = {}) =>
      request(port, 'POST', urlPath, {
        body: JSON.stringify(body),
        headers: withoutUndefined({
          'content-type': 'application/json',
          origin: `http://127.0.0.1:${port}`,
          'sec-fetch-site': 'same-origin',
          ...headers,
        }),
      }),
  }
  studios.push(studio)
  return studio
}

function withoutUndefined(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined))
}

// node:http rather than fetch, so a test controls every header a browser
// would set (Origin, Sec-Fetch-Site).
export function request(port, method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => {
        text += chunk
      })
      res.on('end', () => {
        let json
        try {
          json = JSON.parse(text)
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, text, body: json })
      })
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

// Listens on the studio's HMR socket the way the page does, keeping the
// custom events it pushes.
export async function connectEvents(studio) {
  const token = studio.server.config.webSocketToken
  const ws = new WebSocket(`ws://127.0.0.1:${studio.port}/?token=${token}`, 'vite-hmr')
  const events = []
  const connected = new Promise((resolve, reject) => {
    ws.addEventListener('error', reject)
    ws.addEventListener('message', message => {
      const data = JSON.parse(String(message.data))
      if (data.type === 'connected') resolve()
      if (data.type === 'custom') events.push({ event: data.event, data: data.data })
    })
  })
  await connected
  const listener = {
    events,
    async waitFor(predicate, timeout = 3000) {
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        const found = events.find(predicate)
        if (found !== undefined) return found
        await sleep(50)
      }
      throw new Error(`no matching event within ${timeout}ms; got ${JSON.stringify(events)}`)
    },
    close: () => ws.close(),
  }
  studios.push({ close: async () => listener.close() })
  return listener
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
