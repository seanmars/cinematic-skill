import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, connectEvents, gate, makeWorkspace, sleep, startStudio, writeJson } from './studio-helpers.mjs'

const GATE_FILE = 'video/demo/studio/gates/003-storyboard.json'

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('file change push', () => {
  it('pushes studio:gate when Claude opens a gate', async () => {
    const listener = await connectEvents(studio)

    writeJson(workspace, GATE_FILE, gate('003-storyboard'))

    const event = await listener.waitFor(e => e.event === 'studio:gate')
    expect(event.data).toEqual({ slug: 'demo', file: 'studio/gates/003-storyboard.json' })
  })

  it('pushes studio:project when a new project gets its storyboard', async () => {
    const listener = await connectEvents(studio)

    writeJson(workspace, 'video/new-film/storyboard.json', { shots: [] })

    const event = await listener.waitFor(e => e.event === 'studio:project' && e.data.slug === 'new-film')
    expect(event.data).toEqual({ slug: 'new-film', file: 'storyboard.json' })
  })

  it('does not push the reply the studio itself just wrote', async () => {
    writeJson(workspace, GATE_FILE, gate('003-storyboard'))
    await sleep(300)
    const listener = await connectEvents(studio)

    const res = await studio.post('/api/projects/demo/replies/003-storyboard', { decision: 'approve' })
    expect(res.status, res.text).toBe(200)
    await sleep(300)
    // The mod then records delivery: a write the studio did not make.
    writeJson(workspace, GATE_FILE, gate('003-storyboard', { deliveredAt: '2026-10-04T04:00:02.000Z' }))

    await listener.waitFor(e => e.event === 'studio:gate' && e.data.file === 'studio/gates/003-storyboard.json')
    await sleep(300)
    expect(listener.events.filter(e => e.data?.file?.startsWith('studio/replies/'))).toEqual([])
  })
})
