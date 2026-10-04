import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, connectEvents, gate, makeWorkspace, sleep, startStudio, writeJson, writeText } from './studio-helpers.mjs'

const GATES = 'video/demo/studio/gates'
const REPLIES = 'video/demo/studio/replies'
const DELIVERED = { deliveredAt: '2026-10-04T04:01:00.000Z' }

let workspace
let studio

function answered(gateId, decision) {
  writeJson(workspace, `${GATES}/${gateId}.json`, gate(gateId, DELIVERED))
  writeJson(workspace, `${REPLIES}/${gateId}.json`, { decision, notes: '', changes: [] })
}

beforeEach(async () => {
  workspace = makeWorkspace()
  answered('001-intake', 'approve')
  answered('002-treatments', 'pick')
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('skipped gate warning', () => {
  it('分鏡還沒核准就出現 Build 產出: warns that Claude may have skipped the storyboard gate', async () => {
    const listener = await connectEvents(studio)

    writeText(workspace, 'video/demo/qa/stills/s1-0.9.png', 'png')

    const event = await listener.waitFor(e => e.event === 'studio:warning')
    expect(event.data).toEqual({ slug: 'demo', skipped: 'storyboard', file: 'qa/stills/s1-0.9.png' })
    expect((await studio.get('/api/projects/demo')).body.warnings).toEqual([
      { skipped: 'storyboard', file: 'qa/stills/s1-0.9.png' },
    ])
  })

  it('warns when the picture code changes while the storyboard gate waits for a reply', async () => {
    writeJson(workspace, `${GATES}/003-storyboard.json`, gate('003-storyboard'))
    const listener = await connectEvents(studio)

    writeText(workspace, 'video/demo/index.html', '<p>built early</p>')

    const event = await listener.waitFor(e => e.event === 'studio:warning')
    expect(event.data).toMatchObject({ skipped: 'storyboard', file: 'index.html' })
  })

  it('warns when a storyboard appears before a treatment was picked', async () => {
    writeJson(workspace, `${GATES}/002-treatments.json`, gate('002-treatments'))
    writeJson(workspace, `${REPLIES}/002-treatments.json`, { decision: 'redo', notes: '', changes: [] })
    const listener = await connectEvents(studio)

    writeJson(workspace, 'video/demo/storyboard.json', { shots: [] })

    const event = await listener.waitFor(e => e.event === 'studio:warning')
    expect(event.data).toMatchObject({ skipped: 'treatments', file: 'storyboard.json' })
  })

  it.each([
    ['the storyboard gate was approved', () => answered('003-storyboard', 'approve')],
    ['the storyboard gate is set to auto-continue', () => {
      writeJson(workspace, 'video/demo/studio/settings.json', { autoContinue: ['storyboard'] })
    }],
  ])('stays quiet once %s', async (_, arrange) => {
    arrange()
    const listener = await connectEvents(studio)

    writeText(workspace, 'video/demo/qa/stills/s1-0.9.png', 'png')
    writeJson(workspace, 'video/demo/studio/progress.json', { shots: {} })

    await listener.waitFor(e => e.event === 'studio:project' && e.data.file === 'studio/progress.json')
    await sleep(300)
    expect(listener.events.filter(e => e.event === 'studio:warning')).toEqual([])
  })
})
