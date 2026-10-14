/**
 * Pure math shared by both places the crystal lives — the vanilla-Three
 * placeholder (mountHeroScene.js) and the tuned R3F shader
 * (PageCrystal.jsx) — for how much it shrinks as the hero-to-
 * carousel transition (heroTransition.js) plays out. Kept separate from
 * that file since this part has no DOM/scroll dependency of its own.
 */

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * Rest-to-rest motion with a longer coast in the middle than cubic, so
 * both the hero cards and the post-preloader crystal grow accelerate
 * out of stillness and brake into the landing instead of starting or
 * stopping with a tick.
 */
export function easeInOutQuart(t) {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 8 * x * x * x * x : 1 - (-2 * x + 2) ** 4 / 2
}

// Used only for the descent (see CRYSTAL_DESCEND_DISTANCE below) — unlike
// the symmetric ease-in-out used for shrink/spin, this stays close to 0
// for most of the range and only accelerates near progress=1. A first
// pass at a large descend distance with the symmetric ease sent the
// crystal below the fold by roughly 70% through the scroll, leaving
// nothing on screen for the remaining 30% — this keeps most of the drop
// concentrated at the very end instead.
export function easeInCubic(t) {
  return t * t * t
}

/**
 * Perlin smootherstep: 6t⁵ − 15t⁴ + 10t³. First and second derivatives
 * are zero at both ends, so the crystal eases out of rest, coasts, then
 * brakes into the landing instead of starting or stopping with a tick.
 */
export function smootherstep(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export const CRYSTAL_SHRINK_MIN_SCALE = 0.3

/** shrinkFactor(0) = 1 (full size), shrinkFactor(1) = CRYSTAL_SHRINK_MIN_SCALE. */
export function shrinkFactor(progress) {
  return 1 - (1 - CRYSTAL_SHRINK_MIN_SCALE) * smootherstep(progress)
}

/**
 * The transition is staged, not one uniform 0→1 sweep: cards/text fade
 * out first (fast), the crystal shrinks the whole time but holds its
 * position through that fade, and only afterwards does it start
 * travelling down — "текст с картинками исчезает быстрее, кристалл
 * уменьшается, оставаясь на месте, а затем уходит вниз." `remap01` maps a
 * [start, end] slice of the overall progress back to its own 0→1, so each
 * phase can be eased independently instead of all reusing raw progress.
 */
function remap01(t, start, end) {
  if (end <= start) return t >= end ? 1 : 0
  return Math.min(1, Math.max(0, (t - start) / (end - start)))
}

// Cards finish their return about halfway through the pin, overlapping
// the crystal's own flight instead of vanishing first and then waiting.
const FADE_END = 0.52
/**
 * Cards fly home over the first half of the pin. Quart rest-to-rest so
 * they leave their seats gently and brake into the gem instead of
 * snapping off the first wheel tick.
 */
export function fadeProgress(progress) {
  return easeInOutQuart(remap01(progress, 0, FADE_END))
}

// Crystal starts down while the cards are still returning, so one
// gesture carries both home. The remaining stretch is the flight onto
// the block-two dock, not a second round of scrolling after the cards
// have already vanished.
const DESCEND_START = 0.14
/** 0→1 over [DESCEND_START, 1] — slow out of the hero, slow into the landing. */
export function descendProgress(progress) {
  return smootherstep(remap01(progress, DESCEND_START, 1))
}

// How far the crystal descends (world units, its own local Y) and how
// much extra it spins on top of its own idle rotation over the course of
// the transition — the "уходит вниз, крутясь" (spins away, going down)
// half of the handoff to the carousel section. Shared so the placeholder
// (mountHeroScene.js) and the tuned shader (PageCrystal.jsx)
// move the same amount.
//
// Paired with easeInCubic (above) rather than the symmetric ease: the
// crystal starts at ~39% down the (pinned) viewport and, with this
// distance, ends at ~85% down — close to the bottom edge, reading as
// "sinking away" — right as progress hits 1. An earlier, smaller value
// (0.9) landed too close to its starting height to read as a real
// descent; a larger one (2.4) paired with the symmetric ease sent it
// below the fold well before progress reached 1, leaving nothing on
// screen for the last stretch — easeInCubic keeps it on screen through
// most of the scroll and only drops it in the final stretch instead.
export const CRYSTAL_DESCEND_DISTANCE = 2.2
export const CRYSTAL_EXTRA_SPIN = Math.PI * 3

/**
 * Extra viewport-heights the hero stays pinned (heroTransition.js's
 * `end`). One full viewport, with pinSpacing off: cards return while
 * the crystal flies onto block 2, and when the pin releases block 2 is
 * already filling the screen. Inertia then eases you onto that rest.
 */
export const HERO_PIN_VIEWPORTS = 1

export function crystalTravelRangePx() {
  return window.innerHeight * HERO_PIN_VIEWPORTS
}

export const CRYSTAL_DESCEND_START_FRACTION = 0.14

/** 0 while the crystal is still in the hero, 1 once it has docked on block 2. */
export function crystalHeroBlend(scrollY = window.scrollY) {
  const travelRange = crystalTravelRangePx()
  const descendStartPx = travelRange * CRYSTAL_DESCEND_START_FRACTION
  const blendRaw = (scrollY - descendStartPx) / Math.max(1, travelRange - descendStartPx)
  return smootherstep(Math.min(Math.max(blendRaw, 0), 1))
}

/** 0 at rest, 1 once the hero background has gone solid white. */
export function backgroundWashProgress(progress) {
  const t = Math.min(1, Math.max(0, progress / 0.08))
  return 1 - (1 - t) ** 3
}
