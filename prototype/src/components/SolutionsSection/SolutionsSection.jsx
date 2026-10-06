import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './solutionsSection.css'

const TABS = ['Banks', 'Hedge Funds', 'Brokers', 'Physical AI', 'Foundational AI', 'Others']

// Same timing as block 2 (Block24Section / BulgeFeatureCard): the surface
// eases across one slot in 0.74s, and autoplay waits 3s after each commit.
const TRAVEL_MS = 740
const AUTOPLAY_DELAY = 3000
const AUTOPLAY_MIN_GAP = 2600
const CARD_W = 472
const CARD_H = 274
const CARD_PAD = 24
const ASIDE_W = 230
const TITLE_W = 326

const SLIDES = [
  {
    id: 'liquidity',
    kicker: 'Hedge Funds',
    titleLines: ['Client', 'liquidity'],
    label: 'Client liquidity',
  },
  {
    id: 'hedge-funds',
    kicker: 'Hedge Funds',
    titleLines: ['See the balance sheet before it moves.'],
    label: 'See the balance sheet before it moves.',
  },
  {
    id: 'deposits',
    kicker: 'Hedge Funds',
    titleLines: ['Deposits &', 'withdraws'],
    label: 'Deposits & withdraws',
  },
]

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function wrapIndex(value, count) {
  return ((value % count) + count) % count
}

function shortestDelta(fromIndex, toIndex, count) {
  let delta = wrapIndex(toIndex - fromIndex, count)
  if (delta > count / 2) delta -= count
  return delta
}

// Shallow spherical arc, adapted from BulgeFeatureCard's shell:
// angle across a slot, z from cos(angle), a small lift on the wings.
function measureStage(stage) {
  const stageW = stage?.clientWidth || 1118
  const gap = Math.min(93, Math.max(24, window.innerWidth * 0.06))
  const cardW = Math.min(CARD_W, Math.max(280, stageW - 48))
  const aside = Math.min(ASIDE_W, Math.max(96, (stageW - cardW) * 0.34))
  const idealSide = cardW / 2 + gap + aside / 2
  const sideX = Math.min(idealSide, Math.max(cardW * 0.62, stageW / 2 - 16))
  // Neighbours sit on the same shallow shell as block 2's side headings
  // (BulgeFeatureCard: angle ≈ 0.55rad, depth from cos).
  const slotAngle = 0.55
  const radius = sideX / Math.sin(slotAngle)
  return { cardW, radius, slotAngle }
}

function slotOffset(index, position, count) {
  let slot = index - position
  slot = ((slot % count) + count) % count
  if (slot > count / 2) slot -= count
  return slot
}

