// The studio server's API (server/api.mjs). The page reads and writes
// project files only through it.

export const STAGES = [
  'intake',
  'treatments',
  'storyboard',
  'assets',
  'build-animatic',
  'build-polish',
  'audio',
  'gauntlet',
  'deliver',
] as const
export type Stage = (typeof STAGES)[number]

// open: waiting for the user. replied: the mod has yet to deliver the reply.
// delivered and auto: Claude has it.
export type GateState = 'open' | 'replied' | 'delivered' | 'auto'

// What a deciding reply chose (schema/reply.schema.json).
export type MixElement = { option: string; element: string }
export type Choice = { id?: string; mix?: MixElement[]; priorities?: string[]; regenerate?: string[] }
export type Reply = { decision: string; notes: string; changes: string[]; choice?: Choice }

// What each gate's payload holds, as the protocol asks Claude to write it.
// Reports are markdown text; media and documents are project-relative paths.
export type GatePayload = {
  questions?: { question: string; default?: string }[]
  critic?: string
  assets?: string[]
  ledger?: string
  animatic?: string
  renderEstimate?: string
  mix?: string
  loudness?: string
  round?: number
  measurements?: string
  reviewLog?: string
  film?: string
  poster?: string
  notes?: string
  confirm?: string[]
}

// treatments.json (schema/treatments.schema.json).
export type TreatmentOption = {
  id: string
  title: string
  logline: string
  look: { description: string; palette: string[]; typefaces: string[] }
  specs: string
  stack: string
  cta?: string
  shots: { range: string; text: string }[]
  signatureMoves: string[]
  audio: string
  estimate: string
  risk: string
  whyItFits: string
  preview: string
}
export type Treatments = { options: TreatmentOption[]; chosen: unknown }

export type Settings = { autoContinue: Stage[] }
export type Warning = { skipped: Stage; file: string }

export type Gate = {
  gateId: string
  stage: Stage
  openedAt: string
  autoContinue: boolean
  payload: GatePayload
  deliveredAt?: string
  reply?: Reply
  state: GateState
}

export type ProjectSummary = {
  slug: string
  gate: Pick<Gate, 'gateId' | 'stage' | 'state'> | null
}

export const PROFILES = ['stylized', 'commercial'] as const
export type Profile = (typeof PROFILES)[number]

export type IntakeForm = {
  brief: string
  specs: string
  profile: Profile | null
  brand: string
  assets: string[]
}

export type Intake = IntakeForm & { slug: string; submittedAt: string }

export type Assignment = { slug: string; sessionId: string; assignedAt: string; reason: string }

// storyboard.json (schema/storyboard.schema.json), as far as the studio reads it.
export const SLOTS = ['framing', 'angle', 'movement', 'transition'] as const
export type Slot = (typeof SLOTS)[number]
// The technique category each main slot takes.
export const SLOT_CATEGORIES: Record<Slot, string> = {
  framing: 'framing',
  angle: 'camera-angles',
  movement: 'camera-movement',
  transition: 'editing',
}
export const TEXT_FIELDS = ['picture', 'job', 'action', 'camera', 'audio', 'transition'] as const
export type TextField = (typeof TEXT_FIELDS)[number]

export type Shot = {
  id: string
  duration: number
  techniques: Record<Slot, string | null>
  tags: string[]
  assets: string[]
  text: Partial<Record<TextField, string>>
}
export type Storyboard = {
  inputs?: { specs?: string }
  build?: { render?: string }
  shots: Shot[]
}

// audio/plan.json: one cue per row, [name, time_s, target_dB, note, floor?, cap?].
export type Cue = [string, number, number, string, ...unknown[]]

export type TechniqueCategory = { id: string; title: string; count: number }
export type Technique = { category: string; name: string; slug: string; path: string; summary: string; custom: boolean }

// studio/progress.json, written by Claude during Build.
export type ShotProgress = { status: 'building' | 'done'; stills: string[] }
export type BuildProgress = { shots: Record<string, ShotProgress> }

// render.py --progress-file.
export type RenderProgress = {
  frame: number
  frames: number
  sample: number
  samples: number
  elapsed: number
  eta: number | null
  updatedAt: string
  done: boolean
}

export type Project = {
  slug: string
  intake: Intake | null
  storyboard: Storyboard | null
  treatments: Treatments | null
  plan: Cue[] | null
  progress: BuildProgress | null
  gates: Gate[]
  assignment: Assignment | null
  render: RenderProgress | null
  // The project folder's URL in the static preview; null when its renderRoot
  // lies outside video/.
  previewBase: string | null
  // The fields edited at the open gate so far; the reply carries them.
  changes: string[]
  settings: Settings
  // Outputs that got ahead of a gate the user has not passed.
  warnings: Warning[]
}

// One tool call of a session; endedAt is null while it runs.
export type Activity = { tool: string; summary: string; startedAt: string; endedAt: string | null }

export type Session = {
  sessionId: string
  shortId: string
  startedAt: string
  heartbeatAt: string
  online: boolean
  project: string | null
  activity: Activity[]
  // Set while Claude waits in the terminal for the user to allow a tool.
  permission: { message: string; waitingSince: string } | null
}

export class ApiError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body.error ?? res.statusText)
  return body as T
}

function post<T>(url: string, body: unknown) {
  return call<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

export const api = {
  projects: () => call<{ projects: ProjectSummary[] }>('/api/projects').then(body => body.projects),
  project: (slug: string) => call<Project>(`/api/projects/${slug}`),
  reply: (slug: string, gateId: string, reply: Reply) => post(`/api/projects/${slug}/replies/${gateId}`, reply),
  sessions: () => call<{ sessions: Session[] }>('/api/sessions').then(body => body.sessions),
  intake: (form: IntakeForm & { slug?: string; sessionId?: string }) =>
    post<{ slug: string; assignment: Assignment | null }>('/api/intake', form),
  assign: (slug: string, sessionId: string) => post(`/api/projects/${slug}/assignment`, { sessionId }),
  unlock: (slug: string) => post(`/api/projects/${slug}/unlock`, {}),
  techniques: (slug: string) =>
    call<{ categories: TechniqueCategory[]; techniques: Technique[] }>(`/api/projects/${slug}/techniques`),
  techniqueFile: (slug: string, techniquePath: string) =>
    call<{ markdown: string }>(`/api/projects/${slug}/techniques/${techniquePath}`).then(body => body.markdown),
  editShot: (slug: string, shot: string, field: string, value: unknown) =>
    post<{ changes: string[] }>(`/api/projects/${slug}/storyboard`, { shot, field, value }),
  saveSettings: (slug: string, settings: Settings) => post(`/api/projects/${slug}/settings`, settings),
  editDuration: (slug: string, shot: string, duration: number) =>
    post<{ changes: string[] }>(`/api/projects/${slug}/storyboard/duration`, { shot, duration }),
}

const REALIGN = /^realign:audio\/plan\.json\[(\d+)\]$/

// The plan rows a duration change left for Claude to realign.
export function realignRows(changes: string[]) {
  return changes.flatMap(change => {
    const match = REALIGN.exec(change)
    return match === null ? [] : [Number(match[1])]
  })
}
