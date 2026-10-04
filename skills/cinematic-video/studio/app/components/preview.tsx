import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '@/locale'

// What render.py relies on in the page: window.render(t), which may return a
// promise, and window.ready, false while the page loads.
type PageWindow = Window & { render?: (t: number) => unknown; ready?: boolean }

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'timeout' } | { kind: 'failed'; message: string }

// render.py's own limit for a page to get ready.
const READY_TIMEOUT_MS = 60_000
const MAX_HEIGHT_SHARE = 0.55

function isReady(page: PageWindow) {
  return typeof page.render === 'function' && (page.ready === undefined || page.ready === true)
}

// Resolves to whether the page got ready; gives up once the iframe holds
// another page, as it does after a reload.
async function untilReady(page: PageWindow, isCurrent: () => boolean) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline && isCurrent()) {
    if (isReady(page)) {
      await page.document.fonts?.ready
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return false
}

// The project's page at its own resolution, scaled to fit, showing
// render(time) as render.py would capture it (D5). A studio:preview push
// for this project reloads it.
export function Preview({
  slug,
  src,
  size,
  time,
}: {
  slug: string
  src: string
  size: { width: number; height: number }
  time: number
}) {
  const { t } = useLocale()
  const frame = useRef<HTMLIFrameElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [reloads, setReloads] = useState(0)
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const wantedTime = useRef(time)
  const isRendering = useRef(false)
  wantedTime.current = time

  // One render(t) at a time; a time asked for meanwhile is drawn next.
  const renderLatest = useCallback(async () => {
    const page = frame.current?.contentWindow as PageWindow | null | undefined
    if (isRendering.current || page?.render === undefined) return
    isRendering.current = true
    try {
      let drawn: number | undefined
      while (drawn !== wantedTime.current) {
        drawn = wantedTime.current
        await page.render(drawn)
      }
    } catch (failure) {
      setStatus({ kind: 'failed', message: (failure as Error).message })
    } finally {
      isRendering.current = false
    }
  }, [])

  async function onLoad() {
    const page = frame.current?.contentWindow as PageWindow | null | undefined
    if (page == null) return
    setStatus({ kind: 'loading' })
    const isCurrent = () => frame.current?.contentWindow === page
    if (!(await untilReady(page, isCurrent))) {
      if (isCurrent()) setStatus({ kind: 'timeout' })
      return
    }
    setStatus({ kind: 'ready' })
    await renderLatest()
  }

  useEffect(() => {
    if (status.kind === 'ready') void renderLatest()
  }, [time, status.kind, renderLatest])

  useEffect(() => {
    const onPreview = (change: { slug: string }) => {
      if (change.slug === slug) setReloads(count => count + 1)
    }
    import.meta.hot?.on('studio:preview', onPreview)
    return () => import.meta.hot?.off('studio:preview', onPreview)
  }, [slug])

  useEffect(() => {
    const element = container.current
    if (element === null) return
    // Shrinks to fit, never blown up past the page's own pixels.
    const fit = () =>
      setScale(Math.min(1, element.clientWidth / size.width, (window.innerHeight * MAX_HEIGHT_SHARE) / size.height))
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [size.width, size.height])

  return (
    <div ref={container} className="flex flex-col items-center gap-2">
      <div
        className="relative overflow-hidden rounded-md bg-black"
        style={{ width: size.width * scale, height: size.height * scale }}
      >
        <iframe
          key={reloads}
          ref={frame}
          src={src}
          title={slug}
          onLoad={() => void onLoad()}
          className="absolute top-0 left-0 origin-top-left border-0"
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
        />
      </div>
      {status.kind === 'loading' && <p className="text-xs text-muted-foreground">{t('preview.loading')}</p>}
      {status.kind === 'timeout' && <p className="text-xs text-destructive">{t('preview.timeout')}</p>}
      {status.kind === 'failed' && (
        <p className="text-xs text-destructive">{t('preview.failed', { time: time.toFixed(2), message: status.message })}</p>
      )}
    </div>
  )
}
