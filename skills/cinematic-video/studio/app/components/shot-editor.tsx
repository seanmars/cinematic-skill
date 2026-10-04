import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  SLOT_CATEGORIES,
  SLOTS,
  type Shot,
  type Slot,
  TEXT_FIELDS,
  type Technique,
  type TechniqueCategory,
  type TextField,
  api,
} from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useGateDraft } from '@/gate-draft'
import { useLocale } from '@/locale'
import { useAction } from '@/use-action'
import { TechniqueDoc } from './technique-doc'

export type TechniqueIndex = { categories: TechniqueCategory[]; techniques: Technique[] }

const SELECT_CLASS =
  'h-8 w-full rounded-md border border-input bg-input/30 px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

function useTechniqueName() {
  const { t } = useLocale()
  return (technique: Technique) => (technique.custom ? `${technique.name} (${t('technique.custom')})` : technique.name)
}

function SlotField({
  slot,
  value,
  index,
  isEditable,
  onChange,
  onOpen,
}: {
  slot: Slot
  value: string | null
  index: TechniqueIndex
  isEditable: boolean
  onChange: (value: string | null) => void
  onOpen: (technique: Technique) => void
}) {
  const { t } = useLocale()
  const name = useTechniqueName()
  const choices = index.techniques.filter(technique => technique.category === SLOT_CATEGORIES[slot])
  const chosen = choices.find(technique => technique.path === value)

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`slot-${slot}`} className="text-xs">
        {t(`slot.${slot}`)}
      </Label>
      <select
        id={`slot-${slot}`}
        className={SELECT_CLASS}
        disabled={!isEditable}
        value={value ?? ''}
        onChange={event => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">{t('slot.none')}</option>
        {choices.map(technique => (
          <option key={technique.path} value={technique.path}>
            {name(technique)}
          </option>
        ))}
      </select>
      {chosen !== undefined && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {chosen.summary}{' '}
          <button type="button" className="text-foreground underline" onClick={() => onOpen(chosen)}>
            {t('technique.open')}
          </button>
        </p>
      )}
    </div>
  )
}

