import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './PillButton.module.css'

type PillVariant = 'hero' | 'light' | 'ghost' | 'dark' | 'outline' | 'darkText'

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: PillVariant
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
  className,
  type = 'button',
  ...props
}: PillButtonProps) {
  return (
    <button
      type={type}
      className={[styles.pill, variantClass[variant], className].filter(Boolean).join(' ')}
      {...props}
    >
      <span className={styles.label}>{children}</span>
    </button>
  )
}
