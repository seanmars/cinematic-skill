import { cn } from 'cn'
import { type FormEvent, type ReactNode, useState } from 'react'
import { PROFILES, type Profile, api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLocale } from '@/locale'
import { useOnlineSessions, useStudio } from '@/studio'
import { useAction } from '@/use-action'
import { SessionPicker } from './session-picker'

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function lines(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
}

// Sending it creates the project at once; the only session online gets it,
// with several the user picks, with none it waits to be assigned.
export function IntakeForm() {
  const { t } = useLocale()
  const { select, refresh, setComposing } = useStudio()
  const online = useOnlineSessions()
  const { isRunning, error, run } = useAction()
  const [brief, setBrief] = useState('')
  const [specs, setSpecs] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [brand, setBrand] = useState('')
  const [assets, setAssets] = useState('')
  const [slug, setSlug] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const needsPick = online.length > 1 && !online.some(session => session.sessionId === sessionId)

  async function submit(event: FormEvent) {
    event.preventDefault()
    let created = ''
    const form = { brief, specs, profile, brand, assets: lines(assets) }
    const isSent = await run(async () => {
      const result = await api.intake({
        ...form,
        ...(slug.trim() === '' ? {} : { slug: slug.trim() }),
        ...(online.length > 1 && sessionId !== null ? { sessionId } : {}),
      })
      created = result.slug
    })
    if (!isSent) return
    await refresh()
    select(created)
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-5 p-6">
      <h1 className="text-lg font-semibold">{t('intake.title')}</h1>
      <Field id="intake-brief" label={t('intake.brief')} hint={t('intake.briefHint')}>
        <Textarea id="intake-brief" rows={6} value={brief} onChange={event => setBrief(event.target.value)} required />
      </Field>
      <Field id="intake-specs" label={t('intake.specs')} hint={t('intake.specsHint')}>
        <Input id="intake-specs" value={specs} onChange={event => setSpecs(event.target.value)} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <Label>{t('intake.profile')}</Label>
        <div className="flex gap-2" role="radiogroup">
          {[null, ...PROFILES].map(option => (
            <Button
              key={option ?? 'auto'}
              type="button"
              size="sm"
              variant="outline"
              role="radio"
              aria-checked={profile === option}
              className={cn(profile === option && 'border-ring bg-accent')}
              onClick={() => setProfile(option)}
            >
              {option === null ? t('intake.profileAuto') : t(`intake.profile.${option}`)}
            </Button>
          ))}
        </div>
      </div>
      <Field id="intake-brand" label={t('intake.brand')}>
        <Input id="intake-brand" value={brand} onChange={event => setBrand(event.target.value)} className="font-mono" />
      </Field>
      <Field id="intake-assets" label={t('intake.assets')} hint={t('intake.assetsHint')}>
        <Textarea
          id="intake-assets"
          rows={3}
          value={assets}
          onChange={event => setAssets(event.target.value)}
          className="font-mono"
        />
      </Field>
      <Field id="intake-slug" label={t('intake.slug')} hint={t('intake.slugHint')}>
        <Input id="intake-slug" value={slug} onChange={event => setSlug(event.target.value)} className="font-mono" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <Label>{t('intake.session')}</Label>
        {online.length === 0 && <p className="text-xs text-attention">{t('intake.sessionNone')}</p>}
        {online.length === 1 && (
          <p className="text-xs text-muted-foreground">{t('intake.sessionOnly', { shortId: online[0]!.shortId })}</p>
        )}
        {online.length > 1 && <SessionPicker sessions={online} value={sessionId} onChange={setSessionId} />}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isRunning || brief.trim() === '' || needsPick}>
          {t('intake.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setComposing(false)}>
          {t('intake.cancel')}
        </Button>
      </div>
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
