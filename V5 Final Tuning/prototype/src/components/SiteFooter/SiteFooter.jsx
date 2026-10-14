import { useEffect, useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import { drawFooterHoverLight } from './footerHoverLight.js'
import '../scrollReveal.css'
import './siteFooter.css'
import { ScrambleLink } from '../Scramble/ScrambleText.jsx'

/**
 * Figma footer (307:31233). Nav row over the 42AI wordmark.
 */
export default function SiteFooter() {
  const rootRef = useRef(null)
  const markRef = useRef(null)
  const lightCanvasRef = useRef(null)
  useSequentialReveal(rootRef)

  useEffect(() => {
    const mark = markRef.current
    if (!mark) return undefined
    const canvas = lightCanvasRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let hovering = false
    let glowStart = 0
    let tx = 0.42
    let ty = 0.48
    let x = tx
    let y = ty
    let vx = 0
    let vy = 0
    let ox = 0
    let oy = 0
    let glow = 0
    let spread = 0
    let leaveFrom = 0
    let leaveSpread = 0
    let leaveX = 0.42
    let leaveY = 0.48
    let leaveStart = 0
    let startedAt = 0
    let lastTick = 0
    const GLOW_MS = 780
    const LEAVE_MS = 1680
    const FOLLOW_OMEGA = 9.5

    const smootherstep = (value) => {
      const t = Math.min(1, Math.max(0, value))
      return t * t * t * (t * (t * 6 - 15) + 10)
    }

    const paint = (now) => {
      if (!canvas) return
      const cssW = mark.clientWidth
      const cssH = mark.clientHeight
      if (!cssW || !cssH) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pxW = Math.round(cssW * dpr)
      const pxH = Math.round(cssH * dpr)
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW
        canvas.height = pxH
      }
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const time = startedAt ? (now - startedAt) / 1000 : 0
      drawFooterHoverLight(ctx, cssW, cssH, time, (x + ox) * cssW, (y + oy) * cssH, reduce, spread)
    }

    const tick = (now) => {
      frame = requestAnimationFrame(tick)
      if (!startedAt) startedAt = now
      const dt = lastTick ? Math.min(0.032, (now - lastTick) / 1000) : 0.016
      lastTick = now
      if (reduce) {
        x = tx
        y = ty
        glow = hovering ? 1 : 0
        spread = hovering ? 1 : 0
      } else if (hovering) {
        if (!glowStart) glowStart = now
        const bloom = smootherstep(Math.min(1, (now - glowStart) / GLOW_MS))
        const pull = FOLLOW_OMEGA * FOLLOW_OMEGA
        const drag = 2 * FOLLOW_OMEGA
        let remain = dt
        while (remain > 0.0001) {
          const step = Math.min(1 / 120, remain)
          vx += ((tx - x) * pull - vx * drag) * step
          vy += ((ty - y) * pull - vy * drag) * step
          x += vx * step
          y += vy * step
          remain -= step
        }
        glow = bloom
        spread = 0.2 + bloom * 0.8
      } else {
        if (!leaveStart) {
          leaveStart = now
          leaveX = x
          leaveY = y
        }
        const t = Math.min(1, (now - leaveStart) / LEAVE_MS)
        const dim = t * t * (3 - 2 * t)
        x = leaveX
        y = leaveY
        glow = leaveFrom * (1 - dim)
        spread = leaveSpread * (1 - dim * 0.12)
      }
      const life = reduce ? 0 : (hovering ? 1 : glow)
      const seconds = startedAt ? (now - startedAt) / 1000 : 0
      ox = Math.sin(seconds * 0.7) * 0.006 * life
      oy = Math.cos(seconds * 0.55) * 0.012 * life
      mark.style.setProperty('--mx', (x + ox).toFixed(4))
      mark.style.setProperty('--my', (y + oy).toFixed(4))
      mark.style.setProperty('--light', glow.toFixed(4))
      mark.style.setProperty('--spread', spread.toFixed(4))
      paint(now)
      const settled = !hovering && glow < 0.004
      if (settled || (reduce && !hovering && glow < 0.004)) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const readPointer = (event) => {
      const rect = mark.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      tx = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      ty = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    }
    const onEnter = (event) => {
      readPointer(event)
      x = tx
      y = ty
      glow = 0
      spread = 0.28
      vx = 0
      vy = 0
      glowStart = 0
      leaveStart = 0
      hovering = true
      mark.classList.add('is-lit')
      queue()
    }
    const onMove = (event) => {
      readPointer(event)
      if (!hovering) onEnter(event)
      queue()
    }
    const onLeave = () => {
      hovering = false
      leaveFrom = glow
      leaveSpread = spread
      leaveStart = 0
      mark.classList.remove('is-lit')
      queue()
    }

    mark.addEventListener('pointerenter', onEnter)
    mark.addEventListener('pointermove', onMove)
    mark.addEventListener('pointerleave', onLeave)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      mark.removeEventListener('pointerenter', onEnter)
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
          <img src="/images/v2/footer-mark.svg" alt="42AI" width={1128} height={239} />
          <div className="site-footer__shine" aria-hidden="true">
            <div className="site-footer__glass" />
            <div className="site-footer__iridescence" />
          </div>
          <div className="site-footer__hover-light" aria-hidden="true">
            <canvas ref={lightCanvasRef} />
          </div>
          <div className="site-footer__light-core" aria-hidden="true" />
          <div className="site-footer__rim" aria-hidden="true" />
        </div>
      </div>
    </footer>
  )
}
