import path from 'node:path'
import { readJson } from './server/files.mjs'
import { STATE_DIR } from './server/sessions.mjs'

// server.json, written by the studio alone once it listens (D12), read here
// for start.mjs and stop.mjs. Node built-ins only, like both of them.

const ANSWER_TIMEOUT_MS = 1000

export function serverFile(workspace) {
  return path.join(workspace, STATE_DIR, 'server.json')
}

// server.json names the studio last started here. It still serves the
// workspace only if the process answering at its URL is that same one: a
// studio killed outright leaves the file behind, and its port may since have
// gone to another workspace's studio.
export async function servingStudio(workspace) {
  const server = readJson(serverFile(workspace))
  if (typeof server?.url !== 'string') return undefined
  try {
    const response = await fetch(new URL('api/studio', server.url), { signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS) })
    const answer = await response.json()
    return answer.pid === server.pid ? server : undefined
  } catch {
    return undefined
  }
}
