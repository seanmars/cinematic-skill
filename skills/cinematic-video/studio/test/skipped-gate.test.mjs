import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DELIVERED,
  cleanUp,
  connectEvents,
  makeWorkspace,
  openGate,
  sleep,
  startStudio,
  writeJson,
  writeReply,
  writeText,
} from './studio-helpers.mjs'

let workspace
let studio

function answered(gateId, decision) {
  openGate(workspace, gateId, DELIVERED)
  writeReply(workspace, gateId, decision)
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
    openGate(workspace, '003-storyboard')
    const listener = await connectEvents(studio)

    writeText(workspace, 'video/demo/index.html', '<p>built early</p>')

    const event = await listener.waitFor(e => e.event === 'studio:warning')
    expect(event.data).toMatchObject({ skipped: 'storyboard', file: 'index.html' })
  })

  it('warns when a storyboard appears before a treatment was picked', async () => {
    openGate(workspace, '002-treatments')
    writeReply(workspace, '002-treatments', 'redo')
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
