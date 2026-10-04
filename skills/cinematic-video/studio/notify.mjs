#!/usr/bin/env node
// Notification hook (matcher: permission_prompt). Records that a session is
// waiting for the user to answer a permission prompt in the terminal, so the
// studio can say so. This script is the only writer of its permission file.
//
// The workspace comes from the hook input's cwd, not from this file's own
// location: in link mode Node resolves the junction to the repo's source.
import fs from 'node:fs'
import path from 'node:path'

const input = JSON.parse(fs.readFileSync(0, 'utf8'))
const file = path.join(input.cwd, 'node_modules/.cinematic-studio/permission', `${input.session_id}.json`)
const record = { sessionId: input.session_id, message: input.message, waitingSince: new Date().toISOString() }

fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
