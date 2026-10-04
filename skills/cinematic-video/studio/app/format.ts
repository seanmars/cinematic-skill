// Wall-clock time of day, as the user's locale writes it.
export function clock(iso: string, languageTag: string, withSeconds = false) {
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  if (withSeconds) options.second = '2-digit'
  return new Date(iso).toLocaleTimeString(languageTag, options)
}

// A span of seconds as m:ss.
export function minutes(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
