import fs from 'node:fs'
import path from 'node:path'

// The studio writes with tmp + rename so the mod never reads half a file
// (D3). Windows refuses the rename while another process holds the target
// open, so those errors are retried.
const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RETRY_LIMIT = 10
const RETRY_MS = 50

// Never ends in .json: the mod lists replies/*.json and must not see one.
export const TMP_SUFFIX = '.studio-tmp'

// Pushes for a file the studio wrote itself are dropped for this long (D4).
const RECENT_WRITE_MS = 1500

function isPlain(value) {
  return value === null || typeof value !== 'object'
}

const LINE_WIDTH = 80

// Two-space JSON, but a short array of plain values stays on one line: a
// plan cue or a list of tags reads as one row, the way Claude writes them.
function format(value, indent) {
  if (isPlain(value)) return JSON.stringify(value)
  if (Array.isArray(value) && value.every(isPlain)) {
    const line = `[${value.map(item => JSON.stringify(item)).join(', ')}]`
    if (indent.length + line.length <= LINE_WIDTH) return line
  }
  const inner = `${indent}  `
  const entries = Array.isArray(value)
    ? value.map(item => `${inner}${format(item, inner)}`)
    : Object.entries(value).map(([key, item]) => `${inner}${JSON.stringify(key)}: ${format(item, inner)}`)
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return entries.length === 0 ? `${open}${close}` : `${open}\n${entries.join(',\n')}\n${indent}${close}`
}

export function toJson(value) {
  return `${format(value, '')}\n`
}

// Missing, or caught half-written: the caller treats both as not there yet.
export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

// The .json names in a folder, sorted; none when the folder is missing.
export function listJson(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter(name => name.endsWith('.json'))
      .sort()
  } catch {
    return []
  }
}

async function withRetry(operation) {
  for (let attempt = 1; ; attempt++) {
    try {
      return operation()
    } catch (error) {
      if (!RETRY_CODES.has(error.code) || attempt >= RETRY_LIMIT) throw error
      await new Promise(resolve => setTimeout(resolve, RETRY_MS))
    }
  }
}

export async function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}-${Date.now()}${TMP_SUFFIX}`
  fs.writeFileSync(tmp, toJson(value))
  try {
    await withRetry(() => fs.renameSync(tmp, file))
  } catch (error) {
    fs.rmSync(tmp, { force: true })
    throw error
  }
}

export async function removeFile(file) {
  await withRetry(() => fs.rmSync(file, { force: true }))
}

export function createRecentWrites() {
  const writtenAt = new Map()
  return {
    mark(file) {
      writtenAt.set(path.resolve(file), Date.now())
    },
    has(file) {
      const at = writtenAt.get(path.resolve(file))
      return at !== undefined && Date.now() - at < RECENT_WRITE_MS
    },
  }
}
