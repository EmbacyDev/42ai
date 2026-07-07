import type { GlassConfig } from '@ybouane/liquidglass'

const pillBase: Partial<GlassConfig> = {
  button: true,
  cornerRadius: 30,
  zRadius: 18,
  blurAmount: 0.35,
  refraction: 0.55,
  chromAberration: 0.04,
  edgeHighlight: 0.1,
  shadowOpacity: 0.22,
  shadowSpread: 8,
  shadowOffsetY: 2,
}

export type LiquidGlassButtonVariant = 'light' | 'ghost' | 'outline' | 'darkText'

export const liquidGlassButtonPresets: Record<LiquidGlassButtonVariant, Partial<GlassConfig>> = {
  light: pillBase,
  ghost: {
    ...pillBase,
    blurAmount: 0.3,
    refraction: 0.5,
    edgeHighlight: 0.14,
  },
  outline: {
    ...pillBase,
    blurAmount: 0.28,
    refraction: 0.48,
    edgeHighlight: 0.16,
  },
  darkText: {
    ...pillBase,
    blurAmount: 0.32,
    refraction: 0.52,
    tintStrength: 0.04,
  },
}
