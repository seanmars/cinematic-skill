#!/usr/bin/env node
// Starts the web studio for a workspace made by init.mjs:
//   node <skill>/studio/dev.mjs [--workspace <dir>]
//
// The workspace defaults to the current directory, which is where a
// workspace's own `dev` script runs it.
import fs from 'node:fs'
import path from 'node:path'
import { createStudioServer } from './server/index.mjs'

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
console.log(`Cinematic studio for ${workspace}`)
server.printUrls()
