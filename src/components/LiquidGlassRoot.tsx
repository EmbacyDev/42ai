import { useRef } from 'react'
import type { GlassConfig } from '@ybouane/liquidglass'
import type { ReactNode } from 'react'
import { useLiquidGlass } from '../lib/liquid-glass/useLiquidGlass'

type LiquidGlassRootProps = {
  children: ReactNode
  className?: string
  defaults?: Partial<GlassConfig>
}

export function LiquidGlassRoot({ children, className, defaults }: LiquidGlassRootProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  useLiquidGlass(rootRef, defaults)

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  )
}
