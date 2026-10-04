import fs from 'node:fs'
import path from 'node:path'
import { readJson } from './files.mjs'
import { HttpError } from './http-error.mjs'
import { projectDir, readGate } from './projects.mjs'

// What each gate may answer (web-gate-payloads): v1 only replies to the
// current stage; going back is asked for in the notes.
const DECISIONS = {
  intake: ['approve'],
  treatments: ['pick', 'mix', 'redo'],
  storyboard: ['approve', 'revise'],
  assets: ['approve', 'regenerate'],
  'build-animatic': ['approve', 'revise'],
  'build-polish': ['approve', 'revise'],
  audio: ['approve', 'revise'],
  gauntlet: ['another-round', 'ship'],
  deliver: ['approve'],
}

function invalid(message) {
  return new HttpError(400, message)
}

function isTextList(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item !== '')
}

function treatmentIds(dir) {
  const options = readJson(path.join(dir, 'treatments.json'))?.options
  return new Set(Array.isArray(options) ? options.map(option => option.id) : [])
}

function requireTreatment(dir, id) {
  if (!treatmentIds(dir).has(id)) throw invalid(`treatments.json has no treatment ${id}`)
}

// The choice a deciding reply carries (gate-reply-choice): which treatment,
// what is mixed in, what the next Gauntlet round looks at first, which
// assets to make again. Every other decision carries none.
function parseChoice(dir, decision, choice) {
  if (decision === 'pick') {
    requireTreatment(dir, choice?.id)
    return { id: choice.id }
  }
  if (decision === 'mix') {
    requireTreatment(dir, choice?.id)
    const { mix } = choice
    if (!Array.isArray(mix) || mix.length === 0) throw invalid('a mix names the elements it takes')
    for (const item of mix) {
      requireTreatment(dir, item?.option)
      if (typeof item.element !== 'string' || item.element === '') throw invalid('a mixed element needs a name')
    }
    return { id: choice.id, mix: mix.map(({ option, element }) => ({ option, element })) }
  }
  if (decision === 'another-round' && choice !== undefined) {
    if (!isTextList(choice.priorities)) throw invalid('priorities take a list of text')
    return { priorities: choice.priorities }
  }
  if (decision === 'regenerate') {
    if (!isTextList(choice?.regenerate) || choice.regenerate.length === 0) throw invalid('regenerate names the assets')
    return { regenerate: choice.regenerate }
  }
  if (choice !== undefined) throw invalid(`${decision} carries no choice`)
  return undefined
}

function parseReply(dir, stage, body) {
  const { decision, notes = '', changes = [], choice } = body ?? {}
  const decisions = DECISIONS[stage]
  if (!decisions.includes(decision)) throw invalid(`the ${stage} gate takes ${decisions.join(', ')}`)
  if (typeof notes !== 'string') throw invalid('notes must be text')
  if (!isTextList(changes)) throw invalid('changes must list the edited fields')
  const parsedChoice = parseChoice(dir, decision, choice)
  return { decision, notes, changes, ...(parsedChoice === undefined ? {} : { choice: parsedChoice }) }
}

// A reply is written once, to a gate that is waiting for one. It carries
// every field edited at the gate, so Claude knows what to re-read.
export async function postReply(workspace, slug, gateId, body, { write, changeLog }) {
  const dir = projectDir(workspace, slug)
  const gate = readGate(dir, gateId)
  if (gate.autoContinue) throw new HttpError(409, `gate ${gateId} continued on its own`)
  const file = path.join(dir, 'studio/replies', `${gateId}.json`)
  if (fs.existsSync(file)) throw new HttpError(409, `gate ${gateId} already has a reply`)
  const parsed = parseReply(dir, gate.stage, body)
  const reply = { ...parsed, changes: [...new Set([...changeLog.list(slug, gateId), ...parsed.changes])] }
  await write(file, reply)
  changeLog.clear(slug, gateId)
  return { reply }
}
