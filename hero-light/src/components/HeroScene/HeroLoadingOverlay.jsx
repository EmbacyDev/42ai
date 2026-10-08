import { useEffect, useRef } from 'react'
import HeroLoadingBar from './HeroLoadingBar.jsx'
import { preloaderSpinAngle } from './preloaderSpin.js'

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
  const markRef = useRef(null)

  useEffect(() => {
    const mark = markRef.current
    if (!mark) return undefined
    let raf = 0
    const tick = () => {
      mark.style.transform = `rotate(${preloaderSpinAngle()}rad)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className={`hero-loading-overlay${hidden ? ' hero-loading-overlay--hidden' : ''}`}
      aria-hidden="true"
    >
      <div className="hero-loading-overlay__group">
        {/* Exact mark from logo-42ai.svg's "Group 1410093944" (its two path
            shapes, viewBox cropped to their own bounds) — not a redrawn
            approximation, and now the same black/white fill the header
            logo itself uses, not a colour treatment of its own. */}
        <svg
          ref={markRef}
          className="hero-loading-overlay__mark"
          width="40"
          height="42"
          viewBox="0 0 23.2926 24.9687"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.7464 23.1803L15.4772 24.9687L23.2926 16.7594L18.7103 5.70813L8.11699 3.57568L0 12.2431L4.7464 23.1803Z"
            fill="#121110"
          />
          <path
            d="M15.8113 19.8715L17.3184 8.03101L6.73619 12.1039L15.8113 19.8715Z"
            fill="#ffffff"
          />
        </svg>
        <HeroLoadingBar progress={progress} hidden={hidden} />
      </div>
    </div>
  )
}
