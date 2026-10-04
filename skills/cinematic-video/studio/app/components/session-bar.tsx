import { cn } from 'cn'
import { useLocale } from '@/locale'
import { useOnlineSessions } from '@/studio'
import { SessionLabel } from './session-picker'

// The header's view of who is online, and who waits in the terminal.
export function SessionBar() {
  const { t } = useLocale()
  const online = useOnlineSessions()

  if (online.length === 0) return <span className="text-xs text-muted-foreground">{t('sessions.none')}</span>
  return (
    <ul className="flex items-center gap-2 text-xs">
      {online.map(session => (
        <li key={session.sessionId} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1">
          <span
            className={cn('size-2 rounded-full', session.permission === null ? 'bg-done' : 'bg-attention')}
          />
          <SessionLabel session={session} />
          {session.permission !== null && <span className="text-attention">{t('sessions.waiting')}</span>}
        </li>
      ))}
    </ul>
  )
}
