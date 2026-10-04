import { useState } from 'react'
import { api, type Project } from '@/api'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/locale'
import { useOnlineSessions, useStudio } from '@/studio'
import { useAction } from '@/use-action'
import { SessionPicker } from './session-picker'

// Which session's Claude handles the project. A project nobody holds, or
// whose holder went offline, can be handed to an online session; an offline
// holder's project can also just be released.
export function HolderPanel({ project }: { project: Project }) {
  const { t } = useLocale()
  const { sessions, refresh } = useStudio()
  const online = useOnlineSessions()
  const { isRunning, error, run } = useAction()
  const [picked, setPicked] = useState<string | null>(null)
  const { assignment } = project
  const holder = sessions.find(session => session.sessionId === assignment?.sessionId)
  const isHolderOnline = holder?.online === true
  // The mod's short id is the first six characters of the session id.
  const shortId = holder?.shortId ?? assignment?.sessionId.slice(0, 6) ?? ''

  async function assign(sessionId: string) {
    if (await run(() => api.assign(project.slug, sessionId))) {
      setPicked(null)
      await refresh()
    }
  }

  async function unlock() {
    if (await run(() => api.unlock(project.slug))) await refresh()
  }

  return (
    <div className="flex flex-col gap-2 px-4 text-xs">
      {assignment === null && <p>{t('holder.none')}</p>}
      {assignment !== null && isHolderOnline && <p>{t('holder.online', { shortId })}</p>}
      {assignment !== null && !isHolderOnline && (
        <>
          <p className="text-attention">{t('holder.offline', { shortId })}</p>
          <p className="text-muted-foreground">{t('holder.offlineHint')}</p>
        </>
      )}
      {isHolderOnline && holder?.permission != null && (
        <p className="rounded-md border border-attention/40 bg-attention/10 p-2 text-attention">
          {t('holder.waiting', { message: holder.permission.message })}
        </p>
      )}
      {!isHolderOnline && online.length === 0 && assignment === null && (
        <p className="text-muted-foreground">{t('holder.noneHint')}</p>
      )}
      {!isHolderOnline && online.length > 0 && (
        <>
          <SessionPicker sessions={online} value={picked} onChange={setPicked} />
          <Button
            size="sm"
            disabled={picked === null || isRunning}
            onClick={() => picked !== null && void assign(picked)}
          >
            {assignment === null ? t('holder.assign') : t('holder.reassign')}
          </Button>
        </>
      )}
      {assignment !== null && !isHolderOnline && (
        <Button size="sm" variant="outline" disabled={isRunning} onClick={() => void unlock()}>
          {t('holder.unlock')}
        </Button>
      )}
      {error !== null && <p className="text-destructive">{error}</p>}
    </div>
  )
}
