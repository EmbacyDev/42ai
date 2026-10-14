import { useEffect, useState } from 'react'
import HeroLoadingBar from './HeroLoadingBar.jsx'
import LogoMotionMark from './LogoMotionMark.jsx'
import { LOADER_CYCLE_MS } from './loaderTiming.js'

// PageCrystal.jsx: INTRO_START_SCALE 0.145, gem radius 0.98 world units,
// camera fov 52° at z 4.94. Screen diameter of the gem at the hand-off.
function crystalIntroDiameter() {
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const pxPerWorld = vh / (2 * Math.tan((52 * Math.PI) / 360) * 4.94)
  return 2 * 0.145 * 0.98 * pxPerWorld
}

// Mounted only after the slow-loading threshold. Scene preparation continues
// behind the overlay; once shown, the animation gets its full five seconds.
export default function HeroLoadingOverlay({ progress, hidden }) {
  // Progress follows whichever is slower: asset loading or the visible cycle.
  const [clock, setClock] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const id = setInterval(() => {
      const t = LOADER_CYCLE_MS > 0 ? Math.min(1, (performance.now() - start) / LOADER_CYCLE_MS) : 1
      setClock(t)
      if (t >= 1) clearInterval(id)
    }, 80)
    return () => clearInterval(id)
  }, [])
  const shown = Math.min(progress, clock)
  // v4: the mark matches the 3D crystal it hands over to (PageCrystal.jsx):
  // centred on the viewport, as tall as the gem at its intro scale. The
  // gem's height follows the viewport height, so the mark does too.
  const [markSize, setMarkSize] = useState(() => crystalIntroDiameter())
  useEffect(() => {
    const onResize = () => setMarkSize(crystalIntroDiameter())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
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
          <LogoMotionMark size={markSize} duration={LOADER_CYCLE_MS} />
        </div>
      </div>
      <div className="hero-loading-overlay__bar">
        <HeroLoadingBar progress={shown} hidden={hidden} />
      </div>
    </div>
  )
}
