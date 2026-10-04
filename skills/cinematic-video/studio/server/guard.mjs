// Writing a state file can make Claude run a prompt, so every route that
// writes goes through this check (D2, after open-slide's
// validateMutationRequest). Vite's own Host check runs before it.
//
// Returns undefined when the request may go on, else the status and reason.
export function validateMutationRequest(req) {
  const contentType = req.headers['content-type'] ?? ''
  if (!/^application\/json\b/i.test(contentType)) return { status: 415, error: 'expected a JSON body' }
  if (req.headers['sec-fetch-site'] === 'cross-site') return { status: 403, error: 'cross-site request refused' }

  const origin = req.headers.origin
  if (origin === undefined) return undefined
  if (origin === 'null') return { status: 403, error: 'opaque origin refused' }
  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    return { status: 403, error: 'malformed origin refused' }
  }
  if (originHost !== req.headers.host) return { status: 403, error: 'origin does not match host' }
  return undefined
}
