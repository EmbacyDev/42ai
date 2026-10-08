import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './breakthroughsSection.css'

const CARDS = [
  {
    id: 'foundational',
    kicker: 'Foundational model',
    year: '/2025',
    title: 'Decoding the human factor: high fidelity behavioral predictions',
    tone: 'photo',
  },
  {
    id: 'nature',
    kicker: 'Human nature',
    year: '/2025',
    title: 'Why AI agents must model what we do, not what we say',
    tone: 'teal',
  },
  {
    id: 'agents',
    kicker: 'Human nature',
    year: '/2025',
    title: 'Why AI agents must model what we do, not what we say',
    tone: 'slate',
  },
]

const DURATION_MS = 1120
const TRAVEL_AT = 1
// Forward switch: when the outgoing card reappears on the right.
const WRAP_AT = 0.42
const GESTURE_GAP_MS = 190
const GESTURE_THRESHOLD = 42

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Quintic smootherstep has zero velocity and acceleration at both ends,
// producing a soft takeoff and a long, controlled settle without bounce.
function ease(value) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function mix(from, to, t) {
  return from + (to - from) * t
}

function activeHeadingColor(id, t) {
  const tone = CARDS.find((card) => card.id === id)?.tone
  if (tone === 'teal') return '#ffffff'
  const channel = (from) => Math.round(mix(from, 255, t))
  return `rgb(${channel(223)}, ${channel(226)}, ${channel(233)})`
}

function smoothRange(value, start, end) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

// Text lags the card: a slow start, then a long ease-out so the heading
// settles into the active measure instead of arriving with the motion.
function textEase(phase) {
  const t = Math.min(1, Math.max(0, (phase - 0.14) / 0.86))
  return 1 - (1 - t) ** 3
}

function readMetrics(row) {
  const styles = getComputedStyle(row)
  const length = (name, fallback) => {
    const raw = styles.getPropertyValue(name).trim()
    if (!raw) return fallback
    if (raw.endsWith('%')) return (row.clientWidth * parseFloat(raw)) / 100
    return parseFloat(raw)
  }
  const open = Math.min(length('--card-open', 635), row.clientWidth)
  const shut = Math.min(length('--card-shut', 392), open)
  return {
    open,
    shut,
    gap: length('--card-gap', 12),
    shift: Math.min(52, open * 0.08),
  }
}

function layoutMap(order, metrics) {
  const placed = new Map()
  let x = 0
  order.forEach((id, index) => {
    const width = index === 0 ? metrics.open : metrics.shut
    placed.set(id, { x, width })
    x += width + metrics.gap
  })
  return placed
}

function orderFor(activeId) {
  const start = CARDS.findIndex((card) => card.id === activeId)
  return [...CARDS.slice(start), ...CARDS.slice(0, start)].map((card) => card.id)
}

function activeIndex(order) {
  return CARDS.findIndex((card) => card.id === order[0])
}

/**
 * Forward: the open card compresses and drifts left while the card taking
 * its place keeps its right-hand neighbors in step. The outgoing card stays
 * fully opaque throughout the handoff.
 */
