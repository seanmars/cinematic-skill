import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, type Project, type ProjectSummary, type RenderProgress, type Session } from './api'

// What the page knows about the workspace, kept fresh by the server's push
// events (studio:project, studio:gate, studio:warning, studio:sessions,
// studio:renders). A write the page made itself is not pushed back, so
// useAction calls refresh() after it.

type StudioContextValue = {
  projects: ProjectSummary[] | null
  sessions: Session[]
  selected: string | null
  project: Project | null
  // True while the Intake form for a new project fills the middle.
  isComposing: boolean
  // The shot the timeline picked for the inspector.
  selectedShot: string | null
  select: (slug: string) => void
  selectShot: (shotId: string) => void
  setComposing: (isComposing: boolean) => void
  refresh: () => Promise<void>
}

type ChangeEvent = { slug: string; file: string }

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [selectedShot, setSelectedShot] = useState<string | null>(null)
  // Read by the push handler, which is registered once.
  const selectedRef = useRef<string | null>(null)

  const loadProject = useCallback(async (slug: string) => {
    const loaded = await api.project(slug)
    if (selectedRef.current === slug) setProject(loaded)
  }, [])

  const select = useCallback(
    (slug: string) => {
      selectedRef.current = slug
      setSelected(slug)
      setIsComposing(false)
      setSelectedShot(null)
      setProject(null)
      void loadProject(slug)
    },
    [loadProject],
  )

  const loadProjects = useCallback(async () => {
    const list = await api.projects()
    setProjects(list)
    if (selectedRef.current === null && list.length > 0) select(list[0]!.slug)
  }, [select])

  const refresh = useCallback(async () => {
    const slug = selectedRef.current
    await Promise.all([loadProjects(), slug === null ? undefined : loadProject(slug)])
  }, [loadProjects, loadProject])

  useEffect(() => {
    void loadProjects()
    void api.sessions().then(setSessions)
    const onChange = (change: ChangeEvent) => {
      void loadProjects()
      if (change.slug === selectedRef.current) void loadProject(change.slug)
    }
    const onSessions = (snapshot: { sessions: Session[] }) => setSessions(snapshot.sessions)
    // Arrives about every second during a render: patched in, not refetched,
    // and left alone while the open project's own render did not move.
    const onRenders = (snapshot: { renders: Record<string, RenderProgress> }) =>
      setProject(current => {
        if (current === null) return current
        const render = snapshot.renders[current.slug] ?? null
        return render?.updatedAt === current.render?.updatedAt ? current : { ...current, render }
      })
    const listeners = [
      ['studio:project', onChange],
      ['studio:gate', onChange],
      ['studio:warning', onChange],
      ['studio:sessions', onSessions],
      ['studio:renders', onRenders],
    ] as const
    for (const [event, listener] of listeners) import.meta.hot?.on(event, listener)
    return () => {
      for (const [event, listener] of listeners) import.meta.hot?.off(event, listener)
    }
  }, [loadProjects, loadProject])

  const value = {
    projects,
    sessions,
    selected,
    project,
    isComposing,
    selectedShot,
    select,
    selectShot: setSelectedShot,
    setComposing: setIsComposing,
    refresh,
  }
  return <StudioContext value={value}>{children}</StudioContext>
}

export function useStudio() {
  const value = useContext(StudioContext)
  if (value === null) throw new Error('useStudio needs a StudioProvider')
  return value
}

export function useOnlineSessions() {
  return useStudio().sessions.filter(session => session.online)
}
