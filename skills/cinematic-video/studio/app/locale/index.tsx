import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import en from './en'
import zhTw from './zh-tw'

export const LOCALES = { 'zh-tw': zhTw, en }
export type Locale = keyof typeof LOCALES
export type MessageKey = keyof typeof zhTw
type Values = Record<string, string | number>

// The tag Intl and <html lang> expect for each locale.
const LANGUAGE_TAGS: Record<Locale, string> = { 'zh-tw': 'zh-TW', en: 'en' }

// Each language named in itself, whichever language the page is in.
export const LANGUAGE_NAMES: Record<Locale, string> = { 'zh-tw': '繁體中文', en: 'English' }

const STORAGE_KEY = 'cinematic-studio.locale'

// The language the user switched to last, else the browser's.
function startLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null && saved in LOCALES) return saved as Locale
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-tw' : 'en'
}

type LocaleContextValue = {
  locale: Locale
  languageTag: string
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: Values) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(startLocale)

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_TAGS[locale]
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      languageTag: LANGUAGE_TAGS[locale],
      setLocale,
      t: (key, values = {}) =>
        LOCALES[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match)),
    }),
    [locale],
  )
  return <LocaleContext value={value}>{children}</LocaleContext>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (value === null) throw new Error('useLocale needs a LocaleProvider')
  return value
}
