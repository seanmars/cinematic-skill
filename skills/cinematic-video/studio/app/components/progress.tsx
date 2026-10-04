import { cn } from 'cn'
import type { BuildProgress, RenderProgress, ShotProgress, Storyboard } from '@/api'
import { minutes } from '@/format'
import { useLocale } from '@/locale'

export function RenderProgressBar({ render }: { render: RenderProgress }) {
  const { t } = useLocale()
  const percent = render.frames > 0 ? (render.frame / render.frames) * 100 : 0
  let status = t('render.done', { frames: render.frames, time: minutes(render.elapsed) })
  if (!render.done) {
    const left = render.eta === null ? t('render.etaUnknown') : t('render.eta', { time: minutes(render.eta) })
    status = `${t('render.frames', { frame: render.frame, frames: render.frames })} · ${left}`
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs text-muted-foreground">{t('render.heading')}</h2>
        <span className="font-mono text-xs">{status}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width]', render.done ? 'bg-done' : 'bg-busy')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  )
}

const STATUS_COLOR = { pending: 'text-muted-foreground', building: 'text-busy', done: 'text-done' }

// Each shot in storyboard order, with what Claude reported in progress.json.
export function BuildProgressGrid({
  base,
  storyboard,
  progress,
}: {
  base: string | null
  storyboard: Storyboard | null
  progress: BuildProgress
}) {
  const { t } = useLocale()
  const ids = storyboard?.shots.map(shot => shot.id) ?? Object.keys(progress.shots)

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-xs text-muted-foreground">{t('build.heading')}</h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {ids.map(id => {
          const shot: ShotProgress | undefined = progress.shots[id]
          const status = shot?.status ?? 'pending'
          return (
            <li key={id} className="flex flex-col gap-2 rounded-md border p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono">{id}</span>
                <span className={STATUS_COLOR[status]}>{t(`build.status.${status}`)}</span>
              </div>
              {shot === undefined || shot.stills.length === 0 || base === null ? (
                <p className="text-xs text-muted-foreground">{t('build.noStills')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {shot.stills.map(still => (
                    <img
                      key={still}
                      src={`${base}${still}`}
                      alt={still}
                      loading="lazy"
                      className="aspect-video w-full rounded-sm bg-muted object-cover"
                    />
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
