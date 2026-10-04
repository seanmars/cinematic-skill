#!/usr/bin/env node
// Stops the web studio serving a workspace; the mod runs it for /studio stop
// and when the last session leaves (D12):
//   node <skill>/studio/stop.mjs [--workspace <dir>]
//
// Prints one JSON line, {"status": "stopped" | "not-running"}; on failure, a
// message on stderr and exit code 1. Only a pid that still answers as this
// workspace's studio is stopped: server.json outlives a studio killed
// outright, and its pid may since belong to another process.
//
// Node built-ins only, like start.mjs.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { servingStudio } from './server-state.mjs'

function fail(message) {
  console.error(`studio: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { workspace: process.cwd() }
  const rest = [...argv]
  while (rest.length > 0) {
    const arg = rest.shift()
    if (arg === '--workspace') args.workspace = rest.shift() ?? fail('--workspace needs a directory')
    else fail(`unexpected argument ${arg}; usage: node stop.mjs [--workspace <dir>]`)
  }
  return args
}

// The whole tree, as Vite runs helpers of its own: taskkill's on Windows, and
// elsewhere the process group start.mjs's detached spawn made it lead.
function stopTree(pid) {
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' })
    if (result.status !== 0) fail(`taskkill could not stop the studio (pid ${pid}): ${result.stderr.trim()}`)
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch (error) {
    fail(`could not stop the studio (pid ${pid}): ${error.message}`)
  }
}

const workspace = path.resolve(parseArgs(process.argv.slice(2)).workspace)
const server = await servingStudio(workspace)
if (server !== undefined) stopTree(server.pid)
console.log(JSON.stringify({ status: server === undefined ? 'not-running' : 'stopped' }))
