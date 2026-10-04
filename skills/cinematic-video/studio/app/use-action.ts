import { useState } from 'react'
import { useLocale } from './locale'

// A button's call to the API: busy while it runs, its failure as a message.
export function useAction() {
  const { t } = useLocale()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolves to whether the action succeeded.
  async function run(action: () => Promise<unknown>) {
    setIsRunning(true)
    setError(null)
    try {
      await action()
      return true
    } catch (failure) {
      setError(t('action.failed', { message: (failure as Error).message }))
      return false
    } finally {
      setIsRunning(false)
    }
  }

  return { isRunning, error, run }
}
