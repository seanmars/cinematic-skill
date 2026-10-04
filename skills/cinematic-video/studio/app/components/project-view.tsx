import { useState } from 'react'
import { type Intake, type Project, type Storyboard, realignRows } from '@/api'
import { useLocale } from '@/locale'
import { filmLength, frameRate, frameSize } from '@/storyboard'
import { useStudio } from '@/studio'
import { Playhead } from './playhead'
import { Preview } from './preview'
import { BuildProgressGrid, RenderProgressBar } from './progress'
import { StagePanel } from './stage-panels'
import { Timeline } from './timeline'

// Until Claude opens the Intake gate, the project is the form as it was sent.
function IntakeSent({ intake }: { intake: Intake }) {
  const { t } = useLocale()
  const rows: [string, string][] = [
    [t('intake.brief'), intake.brief],
    [t('intake.specs'), intake.specs],
    [t('intake.profile'), intake.profile === null ? t('intake.profileAuto') : t(`intake.profile.${intake.profile}`)],
    [t('intake.brand'), intake.brand],
    [t('intake.assets'), intake.assets.join('\n')],
  ]
  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">{t('intake.sent')}</h1>
        <p className="text-xs text-muted-foreground">{t('intake.waiting')}</p>
      </header>
      <dl className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-lg border bg-card p-4">
        {rows
          .filter(([, value]) => value !== '')
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
      </dl>
    </>
  )
}

// Outputs that got ahead of a gate the user has not passed (D10). Only a
// warning: the heuristic can be wrong.
function SkippedGateWarnings({ project }: { project: Project }) {
  const { t } = useLocale()
  if (project.warnings.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
      {project.warnings.map(warning => (
        <li key={`${warning.skipped}-${warning.file}`}>
          {t('warning.skipped', { stage: t(`stage.${warning.skipped}`), file: warning.file })}
        </li>
      ))}
    </ul>
  )
}

// Once there is a storyboard to time: the render(t) preview over the
// timeline, sharing one playhead.
function PreviewPanel({ project, storyboard }: { project: Project; storyboard: Storyboard }) {
  const { t } = useLocale()
  const { selectedShot, selectShot } = useStudio()
  const [time, setTime] = useState(0)

  return (
    <section className="flex flex-col gap-3">
      {project.previewBase === null ? (
        <p className="text-xs text-destructive">{t('preview.unavailable')}</p>
      ) : (
        <Preview
          slug={project.slug}
          src={`${project.previewBase}index.html`}
          size={frameSize(storyboard)}
          time={time}
        />
      )}
      <Playhead time={time} length={filmLength(storyboard)} fps={frameRate(storyboard)} onChange={setTime} />
      <Timeline
        storyboard={storyboard}
        plan={project.plan}
        flaggedCues={realignRows(project.changes)}
        time={time}
        selectedShot={selectedShot}
        onSelectShot={(shotId, start) => {
          selectShot(shotId)
          setTime(start)
        }}
      />
    </section>
  )
}

// The middle of the layout: the preview, live progress while Claude works,
// then the latest gate.
export function ProjectView() {
  const { t } = useLocale()
  const { project, selected } = useStudio()

  if (selected === null) return <p className="p-6 text-muted-foreground">{t('projects.pick')}</p>
  if (project === null) return null
  const gate = project.gates.at(-1)

  return (
    <div className="flex flex-col gap-4 p-6">
      <SkippedGateWarnings project={project} />
      {project.storyboard !== null && (
        <PreviewPanel key={project.slug} project={project} storyboard={project.storyboard} />
      )}
      {project.render !== null && <RenderProgressBar render={project.render} />}
      {project.progress !== null && (
        <BuildProgressGrid base={project.previewBase} storyboard={project.storyboard} progress={project.progress} />
      )}
      {gate !== undefined && <StagePanel project={project} gate={gate} />}
      {gate === undefined && project.intake !== null && <IntakeSent intake={project.intake} />}
      {gate === undefined && project.intake === null && <p className="text-muted-foreground">{t('gate.none')}</p>}
    </div>
  )
}
