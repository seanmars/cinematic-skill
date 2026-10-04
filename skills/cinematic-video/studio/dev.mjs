#!/usr/bin/env node
// Serves the web studio for a workspace made by init.mjs:
//   node <skill>/studio/dev.mjs [--workspace <dir>]
//
// start.mjs runs it in the background for /studio start (D12). Once
// listening it records its pid and URL in server.json, the one file it alone
// writes; the workspace defaults to the current directory.
import fs from 'node:fs'
import path from 'node:path'
import { writeJson } from './server/files.mjs'
import { createStudioServer } from './server/index.mjs'
import { STATE_DIR } from './server/sessions.mjs'

const PORT = 5173

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
    else fail(`unexpected argument ${arg}; usage: node dev.mjs [--workspace <dir>]`)
  }
  return args
}

const workspace = path.resolve(parseArgs(process.argv.slice(2)).workspace)
if (!fs.existsSync(path.join(workspace, 'studio.config.json'))) {
  fail(`${workspace} is not a studio workspace; create one with init.mjs first`)
}

const server = await createStudioServer({ workspace, port: PORT })
// Vite moves to the next port when 5173 is taken.
const url = server.resolvedUrls.local[0]
await writeJson(path.join(workspace, STATE_DIR, 'server.json'), { pid: process.pid, url, workspace, startedAt: new Date().toISOString() })
console.log(`Cinematic studio for ${workspace}`)
server.printUrls()
