import { cn } from 'cn'
import type { GateState } from '@/api'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/locale'

// Attention when the user has to act, busy while Claude has the project.
const DOT: Record<GateState, string> = {
  open: 'bg-attention',
  replied: 'bg-busy',
  delivered: 'bg-busy',
  auto: 'bg-busy',
}

export function GateStateDot({ state }: { state: GateState }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', DOT[state])} />
}

export function GateStateBadge({ state }: { state: GateState }) {
  const { t } = useLocale()
  return (
    <Badge variant="outline" className="gap-1.5">
      <GateStateDot state={state} />
      {t(`gate.state.${state}`)}
    </Badge>
  )
}
