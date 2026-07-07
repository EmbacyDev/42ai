import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useGlassPanel } from '../lib/glass-panel/useGlassPanel'
import styles from './PillButton.module.css'

type PillVariant = 'hero' | 'light' | 'ghost' | 'dark' | 'outline' | 'darkText'

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: PillVariant
  glass?: boolean
}

const variantClass: Record<PillVariant, string> = {
  hero: styles.pillHero,
  light: styles.pillLight,
  ghost: styles.pillGhost,
  dark: styles.pillDark,
  outline: styles.pillOutline,
  darkText: styles.pillDarkText,
}

const labelVariantClass: Record<PillVariant, string | undefined> = {
  hero: undefined,
  light: styles.labelLight,
  ghost: styles.labelGhost,
  dark: styles.labelDark,
  outline: styles.labelOutline,
  darkText: styles.labelDarkText,
}

export function PillButton({
  children,
  variant = 'light',
  glass = false,
  className,
  type = 'button',
  ...props
}: PillButtonProps) {
  const glassRef = useGlassPanel<HTMLButtonElement>(glass, [variant, glass])

  return (
    <button
      ref={glassRef}
      type={type}
      className={[
        styles.pill,
        glass ? styles.pillGlass : variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(glass
        ? {
            'data-glass-panel': true,
            'data-glass-blur': '8px',
            'data-glass-no-svg': 'true',
            'data-glass-saturation': '1.3',
          }
        : {})}
      {...props}
    >
      <span className={[styles.label, labelVariantClass[variant]].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
