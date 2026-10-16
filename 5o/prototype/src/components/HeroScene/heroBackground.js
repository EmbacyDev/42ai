import { sceneConfig } from './sceneConfig.js'

/**
 * The hero's actual, currently-visible background colour, as a flat CSS
 * colour — shared with GlassCardCarousel so the second block can match it
 * exactly instead of assuming the plain `sceneConfig.background`.
 *
 * The hero paints its background from the prototype crystal config.
 * A gradient has no single flat colour; `color1` (the first stop) is what
 * the following section matches.
 */
export function resolveHeroBackgroundColor(tunedCrystalConfig) {
  if (!tunedCrystalConfig) return sceneConfig.background
  return tunedCrystalConfig.friendBackgroundColor1 ?? '#ffffff'
}
