import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ripple } from '../server/ripple.mjs'
import {
  DELIVERED,
  cleanUp,
  makeWorkspace,
  openGate,
  readJson,
  startStudio,
  writeJson,
  writeReply,
  writeText,
} from './studio-helpers.mjs'

// fixtures/demo: s1 0–1.786, s2 1.786–2.55, s3 2.55–5.714, s4 5.714–8.
const SHOTS = [
  { id: 's1', duration: 1.786, text: { picture: 'desk' } },
  { id: 's2', duration: 0.764, text: { picture: 'folds' } },
  { id: 's3', duration: 3.164, text: { picture: 'launch' } },
  { id: 's4', duration: 2.286, text: { picture: 'landing' } },
]
const PLAN = [
  ['tick', 1.786, 4, 'first fold'],
  ['tick', 2.168, 4, 'second fold'],
  ['whoosh', 3.4, 2, 'launch peak'],
  ['tick', 5.714, 3, 'landing'],
]

function durations(shots) {
  return shots.map(shot => shot.duration)
}

function total(shots) {
  return Math.round(shots.reduce((sum, shot) => sum + shot.duration, 0) * 1e6) / 1e6
}

describe('ripple', () => {
  it('拉長中間的一顆鏡頭: later shots and their cues move by the difference, the shot\'s own cue is flagged', () => {
    const result = ripple(SHOTS, PLAN, 's3', 4.0, { hasScore: false })

    expect(durations(result.shots)).toEqual([1.786, 0.764, 4.0, 2.286])
    expect(total(result.shots)).toBe(8.836)
    expect(result.plan.map(cue => cue[1])).toEqual([1.786, 2.168, 3.4, 6.55])
    expect(result.changes).toEqual(['shots[s3].duration', 'audio/plan.json[3].time', 'realign:audio/plan.json[2]'])
  })

  it('剛好落在鏡頭起點的 cue: belongs to the shot it starts, so it moves with it', () => {
    const result = ripple(SHOTS, PLAN, 's1', 2.0, { hasScore: false })

    expect(result.plan[0]).toEqual(['tick', 2.0, 4, 'first fold'])
    expect(result.changes).toContain('audio/plan.json[0].time')
    expect(result.changes).not.toContain('realign:audio/plan.json[0]')
  })

  it('shortening moves later cues earlier and leaves the shot\'s own cue where it was', () => {
    const result = ripple(SHOTS, PLAN, 's3', 0.5, { hasScore: false })

    expect(total(result.shots)).toBe(5.336)
    expect(result.plan.map(cue => cue[1])).toEqual([1.786, 2.168, 3.4, 3.05])
    expect(result.changes).toContain('realign:audio/plan.json[2]')
  })

  it('the last shot: nothing after it moves, its cues are flagged, cues past the end move', () => {
    const plan = [...PLAN, ['sting', 8.0, 0, 'button']]

    const result = ripple(SHOTS, plan, 's4', 3.0, { hasScore: false })

    expect(total(result.shots)).toBe(8.714)
    expect(result.plan.map(cue => cue[1])).toEqual([1.786, 2.168, 3.4, 5.714, 8.714])
    expect(result.changes).toEqual(['shots[s4].duration', 'audio/plan.json[4].time', 'realign:audio/plan.json[3]'])
  })

  it('沒有 plan: changes the shots alone', () => {
    const result = ripple(SHOTS, null, 's2', 1.0, { hasScore: false })

    expect(result.plan).toBeNull()
    expect(durations(result.shots)).toEqual([1.786, 1.0, 3.164, 2.286])
    expect(result.changes).toEqual(['shots[s2].duration'])
  })

  it('有配樂時加上 music-recut', () => {
    expect(ripple(SHOTS, PLAN, 's3', 4.0, { hasScore: true }).changes.at(-1)).toBe('music-recut')
    expect(ripple(SHOTS, null, 's3', 4.0, { hasScore: true }).changes).toEqual(['shots[s3].duration', 'music-recut'])
  })

  it('leaves every other field of the plan as it was, extra columns included', () => {
    const plan = [
      ['tick', 1.786, 4, 'first fold', -30, -6],
      ['whoosh', 5.9, 2, 'landing swell', -24],
    ]

    const result = ripple(SHOTS, plan, 's3', 4.0, { hasScore: false })

    expect(result.plan).toEqual([
      ['tick', 1.786, 4, 'first fold', -30, -6],
      ['whoosh', 6.736, 2, 'landing swell', -24],
    ])
  })

  it('does not touch its inputs', () => {
    const shots = structuredClone(SHOTS)
    const plan = structuredClone(PLAN)

    ripple(shots, plan, 's3', 4.0, { hasScore: true })

    expect(shots).toEqual(SHOTS)
    expect(plan).toEqual(PLAN)
  })
})

