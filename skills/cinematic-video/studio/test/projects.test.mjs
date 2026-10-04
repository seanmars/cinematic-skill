import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanUp, listFiles, makeWorkspace, startStudio, writeJson, writeText } from './studio-helpers.mjs'

afterEach(cleanUp)

describe('project list', () => {
  it('剛從網頁送出 Intake 的專案 and 舊專案: lists projects with a storyboard or an intake, hides the rest', async () => {
    const workspace = makeWorkspace()
    writeJson(workspace, 'video/fresh-idea/studio/intake.json', {
      slug: 'fresh-idea',
      submittedAt: '2026-10-04T04:00:00.000Z',
      idea: 'A kettle that sings the morning news.',
    })
    writeText(workspace, 'video/old-promo/brief.md', '# Old promo\n')
    const oldMtime = fs.statSync(path.join(workspace, 'video/old-promo/brief.md')).mtimeMs
    const studio = await startStudio(workspace)

    const res = await studio.get('/api/projects')

    expect(res.status, res.text).toBe(200)
    expect(res.body.projects.map(project => project.slug)).toEqual(['demo', 'fresh-idea'])
    expect(listFiles(path.join(workspace, 'video/old-promo'))).toEqual(['brief.md'])
    expect(fs.statSync(path.join(workspace, 'video/old-promo/brief.md')).mtimeMs).toBe(oldMtime)
  })

  it('reads a project with its storyboard, treatments and audio plan', async () => {
    const workspace = makeWorkspace()
    const studio = await startStudio(workspace)

    const res = await studio.get('/api/projects/demo')

    const fixture = file => JSON.parse(fs.readFileSync(path.join(workspace, 'video/demo', file), 'utf8'))
    expect(res.body.storyboard).toEqual(fixture('storyboard.json'))
    expect(res.body.treatments).toEqual(fixture('treatments.json'))
    expect(res.body.plan).toEqual(fixture('audio/plan.json'))
  })

  it('lists nothing in a workspace with an empty video folder', async () => {
    const studio = await startStudio(makeWorkspace({ seed: false }))

    const res = await studio.get('/api/projects')

    expect(res.body).toEqual({ projects: [] })
  })
})
