import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanUp,
  connectEvents,
  makeWorkspace,
  readJson,
  request,
  sleep,
  startStudio,
  writeJson,
  writeText,
} from './studio-helpers.mjs'

const MODULE_PAGE = `<!doctype html>
<html>
<head>
<script type="importmap">{ "imports": { "scene": "./scene.mjs" } }</script>
</head>
<body>
<script type="module">
import { draw } from 'scene'
window.render = t => draw(t)
</script>
</body>
</html>
`

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

function get(urlPath, headers = {}) {
  return request(studio.port, 'GET', urlPath, { headers })
}

describe('static preview', () => {
  it('使用 module script 的頁面: serves the page byte for byte, untouched by Vite', async () => {
    writeText(workspace, 'video/demo/module.html', MODULE_PAGE)
    writeText(workspace, 'video/demo/scene.mjs', 'export const draw = () => {}\n')

    const page = await get('/__video/demo/module.html')
    const module = await get('/__video/demo/scene.mjs')

    expect(page.status).toBe(200)
    expect(page.headers['content-type']).toMatch(/^text\/html\b/)
    expect(page.text).toBe(MODULE_PAGE)
    expect(module.text).toBe('export const draw = () => {}\n')
    const index = await get('/__video/demo/index.html')
    expect(index.text).toBe(fs.readFileSync(path.join(workspace, 'video/demo/index.html'), 'utf8'))
  })

  it.each([
    ['page.js', 'text/javascript'],
    ['scene.mjs', 'text/javascript'],
    ['data.json', 'application/json'],
    ['physics.wasm', 'application/wasm'],
    ['logo.svg', 'image/svg+xml'],
  ])('serves %s as %s, the type render.py gives it', async (file, type) => {
    writeText(workspace, `video/demo/${file}`, 'x')

    const res = await get(`/__video/demo/${file}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type'].split(';')[0]).toBe(type)
  })

  it('播放成片: answers a byte range, so the player can seek', async () => {
    const film = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256))
    fs.mkdirSync(path.join(workspace, 'video/demo/out'))
    fs.writeFileSync(path.join(workspace, 'video/demo/out/final.mp4'), film)

    const res = await get('/__video/demo/out/final.mp4', { range: 'bytes=100-199' })

    expect(res.status).toBe(206)
    expect(res.headers['content-range']).toBe('bytes 100-199/1000')
    expect(res.headers['content-type']).toBe('video/mp4')
    expect(res.headers['content-length']).toBe('100')
  })

  it.each([
    '/__video/demo/../../studio.config.json',
    '/__video/demo/%2e%2e/%2e%2e/studio.config.json',
    '/__video/demo/..%2f..%2fstudio.config.json',
    '/__video/demo/..%5c..%5cstudio.config.json',
    '/__video/demo/../demo-two/secret.txt',
  ])('擋下跳出 root 的路徑: refuses %s', async urlPath => {
    writeText(workspace, 'video/demo-two/secret.txt', 'another project')

    const res = await get(urlPath)

    expect(res.status).toBe(404)
    expect(res.text).not.toContain('skillVersion')
    expect(res.text).not.toContain('another project')
  })

  it('answers 404 for a missing file instead of falling back to the studio page', async () => {
    const res = await get('/__video/demo/missing.html')

    expect(res.status).toBe(404)
    expect(res.text).not.toContain('<div id="root">')
  })

  it('serves only projects, and only reads', async () => {
    writeText(workspace, 'video/old-promo/index.html', '<p>old</p>')

    expect((await get('/__video/old-promo/index.html')).status).toBe(404)
    expect((await request(studio.port, 'POST', '/__video/demo/index.html', { body: 'x' })).status).not.toBe(200)
  })
})

describe('renderRoot', () => {
  it('serves from the root the storyboard names, like render.py --root', async () => {
    const storyboard = readJson(workspace, 'video/demo/storyboard.json')
    writeJson(workspace, 'video/demo/storyboard.json', { ...storyboard, renderRoot: '..' })
    writeText(workspace, 'video/fonts/brand.css', '@font-face {}\n')

    const project = await studio.get('/api/projects/demo')
    const font = await get('/__video/demo/fonts/brand.css')
    const page = await get('/__video/demo/demo/index.html')

    expect(project.body.previewBase).toBe('/__video/demo/demo/')
    expect(font.text).toBe('@font-face {}\n')
    expect(page.status).toBe(200)
  })

  it('defaults to the project folder', async () => {
    expect((await studio.get('/api/projects/demo')).body.previewBase).toBe('/__video/demo/')
  })

  it('refuses a root outside video/', async () => {
    const storyboard = readJson(workspace, 'video/demo/storyboard.json')
    writeJson(workspace, 'video/demo/storyboard.json', { ...storyboard, renderRoot: '../..' })

    expect((await studio.get('/api/projects/demo')).body.previewBase).toBeNull()
    expect((await get('/__video/demo/studio.config.json')).status).toBe(404)
  })
})

describe('preview push', () => {
  it('pushes one studio:preview after a burst of page edits', async () => {
    const listener = await connectEvents(studio)

    for (let edit = 0; edit < 3; edit++) {
      writeText(workspace, 'video/demo/index.html', `<p>edit ${edit}</p>`)
      await sleep(50)
    }

    await listener.waitFor(e => e.event === 'studio:preview')
    await sleep(600)
    expect(listener.events.filter(e => e.event === 'studio:preview')).toEqual([
      { event: 'studio:preview', data: { slug: 'demo' } },
    ])
  })

  it('does not reload the preview for stills, renders or studio files', async () => {
    const listener = await connectEvents(studio)

    writeText(workspace, 'video/demo/qa/stills/s1-0.9.png', 'png')
    writeText(workspace, 'video/demo/out/final.mp4', 'mp4')
    writeJson(workspace, 'video/demo/studio/progress.json', { shots: {} })

    await listener.waitFor(e => e.event === 'studio:project' && e.data.file === 'studio/progress.json')
    await sleep(600)
    expect(listener.events.filter(e => e.event === 'studio:preview')).toEqual([])
  })
})
