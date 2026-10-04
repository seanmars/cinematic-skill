import { execFile, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { STATE, cleanUp, makeWorkspace, readJson, request, startStudio, writeJson } from './studio-helpers.mjs'

// The launcher the mod runs for /studio start (D12). The seam is its command
// line: the JSON line it prints, its exit code, and server.json.

const studioDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillDir = path.dirname(studioDir)
const LAUNCHER = path.join(studioDir, 'start.mjs')
const STOPPER = path.join(studioDir, 'stop.mjs')

const tempDirs = []
const serverPids = []

afterEach(async () => {
  for (const pid of serverPids.splice(0)) stopTree(pid)
  await cleanUp()
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 })
})

function stopTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'])
  else {
    for (const target of [-pid, pid]) {
      try {
        process.kill(target, 'SIGTERM')
      } catch {}
    }
  }
}

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-start-'))
  tempDirs.push(dir)
  return dir
}

// Asynchronous, so a studio served from this process can still answer the
// launcher; and it returns only once the launcher's output pipes close.
function runStart(launcher, args, { env = process.env } = {}) {
  return new Promise(resolve => {
    execFile(process.execPath, [launcher, ...args], { encoding: 'utf8', env, timeout: 60_000 }, (error, stdout, stderr) => {
      resolve({ status: error === null ? 0 : (error.code ?? 1), stdout, stderr })
    })
  })
}

function output(result) {
  return JSON.parse(result.stdout.trim())
}

