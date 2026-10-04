import { cn } from 'cn'
import { Check } from 'lucide-react'
import { type Project, STAGES, type Stage, api } from '@/api'
import { useLocale } from '@/locale'
import { useStudio } from '@/studio'
import { useAction } from '@/use-action'
import { GateStateDot } from './gate-state'
import { PanelHeading } from './panel-heading'

// The latest gate is the current stage; any earlier gate means its stage is
// done. Gate history runs in a straight line, so nothing else is possible.
function StageMark({ project, stage }: { project: Project; stage: Stage }) {
  const latest = project.gates.at(-1)
  if (latest?.stage === stage) return <GateStateDot state={latest.state} />
  if (project.gates.some(gate => gate.stage === stage)) return <Check className="size-3 text-done" />
  return <span className="inline-block size-2 rounded-full border border-muted-foreground/40" />
}

// Each stage with its auto-continue switch: a stage set to it records its
// gate and lets Claude go on without stopping.
export function StageList() {
  const { t } = useLocale()
  const { project, refresh } = useStudio()
  const { isRunning, error, run } = useAction()
  if (project === null) return null
  const { slug, settings } = project
  const current = project.gates.at(-1)?.stage

  async function toggle(stage: Stage) {
    const autoContinue = settings.autoContinue.includes(stage)
      ? settings.autoContinue.filter(other => other !== stage)
      : [...settings.autoContinue, stage]
    if (await run(() => api.saveSettings(slug, { autoContinue }))) await refresh()
  }

  return (
    <section>
      <div className="flex items-baseline justify-between pr-4">
        <PanelHeading>{t('stages.heading')}</PanelHeading>
        <span className="text-[10px] text-muted-foreground">{t('stages.autoContinue')}</span>
      </div>
      <ol className="px-2 pb-4">
        {STAGES.map(stage => (
          <li
            key={stage}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground',
              stage === current && 'text-foreground',
            )}
          >
            <span className="flex size-3 items-center justify-center">
              <StageMark project={project} stage={stage} />
            </span>
            <span className="flex-1">{t(`stage.${stage}`)}</span>
            <input
              type="checkbox"
              aria-label={t('stages.autoContinueFor', { stage: t(`stage.${stage}`) })}
              checked={settings.autoContinue.includes(stage)}
              disabled={isRunning}
              onChange={() => void toggle(stage)}
            />
          </li>
        ))}
      </ol>
      {error !== null && <p className="px-4 text-xs text-destructive">{error}</p>}
    </section>
  )
}
