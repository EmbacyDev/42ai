import { projectDesignPoint } from './placement.js'
import { sceneConfig } from './sceneConfig.js'

/**
 * Places the headline on the same projection as the portrait camera.
 * Called from a layout effect so the first preloader frame already has
 * the final size — applying it after paint made the type jump.
 */
export function layoutHeroCopy(contentEl, width, height) {
  if (!contentEl || !width || !height) return
  const { designTop, designWidth } = sceneConfig.copy
  const top = projectDesignPoint(sceneConfig.design.width / 2, designTop, width, height).y
  const below = projectDesignPoint(sceneConfig.design.width / 2, designTop + 100, width, height).y
  const scale = (below - top) / 100
  contentEl.style.top = `${top}px`
  contentEl.style.width = `${designWidth}px`
  contentEl.style.transform = `translateX(-50%) scale(${scale})`
}
