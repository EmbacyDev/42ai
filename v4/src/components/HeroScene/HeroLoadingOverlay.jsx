import { useEffect, useState } from 'react'
import HeroLoadingBar from './HeroLoadingBar.jsx'
import LogoMotionMark from './LogoMotionMark.jsx'
import { MIN_LOADER_MS } from './loaderTiming.js'

/**
 * Covers the whole hero section with a plain white sheet plus a small
 * spinning mark and the progress bar, from the very first frame — nothing
 * underneath (the WebGL canvas mid-compile, portraits mid-settle, the
 * headline mid-layout) is ever visible while it's still assembling itself.
 * The real scene keeps mounting and rendering behind it the whole time;
 * this only ever hides it, it never delays it.
 *
 * Fades out once `hidden` flips true (mirrors HeroLoadingBar's own
 * fade-out timing/pattern), and stops intercepting pointer events at the
 * same moment.
 */
export default function HeroLoadingOverlay({ progress, hidden }) {
  // v4: the screen is held for a minimum time (HeroTestPage.jsx), so the
  // bar fills with whichever is slower: the real loading or that clock.
  const [clock, setClock] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const id = setInterval(() => {
      const t = MIN_LOADER_MS > 0 ? Math.min(1, (performance.now() - start) / MIN_LOADER_MS) : 1
      setClock(t)
      if (t >= 1) clearInterval(id)
    }, 80)
    return () => clearInterval(id)
  }, [])
  const shown = Math.min(progress, clock)
  return (
    <div
      className={`hero-loading-overlay${hidden ? ' hero-loading-overlay--hidden' : ''}`}
      aria-hidden="true"
    >
      {/* The crystal half of the Figma logo animation (622:3215), black,
          centred on the viewport; the progress bar sits further below. */}
      {/* v4, Figma 637:2144: mark centred, the headline stays where the
          hero shows it (.hero-content sits above this sheet), the bar low
          on the screen in its own frosted pill. */}
      <div className="hero-loading-overlay__group">
        <div className="hero-loading-overlay__mark">
          <LogoMotionMark size={58} />
        </div>
      </div>
      <div className="hero-loading-overlay__bar">
        <HeroLoadingBar progress={shown} hidden={hidden} />
      </div>
    </div>
  )
}
