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
export const BLOCK24_DESIGN_CRYSTAL_CENTER_Y = 151
// v4: a fixed 56px (screen px) from the gem's bottom to the active card on
// desktop, whatever the scale. The docked gem's radius is 23.7 design px
// (crystalScreen.r = 24.5px at scale 1.033). Figma's 151 left ~74px.
export const BLOCK24_CRYSTAL_CARD_GAP_PX = 56
const BLOCK24_CRYSTAL_HALF_HEIGHT = 23.7
export const BLOCK24_PHOTO_WIDTH = 311
export const BLOCK24_PHOTO_HEIGHT = 370
/** Crystal top through the 400px card, the title, and the Learn more button. */
export const BLOCK24_CONTENT_TOP = 123
export const BLOCK24_CONTENT_BOTTOM = 830
/** Inactive rail cards. The tab drum uses the same height. */
export const BLOCK24_INACTIVE_CARD_HEIGHT = 270.24
/** Vertical centre of the 336×400 active card (top 219). */
export const BLOCK24_HERO_CENTER_Y = 446

// Any committed flick off the block-two rest should start the cinematic.
// 0.03 of a 100% pin is ~0.03vh — below a typical wheel tick — so a
// scrollbar drag still arms, while the wheel listener commits even sooner.
// This threshold only applies after a real rest on block 2 (cards visible,
// pin parked); hero→block-2 landing inertia must not count as a flick.
export const BLOCK24_HANDOFF_ARM = 0.03
export const BLOCK24_HANDOFF_CANCEL = 0.008
export const BLOCK24_HANDOFF_EVENT = '42ai-block-handoff'
export const BLOCK24_RETURN_EVENT = '42ai-block-returned'

/**
 * Active-card geometry in design units (Figma y + 75). Desktop follows
 * Figma 559:594 (310×369 card, side rail centred 15.5px lower); tablet keeps
 * its 336×400 card with the rail on the card's centre line.
 */
export function block24CardGeometry(width) {
  if (width <= 980) {
    return { width: 336, height: 400, top: 219, sideCenterY: 419, stackHeight: 625 }
  }
  return { width: 310, height: 369.05, top: 246, sideCenterY: 446, stackHeight: 568 }
}

export function layoutBlock24(width, height) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const safeTop = Math.min(BLOCK24_HEADER_HEIGHT, h - 1)
  const safeHeight = Math.max(1, h - safeTop)
  const contentHeight = BLOCK24_CONTENT_BOTTOM - BLOCK24_CONTENT_TOP
  const contentCenter = (BLOCK24_CONTENT_TOP + BLOCK24_CONTENT_BOTTOM) / 2
  // The active card stays centred. Only two inactive cards remain visible
  // at rest now; the following one enters from outside the viewport during
  // a transition. Do not shrink the whole composition to reserve permanent
  // room for that hidden card.
  const heroCenter = 720.5
  const secondRight = 1166.5 + 227
  const edgeBreathingRoom = 24
  // Desktop is authored on a 1440×800 frame (Figma 559:594).
  const heightScale = w <= 980 ? h / 836 : h / 800
  const edgeScale = w <= 980 ? w / 768 : w / (2 * (secondRight + edgeBreathingRoom - heroCenter))
  const scale = Math.min(heightScale, edgeScale)
  const originX = w / 2 - heroCenter * scale
  // Desktop: the Figma frame (design y = frame y + 75), centred vertically
  // so taller screens keep the same composition instead of pinning it high.
  const card = block24CardGeometry(w)
  let originY = w <= 980
    ? h * (233 / 960) - card.top * scale
    : (h - 800 * scale) / 2 - 75 * scale
  const contentTop = originY + BLOCK24_CONTENT_TOP * scale
  const contentBottom = originY + BLOCK24_CONTENT_BOTTOM * scale
  if (w > 980 && contentTop < 40) {
    originY += 40 - contentTop
  }
  if (contentBottom > h - BLOCK24_MIN_GAP) {
    originY -= contentBottom - (h - BLOCK24_MIN_GAP)
  }
  const crystalCenterY = w <= 980
    ? 112
    : originY + card.top * scale - BLOCK24_CRYSTAL_CARD_GAP_PX - BLOCK24_CRYSTAL_HALF_HEIGHT * scale
  const crystalTop = crystalCenterY - BLOCK24_CRYSTAL_HIT / 2
  const photoY = originY + card.top * scale
  const tabsHeight = BLOCK24_INACTIVE_CARD_HEIGHT * scale
  // Selected label stays on the vertical centre of the hero photo,
  // so the drum spans the same height as an inactive card.
  const desiredTabsY = originY + card.sideCenterY * scale - tabsHeight / 2
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
    const card = block24CardGeometry(width)
    section.style.setProperty('--b24-card-w', card.width)
    section.style.setProperty('--b24-card-h', card.height)
    section.style.setProperty('--b24-card-top', card.top)
    section.style.setProperty('--b24-side-center', card.sideCenterY)
    section.style.setProperty('--block24-origin-x', `${layout.originX.toFixed(1)}px`)
    section.style.setProperty('--block24-crystal-x', `${layout.crystalX.toFixed(1)}px`)
    section.style.setProperty('--block24-origin-y', `${layout.originY.toFixed(1)}px`)
    section.style.setProperty('--block24-crystal-top', `${layout.crystalTop}px`)
    section.style.setProperty('--block24-crystal-center-y', `${layout.crystalCenterY}px`)
    section.style.setProperty('--block24-photo-top', `${layout.photoY}px`)
    section.style.setProperty('--block24-tabs-top', `${layout.tabsTop.toFixed(1)}px`)
    section.style.setProperty('--block24-label-top', `${layout.labelTop}px`)
    section.style.setProperty('--block24-exit-origin-y', `${layout.crystalCenterY}px`)
  }
  return layout
}
