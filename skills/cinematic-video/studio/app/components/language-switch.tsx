import { cn } from 'cn'
import { LANGUAGE_NAMES, LOCALES, type Locale, useLocale } from '@/locale'

// Changes the interface language only; project content stays as written.
export function LanguageSwitch() {
  const { t, locale, setLocale } = useLocale()
  return (
    <div role="radiogroup" aria-label={t('language.label')} className="flex rounded-md border p-0.5 text-xs">
      {(Object.keys(LOCALES) as Locale[]).map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === locale}
          onClick={() => setLocale(option)}
          className={cn(
            'rounded-sm px-2 py-0.5 text-muted-foreground hover:text-foreground',
            option === locale && 'bg-accent text-foreground',
          )}
        >
          {LANGUAGE_NAMES[option]}
        </button>
      ))}
    </div>
  )
}
