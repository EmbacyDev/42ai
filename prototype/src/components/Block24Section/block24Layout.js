/**
 * Block 2 is the 1440×786 Figma frame (node 318:35926). The hero header
 * occupies the top 80px, so the composition — crystal through the title —
 * is centred in the viewport below that bar. The travelling crystal docks
 * on that frame's crystal, so the DOM layout and the page mesh stay on
 * the same point.
 */

export const BLOCK24_MENU_TOP = 21
export const BLOCK24_MENU_HEIGHT = 46
export const BLOCK24_MENU_BOTTOM = BLOCK24_MENU_TOP + BLOCK24_MENU_HEIGHT
/** Hero bar height. Block 2 centres under this, not under the compact pill. */
export const BLOCK24_HEADER_HEIGHT = 80
/** Keep the crystal from sitting on the header when leftover space is tight. */
export const BLOCK24_MIN_GAP = 12

export const BLOCK24_CRYSTAL_HIT = 100
export const BLOCK24_CRYSTAL_GAP = 8
export const BLOCK24_CRYSTAL_LIFT = 40

export const BLOCK24_DESIGN_WIDTH = 1440
export const BLOCK24_DESIGN_HEIGHT = 786
/** Centre of the Figma crystal frame inside the 786px block. */
export const BLOCK24_DESIGN_CRYSTAL_CENTER_Y = 149
export const BLOCK24_PHOTO_WIDTH = 311
export const BLOCK24_PHOTO_HEIGHT = 370
/** Crystal top through the 400px card, the title, and the Learn more button. */
export const BLOCK24_CONTENT_TOP = 123
export const BLOCK24_CONTENT_BOTTOM = 860
/** Inactive rail cards. The tab drum uses the same height. */
export const BLOCK24_INACTIVE_CARD_HEIGHT = 346
/** Vertical centre of the 336×400 active card (top 219). */
export const BLOCK24_HERO_CENTER_Y = 419

// Any committed flick off the block-two rest should start the cinematic.
// 0.03 of a 100% pin is ~0.03vh — below a typical wheel tick — so a
// scrollbar drag still arms, while the wheel listener commits even sooner.
// This threshold only applies after a real rest on block 2 (cards visible,
// pin parked); hero→block-2 landing inertia must not count as a flick.
export const BLOCK24_HANDOFF_ARM = 0.03
export const BLOCK24_HANDOFF_CANCEL = 0.008
export const BLOCK24_HANDOFF_EVENT = '42ai-block-handoff'
export const BLOCK24_RETURN_EVENT = '42ai-block-returned'

export function layoutBlock24(width, height) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const safeTop = Math.min(BLOCK24_HEADER_HEIGHT, h - 1)
  const safeHeight = Math.max(1, h - safeTop)
  const contentHeight = BLOCK24_CONTENT_BOTTOM - BLOCK24_CONTENT_TOP
  const contentCenter = (BLOCK24_CONTENT_TOP + BLOCK24_CONTENT_BOTTOM) / 2
  // The active card stays centred. Fit the industry list and the first
  // side card; the card after that leaves through the right edge. Shrinking
  // the whole block so that second card stayed fully inside made the photo
  // and the type too small on laptops.
  const heroCenter = 720.5
  const menuLeft = 128
  const firstCardRight = 920.5 + 290
  const edgeInset = 20
  const horizontalSpan = Math.max(heroCenter - menuLeft, firstCardRight - heroCenter)
  const heightScale = Math.max(1, safeHeight - BLOCK24_MIN_GAP * 2) / contentHeight
  const edgeScale = (w - edgeInset * 2) / (2 * horizontalSpan)
  const scale = Math.min(heightScale, edgeScale)
  const originX = w / 2 - heroCenter * scale
  let originY = safeTop + safeHeight / 2 - contentCenter * scale
  const contentTop = originY + BLOCK24_CONTENT_TOP * scale
  const contentBottom = originY + BLOCK24_CONTENT_BOTTOM * scale
  if (contentTop < safeTop + BLOCK24_MIN_GAP) {
    originY += safeTop + BLOCK24_MIN_GAP - contentTop
  }
  if (contentBottom > h - BLOCK24_MIN_GAP) {
    originY -= contentBottom - (h - BLOCK24_MIN_GAP)
  }
  const secondCardRight = 920.5 + 322 + 290
  const railOverflow = originX + secondCardRight * scale - w
  // Figma links sit at x=160 inside the 1440 frame (11% of the width).
  // Pin that to the viewport, so a wider window keeps the same fraction
  // instead of parking the list a fixed distance from the centred photo.
  const tabTextLeft = (160 / BLOCK24_DESIGN_WIDTH) * w
  const crystalCenterY = originY + BLOCK24_DESIGN_CRYSTAL_CENTER_Y * scale
  const crystalTop = crystalCenterY - BLOCK24_CRYSTAL_HIT / 2
  const photoY = originY + 219 * scale
  const tabsHeight = BLOCK24_INACTIVE_CARD_HEIGHT * scale
  // Selected label stays on the vertical centre of the hero photo,
  // so the drum spans the same height as an inactive card.
  const desiredTabsY = originY + BLOCK24_HERO_CENTER_Y * scale - tabsHeight / 2
  const tabsY = Math.min(
    Math.max(desiredTabsY, safeTop),
    Math.max(safeTop, h - tabsHeight - BLOCK24_MIN_GAP),
  )

  return {
    width: w,
    height: h,
    scale,
    originX,
    originY,
    crystalX: originX + 720.5 * scale,
    headerReserve: BLOCK24_HEADER_HEIGHT,
    crystalTop,
    crystalCenterY,
    tabTextLeft,
    railFade: Math.max(0, railOverflow + 56),
    photoY,
    tabsTop: tabsY - originY,
    labelY: originY + 353 * scale,
    labelTop: originY + 217 * scale,
  }
}

export function applyBlock24Layout(section) {
  const width = section?.clientWidth || window.innerWidth
  const height = section?.clientHeight || window.innerHeight
  const layout = layoutBlock24(width, height)
  if (section) {
    section.style.setProperty('--block24-scale', layout.scale.toFixed(4))
    section.style.setProperty('--block24-origin-x', `${layout.originX.toFixed(1)}px`)
    section.style.setProperty('--block24-crystal-x', `${layout.crystalX.toFixed(1)}px`)
    section.style.setProperty('--block24-origin-y', `${layout.originY.toFixed(1)}px`)
    section.style.setProperty('--block24-crystal-top', `${layout.crystalTop}px`)
    section.style.setProperty('--block24-crystal-center-y', `${layout.crystalCenterY}px`)
    section.style.setProperty('--block24-photo-top', `${layout.photoY}px`)
    section.style.setProperty('--block24-tabs-top', `${layout.tabsTop.toFixed(1)}px`)
    section.style.setProperty('--block24-label-top', `${layout.labelTop}px`)
    section.style.setProperty('--block24-exit-origin-y', `${layout.crystalCenterY}px`)
    section.style.setProperty('--block24-tab-text-left', `${layout.tabTextLeft.toFixed(1)}px`)
    section.style.setProperty('--block24-rail-fade', `${layout.railFade.toFixed(1)}px`)
  }
  return layout
}
