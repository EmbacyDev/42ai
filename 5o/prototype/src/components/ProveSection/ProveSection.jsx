import AnimatedHeading from '../AnimatedHeading.jsx'
import { useEffect, useRef, useState } from 'react'
import '../scrollReveal.css'
import './proveSection.css'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'

/**
 * Figma block 7 (307:31179). Proof banner with the request-demo pill.
 */
export default function ProveSection() {
  const rootRef = useRef(null)
  const [headingReady, setHeadingReady] = useState(false)
  const bodyTimer = useRef(null)
  const [buttonReady, setButtonReady] = useState(false)
  useEffect(() => {
    if (!headingReady) { setButtonReady(false); return }
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250
    const timer = setTimeout(() => setButtonReady(true), delay)
    return () => clearTimeout(timer)
  }, [headingReady])
  const [revealCycle, setRevealCycle] = useState(0)
  useEffect(() => {
    const root = rootRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let previousY = window.scrollY
    let aboveEntry = root.getBoundingClientRect().top >= window.innerHeight
    let frame = 0
    const update = () => {
      frame = 0
      const top = root.getBoundingClientRect().top
      const y = window.scrollY
      if (top >= window.innerHeight && !aboveEntry) {
        clearTimeout(bodyTimer.current)
        setHeadingReady(false)
        setButtonReady(false)
      }
      if (y > previousY && aboveEntry && top < window.innerHeight) {
        clearTimeout(bodyTimer.current)
        setHeadingReady(false)
        setButtonReady(false)
        setRevealCycle(cycle => cycle + 1)
      }
      aboveEntry = top >= window.innerHeight
      previousY = y
      const progress = Math.min(1, Math.max(0, (window.innerHeight - top) / (window.innerHeight * .65)))
      const eased = progress * progress * (3 - 2 * progress)
      root.style.setProperty('--cta-card-scale', String(reduce ? 1 : .9 + .1 * eased))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])
  useEffect(() => () => clearTimeout(bodyTimer.current), [])

  return (
    <section className="prove-section" id="request-demo" aria-labelledby="prove-heading" ref={rootRef}>
      <div className="prove-section__card">
        <div className="prove-section__copy">
          <AnimatedHeading key={revealCycle} as="h2" id="prove-heading"
            viewportStart={0.7} once
            onRevealStart={() => { bodyTimer.current = setTimeout(() => setHeadingReady(true), 550) }}
            onRevealComplete={() => { clearTimeout(bodyTimer.current); setHeadingReady(true) }}>
            <span className="prove-section__line">Don’t trust us. Let us prove</span>
            <span className="prove-section__line">it on your data</span>
          </AnimatedHeading>
          <p className={`prove-section__line prove-section__subtitle${headingReady ? ' is-visible' : ''}`}>for your most difficult &amp; valuable problems</p>
        </div>
        <RequestDemoButton
          className={`prove-section__cta${headingReady && buttonReady ? ' is-visible' : ''}`}
          tabIndex={headingReady && buttonReady ? 0 : -1}
          href="#request-demo"
          label="Request demo"
          widen={-8.645}
        />
      </div>
    </section>
  )
}
