import { cn } from 'cn'
import type { ReactNode } from 'react'
import type { Gate, GatePayload, MixElement, Project, TreatmentOption } from '@/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useGateDraft } from '@/gate-draft'
import { type MessageKey, useLocale } from '@/locale'

// What can be borrowed from another treatment in a mix.
const MIX_ELEMENTS = ['look', 'structure', 'signatureMoves', 'audio', 'stack'] as const

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <h2 className="text-xs text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

// A report Claude wrote in markdown, shown as written.
function Report({ title, text }: { title: string; text: string | undefined }) {
  if (!text) return null
  return (
    <Card title={title}>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
    </Card>
  )
}

// A project file by its extension: a picture, a film, a sound.
function Media({ src, className }: { src: string; className?: string }) {
  if (/\.(mp4|webm|mov)$/i.test(src)) return <video controls src={src} className={cn('w-full rounded-md bg-black', className)} />
  if (/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(src)) return <audio controls src={src} className="w-full" />
  return <img src={src} alt={src} className={cn('w-full rounded-md bg-muted object-contain', className)} />
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sm underline">
      {label}
    </a>
  )
}

function TextList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 text-sm">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

type PanelProps = { project: Project; payload: GatePayload; base: string; isOpen: boolean }

function IntakePanel({ payload, isOpen }: PanelProps) {
  const { t } = useLocale()
  const { draft, update } = useGateDraft()
  if (!payload.questions?.length) return null
  return (
    <Card title={t('intakeGate.questions')}>
      {payload.questions.map((item, index) => (
        <label key={item.question} className="flex flex-col gap-1 text-sm">
          {item.question}
          <Input
            disabled={!isOpen}
            placeholder={item.default ?? ''}
            value={draft.answers[index] ?? ''}
            onChange={event => update({ answers: { ...draft.answers, [index]: event.target.value } })}
          />
        </label>
      ))}
      <p className="text-xs text-muted-foreground">{t('intakeGate.defaults')}</p>
    </Card>
  )
}