function sampleForward(fromOrder, toOrder, u, metrics) {
  const from = layoutMap(fromOrder, metrics)
  const to = layoutMap(toOrder, metrics)
  const outgoingId = fromOrder[0]
  const incomingId = toOrder[0]
  // One shared progress for the handoff. The outgoing card must not finish
  // early, or it leaves a gap before the next card's left edge arrives.
  const phase = Math.min(1, u / TRAVEL_AT)
  const travel = ease(phase)
  const text = textEase(phase)
  const outgoingFade = smoothRange(phase, 0.5, 0.72)
  const outgoingReturn = smoothRange(phase, 0.8, 1)
  const outgoingCopyOpacity = 1 - outgoingFade * (1 - outgoingReturn)
  const activeContentWidth = Math.max(0, metrics.open - 64)
  const inactiveContentWidth = Math.max(0, metrics.shut - 64)
  const activeHeadingWidth = Math.min(471, Math.max(0, metrics.open - 136))
  const inactiveHeadingWidth = Math.min(285, inactiveContentWidth)
  const pose = new Map()

  const outgoingStart = from.get(outgoingId)
  const outgoingWidth = mix(outgoingStart.width, metrics.shut, travel)
  const outgoingX = mix(
    outgoingStart.x,
    -(metrics.shut + metrics.gap),
    travel,
  )

  // Place every following card from the preceding card's live right edge.
  // This keeps the gap exact throughout the handoff instead of allowing the
  // expanding card to slide over the collapsing one.
  const linkedLayout = new Map()
  let cursor = outgoingX + outgoingWidth + metrics.gap
  toOrder.forEach((id) => {
    if (id === outgoingId) return
    const width = mix(from.get(id).width, to.get(id).width, travel)
    linkedLayout.set(id, { x: cursor, width })
    cursor += width + metrics.gap
  })

  fromOrder.forEach((id) => {
    const end = to.get(id)
    if (id === outgoingId) {
      // The open card leaves to the left and fades; halfway through it is
      // back on the right, straight after the last card, and slides in
      // together with the others — not dropped in once they have stopped.
      if (travel < 1 && phase < WRAP_AT) {
        pose.set(id, {
          x: outgoingX,
          width: outgoingWidth,
          opacity: 1 - smoothRange(phase, WRAP_AT - 0.22, WRAP_AT),
          contentOpacity: outgoingCopyOpacity,
          contentWidth: mix(activeContentWidth, inactiveContentWidth, text),
          headingColor: activeHeadingColor(id, 1 - text),
          headingWidth: mix(activeHeadingWidth, inactiveHeadingWidth, text),
          z: 2,
        })
      } else if (travel < 1) {
        pose.set(id, {
          x: cursor,
          width: metrics.shut,
          opacity: smoothRange(phase, WRAP_AT, WRAP_AT + 0.18),
          contentOpacity: 1,
          contentWidth: inactiveContentWidth,
          headingColor: activeHeadingColor(id, 0),
          headingWidth: inactiveHeadingWidth,
          z: 1,
        })
      } else {
        pose.set(id, {
          x: end.x,
          width: end.width,
          opacity: 1,
          contentOpacity: 1,
          contentWidth: inactiveContentWidth,
          headingColor: activeHeadingColor(id, 0),
          headingWidth: inactiveHeadingWidth,
          z: 1,
        })
      }
      return
    }
    const linked = linkedLayout.get(id)
    pose.set(id, {
      x: linked.x,
      width: linked.width,
      opacity: 1,
      contentOpacity: 1,
      contentWidth: id === incomingId
        ? mix(inactiveContentWidth, activeContentWidth, text)
        : null,
      headingColor: id === incomingId ? activeHeadingColor(id, text) : null,
      headingWidth: id === incomingId
        ? mix(inactiveHeadingWidth, activeHeadingWidth, text)
        : null,
      z: id === incomingId ? 3 : 1,
    })
  })
  return pose
}

/**
 * Backward plays the handoff from the other side: the open card yields
 * to the right, and the previous card eases in from the left already
 * expanding, instead of flying across the row.
 */
