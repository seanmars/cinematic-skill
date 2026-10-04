import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, gate, makeWorkspace, readJson, startStudio, writeJson, writeText } from './studio-helpers.mjs'

const GATE = 'video/demo/studio/gates/003-storyboard.json'
const EDIT_URL = '/api/projects/demo/storyboard'

let workspace
let studio
let original

beforeEach(async () => {
  workspace = makeWorkspace()
  original = readJson(workspace, 'video/demo/storyboard.json')
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

function shot(storyboard, id) {
  return storyboard.shots.find(candidate => candidate.id === id)
}

describe('storyboard edits at a gate', () => {
  it('更換運鏡: writes the field and lists it as changed', async () => {
    writeJson(workspace, GATE, gate('003-storyboard'))
    expect(shot(original, 's1').techniques.movement).toBe('camera-movement/push-in.md')

    const res = await studio.post(EDIT_URL, { shot: 's1', field: 'techniques.movement', value: 'camera-movement/crane-up.md' })

    expect(res.status, res.text).toBe(200)
    expect(res.body.changes).toEqual(['shots[s1].techniques.movement'])
    const saved = readJson(workspace, 'video/demo/storyboard.json')
    expect(shot(saved, 's1').techniques.movement).toBe('camera-movement/crane-up.md')
    expect({ ...saved, shots: saved.shots.filter(candidate => candidate.id !== 's1') }).toEqual({
      ...original,
      shots: original.shots.filter(candidate => candidate.id !== 's1'),
    })
    expect({ ...shot(saved, 's1'), techniques: {} }).toEqual({ ...shot(original, 's1'), techniques: {} })
  })

  it('sends the changed fields with the reply, merged with what the page sent', async () => {
    writeJson(workspace, GATE, gate('003-storyboard'))
    await studio.post(EDIT_URL, { shot: 's1', field: 'techniques.movement', value: 'camera-movement/crane-up.md' })
    await studio.post(EDIT_URL, { shot: 's2', field: 'text.picture', value: 'One fold, then a second.' })
    await studio.post(EDIT_URL, { shot: 's1', field: 'techniques.movement', value: 'camera-movement/jib-up.md' })

    const pending = (await studio.get('/api/projects/demo')).body.changes
    const reply = await studio.post('/api/projects/demo/replies/003-storyboard', {
      decision: 'approve',
      notes: '',
      changes: ['shots[s3].text.camera'],
    })

    expect(pending).toEqual(['shots[s1].techniques.movement', 'shots[s2].text.picture'])
    expect(reply.status, reply.text).toBe(200)
    expect(readJson(workspace, 'video/demo/studio/replies/003-storyboard.json').changes).toEqual([
      'shots[s1].techniques.movement',
      'shots[s2].text.picture',
      'shots[s3].text.camera',
    ])
    expect((await studio.get('/api/projects/demo')).body.changes).toEqual([])
  })

  it.each([
    ['tags', ['lighting/top-light.md', 'color/warm-amber.md']],
    ['techniques.transition', null],
    ['text.camera', 'Hold, then a slow push.'],
  ])('edits %s', async (field, value) => {
    writeJson(workspace, GATE, gate('003-storyboard'))

    const res = await studio.post(EDIT_URL, { shot: 's1', field, value })

    expect(res.status, res.text).toBe(200)
    const [group, key] = field.split('.')
    const saved = shot(readJson(workspace, 'video/demo/storyboard.json'), 's1')
    expect(key === undefined ? saved[group] : saved[group][key]).toEqual(value)
  })

  it('accepts a custom technique of the project', async () => {
    writeJson(workspace, GATE, gate('003-storyboard'))
    writeText(workspace, 'video/demo/techniques/camera-movement/drone-spiral.md', '---\nname: Drone Spiral\n---\n')

    const res = await studio.post(EDIT_URL, { shot: 's1', field: 'techniques.movement', value: 'camera-movement/drone-spiral.md' })

    expect(res.status, res.text).toBe(200)
  })

  it.each([
    ['a technique that does not exist', 'techniques.movement', 'camera-movement/push-inn.md'],
    ['a technique of another category in a main slot', 'techniques.movement', 'framing/wide-shot.md'],
    ['a main-slot category among the tags', 'tags', ['camera-movement/crane-up.md']],
    ['repeated tags', 'tags', ['lighting/top-light.md', 'lighting/top-light.md']],
    ['an empty picture', 'text.picture', ''],
    ['a field the studio does not edit', 'assets', ['x.png']],
    ['an unknown text field', 'text.mood', 'calm'],
  ])('refuses %s', async (_, field, value) => {
    writeJson(workspace, GATE, gate('003-storyboard'))

    const res = await studio.post(EDIT_URL, { shot: 's1', field, value })

    expect(res.status).toBe(400)
    expect(readJson(workspace, 'video/demo/storyboard.json')).toEqual(original)
  })

  it('refuses a shot the storyboard does not have', async () => {
    writeJson(workspace, GATE, gate('003-storyboard'))

    const res = await studio.post(EDIT_URL, { shot: 's9', field: 'text.camera', value: 'x' })

    expect(res.status).toBe(404)
  })
})

describe('read-only while Claude works', () => {
  it.each([
    ['Claude 工作中: the gate was answered', () => {
      writeJson(workspace, GATE, gate('003-storyboard', { deliveredAt: '2026-10-04T04:01:00.000Z' }))
      writeJson(workspace, 'video/demo/studio/replies/003-storyboard.json', { decision: 'approve', notes: '', changes: [] })
    }],
    ['the reply waits for the mod', () => {
      writeJson(workspace, GATE, gate('003-storyboard'))
      writeJson(workspace, 'video/demo/studio/replies/003-storyboard.json', { decision: 'approve', notes: '', changes: [] })
    }],
    ['no gate is open', () => {}],
  ])('refuses edits when %s', async (_, arrange) => {
    arrange()

    const res = await studio.post(EDIT_URL, { shot: 's1', field: 'techniques.movement', value: 'camera-movement/crane-up.md' })

    expect(res.status).toBe(409)
    expect(readJson(workspace, 'video/demo/storyboard.json')).toEqual(original)
  })
})