// A PATH holding only fake package managers: each answers --version, and
// records any other call (its arguments, then the directory it ran in) and
// fails, so no test ever installs for real.
function fakeBin(names) {
  const bin = makeTempDir()
  for (const name of names) {
    if (process.platform === 'win32') {
      fs.writeFileSync(
        path.join(bin, `${name}.cmd`),
        [
          '@echo off',
          'if "%1"=="--version" exit /b 0',
          `echo ${name} %*>>"%~dp0calls.txt"`,
          'echo %CD%>>"%~dp0calls.txt"',
          'exit /b 1',
          '',
        ].join('\r\n'),
      )
    } else {
      const script = path.join(bin, name)
      fs.writeFileSync(
        script,
        [
          '#!/bin/sh',
          '[ "$1" = "--version" ] && exit 0',
          `echo "${name} $*" >> "$(dirname "$0")/calls.txt"`,
          'pwd >> "$(dirname "$0")/calls.txt"',
          'exit 1',
          '',
        ].join('\n'),
      )
      fs.chmodSync(script, 0o755)
    }
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'))
  return { env: { ...env, PATH: bin }, calls: () => readCalls(bin) }
}

function readCalls(bin) {
  const file = path.join(bin, 'calls.txt')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(line => line.trim()) : []
}

// A workspace made by init in normal mode, before anything is installed.
function initWorkspace() {
  const target = path.join(makeTempDir(), 'my-studio')
  const result = spawnSync(process.execPath, [path.join(studioDir, 'init.mjs'), target], { encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(0)
  return target
}

// A workspace linked, as init --link links it, to a copy of the skill with no
// dependencies installed.
function linkedWorkspace() {
  const skill = path.join(makeTempDir(), 'cinematic-video')
  fs.cpSync(skillDir, skill, { recursive: true, filter: src => !['node_modules', '__pycache__'].includes(path.basename(src)) })
  const workspace = makeWorkspace({ seed: false })
  const link = path.join(workspace, '.claude/skills/cinematic-video')
  fs.mkdirSync(path.dirname(link), { recursive: true })
  fs.symlinkSync(skill, link, process.platform === 'win32' ? 'junction' : 'dir')
  return { workspace, launcher: path.join(link, 'studio/start.mjs') }
}

function launcherIn(workspace) {
  return path.join(workspace, '.claude/skills/cinematic-video/studio/start.mjs')
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function untilGone(pid, timeout = 5000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline && isAlive(pid)) await new Promise(resolve => setTimeout(resolve, 50))
  return !isAlive(pid)
}

describe('/studio start launcher', () => {
  it('一般模式還沒安裝依賴: installs with pnpm in the workspace', async () => {
    const workspace = initWorkspace()
    const bin = fakeBin(['pnpm', 'npm'])

    const result = await runStart(launcherIn(workspace), ['--workspace', workspace, '--no-open'], { env: bin.env })

    expect(bin.calls()).toEqual(['pnpm install', workspace])
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/pnpm install/)
  })

  it('installs with npm when there is no pnpm', async () => {
    const workspace = initWorkspace()
    const bin = fakeBin(['npm'])

    await runStart(launcherIn(workspace), ['--workspace', workspace, '--no-open'], { env: bin.env })

    expect(bin.calls()).toEqual(['npm install', workspace])
  })

  it('link 模式還沒安裝依賴: says to install in the repo and installs nothing', async () => {
    const { workspace, launcher } = linkedWorkspace()
    const bin = fakeBin(['pnpm', 'npm'])

    const result = await runStart(launcher, ['--workspace', workspace, '--no-open'], { env: bin.env })

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/pnpm install/)
    expect(bin.calls()).toEqual([])
    expect(fs.existsSync(path.join(workspace, STATE, 'server.json'))).toBe(false)
  })

  it('studio 已經在執行: reports the studio already serving the workspace', async () => {
    const workspace = makeWorkspace({ seed: false })
    const studio = await startStudio(workspace)
    const serving = { pid: process.pid, url: `http://127.0.0.1:${studio.port}/`, workspace, startedAt: new Date().toISOString() }
    writeJson(workspace, `${STATE}/server.json`, serving)

    const result = await runStart(LAUNCHER, ['--workspace', workspace, '--no-open'])

    expect(result.status, result.stderr).toBe(0)
    expect(output(result)).toEqual({ status: 'running', url: serving.url, opened: false })
    expect(readJson(workspace, `${STATE}/server.json`)).toEqual(serving)
  })

  it('treats a server.json no studio answers for as not running, and records the new studio', async () => {
    const workspace = makeWorkspace({ seed: false })
    const stale = { pid: 999999, url: 'http://127.0.0.1:9/', workspace, startedAt: '2026-10-04T04:00:00.000Z' }
    writeJson(workspace, `${STATE}/server.json`, stale)

    const result = await runStart(LAUNCHER, ['--workspace', workspace, '--no-open'])
    const server = readJson(workspace, `${STATE}/server.json`)
    serverPids.push(server.pid)

    expect(result.status, result.stderr).toBe(0)
    expect(output(result)).toEqual({ status: 'started', url: server.url, opened: false })
    expect(server.pid).not.toBe(stale.pid)
    const answer = await request(Number(new URL(server.url).port), 'GET', '/api/studio')
    expect(answer.body).toEqual({ pid: server.pid, workspace: path.resolve(workspace) })
  })
})

describe('/studio stop script', () => {
  it('stops the studio serving the workspace', async () => {
    const workspace = makeWorkspace({ seed: false })
    await runStart(LAUNCHER, ['--workspace', workspace, '--no-open'])
    const { pid } = readJson(workspace, `${STATE}/server.json`)
    serverPids.push(pid)

    const result = await runStart(STOPPER, ['--workspace', workspace])

    expect(result.status, result.stderr).toBe(0)
    expect(output(result)).toEqual({ status: 'stopped' })
    expect(await untilGone(pid)).toBe(true)
  })

  it('leaves alone the process server.json names when no studio answers for it', async () => {
    const workspace = makeWorkspace({ seed: false })
    const bystander = execFile(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])
    serverPids.push(bystander.pid)
    writeJson(workspace, `${STATE}/server.json`, { pid: bystander.pid, url: 'http://127.0.0.1:9/', workspace })

    const result = await runStart(STOPPER, ['--workspace', workspace])

    expect(result.status, result.stderr).toBe(0)
    expect(output(result)).toEqual({ status: 'not-running' })
    expect(isAlive(bystander.pid)).toBe(true)
  })
})
