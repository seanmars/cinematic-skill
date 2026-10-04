import { createContext, type ReactNode, useContext, useState } from 'react'
import type { MixElement } from './api'

// What the user is choosing at the open gate before replying: picked in the
// middle (a treatment, mixed elements, assets, answers) or noted in the
// inspector (the reply's notes, a note per shot), sent from the inspector.
export type GateDraft = {
  treatment: string | null
  mix: MixElement[]
  regenerate: string[]
  priorities: string
  answers: Record<number, string>
  notes: string
  shotNotes: Record<string, string>
}

type GateDraftValue = { draft: GateDraft; update: (patch: Partial<GateDraft>) => void }

const EMPTY: GateDraft = { treatment: null, mix: [], regenerate: [], priorities: '', answers: {}, notes: '', shotNotes: {} }

const GateDraftContext = createContext<GateDraftValue | null>(null)

// A draft belongs to one gate: a new gate starts empty. The draft is dropped
// rather than the tree remounted, which would reload the preview.
export function GateDraftProvider({ gateKey, children }: { gateKey: string; children: ReactNode }) {
  const [saved, setSaved] = useState({ gateKey, draft: EMPTY })
  const draft = saved.gateKey === gateKey ? saved.draft : EMPTY
  const update = (patch: Partial<GateDraft>) =>
    setSaved(current => ({ gateKey, draft: { ...(current.gateKey === gateKey ? current.draft : EMPTY), ...patch } }))
  return <GateDraftContext value={{ draft, update }}>{children}</GateDraftContext>
}

export function useGateDraft() {
  const value = useContext(GateDraftContext)
  if (value === null) throw new Error('useGateDraft needs a GateDraftProvider')
  return value
}
