import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, exists, gate, makeWorkspace, readJson, startStudio, writeJson } from './studio-helpers.mjs'

// Each accepted decision is written, then its reply removed so the next
// decision finds the gate open again.
const REPLIES = 'video/demo/studio/replies'

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

function openGate(gateId) {
  writeJson(workspace, `video/demo/studio/gates/${gateId}.json`, gate(gateId))
}

function reply(gateId, body) {
  return studio.post(`/api/projects/demo/replies/${gateId}`, body)
}

describe('decisions per stage', () => {
  it.each([
    ['001-intake', ['approve'], ['revise', 'pick']],
    ['002-treatments', [], ['approve', 'revise', 'ship']],
    ['003-storyboard', ['approve', 'revise'], ['pick', 'ship']],
    ['004-assets', ['approve'], ['revise', 'ship']],
    ['005-build-animatic', ['approve', 'revise'], ['pick', 'redo', 'ship']],
    ['006-build-polish', ['approve', 'revise'], ['ship']],
    ['007-audio', ['approve', 'revise'], ['ship', 'another-round']],
    ['008-gauntlet', ['ship'], ['approve', 'revise']],
    ['009-deliver', ['approve'], ['revise', 'ship']],
  ])('%s takes %j and refuses %j', async (gateId, accepted, refused) => {
    for (const decision of refused) {
      openGate(gateId)
      const res = await reply(gateId, { decision })
      expect(res.status, `${decision}: ${res.text}`).toBe(400)
      expect(exists(workspace, `${REPLIES}/${gateId}.json`)).toBe(false)
    }
    for (const decision of accepted) {
      const res = await reply(gateId, { decision })
      expect(res.status, `${decision}: ${res.text}`).toBe(200)
      expect(readJson(workspace, `${REPLIES}/${gateId}.json`).decision).toBe(decision)
      fs.rmSync(path.join(workspace, REPLIES, `${gateId}.json`))
    }
  })
})

describe('Treatments', () => {
  beforeEach(() => openGate('002-treatments'))

  it('picks one treatment', async () => {
    const res = await reply('002-treatments', { decision: 'pick', notes: '', choice: { id: 'B' } })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/002-treatments.json`)).toEqual({
      decision: 'pick',
      notes: '',
      changes: [],
      choice: { id: 'B' },
    })
  })

  it('Treatments 混搭: records the elements mixed in and the notes', async () => {
    const choice = {
      id: 'A',
      mix: [
        { option: 'A', element: 'look' },
        { option: 'C', element: 'structure' },
      ],
    }

    const res = await reply('002-treatments', { decision: 'mix', notes: 'Warmer grade than A.', choice })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/002-treatments.json`)).toMatchObject({
      decision: 'mix',
      notes: 'Warmer grade than A.',
      choice,
    })
  })

  it('redoes all three, with no choice', async () => {
    const res = await reply('002-treatments', { decision: 'redo', notes: 'None of these feel right.' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/002-treatments.json`).choice).toBeUndefined()
  })

  it.each([
    ['a pick without a choice', { decision: 'pick' }],
    ['a pick of a treatment that is not there', { decision: 'pick', choice: { id: 'Z' } }],
    ['a mix of nothing', { decision: 'mix', choice: { id: 'A', mix: [] } }],
    ['a mix from a treatment that is not there', { decision: 'mix', choice: { id: 'A', mix: [{ option: 'Z', element: 'look' }] } }],
    ['a mix element without a name', { decision: 'mix', choice: { id: 'A', mix: [{ option: 'C', element: '' }] } }],
    ['a redo that carries a choice', { decision: 'redo', choice: { id: 'A' } }],
  ])('refuses %s', async (_, body) => {
    const res = await reply('002-treatments', body)

    expect(res.status).toBe(400)
    expect(exists(workspace, `${REPLIES}/002-treatments.json`)).toBe(false)
  })
})

describe('Gauntlet', () => {
  beforeEach(() => openGate('008-gauntlet'))

  it('Gauntlet 再一輪: records another round and what comes first', async () => {
    const choice = { priorities: ['Frozen time in s3', 'Loudness of the landing tick'] }

    const res = await reply('008-gauntlet', { decision: 'another-round', notes: '', choice })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/008-gauntlet.json`)).toMatchObject({ decision: 'another-round', choice })
  })

  it('takes another round with no priorities', async () => {
    expect((await reply('008-gauntlet', { decision: 'another-round' })).status).toBe(200)
  })

  it('refuses priorities that are not a list of text', async () => {
    expect((await reply('008-gauntlet', { decision: 'another-round', choice: { priorities: 'loudness' } })).status).toBe(400)
  })
})

describe('Assets', () => {
  beforeEach(() => openGate('004-assets'))

  it('regenerates the assets the user picked', async () => {
    const choice = { regenerate: ['source/gen/desk-01.png'] }

    const res = await reply('004-assets', { decision: 'regenerate', choice })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/004-assets.json`).choice).toEqual(choice)
  })

  it('refuses a regenerate that names no asset', async () => {
    expect((await reply('004-assets', { decision: 'regenerate', choice: { regenerate: [] } })).status).toBe(400)
  })
})

describe('v1 stays in the current stage', () => {
  it('v1 不能回到前面的階段: Build animatic takes its own replies, with the wish in the notes', async () => {
    openGate('005-build-animatic')

    expect((await reply('005-build-animatic', { decision: 'pick', choice: { id: 'B' } })).status).toBe(400)
    expect((await reply('005-build-animatic', { decision: 'approve', choice: { id: 'B' } })).status).toBe(400)
    const res = await reply('005-build-animatic', { decision: 'revise', notes: "Use treatment B's grade instead." })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${REPLIES}/005-build-animatic.json`)).toEqual({
      decision: 'revise',
      notes: "Use treatment B's grade instead.",
      changes: [],
    })
  })
})
