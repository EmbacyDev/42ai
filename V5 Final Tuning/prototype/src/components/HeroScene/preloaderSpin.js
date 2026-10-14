/** One full turn of the black preloader mark, in seconds. */
export const PRELOADER_SPIN_PERIOD = 2.6
export const PRELOADER_SPIN_OMEGA = (Math.PI * 2) / PRELOADER_SPIN_PERIOD

/**
 * Shared clock for the black SVG mark and the coloured crystal. Both
 * read this every frame so the hand-off continues the same spin instead
 * of starting a different axis from angle zero.
 */
export function preloaderSpinAngle(now = performance.now()) {
  return (now / 1000) * PRELOADER_SPIN_OMEGA
}

// Shared by crystal growth and the card launch origin.
export const INTRO_GROW_DELAY = 0
export const INTRO_SLOWDOWN = 1.3
export const INTRO_GROW_DURATION = 1.5 * INTRO_SLOWDOWN

// Longer deceleration tail; zero velocity and acceleration at both ends.
export function introEase(value) {
  const t = Math.max(0, Math.min(1, value))
  return t ** 3 * (20 + t * (-45 + t * (36 - 10 * t)))
}
