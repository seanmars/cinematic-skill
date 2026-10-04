import { afterEach, describe, expect, it } from 'vitest'
import { cleanUp, makeWorkspace, startStudio } from './studio-helpers.mjs'

afterEach(cleanUp)

describe('routing', () => {
  it("leaves the page's own modules to Vite, even one named like the API", async () => {
    const studio = await startStudio(makeWorkspace())

    const res = await studio.get('/api.ts')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/javascript/)
  })
})
