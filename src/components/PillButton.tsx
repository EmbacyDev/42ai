import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useFrostedBackdrop } from '../lib/glass-panel/useFrostedBackdrop'
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
  const { hostRef, backdropRef } = useFrostedBackdrop<HTMLButtonElement>(glass)

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
      {glass ? <span ref={backdropRef} className={styles.glassBackdrop} aria-hidden="true" /> : null}
      <span className={[styles.label, labelVariantClass[variant]].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
