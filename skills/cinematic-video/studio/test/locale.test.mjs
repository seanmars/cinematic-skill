import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Visitor, parseSync } from 'vite'
import { describe, expect, it } from 'vitest'
import en from '../app/locale/en.ts'
import zhTw from '../app/locale/zh-tw.ts'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app')
// Attributes a user reads or hears.
const VISIBLE_ATTRIBUTES = new Set(['title', 'alt', 'aria-label', 'placeholder', 'label'])
const WORDS = /[A-Za-z㐀-鿿]/

function placeholders(message) {
  return [...message.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort()
}

// The page's own components; components/ui holds shadcn's generated
// building blocks, which take their labels from these.
function sourceFiles(dir = appDir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return full === path.join(appDir, 'components/ui') ? [] : sourceFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

// Text written into the JSX itself rather than looked up in a locale.
function hardcodedText(file) {
  const source = fs.readFileSync(file, 'utf8')
  const { program } = parseSync(file, source, { lang: 'tsx' })
  const found = []
  new Visitor({
    JSXText(node) {
      if (WORDS.test(node.value)) found.push(node.value.trim())
    },
    JSXAttribute(node) {
      const name = node.name.name
      if (VISIBLE_ATTRIBUTES.has(name) && node.value?.type === 'Literal' && WORDS.test(String(node.value.value))) {
        found.push(`${name}="${node.value.value}"`)
      }
    },
  }).visit(program)
  return found.map(text => `${path.relative(appDir, file)}: ${text}`)
}

describe('locales', () => {
  it('zh-TW and en carry the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhTw).sort())
  })

  it('every message is written, with the same placeholders in both', () => {
    for (const key of Object.keys(zhTw)) {
      expect(zhTw[key].trim(), `zh-tw ${key}`).not.toBe('')
      expect(en[key]?.trim(), `en ${key}`).not.toBe('')
      expect(placeholders(en[key]), key).toEqual(placeholders(zhTw[key]))
    }
  })

  it('the UI source writes no interface text of its own', () => {
    const files = sourceFiles()

    expect(files.length).toBeGreaterThan(10)
    expect(files.flatMap(hardcodedText)).toEqual([])
  })
})
