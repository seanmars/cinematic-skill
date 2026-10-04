#!/usr/bin/env node
// Creates a studio workspace:
//   node <skill>/studio/init.mjs <dir> [--force] [--link] [--seed <fixture>]
//
// --link is for developing this repo: the workspace links to the skill source
// instead of copying it, so edits take effect without another init.
//
// Node built-ins only: a skill installed with `npx skills add` has no .git and
// no dependencies, so this must run from a bare copy.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_NAME = 'cinematic-video'
const SKILL_IN_WORKSPACE = `.claude/skills/${SKILL_NAME}`

// Never copied into a workspace: dependencies, Python caches, and the manifest
// (plus the tsconfig the engine lays beside it) that only init writes.
const EXCLUDED_NAMES = new Set(['node_modules', '__pycache__'])
const MANIFEST_PATHS = new Set(['.claude-plugin', 'hooks/hooks.json', 'tsconfig.json'])

const GITIGNORE = `node_modules/

# Rendered output; video/*/studio/ stays tracked as the project's decision record
video/*/out/
`

const studioDir = path.dirname(fileURLToPath(import.meta.url))
const skillDir = path.dirname(studioDir)

function fail(message) {
  console.error(`init: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { dir: undefined, force: false, link: false, seed: undefined }
  const rest = [...argv]
  while (rest.length > 0) {
    const arg = rest.shift()
    if (arg === '--force') args.force = true
    else if (arg === '--link') args.link = true
    else if (arg === '--seed') args.seed = rest.shift() ?? fail('--seed needs a fixture directory')
    else if (arg.startsWith('--')) fail(`unknown option ${arg}`)
    else if (args.dir === undefined) args.dir = arg
    else fail(`unexpected argument ${arg}`)
  }
  if (args.dir === undefined) fail('usage: node init.mjs <dir> [--force] [--link] [--seed <fixture>]')
  return args
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

// studio/package.json declares engines.node as a single lower bound, ">=X.Y.Z".
function checkNode(engines) {
  const required = engines?.node ?? ''
  const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(required)
  if (match === null) fail(`studio/package.json engines.node must read ">=X.Y.Z", found "${required}"`)
  const have = process.versions.node.split('.').map(Number)
  if (compareVersions(have, match.slice(1).map(Number)) < 0) {
    fail(`Node ${required} is required, found ${process.versions.node}`)
  }
}

function checkTarget(dir, force) {
  if (!fs.existsSync(dir)) return
  if (!fs.statSync(dir).isDirectory()) fail(`${dir} is not a directory`)
  const visible = fs.readdirSync(dir).filter(name => !name.startsWith('.'))
  if (visible.length > 0 && !force) fail(`${dir} is not empty; pass --force to write into it anyway`)
}

function detectPackageManager() {
  // One command string: through a shell so Windows finds pnpm.cmd, and with no
  // argument list, which Node warns about under shell: true.
  const pnpm = spawnSync('pnpm --version', { shell: true, stdio: 'ignore' })
  return pnpm.status === 0 ? 'pnpm' : 'npm'
}

function isCopied(src) {
  const file = path.relative(skillDir, src).split(path.sep).join('/')
  return !EXCLUDED_NAMES.has(path.basename(src)) && !file.endsWith('.pyc') && !MANIFEST_PATHS.has(file)
}

function checkSeed(seed) {
  if (seed !== undefined && !fs.statSync(seed, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`${seed} is not a fixture directory`)
  }
}

function linkSkill(link) {
  fs.mkdirSync(path.dirname(link), { recursive: true })
  // A junction needs neither admin rights nor Developer Mode on Windows.
  fs.symlinkSync(skillDir, link, process.platform === 'win32' ? 'junction' : 'dir')
}

// In link mode the skill path is the link, so this lands in the skill source,
// where the repo's .gitignore keeps it out of the distributed skill.
function writeManifest(skill, version) {
  writeJson(path.join(skill, '.claude-plugin/plugin.json'), {
    name: SKILL_NAME,
    version,
    description: 'Cinematic video studio bridge: stage gates, wake-ups and the render guard for web mode.',
  })
  writeJson(path.join(skill, 'hooks/hooks.json'), { modules: ['../studio/mod/register.ts'] })
}

function settings() {
  return {
    permissions: {
      allow: [`mcp__${SKILL_NAME}__*`, `Bash(uv run ${SKILL_IN_WORKSPACE}/scripts/*)`],
    },
    hooks: {
      Notification: [
        {
          matcher: 'permission_prompt',
          hooks: [{ type: 'command', command: `node ${SKILL_IN_WORKSPACE}/studio/notify.mjs` }],
        },
      ],
    },
  }
}

const OPEN_CLAUDE = `Then open Claude Code there:
  claude
Accept the trust prompt the first time; the studio mod loads once the folder is trusted.`

function printNextSteps(dir, packageManager) {
  const run = packageManager === 'pnpm' ? 'pnpm dev' : 'npm run dev'
  console.log(`Created a cinematic studio workspace in ${dir}

Next steps:
  cd ${dir}
  ${packageManager} install
  ${run}

${OPEN_CLAUDE}`)
}

function printLinkedNextSteps(dir) {
  console.log(`Linked a cinematic studio workspace in ${dir} to ${skillDir}

${OPEN_CLAUDE}`)
}

const args = parseArgs(process.argv.slice(2))
const target = path.resolve(args.dir)
const seed = args.seed === undefined ? undefined : path.resolve(args.seed)
const studioPackage = readJson(path.join(studioDir, 'package.json'))

checkNode(studioPackage.engines)
checkTarget(target, args.force)
checkSeed(seed)

const skill = path.join(target, SKILL_IN_WORKSPACE)
if (args.link) linkSkill(skill)
else fs.cpSync(skillDir, skill, { recursive: true, filter: isCopied })
writeManifest(skill, studioPackage.version)
writeJson(path.join(target, 'studio.config.json'), { skillVersion: studioPackage.version })
if (!args.link) {
  writeJson(path.join(target, 'package.json'), {
    private: true,
    type: 'module',
    scripts: { dev: `node ${SKILL_IN_WORKSPACE}/studio/dev.mjs` },
    dependencies: studioPackage.dependencies ?? {},
  })
}
writeJson(path.join(target, '.claude/settings.json'), settings())
fs.writeFileSync(path.join(target, '.gitignore'), GITIGNORE)
fs.mkdirSync(path.join(target, 'video'), { recursive: true })
if (seed !== undefined) fs.cpSync(seed, path.join(target, 'video', path.basename(seed)), { recursive: true })

if (args.link) printLinkedNextSteps(target)
else printNextSteps(target, detectPackageManager())
