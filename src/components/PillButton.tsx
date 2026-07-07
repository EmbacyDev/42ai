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
        variantClass[variant],
        glass && styles.pillGlass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(glass
        ? {
            'data-glass-panel': true,
            'data-glass-blur': '2px',
            'data-glass-distortion': '55',
            'data-glass-bezel': '0.19',
            'data-glass-saturation': '1.3',
          }
        : {})}
      {...props}
    >
      <span className={styles.label}>{children}</span>
    </button>
  )
}
