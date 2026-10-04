import { cn } from 'cn'
import type { Activity } from '@/api'
import { clock } from '@/format'
import { useLocale } from '@/locale'

const SHOWN = 10

// What Claude is doing: the holder's latest tool calls, newest first.
export function ActivityList({ activity }: { activity: Activity[] }) {
  const { t, languageTag } = useLocale()
  if (activity.length === 0) return <p className="px-4 text-xs text-muted-foreground">{t('activity.empty')}</p>

  return (
    <ol className="flex flex-col gap-1 px-4 text-xs">
      {activity
        .slice(-SHOWN)
        .reverse()
        .map(entry => {
          const isRunning = entry.endedAt === null
          return (
            <li key={`${entry.startedAt}-${entry.summary}`} className="flex items-center gap-2">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  isRunning ? 'animate-pulse bg-busy' : 'bg-muted-foreground/40',
                )}
              />
              <span className={cn('min-w-0 flex-1 truncate', !isRunning && 'text-muted-foreground')}>
                {entry.summary}
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {isRunning ? t('activity.running') : clock(entry.startedAt, languageTag, true)}
              </span>
            </li>
          )
        })}
    </ol>
  )
}
