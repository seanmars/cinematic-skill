import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const tempDirs = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-init-'))
  tempDirs.push(dir)
  return dir
}

function newTarget() {
  return path.join(makeTempDir(), 'my-studio')
}

function runInit(args, { skill = skillDir, env = process.env } = {}) {
  return spawnSync(process.execPath, [path.join(skill, 'studio/init.mjs'), ...args], { encoding: 'utf8', env })
}

// What the distributed skill carries: no caches, no link-mode manifest.
function isDistributed(src) {
  const file = path.relative(skillDir, src).split(path.sep).join('/')
  return (
    !['node_modules', '__pycache__'].includes(path.basename(src)) &&
    !['.claude-plugin', 'hooks/hooks.json', 'tsconfig.json'].includes(file)
  )
}

// A throwaway copy of the skill, so a test can plant files or edit studio/package.json.
function copySkill() {
  const dest = path.join(makeTempDir(), 'cinematic-video')
  fs.cpSync(skillDir, dest, { recursive: true, filter: isDistributed })
  return dest
}

function editStudioPackage(skill, edit) {
  const file = path.join(skill, 'studio/package.json')
  fs.writeFileSync(file, JSON.stringify(edit(readJson(file)), null, 2))
}

function plant(root, file, text = 'planted') {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function listFiles(root, dir = root) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(root, full) : [path.relative(root, full).split(path.sep).join('/')]
  })
}

function envWithoutPnpm() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'))
  return { ...env, PATH: makeTempDir() }
}

function isGitIgnored(repo, file) {
  return spawnSync('git', ['check-ignore', '-q', file], { cwd: repo }).status === 0
}

describe('init in normal mode', () => {
  it('目標目錄不存在: creates the workspace and prints the next steps', () => {
    const target = newTarget()

    const result = runInit([target])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(fs.existsSync(path.join(target, '.claude/skills/cinematic-video/SKILL.md'))).toBe(true)
    expect(fs.statSync(path.join(target, 'video')).isDirectory()).toBe(true)
    expect(result.stdout).toMatch(/claude/)
    expect(result.stdout).toMatch(/\/studio start/)
    expect(result.stdout).not.toMatch(/install|pnpm dev|npm run dev/)
  })

  it('目標目錄非空且沒有 force: writes nothing and points at --force', () => {
    const target = makeTempDir()
    plant(target, 'notes.txt', 'keep')

    const result = runInit([target])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/--force/)
    expect(fs.readdirSync(target)).toEqual(['notes.txt'])
  })

  it('accepts a directory holding only hidden files, and a non-empty one with --force', () => {
    const hiddenOnly = makeTempDir()
    fs.mkdirSync(path.join(hiddenOnly, '.git'))
    const busy = makeTempDir()
    plant(busy, 'notes.txt', 'keep')

    expect(runInit([hiddenOnly]).status).toBe(0)
    expect(runInit([busy, '--force']).status).toBe(0)
    expect(fs.readFileSync(path.join(busy, 'notes.txt'), 'utf8')).toBe('keep')
    expect(fs.existsSync(path.join(busy, 'studio.config.json'))).toBe(true)
  })

  it('Node 版本不足: writes nothing and names the required version', () => {
    const skill = copySkill()
    editStudioPackage(skill, pkg => ({ ...pkg, engines: { node: '>=99.0.0' } }))
    const target = newTarget()

    const result = runInit([target], { skill })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/>=99\.0\.0/)
    expect(fs.existsSync(target)).toBe(false)
  })

  // Installing moved to /studio start, which picks pnpm or npm itself.
  it('needs no package manager: without pnpm the next steps are the same', () => {
    const result = runInit([newTarget()], { env: envWithoutPnpm() })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/\/studio start/)
    expect(result.stdout).not.toMatch(/npm/)
  })

  it('複製時排除快取與依賴: copies every other skill file', () => {
    const skill = copySkill()
    const expected = listFiles(skill)
    plant(skill, 'node_modules/dep/index.js')
    plant(skill, 'studio/node_modules/dep/index.js')
    plant(skill, 'scripts/__pycache__/render.cpython-313.pyc')
    plant(skill, 'scripts/stale.pyc')
    plant(skill, '.claude-plugin/plugin.json', '{ "name": "planted" }')
    plant(skill, '.claude-plugin/types/claude-code/index.d.ts')
    plant(skill, 'hooks/hooks.json', '{ "modules": ["./planted.ts"] }')
    plant(skill, 'tsconfig.json')
    const target = newTarget()

    expect(runInit([target], { skill }).status).toBe(0)

    const copy = path.join(target, '.claude/skills/cinematic-video')
    const generated = ['.claude-plugin/plugin.json', 'hooks/hooks.json']
    expect(listFiles(copy).filter(file => !generated.includes(file)).sort()).toEqual(expected.sort())
    expect(readJson(path.join(copy, '.claude-plugin/plugin.json')).name).toBe('cinematic-video')
    expect(readJson(path.join(copy, 'hooks/hooks.json')).modules).toEqual(['../studio/mod/register.ts'])
  })

  it('產生的依賴與 studio 宣告一致', () => {
    const skill = copySkill()
    editStudioPackage(skill, pkg => ({ ...pkg, dependencies: { vite: '^8.3.2', sirv: '^3.0.2' } }))
    const target = newTarget()

    expect(runInit([target], { skill }).status).toBe(0)

    const pkg = readJson(path.join(target, 'package.json'))
    expect(pkg.dependencies).toEqual({ vite: '^8.3.2', sirv: '^3.0.2' })
    expect(pkg.scripts).toBeUndefined()
  })

  it('writes the workspace marker, settings and gitignore, but no MCP config', () => {
    const target = newTarget()
    const { version } = readJson(path.join(skillDir, 'studio/package.json'))

    expect(runInit([target]).status).toBe(0)

    expect(version).toMatch(/^\d+\.\d+\.\d+/)
    expect(readJson(path.join(target, 'studio.config.json')).skillVersion).toBe(version)

    const settings = readJson(path.join(target, '.claude/settings.json'))
    expect(settings.permissions.allow).toContain('mcp__cinematic-video__*')
    expect(settings.permissions.allow).toContain('Bash(uv run .claude/skills/cinematic-video/scripts/*)')
    expect(settings.hooks.Notification).toEqual([
      {
        matcher: 'permission_prompt',
        hooks: [{ type: 'command', command: 'node .claude/skills/cinematic-video/studio/notify.mjs' }],
      },
    ])

    spawnSync('git', ['init', '-q'], { cwd: target })
    expect(isGitIgnored(target, 'node_modules/vite/package.json')).toBe(true)
    expect(isGitIgnored(target, 'video/demo/studio/gates/001-intake.json')).toBe(false)
    expect(isGitIgnored(target, 'video/demo/studio/replies/001-intake.json')).toBe(false)

    expect(fs.existsSync(path.join(target, '.mcp.json'))).toBe(false)
  })
})

