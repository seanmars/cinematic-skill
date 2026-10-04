import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'
import { createApi } from './api.mjs'
import { createChangeLog } from './edits.mjs'
import { createRecentWrites, writeJson } from './files.mjs'
import { pushPolledState } from './poll.mjs'
import { createPreview } from './preview.mjs'
import { pushFileChanges } from './push.mjs'
import { createWarnings } from './skipped-gates.mjs'

const studioDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Middlewares added straight from configureServer run ahead of Vite's own.
function studioPlugin(workspace) {
  return {
    name: 'cinematic-studio',
    configureServer(server) {
      const recentWrites = createRecentWrites()
      const write = async (file, value) => {
        recentWrites.mark(file)
        await writeJson(file, value)
      }
      const warnings = createWarnings()
      server.middlewares.use(createApi({ workspace, write, changeLog: createChangeLog(), warnings }))
      server.middlewares.use(createPreview(workspace))
      pushFileChanges(server, { workspace, recentWrites, warnings })
      pushPolledState(server, workspace)
    },
  }
}

// The Vite dev server is the studio's runtime (D1): it serves the app and
// carries the API, the preview and the push as plugins.
export async function createStudioServer({ workspace, port }) {
  const appDir = path.join(studioDir, 'app')
  const server = await createServer({
    configFile: false,
    root: appDir,
    resolve: { alias: { '@': appDir } },
    server: { host: '127.0.0.1', port },
    plugins: [react(), tailwindcss(), studioPlugin(path.resolve(workspace))],
  })
  await server.listen()
  return server
}
