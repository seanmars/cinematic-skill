import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listDir } from './files.mjs'
import { HttpError } from './http-error.mjs'
import { projectDir } from './projects.mjs'

// The skill's technique library, read from INDEX.md at start (D7): a
// "## <Title> (<n>)" heading per category and a "| [Name](<category>/<slug>.md)
// | Summary |" row per technique. The tests lock this format.
const LIBRARY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../references/techniques')
const HEADING = /^## (.+) \((\d+)\)$/
const ROW = /^\| \[(.+?)\]\(([a-z-]+)\/([a-z0-9-]+)\.md\) \| (.*) \|$/
const TECHNIQUE_FILE = /^[a-z0-9-]+\.md$/

function parseIndex(text) {
  const categories = []
  const techniques = []
  let heading
  for (const line of text.split(/\r?\n/)) {
    const section = HEADING.exec(line)
    if (section !== null) heading = { id: undefined, title: section[1], count: Number(section[2]) }
    const row = ROW.exec(line)
    if (row === null || heading === undefined) continue
    const [, name, category, slug, summary] = row
    if (heading.id === undefined) {
      heading.id = category
      categories.push(heading)
    }
    techniques.push({ category, name, slug, path: `${category}/${slug}.md`, summary, custom: false })
  }
  return { categories, techniques }
}

const library = parseIndex(fs.readFileSync(path.join(LIBRARY, 'INDEX.md'), 'utf8'))
const libraryPaths = new Set(library.techniques.map(technique => technique.path))
const categoryIds = new Set(library.categories.map(category => category.id))

// A custom technique file has the library's shape: frontmatter with name,
// then a "Summary:" line.
function readCustom(dir, category, file) {
  const text = fs.readFileSync(path.join(dir, 'techniques', category, file), 'utf8')
  const slug = file.replace(/\.md$/, '')
  const name = /^name:\s*(.+)$/m.exec(text)?.[1].trim() ?? slug
  const summary = /^Summary:\s*(.+)$/m.exec(text)?.[1].trim() ?? ''
  return { category, name, slug, path: `${category}/${file}`, summary, custom: true }
}

// The project's own techniques/<category>/<slug>.md, in the library's
// categories; where a path is in both, the library's file stands.
function customTechniques(dir) {
  return [...categoryIds].flatMap(category =>
    listDir(path.join(dir, 'techniques', category))
      .filter(file => TECHNIQUE_FILE.test(file) && !libraryPaths.has(`${category}/${file}`))
      .map(file => readCustom(dir, category, file)),
  )
}

export function readTechniques(workspace, slug) {
  const dir = projectDir(workspace, slug)
  return { categories: library.categories, techniques: [...library.techniques, ...customTechniques(dir)] }
}

// Whether a <category>/<slug>.md path names a technique the project can use.
export function isKnownTechnique(dir, techniquePath) {
  const [category, file, ...rest] = techniquePath.split('/')
  if (rest.length > 0 || !categoryIds.has(category) || !TECHNIQUE_FILE.test(file ?? '')) return false
  return libraryPaths.has(techniquePath) || fs.existsSync(path.join(dir, 'techniques', category, file))
}

export function readTechniqueFile(workspace, slug, category, file) {
  const dir = projectDir(workspace, slug)
  const techniquePath = `${category}/${file}`
  if (!isKnownTechnique(dir, techniquePath)) throw new HttpError(404, `no technique ${techniquePath}`)
  const source = libraryPaths.has(techniquePath) ? LIBRARY : path.join(dir, 'techniques')
  return { markdown: fs.readFileSync(path.join(source, category, file), 'utf8') }
}
