import { useLocale } from '@/locale'

// Drags the time the preview shows, frame by frame.
export function Playhead({
  time,
  length,
  fps,
  onChange,
}: {
  time: number
  length: number
  fps: number
  onChange: (time: number) => void
}) {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={t('playhead.label')}
        min={0}
        max={length}
        step={1 / fps}
        value={time}
        onChange={event => onChange(Number(event.target.value))}
        className="h-1 flex-1 cursor-pointer accent-foreground"
      />
      <span className="w-32 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {t('playhead.time', { time: time.toFixed(2), length: length.toFixed(2) })}
      </span>
    </div>
  )
}
