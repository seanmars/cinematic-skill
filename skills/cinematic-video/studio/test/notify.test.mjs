import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const notify = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../notify.mjs')

const tempDirs = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('notify.mjs', () => {
  it('Claude 等待權限授權: records that the session is waiting', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-notify-'))
    tempDirs.push(workspace)
    const input = {
      session_id: 'baf24fd7-416c-4f59-806f-d89f9bf237db',
      transcript_path: '',
      cwd: workspace,
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      message: 'Claude needs your permission to use Bash',
    }

    const result = spawnSync(process.execPath, [notify], { input: JSON.stringify(input), encoding: 'utf8' })

    expect(result.status, result.stderr).toBe(0)
    const file = path.join(workspace, 'node_modules/.cinematic-studio/permission', `${input.session_id}.json`)
    const record = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(record).toEqual({
      sessionId: input.session_id,
      message: input.message,
      waitingSince: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
  })
})
