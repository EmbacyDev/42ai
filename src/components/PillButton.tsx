import { useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useGlassSettings } from '../lib/glass-panel/GlassSettingsProvider'
import { glassSettingsToDataset } from '../lib/glass-panel/glassSettings'
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
  const { settings } = useGlassSettings()
  const surfaceRef = useRef<HTMLSpanElement>(null)
  const { hostRef } = useFrostedBackdrop<HTMLButtonElement>(glass, surfaceRef)

  useGlassPanel(
    glass,
    [
      variant,
      glass,
      settings.blur,
      settings.distortion,
      settings.bezel,
      settings.saturation,
      settings.specular,
      settings.warmth,
      settings.fillTop,
      settings.fillBottom,
      settings.edge,
      settings.shadow,
      settings.burn,
    ],
    surfaceRef,
  )

  const glassDataset = glass ? glassSettingsToDataset(settings) : {}

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
          {...glassDataset}
        />
      ) : null}
      <span className={[styles.label, labelVariantClass[variant]].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
