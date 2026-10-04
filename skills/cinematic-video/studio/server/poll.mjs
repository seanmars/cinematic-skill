import { readRenders, readSessions } from './sessions.mjs'

const POLL_MS = 1000

// The short-lived state is polled rather than watched (D4); each snapshot
// goes out only when it differs from the last one sent.
export function pushPolledState(server, workspace) {
  const sources = [
    ['studio:sessions', () => ({ sessions: readSessions(workspace) })],
    ['studio:renders', () => ({ renders: readRenders(workspace) })],
  ]
  const lastSent = new Map()
  const timer = setInterval(() => {
    for (const [event, read] of sources) {
      const snapshot = read()
      const text = JSON.stringify(snapshot)
      if (lastSent.get(event) === text) continue
      lastSent.set(event, text)
      server.ws.send(event, snapshot)
    }
  }, POLL_MS)
  server.httpServer?.on('close', () => clearInterval(timer))
}