function sampleReverse(fromOrder, toOrder, u, metrics) {
  const from = layoutMap(fromOrder, metrics)
  const to = layoutMap(toOrder, metrics)
  const leavingId = fromOrder[0]
  const enteringId = toOrder[0]
  const travel = ease(u)
  const text = textEase(u)
  const activeContentWidth = Math.max(0, metrics.open - 64)
  const inactiveContentWidth = Math.max(0, metrics.shut - 64)
  const activeHeadingWidth = Math.min(471, Math.max(0, metrics.open - 136))
  const inactiveHeadingWidth = Math.min(285, inactiveContentWidth)
  const pose = new Map()

  const enteringX = mix(-(metrics.shut + metrics.gap), 0, travel)
  const enteringWidth = mix(metrics.shut, metrics.open, travel)
  const linkedLayout = new Map([
    [enteringId, { x: enteringX, width: enteringWidth }],
  ])
  let cursor = enteringX + enteringWidth + metrics.gap
  toOrder.forEach((id) => {
    if (id === enteringId) return
    const width = mix(from.get(id).width, to.get(id).width, travel)
    linkedLayout.set(id, { x: cursor, width })
    cursor += width + metrics.gap
  })

  fromOrder.forEach((id) => {
    const linked = linkedLayout.get(id)
    if (id === enteringId) {
      pose.set(id, {
        x: linked.x,
        width: linked.width,
        opacity: 1,
        contentOpacity: 1,
        contentWidth: mix(inactiveContentWidth, activeContentWidth, text),
        headingColor: activeHeadingColor(id, text),
        headingWidth: mix(inactiveHeadingWidth, activeHeadingWidth, text),
        z: 4,
      })
      return
    }
    pose.set(id, {
      x: linked.x,
      width: linked.width,
      opacity: 1,
      contentOpacity: 1,
      contentWidth: id === leavingId
        ? mix(activeContentWidth, inactiveContentWidth, text)
        : null,
      headingColor: id === leavingId ? activeHeadingColor(id, 1 - text) : null,
      headingWidth: id === leavingId
        ? mix(activeHeadingWidth, inactiveHeadingWidth, text)
        : null,
      z: id === leavingId ? 2 : 1,
    })
  })
  return pose
}

function applyPose(pose, nodes) {
  pose.forEach((style, id) => {
    const el = nodes[id]
    if (!el) return
    el.style.transform = `translate3d(${style.x}px, 0, 0)`
    el.style.width = `${style.width}px`
    el.style.opacity = String(style.opacity)
    el.style.zIndex = String(style.z)
    const content = el.querySelector('.breakthroughs-section__card-copy')
    if (content) {
      content.style.opacity = String(style.contentOpacity ?? 1)
      if (style.contentWidth == null) content.style.removeProperty('width')
      else content.style.width = `${style.contentWidth}px`
    }
    const heading = content?.querySelector('h3')
    if (heading) {
      if (style.headingColor) heading.style.color = style.headingColor
      else heading.style.removeProperty('color')
      if (style.headingWidth == null) heading.style.removeProperty('width')
      else heading.style.width = `${style.headingWidth}px`
    }
  })
}

function applyLayout(order, metrics, nodes) {
  const placed = layoutMap(order, metrics)
  const pose = new Map()
  order.forEach((id, index) => {
    const slot = placed.get(id)
    pose.set(id, {
      x: slot.x,
      width: slot.width,
      opacity: 1,
      contentOpacity: 1,
      contentWidth: null,
      headingColor: null,
      headingWidth: null,
      z: index === 0 ? 3 : 1,
    })
  })
  applyPose(pose, nodes)
}

