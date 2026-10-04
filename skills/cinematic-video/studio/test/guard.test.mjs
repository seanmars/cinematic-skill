import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanUp, gate, listFiles, makeWorkspace, startStudio, writeJson } from './studio-helpers.mjs'

const REPLY_URL = '/api/projects/demo/replies/003-storyboard'
const REPLIES = 'video/demo/studio/replies'
const APPROVE = { decision: 'approve', notes: '', changes: [] }

let workspace
let studio

beforeEach(async () => {
  workspace = makeWorkspace()
  writeJson(workspace, 'video/demo/studio/gates/003-storyboard.json', gate('003-storyboard'))
  studio = await startStudio(workspace)
})

afterEach(cleanUp)

describe('mutation request guard', () => {
  it.each([
    ['a cross-site request', { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }, 403],
    ['an opaque origin', { origin: 'null', 'sec-fetch-site': 'cross-site' }, 403],
    ['an Origin that does not match Host', { origin: 'http://evil.example', 'sec-fetch-site': undefined }, 403],
    ['another port on this machine', { origin: 'http://127.0.0.1:1', 'sec-fetch-site': 'same-site' }, 403],
    ['a body that is not JSON', { 'content-type': 'text/plain' }, 415],
  ])('其他網站對 studio 送出寫入請求: rejects %s and writes nothing', async (_, headers, status) => {
    const res = await studio.post(REPLY_URL, APPROVE, headers)

    expect(res.status).toBe(status)
    expect(listFiles(workspace, `${workspace}/${REPLIES}`)).toEqual([])
  })

  it("runs behind Vite's host check, which stops DNS rebinding", async () => {
    const res = await studio.post(REPLY_URL, APPROVE, { host: 'evil.example', origin: 'http://evil.example' })

    expect(res.status).toBe(403)
    expect(listFiles(workspace, `${workspace}/${REPLIES}`)).toEqual([])
  })

  it('accepts the same request from the studio page itself', async () => {
    const res = await studio.post(REPLY_URL, APPROVE)

    expect(res.status, res.text).toBe(200)
    expect(listFiles(workspace, `${workspace}/${REPLIES}`)).toEqual([`${REPLIES}/003-storyboard.json`])
  })
})
