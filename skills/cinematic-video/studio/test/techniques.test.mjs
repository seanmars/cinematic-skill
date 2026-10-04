import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, makeWorkspace, startStudio, writeText } from './studio-helpers.mjs'

const LIBRARY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../references/techniques')

// The section headings of INDEX.md, with the count each one states.
function indexHeadings() {
  const text = fs.readFileSync(path.join(LIBRARY, 'INDEX.md'), 'utf8')
  return [...text.matchAll(/^## (.+) \((\d+)\)$/gm)].map(([, title, count]) => ({ title, count: Number(count) }))
}

function customTechnique({ name, category, slug, summary }) {
  return `---
name: ${name}
category: ${category}
slug: ${slug}
source: user
---

# ${name}

Summary: ${summary}

## How
Spiral up around the subject while climbing.
`
}

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('technique index', () => {
  it("parses every row of INDEX.md into its heading's category", async () => {
    const res = await studio.get('/api/projects/demo/techniques')

    expect(res.status, res.text).toBe(200)
    const { categories, techniques } = res.body
    expect(categories.map(category => ({ title: category.title, count: category.count }))).toEqual(indexHeadings())
    for (const category of categories) {
      expect(techniques.filter(technique => technique.category === category.id), category.id).toHaveLength(category.count)
    }
    expect(techniques).toHaveLength(424)
    expect(techniques).toContainEqual({
      category: 'camera-movement',
      name: 'Crane Up',
      slug: 'crane-up',
      path: 'camera-movement/crane-up.md',
      summary:
        'The crane raises the camera from human height while retreating slightly, shrinking the character to a dot in a larger environment.',
      custom: false,
    })
    for (const technique of techniques) expect(fs.existsSync(path.join(LIBRARY, technique.path)), technique.path).toBe(true)
  })

  it('names the categories the way the storyboard slots use them', async () => {
    const { categories } = (await studio.get('/api/projects/demo/techniques')).body

    expect(categories.map(category => category.id)).toEqual(
      expect.arrayContaining(['framing', 'camera-angles', 'camera-movement', 'editing', 'lighting']),
    )
  })

  it('專案有自訂技巧: lists a technique file of the project, marked custom', async () => {
    writeText(
      workspace,
      'video/demo/techniques/camera-movement/drone-spiral.md',
      customTechnique({
        name: 'Drone Spiral',
        category: 'camera-movement',
        slug: 'drone-spiral',
        summary: 'A drone spirals upward around the subject.',
      }),
    )

    const { techniques } = (await studio.get('/api/projects/demo/techniques')).body

    expect(techniques).toContainEqual({
      category: 'camera-movement',
      name: 'Drone Spiral',
      slug: 'drone-spiral',
      path: 'camera-movement/drone-spiral.md',
      summary: 'A drone spirals upward around the subject.',
      custom: true,
    })
  })

  it('keeps the library version when the project repeats a library path, and skips unknown categories', async () => {
    writeText(
      workspace,
      'video/demo/techniques/camera-movement/push-in.md',
      customTechnique({ name: 'My Push', category: 'camera-movement', slug: 'push-in', summary: 'Mine.' }),
    )
    writeText(
      workspace,
      'video/demo/techniques/sound/whoosh.md',
      customTechnique({ name: 'Whoosh', category: 'sound', slug: 'whoosh', summary: 'A whoosh.' }),
    )

    const { techniques } = (await studio.get('/api/projects/demo/techniques')).body

    const pushIn = techniques.filter(technique => technique.path === 'camera-movement/push-in.md')
    expect(pushIn).toHaveLength(1)
    expect(pushIn[0].custom).toBe(false)
    expect(techniques.some(technique => technique.path === 'sound/whoosh.md')).toBe(false)
  })

  it('opens the full technique file, from the library or the project', async () => {
    writeText(
      workspace,
      'video/demo/techniques/camera-movement/drone-spiral.md',
      customTechnique({ name: 'Drone Spiral', category: 'camera-movement', slug: 'drone-spiral', summary: 'Up.' }),
    )

    const library = await studio.get('/api/projects/demo/techniques/camera-movement/crane-up.md')
    const custom = await studio.get('/api/projects/demo/techniques/camera-movement/drone-spiral.md')
    const missing = await studio.get('/api/projects/demo/techniques/camera-movement/push-inn.md')
    const escape = await studio.get('/api/projects/demo/techniques/..%2F..%2Fstoryboard.json/x.md')

    expect(library.body.markdown).toBe(fs.readFileSync(path.join(LIBRARY, 'camera-movement/crane-up.md'), 'utf8'))
    expect(custom.body.markdown).toContain('Spiral up around the subject')
    expect(missing.status).toBe(404)
    expect(escape.status).toBe(404)
  })
})
