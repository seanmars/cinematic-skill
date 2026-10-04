import path from 'node:path'
import { readJson } from './files.mjs'
import { HttpError } from './http-error.mjs'
import { STAGES, projectDir } from './projects.mjs'

// studio/settings.json: the studio's own file, so it may change while Claude
// works. The mod reads it each time Claude opens a gate.
function settingsPath(dir) {
  return path.join(dir, 'studio/settings.json')
}

export function readSettings(dir) {
  const settings = readJson(settingsPath(dir))
  return { autoContinue: Array.isArray(settings?.autoContinue) ? settings.autoContinue : [] }
}

export async function postSettings(workspace, slug, body, write) {
  const dir = projectDir(workspace, slug)
  const autoContinue = body?.autoContinue
  if (
    !Array.isArray(autoContinue) ||
    !autoContinue.every(stage => STAGES.includes(stage)) ||
    new Set(autoContinue).size !== autoContinue.length
  ) {
    throw new HttpError(400, `autoContinue takes distinct stages of ${STAGES.join(', ')}`)
  }
  const settings = { autoContinue }
  await write(settingsPath(dir), settings)
  return { settings }
}