function horizontalWheelDelta(event) {
  if (event.ctrlKey) return 0
  const shiftedWheel = event.shiftKey && Math.abs(event.deltaX) < 0.5
  if (!shiftedWheel && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return 0

  let delta = shiftedWheel ? event.deltaY : event.deltaX
  if (event.deltaMode === 1) delta *= 16
  else if (event.deltaMode === 2) delta *= window.innerWidth
  return delta
}

function sectionEngaged(row) {
  if (!row) return false
  const rect = row.getBoundingClientRect()
  const viewport = window.innerHeight
  const visible = Math.min(rect.bottom, viewport) - Math.max(rect.top, 0)
  if (visible / rect.height < 0.72) return false
  if (rect.top > viewport * 0.7) return false
  if (rect.bottom < viewport * 0.3) return false
  return true
}

export default function BreakthroughsSection() {
  const rootRef = useRef(null)
  const rowRef = useRef(null)
  const cardRefs = useRef({})
  const orderRef = useRef(CARDS.map((card) => card.id))
  const motionRef = useRef(null)
  const runningRef = useRef(false)
  const beginRef = useRef(() => false)
  const [order, setOrder] = useState(orderRef.current)
  const [visualActiveId, setVisualActiveId] = useState(orderRef.current[0])
  // The arrow belongs to the card that is opening, from the moment it
  // starts to widen, not from when the open state lands at the end.
  const [arrowId, setArrowId] = useState(orderRef.current[0])
  useSequentialReveal(rootRef)

  const begin = (nextOrder, mode) => {
    if (runningRef.current) return false
    const current = orderRef.current
    if (!nextOrder?.length || nextOrder[0] === current[0]) return false
    setArrowId(nextOrder[0])
    if (prefersReducedMotion()) {
      orderRef.current = nextOrder
      setOrder(nextOrder)
      setVisualActiveId(nextOrder[0])
      return true
    }
    motionRef.current = {
      fromOrder: current.slice(),
      toOrder: nextOrder.slice(),
      mode,
    }
    orderRef.current = nextOrder
    runningRef.current = true
    if (mode === 'reverse') setVisualActiveId(nextOrder[0])
    setOrder(nextOrder)
    return true
  }

  beginRef.current = begin

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return undefined
    const metrics = readMetrics(row)
    const nodes = cardRefs.current
    row.style.setProperty('--card-open-px', `${metrics.open}px`)
    const motion = motionRef.current
    if (!motion) {
      applyLayout(orderRef.current, metrics, nodes)
      runningRef.current = false
      return undefined
    }
    motionRef.current = null
    runningRef.current = true

    const sample = motion.mode === 'reverse' ? sampleReverse : sampleForward
    const started = performance.now()
    let frame = 0
    let visualStateSwitched = motion.mode === 'reverse'
    row.style.pointerEvents = 'none'

    const draw = (u) => {
      if (!visualStateSwitched) {
        const phase = Math.min(1, u / TRAVEL_AT)
        if (phase >= 0.94) {
          visualStateSwitched = true
          setVisualActiveId(motion.toOrder[0])
        }
      }
      applyPose(sample(motion.fromOrder, motion.toOrder, u, metrics), nodes)
    }
    draw(0)

    const tick = (now) => {
      const raw = Math.min(1, (now - started) / DURATION_MS)
      draw(raw)
      if (raw < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      const latest = readMetrics(row)
      row.style.setProperty('--card-open-px', `${latest.open}px`)
      if (!visualStateSwitched) setVisualActiveId(orderRef.current[0])
      applyLayout(orderRef.current, latest, nodes)
      row.style.pointerEvents = ''
      runningRef.current = false
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      row.style.pointerEvents = ''
      runningRef.current = false
    }
  }, [order])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined
    const observer = new ResizeObserver(() => {
      if (runningRef.current) return
      const metrics = readMetrics(row)
      row.style.setProperty('--card-open-px', `${metrics.open}px`)
      applyLayout(orderRef.current, metrics, cardRefs.current)
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const wheel = {
      lastAt: 0,
      used: false,
      acc: 0,
      dir: 0,
      armed: false,
    }

    const onWheel = (event) => {
      const delta = horizontalWheelDelta(event)
      if (Math.abs(delta) < 0.5) return
      const now = performance.now()
      const fresh = now - wheel.lastAt > GESTURE_GAP_MS
      wheel.lastAt = now
      if (fresh) {
        wheel.used = false
        wheel.acc = 0
        wheel.dir = 0
        wheel.armed = sectionEngaged(rowRef.current)
      }
      if (!wheel.armed) return

      const direction = delta > 0 ? 1 : -1
      const index = activeIndex(orderRef.current)
      const atEdge = (direction > 0 && index >= CARDS.length - 1)
        || (direction < 0 && index <= 0)
      if (atEdge && !runningRef.current && !wheel.used) return

      event.preventDefault()
      if (runningRef.current || wheel.used) return
      if (wheel.dir !== direction) {
        wheel.dir = direction
        wheel.acc = 0
      }
      wheel.acc += Math.abs(delta)
      if (wheel.acc < GESTURE_THRESHOLD) return

      wheel.acc = 0
      const next = CARDS[index + direction]
      if (!next) return
      const started = beginRef.current(
        orderFor(next.id),
        direction > 0 ? 'forward' : 'reverse',
      )
      if (started) wheel.used = true
    }

    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined
    const drag = { x: 0, moved: false, tracking: false }

    const onPointerDown = (event) => {
      if (event.target.closest('button, a')) return
      drag.tracking = true
      drag.moved = false
      drag.x = event.clientX
    }
    const onPointerUp = (event) => {
      if (!drag.tracking) return
      drag.tracking = false
      const dx = event.clientX - drag.x
      if (Math.abs(dx) < 56) return
      drag.moved = true
      const current = orderRef.current
      const index = activeIndex(current)
      if (dx < 0) {
        const next = CARDS[(index + 1) % CARDS.length]
        beginRef.current(orderFor(next.id), 'forward')
      } else {
        const prev = CARDS[(index - 1 + CARDS.length) % CARDS.length]
        beginRef.current(orderFor(prev.id), 'reverse')
      }
    }
    const onClickCapture = (event) => {
      if (!drag.moved) return
      drag.moved = false
      event.stopPropagation()
      event.preventDefault()
    }

    row.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    row.addEventListener('click', onClickCapture, true)
    return () => {
      row.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      row.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  const byId = Object.fromEntries(CARDS.map((card) => [card.id, card]))
  const activeId = visualActiveId

  return (
    <section className="breakthroughs-section" aria-labelledby="breakthroughs-heading" ref={rootRef}>
      <div className="breakthroughs-section__inner">
        <div className="breakthroughs-section__header">
          <div className="breakthroughs-section__copy scroll-reveal" data-reveal="0">
            <p className="breakthroughs-section__eyebrow">Our breakthroughs</p>
            <h2 id="breakthroughs-heading">
              We are building the behavioral
              <br />
              layer for every future AI system.
            </h2>
          </div>
          <RequestDemoButton
            className="breakthroughs-section__cta"
            label="Explore our vision"
            href="#vision"
            widen={56.022}
          />
        </div>

        <div className="breakthroughs-section__row" ref={rowRef}>
          {CARDS.map((source) => {
            const card = byId[source.id]
            const active = card.id === activeId
            return (
              <article
                key={card.id}
                className={`breakthroughs-section__card breakthroughs-section__card--${card.tone}${active ? ' is-active' : ''}${card.id === arrowId ? ' has-arrow' : ''}`}
                ref={(node) => {
                  cardRefs.current[card.id] = node
                }}
                aria-current={active || undefined}
                onClick={() => begin(orderFor(card.id), 'forward')}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  begin(orderFor(card.id), 'forward')
                }}
                tabIndex={active ? -1 : 0}
              >
                {card.tone === 'photo' && (
                  <img src="/images/v2/breakthrough-foundational.png" alt="" />
                )}
                <div className="breakthroughs-section__card-copy">
                  <div className="breakthroughs-section__meta">
                    <span>{card.kicker}</span>
                    <span>{card.year}</span>
                  </div>
                  <h3>
                    {card.title.split('\n').map((line, index) => (
                      <span key={line}>
                        {index > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </h3>
                </div>
                <button
                  type="button"
                  className="breakthroughs-section__next"
                  aria-label="Next breakthrough"
                  aria-hidden={active ? undefined : true}
                  tabIndex={active ? 0 : -1}
                  onClick={(event) => {
                    event.stopPropagation()
                    const index = activeIndex(order)
                    const next = CARDS[(index + 1) % CARDS.length]
                    begin(orderFor(next.id), 'forward')
                  }}
                >
                  <img src="/images/v2/card-arrow.svg" alt="" width={9} height={14} />
                </button>
              </article>
            )
          })}
          <div className="breakthroughs-section__fade" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