// Every category beyond the four slots, as removable tags. The list goes out
// whole, so it waits while the last change is saving.
function TagsField({
  tags,
  index,
  isEditable,
  isSaving,
  onChange,
  onOpen,
}: {
  tags: string[]
  index: TechniqueIndex
  isEditable: boolean
  isSaving: boolean
  onChange: (tags: string[]) => void
  onOpen: (technique: Technique) => void
}) {
  const { t } = useLocale()
  const name = useTechniqueName()
  const slotCategories = new Set(Object.values(SLOT_CATEGORIES))
  const byPath = new Map(index.techniques.map(technique => [technique.path, technique]))

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tag-add" className="text-xs">
        {t('tags.heading')}
      </Label>
      <ul className="flex flex-wrap gap-1">
        {tags.map(tag => {
          const technique = byPath.get(tag)
          return (
            <li key={tag} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
              <button type="button" onClick={() => technique && onOpen(technique)}>
                {technique === undefined ? tag : name(technique)}
              </button>
              {isEditable && (
                <button
                  type="button"
                  aria-label={t('tags.remove', { name: technique?.name ?? tag })}
                  disabled={isSaving}
                  onClick={() => onChange(tags.filter(other => other !== tag))}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {isEditable && (
        <select
          id="tag-add"
          className={SELECT_CLASS}
          disabled={isSaving}
          value=""
          onChange={event => onChange([...tags, event.target.value])}
        >
          <option value="">{t('tags.add')}</option>
          {index.categories
            .filter(category => !slotCategories.has(category.id))
            .map(category => (
              <optgroup key={category.id} label={category.title}>
                {index.techniques
                  .filter(technique => technique.category === category.id && !tags.includes(technique.path))
                  .map(technique => (
                    <option key={technique.path} value={technique.path}>
                      {name(technique)}
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>
      )}
    </div>
  )
}

// Saved when the field loses focus, and only if it changed.
function TextFieldEditor({
  field,
  value,
  isEditable,
  onSave,
}: {
  field: TextField
  value: string
  isEditable: boolean
  onSave: (value: string) => void
}) {
  const { t } = useLocale()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`text-${field}`} className="text-xs">
        {t(`text.${field}`)}
      </Label>
      <Textarea
        id={`text-${field}`}
        rows={field === 'picture' ? 4 : 2}
        className="min-h-0 text-xs"
        disabled={!isEditable}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
      />
    </div>
  )
}

// Saved on Enter or when the field loses focus. Later shots and their cues
// follow (D6).
function DurationField({
  duration,
  isEditable,
  onSave,
}: {
  duration: number
  isEditable: boolean
  onSave: (duration: number) => void
}) {
  const { t } = useLocale()
  const [draft, setDraft] = useState(String(duration))
  useEffect(() => setDraft(String(duration)), [duration])

  function save() {
    const value = Number(draft)
    if (Number.isFinite(value) && value > 0 && value !== duration) onSave(value)
    else setDraft(String(duration))
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="shot-duration" className="text-xs">
        {t('shot.durationLabel')}
      </Label>
      <Input
        id="shot-duration"
        type="number"
        step="0.001"
        min="0.001"
        className="h-8 font-mono text-xs"
        disabled={!isEditable}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={event => event.key === 'Enter' && save()}
      />
      <p className="text-[11px] text-muted-foreground">{t('shot.durationHint')}</p>
    </div>
  )
}

// One shot's duration, technique slots, tags and text. Every edit goes straight to
// storyboard.json and joins the change list the reply carries; the note
// goes into the reply alone.
export function ShotEditor({
  slug,
  shot,
  index,
  isEditable,
}: {
  slug: string
  shot: Shot
  index: TechniqueIndex
  isEditable: boolean
}) {
  const { t } = useLocale()
  const { draft, update } = useGateDraft()
  const { isRunning, error, run } = useAction()
  const [open, setOpen] = useState<Technique | null>(null)
  const edit = (field: string, value: unknown) => void run(() => api.editShot(slug, shot.id, field, value))

  return (
    <div className="flex flex-col gap-3 px-4">
      <DurationField duration={shot.duration} isEditable={isEditable} onSave={duration => void run(() => api.editDuration(slug, shot.id, duration))} />
      {SLOTS.map(slot => (
        <SlotField
          key={slot}
          slot={slot}
          value={shot.techniques[slot]}
          index={index}
          isEditable={isEditable}
          onChange={value => edit(`techniques.${slot}`, value)}
          onOpen={setOpen}
        />
      ))}
      <TagsField
        tags={shot.tags}
        index={index}
        isEditable={isEditable}
        isSaving={isRunning}
        onChange={tags => edit('tags', tags)}
        onOpen={setOpen}
      />
      {TEXT_FIELDS.map(field => (
        <TextFieldEditor
          key={field}
          field={field}
          value={shot.text[field] ?? ''}
          isEditable={isEditable}
          onSave={value => edit(`text.${field}`, value)}
        />
      ))}
      <div className="flex flex-col gap-1">
        <Label htmlFor="shot-note" className="text-xs">
          {t('shot.note')}
        </Label>
        <Textarea
          id="shot-note"
          rows={2}
          className="min-h-0 text-xs"
          disabled={!isEditable}
          value={draft.shotNotes[shot.id] ?? ''}
          onChange={event => update({ shotNotes: { ...draft.shotNotes, [shot.id]: event.target.value } })}
        />
      </div>
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
      <TechniqueDoc
        slug={slug}
        techniquePath={open?.path ?? null}
        title={open?.name ?? ''}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}

export function useTechniqueIndex(slug: string) {
  const [index, setIndex] = useState<TechniqueIndex | null>(null)
  useEffect(() => {
    setIndex(null)
    void api.techniques(slug).then(setIndex)
  }, [slug])
  return index
}
