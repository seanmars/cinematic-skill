#!/usr/bin/env node
// Starts the web studio in the background for a workspace, or finds the one
// already serving it; the mod runs it for /studio start (D12):
//   node <skill>/studio/start.mjs [--workspace <dir>] [--no-open]
//
// Prints one JSON line, {"status": "started" | "running", "url", "opened"};
// on failure, a message on stderr and exit code 1.
//
// Node built-ins only: it runs before the studio's dependencies are installed.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serverFile, servingStudio } from './server-state.mjs'
import { readJson } from './server/files.mjs'
import { STATE_DIR } from './server/sessions.mjs'

const SKILL_IN_WORKSPACE = '.claude/skills/cinematic-video'
const START_TIMEOUT_MS = 30_000
const POLL_MS = 100
const LOG_TAIL_LINES = 20

const studioDir = path.dirname(fileURLToPath(import.meta.url))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function fail(message) {
  console.error(`studio: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { workspace: process.cwd(), open: true }
  const rest = [...argv]
  while (rest.length > 0) {
    const arg = rest.shift()
    if (arg === '--workspace') args.workspace = rest.shift() ?? fail('--workspace needs a directory')
    else if (arg === '--no-open') args.open = false
    else fail(`unexpected argument ${arg}; usage: node start.mjs [--workspace <dir>] [--no-open]`)
  }
  return args
}

function logFile(workspace) {
  return path.join(workspace, STATE_DIR, 'studio.log')
}

// Resolved from this file, so from a copied skill the search walks up into the
// workspace's node_modules, and from a linked one into the repo's. Not whether
// node_modules exists: the mod writes its state there from the first session.
function hasDependencies() {
  try {
    import.meta.resolve('vite')
    return true
  } catch {
    return false
  }
}

// init --link leaves a junction (a symlink elsewhere) where the copy would be.
function isLinked(workspace) {
  return fs.lstatSync(path.join(workspace, SKILL_IN_WORKSPACE), { throwIfNoEntry: false })?.isSymbolicLink() === true
}

function detectPackageManager() {
  // One command string: through a shell so Windows finds pnpm.cmd, and with no
  // argument list, which Node warns about under shell: true.
  const pnpm = spawnSync('pnpm --version', { shell: true, stdio: 'ignore' })
  return pnpm.status === 0 ? 'pnpm' : 'npm'
}

// Its output goes to stderr only on failure: stdout carries the one JSON line.
function install(workspace) {
  const packageManager = detectPackageManager()
  const result = spawnSync(`${packageManager} install`, { shell: true, cwd: workspace, encoding: 'utf8' })
  if (result.status !== 0) fail(`${packageManager} install failed in ${workspace}:\n${result.stdout ?? ''}${result.stderr ?? ''}`)
}

// Detached, with its output in a file rather than this process's pipes, so it
// outlives this launcher and the call that ran it returns at once.
function startServer(workspace) {
  fs.mkdirSync(path.join(workspace, STATE_DIR), { recursive: true })
  const log = fs.openSync(logFile(workspace), 'w')
  const child = spawn(process.execPath, [path.join(studioDir, 'dev.mjs'), '--workspace', workspace], {
    cwd: workspace,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  })
  fs.closeSync(log)
  child.unref()
  return child
}

function logTail(workspace) {
  const text = readText(logFile(workspace))
  return text.trimEnd().split(/\r?\n/).slice(-LOG_TAIL_LINES).join('\n')
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

// Until the new studio records itself in server.json.
async function untilServing(workspace, child) {
  let hasExited = false
  child.on('exit', () => {
    hasExited = true
  })
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline && !hasExited) {
    const server = readJson(serverFile(workspace))
    if (server?.pid === child.pid) return server
    await sleep(POLL_MS)
  }
  if (!hasExited) child.kill()
  const why = hasExited ? 'stopped before it was serving' : `was not serving after ${START_TIMEOUT_MS / 1000} s`
  return fail(`the studio ${why}; the end of ${logFile(workspace)}:\n${logTail(workspace)}`)
}

// Through cmd's start on Windows, verbatim: its first quoted argument is the
// window title. The URL is printed either way, so a missing opener is fine.
function openBrowser(url) {
  const [command, ...args] =
    process.platform === 'win32'
      ? ['cmd', '/c', 'start', '""', url]
      : process.platform === 'darwin'
        ? ['open', url]
        : ['xdg-open', url]
  const opener = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true })
  opener.on('error', () => {})
  opener.unref()
}

function report(status, url, opened) {
  console.log(JSON.stringify({ status, url, opened }))
}

const args = parseArgs(process.argv.slice(2))
const workspace = path.resolve(args.workspace)
if (!fs.existsSync(path.join(workspace, 'studio.config.json'))) {
  fail(`${workspace} is not a studio workspace; create one with init.mjs first`)
}

const running = await servingStudio(workspace)
if (running !== undefined) {
  report('running', running.url, false)
} else {
  if (!hasDependencies()) {
    if (isLinked(workspace)) {
      fail(`the studio's dependencies are not installed; this workspace links to ${path.dirname(studioDir)}: run pnpm install in that repo`)
    }
    install(workspace)
  }
  const server = await untilServing(workspace, startServer(workspace))
  if (args.open) openBrowser(server.url)
  report('started', server.url, args.open)
}