describe('init in link mode', () => {
  const repoGitignore = path.resolve(skillDir, '../../.gitignore')

  it('修改原始碼後立即生效: the workspace skill is a link to the source', () => {
    const skill = copySkill()
    const target = newTarget()

    const result = runInit([target, '--link'], { skill })

    expect(result.status, result.stderr).toBe(0)
    const link = path.join(target, '.claude/skills/cinematic-video')
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
    expect(fs.realpathSync(link)).toBe(fs.realpathSync(skill))
    plant(skill, 'references/edited-after-init.md', 'fresh')
    expect(fs.readFileSync(path.join(link, 'references/edited-after-init.md'), 'utf8')).toBe('fresh')
  })

  it('writes the workspace files but no package.json', () => {
    const skill = copySkill()
    const target = newTarget()

    expect(runInit([target, '--link'], { skill }).status).toBe(0)

    expect(fs.existsSync(path.join(target, 'package.json'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'studio.config.json'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.claude/settings.json'))).toBe(true)
    expect(fs.statSync(path.join(target, 'video')).isDirectory()).toBe(true)
    expect(readJson(path.join(skill, '.claude-plugin/plugin.json')).name).toBe('cinematic-video')
    expect(readJson(path.join(skill, 'hooks/hooks.json')).modules).toEqual(['../studio/mod/register.ts'])
  })

  it.skipIf(!fs.existsSync(repoGitignore))('manifest 不會被散佈: the repo ignores the manifest link mode writes', () => {
    const repo = makeTempDir()
    fs.copyFileSync(repoGitignore, path.join(repo, '.gitignore'))
    const skill = path.join(repo, 'skills/cinematic-video')
    fs.cpSync(skillDir, skill, { recursive: true, filter: isDistributed })
    spawnSync('git', ['init', '-q'], { cwd: repo })
    plant(skill, 'tsconfig.json', '{ "extends": "./.claude-plugin/types/tsconfig.json" }')

    expect(runInit([newTarget(), '--link'], { skill }).status).toBe(0)

    for (const file of ['.claude-plugin/plugin.json', 'hooks/hooks.json', 'tsconfig.json']) {
      expect(fs.existsSync(path.join(skill, file)), file).toBe(true)
      expect(isGitIgnored(repo, `skills/cinematic-video/${file}`), file).toBe(true)
    }
  })

  it('--seed copies the fixture into video/', () => {
    const fixture = path.join(makeTempDir(), 'demo')
    plant(fixture, 'storyboard.json', '{}')
    plant(fixture, 'audio/plan.json', '{}')
    const target = newTarget()

    const result = runInit([target, '--link', '--seed', fixture], { skill: copySkill() })

    expect(result.status, result.stderr).toBe(0)
    expect(listFiles(path.join(target, 'video/demo')).sort()).toEqual(['audio/plan.json', 'storyboard.json'])
  })
})
