import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { GlassConfig } from '@ybouane/liquidglass'
import { useHomePageVariant } from '../context/HomePageVariantContext'
import { LiquidGlassButton } from './LiquidGlassButton'
import { PillButton } from './PillButton'
import type { LiquidGlassButtonVariant } from '../lib/liquid-glass/liquidGlassPresets'

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: LiquidGlassButtonVariant
  config?: Partial<GlassConfig>
}

export function GlassButton({
  children,
  variant = 'light',
  config,
  className,
  type = 'button',
  ...props
}: GlassButtonProps) {
  const { useLiquidGlassButtons } = useHomePageVariant()

  if (useLiquidGlassButtons) {
    return (
      <LiquidGlassButton variant={variant} config={config} className={className} type={type} {...props}>
        {children}
      </LiquidGlassButton>
    )
  }

  return (
    <PillButton variant={variant} className={className} type={type} {...props}>
      {children}
    </PillButton>
  )
}
