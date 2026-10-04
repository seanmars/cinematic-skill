import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STATE, cleanUp, connectEvents, makeWorkspace, startStudio, writeJson, writeSession } from './studio-helpers.mjs'

// What render.py --progress-file writes while a render runs.
const RENDER_PROGRESS = {
  frame: 120,
  frames: 240,
  sample: 120,
  samples: 240,
  elapsed: 30.5,
  eta: 30.5,
  updatedAt: '2026-10-04T05:00:30.500Z',
  done: false,
}

// What Claude writes during Build in web mode (D8).
const BUILD_PROGRESS = {
  shots: {
    s1: { status: 'done', stills: ['qa/stills/s1-0.9.png'] },
    s2: { status: 'building', stills: [] },
  },
}

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('render progress', () => {
  it('render 進度: shows the frames done and the time left of a running render', async () => {
    expect((await studio.get('/api/projects/demo')).body.render).toBeNull()

    writeJson(workspace, `${STATE}/render/demo.json`, RENDER_PROGRESS)

    expect((await studio.get('/api/projects/demo')).body.render).toEqual(RENDER_PROGRESS)
  })

  it('pushes studio:renders each time the progress file changes', async () => {
    const listener = await connectEvents(studio)

    writeJson(workspace, `${STATE}/render/demo.json`, RENDER_PROGRESS)
    await listener.waitFor(e => e.event === 'studio:renders' && e.data.renders.demo?.frame === 120)

    writeJson(workspace, `${STATE}/render/demo.json`, { ...RENDER_PROGRESS, frame: 240, sample: 240, eta: 0, done: true })
    await listener.waitFor(e => e.event === 'studio:renders' && e.data.renders.demo?.done === true)
  })
})

describe('build progress', () => {
  it('一顆鏡頭完成: shows each shot status and stills from progress.json', async () => {
    expect((await studio.get('/api/projects/demo')).body.progress).toBeNull()

    writeJson(workspace, 'video/demo/studio/progress.json', BUILD_PROGRESS)

    expect((await studio.get('/api/projects/demo')).body.progress).toEqual(BUILD_PROGRESS)
  })

  it('pushes studio:project when Claude updates progress.json', async () => {
    const listener = await connectEvents(studio)

    writeJson(workspace, 'video/demo/studio/progress.json', BUILD_PROGRESS)

    await listener.waitFor(e => e.event === 'studio:project' && e.data.file === 'studio/progress.json')
  })
})

describe('activity', () => {
  const PERMISSION = {
    sessionId: 'session-a',
    message: 'Claude needs your permission to use Bash',
    waitingSince: '2026-10-04T05:00:10.000Z',
  }

  function activity(startedAt, endedAt) {
    return { tool: 'Bash', summary: 'uv render.py', startedAt, endedAt }
  }

  async function sessionA() {
    return (await studio.get('/api/sessions')).body.sessions.find(session => session.sessionId === 'session-a')
  }

  it('Claude 派出 critic: shows what the session is doing', async () => {
    const critic = { tool: 'Agent', summary: 'storyboard critic', startedAt: '2026-10-04T05:00:00.000Z', endedAt: null }
    writeSession(workspace, 'session-a', { activity: [critic] })

    expect((await sessionA()).activity).toEqual([critic])
  })

  it('still waits for permission while the call that asked has not ended', async () => {
    writeSession(workspace, 'session-a', { activity: [activity('2026-10-04T05:00:09.000Z', null)] })
    writeJson(workspace, `${STATE}/permission/session-a.json`, PERMISSION)

    expect((await sessionA()).permission).toEqual({ message: PERMISSION.message, waitingSince: PERMISSION.waitingSince })
  })

  it('stops waiting for permission once the session did something after the prompt', async () => {
    writeSession(workspace, 'session-a', {
      activity: [activity('2026-10-04T05:00:09.000Z', '2026-10-04T05:00:15.000Z')],
    })
    writeJson(workspace, `${STATE}/permission/session-a.json`, PERMISSION)

    expect((await sessionA()).permission).toBeNull()
  })
})