function TreatmentCard({ option, base, isOpen }: { option: TreatmentOption; base: string; isOpen: boolean }) {
  const { t } = useLocale()
  const { draft, update } = useGateDraft()
  const isBase = draft.treatment === option.id
  const isMixed = (element: string) => draft.mix.some(item => item.option === option.id && item.element === element)
  const toggle = (element: string) => {
    const item: MixElement = { option: option.id, element }
    update({
      mix: isMixed(element)
        ? draft.mix.filter(other => !(other.option === option.id && other.element === element))
        : [...draft.mix, item],
    })
  }

  return (
    <article className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm', isBase && 'ring-2 ring-ring')}>
      <header>
        <h2 className="font-semibold">
          <span className="mr-2 font-mono text-muted-foreground">{option.id}</span>
          {option.title}
        </h2>
        <p className="text-muted-foreground">{option.logline}</p>
      </header>
      {option.preview && <Media src={`${base}${option.preview}`} className="aspect-video" />}
      <div className="flex flex-col gap-1">
        <p>{option.look.description}</p>
        <div className="flex gap-1">
          {option.look.palette.map(color => (
            <span key={color} title={color} className="size-5 rounded-sm border" style={{ background: color }} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{option.look.typefaces.join(', ')}</p>
      </div>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t('treatment.specs')}</dt>
        <dd>{option.specs}</dd>
        <dt className="text-muted-foreground">{t('treatment.stack')}</dt>
        <dd>{option.stack}</dd>
        {option.cta && (
          <>
            <dt className="text-muted-foreground">{t('treatment.cta')}</dt>
            <dd>{option.cta}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t('treatment.audio')}</dt>
        <dd>{option.audio}</dd>
        <dt className="text-muted-foreground">{t('treatment.estimate')}</dt>
        <dd>{option.estimate}</dd>
        <dt className="text-muted-foreground">{t('treatment.risk')}</dt>
        <dd>{option.risk}</dd>
        <dt className="text-muted-foreground">{t('treatment.whyItFits')}</dt>
        <dd>{option.whyItFits}</dd>
      </dl>
      <ol className="flex flex-col gap-1 text-xs">
        {option.shots.map(shot => (
          <li key={shot.range}>
            <span className="mr-2 font-mono text-muted-foreground">{shot.range}</span>
            {shot.text}
          </li>
        ))}
      </ol>
      <TextList items={option.signatureMoves} />
      {isOpen && (
        <footer className="flex flex-col gap-2 border-t pt-3 text-xs">
          <label className="flex items-center gap-2">
            <input type="radio" name="treatment" checked={isBase} onChange={() => update({ treatment: option.id })} />
            {t('treatment.base', { id: option.id })}
          </label>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-muted-foreground">{t('treatment.mixIn')}</span>
            {MIX_ELEMENTS.map(element => (
              <label key={element} className="flex items-center gap-1">
                <input type="checkbox" checked={isMixed(element)} onChange={() => toggle(element)} />
                {t(`treatment.element.${element}`)}
              </label>
            ))}
          </div>
        </footer>
      )}
    </article>
  )
}

function TreatmentsPanel({ project, base, isOpen }: PanelProps) {
  const { t } = useLocale()
  if (project.treatments === null) return <p className="text-sm text-muted-foreground">{t('treatment.missing')}</p>
  return (
    <div className="grid gap-4 2xl:grid-cols-3">
      {project.treatments.options.map(option => (
        <TreatmentCard key={option.id} option={option} base={base} isOpen={isOpen} />
      ))}
    </div>
  )
}

function AssetsPanel({ payload, base, isOpen }: PanelProps) {
  const { t } = useLocale()
  const { draft, update } = useGateDraft()
  const toggle = (asset: string) =>
    update({
      regenerate: draft.regenerate.includes(asset)
        ? draft.regenerate.filter(other => other !== asset)
        : [...draft.regenerate, asset],
    })
  return (
    <>
      {payload.assets?.length ? (
        <Card title={t('assetsGate.gallery')}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {payload.assets.map(asset => (
              <li key={asset} className="flex flex-col gap-1 text-xs">
                <Media src={`${base}${asset}`} className="aspect-video" />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    disabled={!isOpen}
                    checked={draft.regenerate.includes(asset)}
                    onChange={() => toggle(asset)}
                  />
                  <span className="truncate font-mono">{asset}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Report title={t('gate.critic')} text={payload.critic} />
      {payload.ledger && <DocLink href={`${base}${payload.ledger}`} label={t('assetsGate.ledger')} />}
    </>
  )
}

function GauntletPanel({ payload, base, isOpen }: PanelProps) {
  const { t } = useLocale()
  const { draft, update } = useGateDraft()
  return (
    <>
      {payload.round !== undefined && <p className="text-sm">{t('gauntletGate.round', { round: payload.round })}</p>}
      <Report title={t('gate.critic')} text={payload.critic} />
      <Report title={t('gauntletGate.measurements')} text={payload.measurements} />
      {payload.reviewLog && <DocLink href={`${base}${payload.reviewLog}`} label={t('gauntletGate.reviewLog')} />}
      <Card title={t('gauntletGate.priorities')}>
        <Textarea
          rows={3}
          disabled={!isOpen}
          value={draft.priorities}
          onChange={event => update({ priorities: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t('gauntletGate.prioritiesHint')}</p>
      </Card>
    </>
  )
}

function DeliverPanel({ payload, base }: PanelProps) {
  const { t } = useLocale()
  return (
    <>
      {payload.film && <Media src={`${base}${payload.film}`} />}
      {payload.poster && (
        <Card title={t('deliverGate.poster')}>
          <Media src={`${base}${payload.poster}`} className="max-h-96" />
        </Card>
      )}
      <Report title={t('deliverGate.notes')} text={payload.notes} />
      {payload.confirm?.length ? (
        <Card title={t('deliverGate.confirm')}>
          <TextList items={payload.confirm} />
        </Card>
      ) : null}
    </>
  )
}

function MediaWithReports({ src, reports }: { src: string | undefined; reports: [MessageKey, string | undefined][] }) {
  const { t } = useLocale()
  return (
    <>
      {src && <Media src={src} />}
      {reports.map(([title, text]) => (
        <Report key={title} title={t(title)} text={text} />
      ))}
    </>
  )
}

function StageContent(props: PanelProps & { stage: Gate['stage'] }) {
  const { payload, base } = props
  switch (props.stage) {
    case 'intake':
      return <IntakePanel {...props} />
    case 'treatments':
      return <TreatmentsPanel {...props} />
    case 'storyboard':
      return <MediaWithReports src={undefined} reports={[['gate.critic', payload.critic]]} />
    case 'assets':
      return <AssetsPanel {...props} />
    case 'build-animatic':
      return (
        <MediaWithReports
          src={payload.animatic && `${base}${payload.animatic}`}
          reports={[['gate.critic', payload.critic]]}
        />
      )
    case 'build-polish':
      return (
        <MediaWithReports
          src={undefined}
          reports={[
            ['gate.critic', payload.critic],
            ['polishGate.estimate', payload.renderEstimate],
          ]}
        />
      )
    case 'audio':
      return (
        <MediaWithReports src={payload.mix && `${base}${payload.mix}`} reports={[['audioGate.loudness', payload.loudness]]} />
      )
    case 'gauntlet':
      return <GauntletPanel {...props} />
    case 'deliver':
      return <DeliverPanel {...props} />
  }
}

// The middle of the layout at a gate: what Claude brought to this stage,
// and where the user makes the stage's choices. The raw payload stays one
// click away.
export function StagePanel({ project, gate }: { project: Project; gate: Gate }) {
  const { t, languageTag } = useLocale()
  const base = project.previewBase ?? ''
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold">{t('gate.title', { stage: t(`stage.${gate.stage}`) })}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {gate.gateId} · {t('gate.openedAt', { time: new Date(gate.openedAt).toLocaleString(languageTag) })}
        </p>
      </header>
      <StageContent
        stage={gate.stage}
        project={project}
        payload={gate.payload}
        base={base}
        isOpen={gate.state === 'open'}
      />
      <details className="rounded-lg border bg-card">
        <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground">{t('gate.payload')}</summary>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
          {JSON.stringify(gate.payload, null, 2)}
        </pre>
      </details>
    </div>
  )
}
