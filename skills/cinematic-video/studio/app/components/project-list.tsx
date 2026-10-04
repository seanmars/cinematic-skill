import { cn } from 'cn'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/locale'
import { useStudio } from '@/studio'
import { GateStateDot } from './gate-state'
import { PanelHeading } from './panel-heading'

export function ProjectList() {
  const { t } = useLocale()
  const { projects, selected, isComposing, select, setComposing } = useStudio()

  return (
    <section>
      <div className="flex items-center justify-between pr-2">
        <PanelHeading>{t('projects.heading')}</PanelHeading>
        <Button size="xs" variant={isComposing ? 'secondary' : 'ghost'} onClick={() => setComposing(true)}>
          <Plus />
          {t('intake.new')}
        </Button>
      </div>
      {projects?.length === 0 && <p className="px-4 text-xs text-muted-foreground">{t('projects.empty')}</p>}
      <ul className="px-2">
        {projects?.map(project => (
          <li key={project.slug}>
            <button
              type="button"
              onClick={() => select(project.slug)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs hover:bg-accent',
                project.slug === selected && 'bg-accent text-accent-foreground',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{project.slug}</span>
              {project.gate !== null && <GateStateDot state={project.gate.state} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
