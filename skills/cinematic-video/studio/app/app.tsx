import { useEffect } from 'react'
import { Inspector } from './components/inspector'
import { IntakeForm } from './components/intake-form'
import { LanguageSwitch } from './components/language-switch'
import { ProjectList } from './components/project-list'
import { ProjectView } from './components/project-view'
import { SessionBar } from './components/session-bar'
import { StageList } from './components/stage-list'
import { GateDraftProvider } from './gate-draft'
import { useLocale } from './locale'
import { useStudio } from './studio'

// Editing-software layout: projects and stages on the left, the stage's
// content in the middle, the inspector with the gate's actions on the right.
export function App() {
  const { t } = useLocale()
  const { project, isComposing } = useStudio()

  useEffect(() => {
    document.title = t('app.title')
  }, [t])

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)] text-sm">
      <header className="flex h-10 items-center gap-3 border-b px-4">
        <span className="font-semibold tracking-tight">{t('app.title')}</span>
        <div className="ml-auto flex items-center gap-3">
          <SessionBar />
          <LanguageSwitch />
        </div>
      </header>
      {/* Choices made in the middle are sent from the inspector; a new gate starts afresh. */}
      <GateDraftProvider gateKey={`${project?.slug}/${project?.gates.at(-1)?.gateId}`}>
        <div className="grid min-h-0 grid-cols-[15rem_minmax(0,1fr)_20rem]">
          <aside className="flex min-h-0 flex-col overflow-y-auto border-r">
            <ProjectList />
            <StageList />
          </aside>
          <main className="min-h-0 overflow-y-auto">{isComposing ? <IntakeForm /> : <ProjectView />}</main>
          <aside className="min-h-0 overflow-y-auto border-l">
            <Inspector />
          </aside>
        </div>
      </GateDraftProvider>
    </div>
  )
}
