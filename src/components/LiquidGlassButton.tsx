import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { GlassConfig } from '@ybouane/liquidglass'
import {
  liquidGlassButtonPresets,
  type LiquidGlassButtonVariant,
} from '../lib/liquid-glass/liquidGlassPresets'
import pillStyles from './PillButton.module.css'
import styles from './LiquidGlassButton.module.css'

type LiquidGlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: LiquidGlassButtonVariant
  config?: Partial<GlassConfig>
}

const labelVariantClass: Record<LiquidGlassButtonVariant, string | undefined> = {
  light: pillStyles.labelLight,
  ghost: pillStyles.labelGhost,
  outline: pillStyles.labelOutline,
  darkText: pillStyles.labelDarkText,
}

export function LiquidGlassButton({
  children,
  variant = 'light',
  config,
  className,
  type = 'button',
  ...props
}: LiquidGlassButtonProps) {
  const mergedConfig = { ...liquidGlassButtonPresets[variant], ...config }

  return (
    <button
      type={type}
      data-liquid-glass
      data-config={JSON.stringify(mergedConfig)}
      className={[styles.button, className].filter(Boolean).join(' ')}
      {...props}
    >
      <span className={[styles.label, labelVariantClass[variant]].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
