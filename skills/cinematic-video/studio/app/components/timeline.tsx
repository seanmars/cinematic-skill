import { cn } from 'cn'
import type { Cue, Storyboard } from '@/api'
import { useLocale } from '@/locale'
import { filmLength } from '@/storyboard'

function percent(seconds: number, length: number) {
  return `${(seconds / length) * 100}%`
}

function TrackLabel({ children }: { children: string }) {
  return <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{children}</span>
}

// Shots laid end to end by duration over the plan's SFX cues, under the
// playhead. Picking a shot opens it in the inspector and seeks to its start.
export function Timeline({
  storyboard,
  plan,
  flaggedCues,
  time,
  selectedShot,
  onSelectShot,
}: {
  storyboard: Storyboard
  plan: Cue[] | null
  // Rows of the plan a duration change left for Claude to realign.
  flaggedCues: number[]
  time: number
  selectedShot: string | null
  onSelectShot: (shotId: string, start: number) => void
}) {
  const { t } = useLocale()
  const length = filmLength(storyboard)
  const starts = storyboard.shots.map((_, index) =>
    storyboard.shots.slice(0, index).reduce((total, shot) => total + shot.duration, 0),
  )

  return (
    <section aria-label={t('timeline.label')} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <TrackLabel>{t('timeline.picture')}</TrackLabel>
        <div className="relative flex h-12 flex-1">
          {storyboard.shots.map((shot, index) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => onSelectShot(shot.id, starts[index]!)}
              aria-pressed={shot.id === selectedShot}
              style={{ width: percent(shot.duration, length) }}
              className={cn(
                'flex min-w-0 flex-col items-start justify-center overflow-hidden rounded-sm border-r-2 border-card bg-secondary px-2 text-left hover:bg-accent',
                shot.id === selectedShot && 'ring-2 ring-ring',
              )}
            >
              <span className="truncate font-mono text-xs">{shot.id}</span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {t('shot.duration', { seconds: shot.duration.toFixed(2) })}
              </span>
            </button>
          ))}
          <Playline time={time} length={length} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TrackLabel>{t('timeline.sfx')}</TrackLabel>
        <div className="relative h-6 flex-1 rounded-sm bg-muted/50">
          {plan?.map(([name, at, , note], index) => (
            <span
              key={`${index}-${name}`}
              title={[name, t('shot.duration', { seconds: at }), note].filter(Boolean).join(' · ')}
              style={{ left: percent(at, length) }}
              className="absolute top-0 flex h-full -translate-x-1/2 items-center"
            >
              <span className={cn('h-full w-px', flaggedCues.includes(index) ? 'w-0.5 bg-destructive' : 'bg-attention')} />
              <span
                className={cn(
                  'ml-1 font-mono text-[10px]',
                  flaggedCues.includes(index) ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {name}
              </span>
            </span>
          ))}
          <Playline time={time} length={length} />
        </div>
      </div>
    </section>
  )
}

function Playline({ time, length }: { time: number; length: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-0 h-full w-px bg-foreground"
      style={{ left: percent(time, length) }}
    />
  )
}