function applyPose(el, slot, layout) {
  if (!el) return
  const angle = slot * layout.slotAngle
  const depth = 1 - Math.cos(angle)
  const x = Math.sin(angle) * layout.radius
  const z = -depth * layout.radius
  const y = -depth * 42
  const rot = angle * (180 / Math.PI)
  const abs = Math.abs(slot)
  const center = 1 - smoothstep(0.1, 0.82, abs)
  const edge = 1 - smoothstep(1.02, 1.32, abs)
  const titleW = Math.min(TITLE_W, layout.cardW - CARD_PAD * 2)
  const copyW = ASIDE_W + (titleW - ASIDE_W) * center
  const centeredLeft = (layout.cardW - copyW) / 2
  const left = centeredLeft + (CARD_PAD - centeredLeft) * center

  el.style.width = `${layout.cardW}px`
  el.style.height = `${CARD_H}px`
  el.style.opacity = edge.toFixed(4)
  el.style.zIndex = String(20 + Math.round(center * 10 - abs * 2))
  el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${rot.toFixed(2)}deg)`
  el.style.setProperty('--center', center.toFixed(4))
  el.dataset.centered = center > 0.62 ? '1' : '0'

  const copy = el.querySelector('.solutions-section__card-copy')
  if (!copy) return
  copy.style.width = `${copyW.toFixed(2)}px`
  copy.style.left = `${left.toFixed(2)}px`
  copy.style.textAlign = center > 0.62 ? 'left' : 'center'
  const copyH = copy.offsetHeight
  const shiftY = -copyH / 2 + center * (CARD_H / 2 - CARD_PAD - copyH / 2)
  copy.style.transform = `translateY(${shiftY.toFixed(2)}px)`
}

/**
 * Figma block 6 (307:31155). The card row travels on the same kind of
 * spherical arc as block 2, auto-advancing and jumping from the pagination.
 */
export default function SolutionsSection() {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const slotRefs = useRef([])
  const goToRef = useRef(() => {})
  const [activeIndex, setActiveIndex] = useState(1)
  useSequentialReveal(rootRef)

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const count = SLIDES.length
    let layout = measureStage(stage)
    let position = 1
    let settled = 1
    let animFrom = 1
    let animTo = 1
    let animStart = 0
    let animating = false
    let raf = 0
    let autoplayTimer = 0
    let lastAdvanceAt = 0
    let visible = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const apply = (pos) => {
      layout = measureStage(stage)
      SLIDES.forEach((slide, index) => {
        applyPose(slotRefs.current[index], slotOffset(index, pos, count), layout)
      })
    }

    const tick = () => {
      try {
        // performance.now(), not the rAF timestamp: a throttled frame can
        // carry a stamp from before this gesture and rewind the sphere.
        const raw = Math.min(1, Math.max(0, (performance.now() - animStart) / TRAVEL_MS))
        position = animFrom + (animTo - animFrom) * easeInOutCubic(raw)
        apply(position)
        if (raw < 1) {
          raf = window.requestAnimationFrame(tick)
          return
        }
        animating = false
        position = animTo
        apply(position)
      } catch {
        animating = false
        position = animTo
        try { apply(position) } catch { /* leave the last painted pose */ }
      }
    }

    const scheduleAutoplay = () => {
      window.clearTimeout(autoplayTimer)
      if (!visible || document.hidden) return
      autoplayTimer = window.setTimeout(() => {
        goTo(wrapIndex(settled + 1, count), true)
      }, AUTOPLAY_DELAY)
    }

    const goTo = (index, automatic = false) => {
      const now = performance.now()
      if (automatic && now - lastAdvanceAt < AUTOPLAY_MIN_GAP) return
      const delta = shortestDelta(wrapIndex(settled, count), index, count)
      if (delta === 0) return
      lastAdvanceAt = now
      animFrom = position
      settled += delta
      animTo = settled
      setActiveIndex(wrapIndex(settled, count))
      if (reduced) {
        position = settled
        animating = false
        window.cancelAnimationFrame(raf)
        apply(position)
        scheduleAutoplay()
        return
      }
      animStart = now
      animating = true
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(tick)
      scheduleAutoplay()
    }

    goToRef.current = goTo
    apply(position)

    const onResize = () => apply(position)
    window.addEventListener('resize', onResize)
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(onResize)
      : null
    resizeObserver?.observe(stage)

    let observer
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting && entry.intersectionRatio >= 0.35
          scheduleAutoplay()
        },
        { threshold: [0, 0.35, 0.6] },
      )
      observer.observe(stage)
    } else {
      visible = true
      scheduleAutoplay()
    }

    const onVisibility = () => scheduleAutoplay()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(autoplayTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      resizeObserver?.disconnect()
      observer?.disconnect()
      goToRef.current = () => {}
    }
  }, [])

  return (
    <section
      className="solutions-section"
      id="applications"
      aria-labelledby="solutions-heading"
      ref={rootRef}
    >
      <div className="solutions-section__intro">
        <h2 id="solutions-heading" className="solutions-section__title scroll-reveal" data-reveal="0">
          Universal solution for human
          <br />
          and agentic behaviour.
        </h2>
        <p className="solutions-section__lead scroll-reveal" data-reveal="1">
          One behavioral intelligence engine for your high-value environments.
        </p>
        <div className="solutions-section__tabs scroll-reveal" data-reveal="2" role="tablist" aria-label="Industries">
          {TABS.map((tab) => {
            const active = tab === 'Hedge Funds'
            return (
              <span
                key={tab}
                className={`solutions-section__tab${active ? ' solutions-section__tab--active' : ''}`}
                role="tab"
                aria-selected={active}
              >
                {tab}
              </span>
            )
          })}
        </div>
      </div>

      <div className="solutions-section__stage scroll-reveal" data-reveal="3" ref={stageRef}>
        {SLIDES.map((slide, index) => (
          <article
            key={slide.id}
            id={`solutions-slide-${slide.id}`}
            className="solutions-section__slot"
            ref={(node) => {
              slotRefs.current[index] = node
            }}
            aria-hidden={index !== activeIndex}
            aria-label={slide.label}
          >
            <div className="solutions-section__card-bg" />
            <img
              className="solutions-section__chart"
              src="/images/v2/hedge-chart.svg"
              alt=""
              width={40}
              height={40}
            />
            <div className="solutions-section__card-copy">
              <p className="solutions-section__kicker">{slide.kicker}</p>
              <h3>
                {slide.titleLines.map((line, lineIndex) => (
                  <span key={line}>
                    {lineIndex > 0 && <br />}
                    {line}
                  </span>
                ))}
              </h3>
            </div>
          </article>
        ))}
      </div>

      <div
        className="solutions-section__progress scroll-reveal"
        data-reveal="4"
        role="tablist"
        aria-label="Solutions"
      >
        {SLIDES.map((slide, index) => {
          const selected = index === activeIndex
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              className={selected ? 'solutions-section__progress-fill' : 'solutions-section__progress-dot'}
              aria-selected={selected}
              aria-controls={`solutions-slide-${slide.id}`}
              aria-label={slide.label}
              onClick={() => goToRef.current(index)}
            />
          )
        })}
      </div>
    </section>
  )
}
