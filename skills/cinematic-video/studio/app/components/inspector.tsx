import type { Gate, Project, Storyboard } from '@/api'
import { useLocale } from '@/locale'
import { useStudio } from '@/studio'
import { ActivityList } from './activity-list'
import { HolderPanel } from './holder-panel'
import { PanelHeading } from './panel-heading'
import { ReplyPanel } from './reply-panel'
import { ShotEditor, useTechniqueIndex } from './shot-editor'

// The shot the timeline picked; editable only while the project waits at a
// gate, read-only while Claude works.
function ShotSection({ project, storyboard, isEditable }: { project: Project; storyboard: Storyboard; isEditable: boolean }) {
  const { t } = useLocale()
  const { selectedShot } = useStudio()
  const index = useTechniqueIndex(project.slug)
  const shot = storyboard.shots.find(candidate => candidate.id === selectedShot)

  return (
    <>
      <PanelHeading>
        {t('shot.section')}
        {/* A shot id is project content: never restyled. */}
        {shot !== undefined && <span className="ml-1.5 font-mono normal-case">{shot.id}</span>}
      </PanelHeading>
      {!isEditable && <p className="px-4 pb-2 text-xs text-busy">{t('shot.readOnly')}</p>}
      {shot === undefined && <p className="px-4 text-xs text-muted-foreground">{t('shot.pick')}</p>}
      {shot !== undefined && index !== null && (
        <ShotEditor slug={project.slug} shot={shot} index={index} isEditable={isEditable} />
      )}
    </>
  )
}

// Everything the user answers at one gate; a new gate remounts it, which
// drops unsaved field edits and reloads the techniques.
function GateWork({ project, gate }: { project: Project; gate: Gate | undefined }) {
  const { t } = useLocale()
  const isEditable = gate?.state === 'open'

  return (
    <>
      {project.storyboard !== null && (
        <ShotSection project={project} storyboard={project.storyboard} isEditable={isEditable} />
      )}
      {gate !== undefined && (
        <>
          <PanelHeading>{t('inspector.heading')}</PanelHeading>
          <ReplyPanel slug={project.slug} gate={gate} changes={project.changes} plan={project.plan} />
        </>
      )}
    </>
  )
}

export function Inspector() {
  const { t } = useLocale()
  const { project, sessions, isComposing } = useStudio()

  if (project === null || isComposing) return <PanelHeading>{t('inspector.heading')}</PanelHeading>
  const gate = project.gates.at(-1)
  const holder = sessions.find(session => session.sessionId === project.assignment?.sessionId)

  return (
    <div className="pb-6">
      <PanelHeading>{t('holder.heading')}</PanelHeading>
      <HolderPanel project={project} holder={holder} />
      {holder !== undefined && (
        <>
          <PanelHeading>{t('activity.heading')}</PanelHeading>
          <ActivityList activity={holder.activity} />
        </>
      )}
      <GateWork key={`${project.slug}/${gate?.gateId}`} project={project} gate={gate} />
    </div>
  )
}
