import { cn } from 'cn'
import type { Session } from '@/api'
import { clock } from '@/format'
import { useLocale } from '@/locale'

// What tells sessions apart: the short id the terminal's status line shows,
// when it started, and what it is busy with.
export function SessionLabel({ session }: { session: Session }) {
  const { t, languageTag } = useLocale()
  return (
    <>
      <span className="font-mono">{session.shortId}</span>
      <span className="text-muted-foreground">
        {t('sessions.startedAt', { time: clock(session.startedAt, languageTag) })} ·{' '}
        {session.project === null ? t('sessions.idle') : t('sessions.holds', { slug: session.project })}
      </span>
    </>
  )
}

export function SessionPicker({
  sessions,
  value,
  onChange,
}: {
  sessions: Session[]
  value: string | null
  onChange: (sessionId: string) => void
}) {
  return (
    <ul className="flex flex-col gap-1" role="radiogroup">
      {sessions.map(session => (
        <li key={session.sessionId}>
          <button
            type="button"
            role="radio"
            aria-checked={session.sessionId === value}
            onClick={() => onChange(session.sessionId)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs hover:bg-accent',
              session.sessionId === value && 'border-ring bg-accent',
            )}
          >
            <SessionLabel session={session} />
          </button>
        </li>
      ))}
    </ul>
  )
}
