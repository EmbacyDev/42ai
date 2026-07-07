import { useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useFrostedBackdrop } from '../lib/glass-panel/useFrostedBackdrop'
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
  const surfaceRef = useRef<HTMLSpanElement>(null)
  const { hostRef } = useFrostedBackdrop<HTMLButtonElement>(glass, surfaceRef)
  useGlassPanel(glass, [variant, glass], surfaceRef)

  return (
    <button
      ref={hostRef}
      type={type}
      className={[
        styles.pill,
        glass ? styles.pillGlass : variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {glass ? (
        <span
          ref={surfaceRef}
          className={styles.glassBackdrop}
          aria-hidden="true"
          data-glass-panel
          data-glass-surface="true"
          data-glass-blur="2px"
          data-glass-distortion="55"
          data-glass-bezel="0.19"
          data-glass-saturation="1.3"
        />
      ) : null}
      <span className={[styles.label, labelVariantClass[variant]].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
