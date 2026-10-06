import type { ReactNode } from 'react'
import type { GlassConfig } from '@ybouane/liquidglass'
import { useHomePageVariant } from '../context/HomePageVariantContext'
import { LiquidGlassRoot } from './LiquidGlassRoot'

type GlassSurfaceProps = {
  children: ReactNode
  className?: string
  defaults?: Partial<GlassConfig>
}

export function GlassSurface({ children, className, defaults }: GlassSurfaceProps) {
  const { useLiquidGlassButtons } = useHomePageVariant()

  if (useLiquidGlassButtons) {
    return (
      <LiquidGlassRoot className={className} defaults={defaults}>
        {children}
      </LiquidGlassRoot>
    )
  }

  return <div className={className}>{children}</div>
}
