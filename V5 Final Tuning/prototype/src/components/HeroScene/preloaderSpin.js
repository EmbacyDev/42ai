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
