export type GlassSettings = {
  blur: number
  distortion: number
  bezel: number
  saturation: number
  specular: number
  warmth: number
  fillTop: number
  fillBottom: number
  edge: number
  shadow: number
  burn: number
  hoverScale: number
}

export const defaultGlassSettings: GlassSettings = {
  blur: 2,
  distortion: 55,
  bezel: 0.19,
  saturation: 1.3,
  specular: 0,
  warmth: 0,
  fillTop: 0,
  fillBottom: 0,
  edge: 0,
  shadow: 0,
  burn: 0,
  hoverScale: 1.05,
}

export function glassSettingsToDataset(settings: GlassSettings): Record<string, string> {
  return {
    'data-glass-blur': `${settings.blur}px`,
    'data-glass-distortion': String(settings.distortion),
    'data-glass-bezel': String(settings.bezel),
    'data-glass-saturation': String(settings.saturation),
    'data-glass-specular': String(settings.specular),
    'data-glass-warmth': String(settings.warmth),
    'data-glass-fill-top': String(settings.fillTop),
    'data-glass-fill-bottom': String(settings.fillBottom),
    'data-glass-edge': String(settings.edge),
    'data-glass-shadow': String(settings.shadow),
    'data-glass-burn': String(settings.burn),
  }
}
