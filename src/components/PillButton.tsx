import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './PillButton.module.css'

type PillVariant = 'light' | 'ghost' | 'dark' | 'outline'

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: PillVariant
}

const variantClass: Record<PillVariant, string> = {
  light: styles.pillLight,
  ghost: styles.pillGhost,
  dark: styles.pillDark,
  outline: styles.pillOutline,
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
      {children}
    </button>
  )
}
