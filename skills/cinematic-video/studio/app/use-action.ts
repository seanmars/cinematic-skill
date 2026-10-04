import { useState } from 'react'
import { useLocale } from './locale'
import { useStudio } from './studio'

// A button's call to the API: busy while it runs, its failure as a message.
// The server does not push back what the page wrote itself, so a call that
// succeeded refreshes the page.
export function useAction() {
  const { t } = useLocale()
  const { refresh } = useStudio()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolves to whether the action succeeded. Busy until the refresh lands,
  // so a second click never acts on the state from before the write.
  async function run(action: () => Promise<unknown>) {
    setIsRunning(true)
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(t('action.failed', { message: (failure as Error).message }))
      setIsRunning(false)
      return false
    }
    try {
      await refresh()
    } finally {
      setIsRunning(false)
    }
    return true
  }

  return { isRunning, error, run }
}
