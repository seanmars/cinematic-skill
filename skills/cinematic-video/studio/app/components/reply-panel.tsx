import { type Choice, type Cue, type Gate, type Stage, api, realignRows } from '@/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { lines } from '@/format'
import { type GateDraft, useGateDraft } from '@/gate-draft'
import { type MessageKey, useLocale } from '@/locale'
import { useAction } from '@/use-action'
import { GateStateBadge } from './gate-state'

// A reply the gate offers. choice turns the draft into the reply's choice:
// undefined sends none, null means the draft is not ready for this reply.
type Action = {
  decision: string
  label: MessageKey
  isSecondary?: boolean
  choice?: (draft: GateDraft) => Choice | undefined | null
}

const APPROVE: Action = { decision: 'approve', label: 'gate.approve' }
const REVISE: Action = { decision: 'revise', label: 'reply.revise', isSecondary: true }

// Each stage's replies (web-gate-payloads, gate-reply-choice).
const ACTIONS: Record<Stage, Action[]> = {
  intake: [{ decision: 'approve', label: 'reply.sendAnswers' }],
  treatments: [
    {
      decision: 'pick',
      label: 'reply.pick',
      choice: draft => (draft.treatment !== null && draft.mix.length === 0 ? { id: draft.treatment } : null),
    },
    {
      decision: 'mix',
      label: 'reply.mix',
      choice: draft => (draft.treatment !== null && draft.mix.length > 0 ? { id: draft.treatment, mix: draft.mix } : null),
    },
    { decision: 'redo', label: 'reply.redo', isSecondary: true },
  ],
  storyboard: [APPROVE, REVISE],
  assets: [
    APPROVE,
    {
      decision: 'regenerate',
      label: 'reply.regenerate',
      isSecondary: true,
      choice: draft => (draft.regenerate.length > 0 ? { regenerate: draft.regenerate } : null),
    },
  ],
  'build-animatic': [APPROVE, REVISE],
  'build-polish': [{ decision: 'approve', label: 'reply.approveRender' }, REVISE],
  audio: [APPROVE, REVISE],
  gauntlet: [
    { decision: 'ship', label: 'reply.ship' },
    {
      decision: 'another-round',
      label: 'reply.anotherRound',
      isSecondary: true,
      choice: draft => {
        const priorities = lines(draft.priorities)
        return priorities.length > 0 ? { priorities } : undefined
      },
    },
  ],
  deliver: [{ decision: 'approve', label: 'reply.close' }],
}

// The user's notes, the answers to Claude's Intake questions, then one line
// per shot that has a note of its own.
function replyNotes(gate: Gate, draft: GateDraft) {
  const answers = (gate.payload.questions ?? []).flatMap((item, index) => {
    const answer = draft.answers[index]?.trim()
    return answer ? [`${item.question}\n→ ${answer}`] : []
  })
  const perShot = Object.entries(draft.shotNotes)
    .filter(([, note]) => note.trim() !== '')
    .map(([shotId, note]) => `${shotId}: ${note.trim()}`)
  return [draft.notes.trim(), ...answers, ...perShot].filter(line => line !== '').join('\n')
}

// Answers the open gate. The studio adds every field edited at this gate to
// the reply, so the list shown here is what Claude will re-read.
export function ReplyPanel({
  slug,
  gate,
  changes,
  plan,
}: {
  slug: string
  gate: Gate
  changes: string[]
  plan: Cue[] | null
}) {
  const { t } = useLocale()
  const { draft, update } = useGateDraft()
  const { isRunning, error, run } = useAction()
  const isOpen = gate.state === 'open'
  const realign = realignRows(changes).flatMap(row => (plan?.[row] === undefined ? [] : [plan[row]]))

  async function send(action: Action, choice: Choice | undefined) {
    const reply = {
      decision: action.decision,
      notes: replyNotes(gate, draft),
      changes: [],
      ...(choice === undefined ? {} : { choice }),
    }
    await run(() => api.reply(slug, gate.gateId, reply))
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <GateStateBadge state={gate.state} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="reply-notes" className="text-xs">
          {t('reply.notes')}
        </Label>
        <Textarea
          id="reply-notes"
          rows={3}
          className="min-h-0 text-xs"
          disabled={!isOpen}
          value={draft.notes}
          onChange={event => update({ notes: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t('reply.changes')}</span>
        {changes.length === 0 ? (
          <span className="text-muted-foreground">{t('reply.noChanges')}</span>
        ) : (
          <ul className="font-mono text-[11px]">
            {changes.map(change => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        )}
      </div>
      {realign.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-attention/40 bg-attention/10 p-2 text-xs text-attention">
          <span>{t('reply.realign')}</span>
          <ul className="font-mono text-[11px]">
            {realign.map(([name, at], index) => (
              <li key={`${index}-${name}`}>{t('reply.cue', { name, time: at })}</li>
            ))}
          </ul>
        </div>
      )}
      {changes.includes('music-recut') && (
        <p className="rounded-md border border-attention/40 bg-attention/10 p-2 text-xs text-attention">
          {t('reply.musicRecut')}
        </p>
      )}
      {ACTIONS[gate.stage].map(action => {
        const choice = action.choice?.(draft)
        return (
          <Button
            key={action.decision}
            variant={action.isSecondary ? 'outline' : 'default'}
            disabled={!isOpen || isRunning || choice === null}
            onClick={() => choice !== null && void send(action, choice)}
          >
            {t(action.label, { id: draft.treatment ?? '' })}
          </Button>
        )
      })}
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