describe('duration edits at a gate', () => {
  let workspace
  let studio

  beforeEach(async () => {
    workspace = makeWorkspace()
    studio = await startStudio(workspace)
  })

  afterEach(cleanUp)

  it('writes the storyboard and the plan, and lists the changes for the reply', async () => {
    openGate(workspace, '005-build-animatic')

    const res = await studio.post('/api/projects/demo/storyboard/duration', { shot: 's3', duration: 4.0 })

    expect(res.status, res.text).toBe(200)
    expect(res.body.changes).toEqual(['shots[s3].duration', 'audio/plan.json[3].time', 'realign:audio/plan.json[2]'])
    expect(readJson(workspace, 'video/demo/storyboard.json').shots.map(shot => shot.duration)).toEqual([
      1.786, 0.764, 4, 2.286,
    ])
    expect(readJson(workspace, 'video/demo/audio/plan.json')).toEqual([
      ['tick', 1.786, 4, 'first fold'],
      ['tick', 2.168, 4, 'second fold'],
      ['whoosh', 3.4, 2, 'launch peak'],
      ['tick', 6.55, 3, 'landing'],
    ])
    expect((await studio.get('/api/projects/demo')).body.changes).toEqual(res.body.changes)
  })

  it('keeps one cue per line, as the plan was written', async () => {
    openGate(workspace, '005-build-animatic')

    await studio.post('/api/projects/demo/storyboard/duration', { shot: 's3', duration: 4.0 })

    expect(fs.readFileSync(path.join(workspace, 'video/demo/audio/plan.json'), 'utf8')).toBe(
      [
        '[',
        '  ["tick", 1.786, 4, "first fold"],',
        '  ["tick", 2.168, 4, "second fold"],',
        '  ["whoosh", 3.4, 2, "launch peak"],',
        '  ["tick", 6.55, 3, "landing"]',
        ']',
        '',
      ].join('\n'),
    )
  })

  it('adds music-recut when audio/ holds a score', async () => {
    openGate(workspace, '005-build-animatic')
    writeText(workspace, 'video/demo/audio/music-cut.wav', 'RIFF')

    const res = await studio.post('/api/projects/demo/storyboard/duration', { shot: 's3', duration: 4.0 })

    expect(res.body.changes.at(-1)).toBe('music-recut')
  })

  it('adds music-recut when the storyboard plans a score', async () => {
    openGate(workspace, '005-build-animatic')
    const storyboard = readJson(workspace, 'video/demo/storyboard.json')
    writeJson(workspace, 'video/demo/storyboard.json', {
      ...storyboard,
      inputs: { ...storyboard.inputs, audio: 'Library score cut to 84 BPM; SFX on each fold' },
    })

    const res = await studio.post('/api/projects/demo/storyboard/duration', { shot: 's3', duration: 4.0 })

    expect(res.body.changes.at(-1)).toBe('music-recut')
  })

  it.each([0, -1, 'four', null])('refuses the duration %s', async duration => {
    openGate(workspace, '005-build-animatic')
    const before = readJson(workspace, 'video/demo/storyboard.json')

    const res = await studio.post('/api/projects/demo/storyboard/duration', { shot: 's3', duration })

    expect(res.status).toBe(400)
    expect(readJson(workspace, 'video/demo/storyboard.json')).toEqual(before)
  })

  it('refuses while Claude works, leaving both files alone', async () => {
    openGate(workspace, '005-build-animatic', DELIVERED)
    writeReply(workspace, '005-build-animatic', 'approve')
    const plan = readJson(workspace, 'video/demo/audio/plan.json')

    const res = await studio.post('/api/projects/demo/storyboard/duration', { shot: 's3', duration: 4.0 })

    expect(res.status).toBe(409)
    expect(readJson(workspace, 'video/demo/audio/plan.json')).toEqual(plan)
  })
})
