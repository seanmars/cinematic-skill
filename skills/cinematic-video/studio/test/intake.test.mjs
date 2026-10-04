import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STALE,
  STATE,
  cleanUp,
  exists,
  listFiles,
  makeWorkspace,
  readJson,
  startStudio,
  writeSession,
} from './studio-helpers.mjs'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const FORM = {
  brief: 'A kettle that sings the morning news',
  specs: '15s, 1080x1920, 30fps',
  profile: 'stylized',
  brand: 'D:/brand/kettle',
  assets: ['D:/assets/kettle.png', 'D:/assets/steam.mp4'],
}

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('intake from the studio', () => {
  it('只有一個線上 session: creates the project and assigns it to that session', async () => {
    writeSession(workspace, 'session-online')
    writeSession(workspace, 'session-crashed', STALE)
    writeSession(workspace, 'session-ended', { online: false })

    const res = await studio.post('/api/intake', FORM)

    expect(res.status, res.text).toBe(200)
    const slug = 'a-kettle-that-sings'
    expect(res.body.slug).toBe(slug)
    expect(readJson(workspace, `video/${slug}/studio/intake.json`)).toEqual({
      slug,
      submittedAt: expect.stringMatching(ISO),
      ...FORM,
    })
    const assignment = { slug, sessionId: 'session-online', assignedAt: expect.stringMatching(ISO), reason: 'intake' }
    expect(readJson(workspace, `${STATE}/assignments/${slug}.json`)).toEqual(assignment)
    expect(res.body.assignment).toEqual(assignment)
  })

  it('沒有線上 session: still creates the project and its intake, unassigned', async () => {
    writeSession(workspace, 'session-ended', { online: false })

    const res = await studio.post('/api/intake', FORM)

    expect(res.status, res.text).toBe(200)
    expect(res.body.assignment).toBeNull()
    expect(exists(workspace, `video/${res.body.slug}/studio/intake.json`)).toBe(true)
    expect(listFiles(workspace, `${workspace}/${STATE}/assignments`)).toEqual([])
  })

  it('多個線上 session: leaves the choice to the user', async () => {
    writeSession(workspace, 'session-a')
    writeSession(workspace, 'session-b')

    const res = await studio.post('/api/intake', FORM)

    expect(res.status, res.text).toBe(200)
    expect(res.body.assignment).toBeNull()
    expect(exists(workspace, `video/${res.body.slug}/studio/intake.json`)).toBe(true)
    expect(listFiles(workspace, `${workspace}/${STATE}/assignments`)).toEqual([])
  })

  it('assigns to the session the user picked', async () => {
    writeSession(workspace, 'session-a')
    writeSession(workspace, 'session-b')

    const res = await studio.post('/api/intake', { ...FORM, sessionId: 'session-b' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `${STATE}/assignments/${res.body.slug}.json`).sessionId).toBe('session-b')
  })

  it('refuses a picked session that is offline, creating nothing', async () => {
    writeSession(workspace, 'session-crashed', STALE)

    const res = await studio.post('/api/intake', { ...FORM, sessionId: 'session-crashed' })

    expect(res.status).toBe(409)
    expect(listFiles(workspace, `${workspace}/video`).filter(file => !file.startsWith('video/demo/'))).toEqual([])
  })

  it('lists the new project right away', async () => {
    const res = await studio.post('/api/intake', FORM)

    const list = await studio.get('/api/projects')
    expect(list.body.projects.map(project => project.slug)).toContain(res.body.slug)
  })
})

describe('slug rule', () => {
  it('takes the slug the user typed', async () => {
    const res = await studio.post('/api/intake', { ...FORM, slug: 'kettle-news' })

    expect(res.status, res.text).toBe(200)
    expect(res.body.slug).toBe('kettle-news')
    expect(exists(workspace, 'video/kettle-news/studio/intake.json')).toBe(true)
  })

  it('refuses a typed slug that is taken, leaving that project alone', async () => {
    const before = listFiles(workspace, `${workspace}/video/demo`)

    const res = await studio.post('/api/intake', { ...FORM, slug: 'demo' })

    expect(res.status).toBe(409)
    expect(listFiles(workspace, `${workspace}/video/demo`)).toEqual(before)
  })

  it.each(['Kettle News', 'kettle_news', '-kettle', '../escape'])('refuses the typed slug %s', async slug => {
    const res = await studio.post('/api/intake', { ...FORM, slug })

    expect(res.status).toBe(400)
  })

  it('derives a free slug from the brief, numbering repeats', async () => {
    const first = await studio.post('/api/intake', FORM)
    const second = await studio.post('/api/intake', FORM)

    expect(first.body.slug).toBe('a-kettle-that-sings')
    expect(second.body.slug).toBe('a-kettle-that-sings-2')
  })

  it('falls back to a dated slug when the brief has no latin words', async () => {
    const res = await studio.post('/api/intake', { ...FORM, brief: '一隻會唱晨間新聞的水壺' })

    expect(res.status, res.text).toBe(200)
    expect(res.body.slug).toMatch(/^film-\d{8}$/)
  })
})

describe('intake form checks', () => {
  it.each([
    ['an empty brief', { ...FORM, brief: '  ' }],
    ['an unknown profile', { ...FORM, profile: 'documentary' }],
    ['asset paths that are not a list', { ...FORM, assets: 'D:/assets/kettle.png' }],
    ['specs that are not text', { ...FORM, specs: 15 }],
  ])('refuses %s', async (_, body) => {
    const res = await studio.post('/api/intake', body)

    expect(res.status).toBe(400)
    expect(listFiles(workspace, `${workspace}/video`).filter(file => !file.startsWith('video/demo/'))).toEqual([])
  })

  it('accepts a brief alone, leaving the rest for Claude to ask or default', async () => {
    const res = await studio.post('/api/intake', { brief: 'A paper plane crosses a desk' })

    expect(res.status, res.text).toBe(200)
    expect(readJson(workspace, `video/${res.body.slug}/studio/intake.json`)).toMatchObject({
      brief: 'A paper plane crosses a desk',
      specs: '',
      profile: null,
      brand: '',
      assets: [],
    })
  })
})
