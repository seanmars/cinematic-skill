import type { ReactNode } from 'react'

export function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-4 pt-4 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{children}</h2>
  )
}
