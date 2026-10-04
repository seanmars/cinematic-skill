import path from 'node:path'
import sirv from 'sirv'
import { readJson } from './files.mjs'
import { findProjectDir } from './projects.mjs'

// Project pages served the way render.py serves them (D5): as plain files,
// never through Vite's HTML transform, from the same root and with the same
// explicit types. The Windows registry can map .js to text/plain.
const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
}

const PREVIEW_URL = /^\/__video\/([^/?]+)(\/[^?]*)?(\?.*)?$/

function isInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative))
}

// render.py's root: the project folder, or --root as the storyboard's
// renderRoot names it. Never a folder outside video/.
function previewRoot(workspace, slug) {
  const dir = findProjectDir(workspace, slug)
  if (dir === null) return null
  const { renderRoot } = readJson(path.join(dir, 'storyboard.json')) ?? {}
  const root = typeof renderRoot === 'string' ? path.resolve(dir, renderRoot) : dir
  return isInside(path.join(workspace, 'video'), root) ? root : null
}

// Where the project folder sits under /__video/<slug>/: the page's URL is
// this plus index.html, a still's this plus its project-relative path.
export function previewBase(workspace, slug) {
  const root = previewRoot(workspace, slug)
  if (root === null) return null
  const project = path.relative(root, findProjectDir(workspace, slug)).split(path.sep).join('/')
  return `/__video/${slug}/${project === '' ? '' : `${project}/`}`
}

function decodedPath(encoded) {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

function notFound(res) {
  res.statusCode = 404
  res.end('Not found')
}

function setType(res, pathname) {
  const type = MIME[path.extname(pathname).toLowerCase()]
  if (type !== undefined) res.setHeader('content-type', type)
}

// Added straight from configureServer, so it runs ahead of Vite's HTML
// middleware and its SPA fallback. sirv answers Range requests, which lets
// <video> seek.
export function createPreview(workspace) {
  return function preview(req, res, next) {
    const match = PREVIEW_URL.exec(req.url)
    if (match === null) return next()
    const [, slug, rest = '/', query = ''] = match
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      return res.end()
    }
    const root = previewRoot(workspace, slug)
    const decoded = decodedPath(rest)
    if (root === null || decoded === null || !isInside(root, path.resolve(root, `.${decoded}`))) return notFound(res)

    req.url = rest + query
    sirv(root, { dev: true, extensions: [], setHeaders: setType })(req, res, () => notFound(res))
  }
}
