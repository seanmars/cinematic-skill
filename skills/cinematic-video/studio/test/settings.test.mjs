import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELIVERED, cleanUp, exists, makeWorkspace, openGate, readJson, startStudio, writeReply } from './studio-helpers.mjs'

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('auto-continue settings', () => {
  it('對 Audio gate 開啟 auto-continue: writes the settings the mod reads at the next audio gate', async () => {
    expect((await studio.get('/api/projects/demo')).body.settings).toEqual({ autoContinue: [] })

    const res = await studio.post('/api/projects/demo/settings', { autoContinue: ['audio'] })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, 'video/demo/studio/settings.json')).toEqual({ autoContinue: ['audio'] })
    expect((await studio.get('/api/projects/demo')).body.settings).toEqual({ autoContinue: ['audio'] })
  })

  it('can be changed while Claude works: the settings are the studio\'s own file', async () => {
    openGate(workspace, '003-storyboard', DELIVERED)
    writeReply(workspace, '003-storyboard', 'approve')

    const res = await studio.post('/api/projects/demo/settings', { autoContinue: ['audio', 'gauntlet'] })

    expect(res.status, res.text).toBe(200)
  })

  it.each([
    ['an unknown stage', { autoContinue: ['mixing'] }],
    ['a repeated stage', { autoContinue: ['audio', 'audio'] }],
    ['a list that is not one', { autoContinue: 'audio' }],
  ])('refuses %s', async (_, body) => {
    const res = await studio.post('/api/projects/demo/settings', body)

    expect(res.status).toBe(400)
    expect(exists(workspace, 'video/demo/studio/settings.json')).toBe(false)
  })
})
