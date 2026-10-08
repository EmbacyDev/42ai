import { useEffect, useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import { ScrambleLink } from '../Scramble/ScrambleText.jsx'
import '../scrollReveal.css'
import './siteFooter.css'

/**
 * Figma footer (307:31233). Nav row over the 42AI wordmark.
 */
export default function SiteFooter() {
  const rootRef = useRef(null)
  const markRef = useRef(null)
  useSequentialReveal(rootRef)

  useEffect(() => {
    const mark = markRef.current
    if (!mark) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let hovering = false
    let tx = 0.42
    let ty = 0.48
    let x = tx
    let y = ty

    const tick = () => {
      frame = 0
      if (!hovering) return
      const follow = reduce ? 1 : 0.16
      x += (tx - x) * follow
      y += (ty - y) * follow
      mark.style.setProperty('--mx', x.toFixed(4))
      mark.style.setProperty('--my', y.toFixed(4))
      if (!reduce && (Math.abs(tx - x) > 0.0015 || Math.abs(ty - y) > 0.0015)) {
        frame = requestAnimationFrame(tick)
      }
    }
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const onMove = (event) => {
      const rect = mark.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      tx = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      ty = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      hovering = true
      mark.classList.add('is-lit')
      queue()
    }
    const onLeave = () => {
      hovering = false
      mark.classList.remove('is-lit')
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }

    mark.addEventListener('pointermove', onMove)
    mark.addEventListener('pointerleave', onLeave)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      mark.removeEventListener('pointermove', onMove)
      mark.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <footer className="site-footer" id="contact" ref={rootRef}>
      <div className="site-footer__inner">
        <nav className="site-footer__nav scroll-reveal" data-reveal="0" aria-label="Footer">
          <div className="site-footer__group">
            <ScrambleLink href="#technology" text="TECHNOLOGY" />
            <ScrambleLink href="#applications" text="PRODUCT" />
          </div>
          <div className="site-footer__group site-footer__group--end">
            <ScrambleLink href="#vision" text="ABOUT US" />
            <ScrambleLink href="#contact" text="CONTACT US" />
          </div>
        </nav>
        <div className="site-footer__mark scroll-reveal" data-reveal="1" ref={markRef}>
          <div className="site-footer__shine" aria-hidden="true">
            <div className="site-footer__light">
              <div className="site-footer__light-flow" />
            </div>
            <div className="site-footer__frost" />
            <div className="site-footer__sheen" />
          </div>
          <img src="/images/v2/footer-mark.svg" alt="42AI" width={1128} height={239} />
        </div>
      </div>
    </footer>
  )
}
