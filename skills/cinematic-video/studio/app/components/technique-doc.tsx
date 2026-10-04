import { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { useLocale } from '@/locale'

// A technique's full file, from the library or the project, as written.
export function TechniqueDoc({
  slug,
  techniquePath,
  title,
  onClose,
}: {
  slug: string
  techniquePath: string | null
  title: string
  onClose: () => void
}) {
  const { t } = useLocale()
  const [markdown, setMarkdown] = useState('')

  useEffect(() => {
    setMarkdown('')
    if (techniquePath !== null) void api.techniqueFile(slug, techniquePath).then(setMarkdown)
  }, [slug, techniquePath])

  return (
    <Dialog open={techniquePath !== null} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[80vh] flex-col sm:max-w-2xl">
        <DialogTitle>{title}</DialogTitle>
        <pre className="min-h-0 flex-1 overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">
          {markdown}
        </pre>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('dialog.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
