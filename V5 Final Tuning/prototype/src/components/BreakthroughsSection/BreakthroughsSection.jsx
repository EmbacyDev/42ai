import AnimatedHeading from '../AnimatedHeading.jsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'
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
  const text = travel
  const activeContentWidth = Math.max(0, metrics.open - 64)
  const inactiveContentWidth = Math.max(0, metrics.shut - 64)
  const activeHeadingWidth = Math.min(430, Math.max(0, metrics.open - 136))
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
          contentOpacity: 1,
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

function sampleReverse(fromOrder, toOrder, u, metrics) {
  const from = layoutMap(fromOrder, metrics)
  const to = layoutMap(toOrder, metrics)
  const leavingId = fromOrder[0]
  const enteringId = toOrder[0]
  const travel = ease(u)
  const text = travel
  const activeContentWidth = Math.max(0, metrics.open - 64)
  const inactiveContentWidth = Math.max(0, metrics.shut - 64)
  const activeHeadingWidth = Math.min(430, Math.max(0, metrics.open - 136))
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

const wordMotion = new WeakMap()
function applyPose(pose, nodes, animateText = true) {
  pose.forEach((style, id) => {
    const el = nodes[id]
    if (!el) return
    const content = el.querySelector('.breakthroughs-section__card-copy')
    const heading = content?.querySelector('h3')
    const layoutChanged = heading && style.headingWidth != null
      && heading.style.width !== `${style.headingWidth}px`
    const shouldAnimate = layoutChanged && animateText && style.animateText !== false
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Only measure the words at the single reflow, not on every RAF.
    const titleWords = layoutChanged ? [...el.querySelectorAll('.breakthroughs-section__title-word')] : []
    const before = shouldAnimate ? titleWords.map(word => ({ x: word.offsetLeft, y: word.offsetTop })) : []
    el.style.transform = `translate3d(${style.x}px, 0, 0)`
    el.style.width = `${style.width}px`
    el.style.opacity = String(style.opacity)
    el.style.zIndex = String(style.z)
    if (content) {
      content.style.opacity = String(style.contentOpacity ?? 1)
      if (style.contentWidth == null) content.style.removeProperty('width')
      else content.style.width = `${style.contentWidth}px`
    }
    if (heading) {
      if (style.headingColor) heading.style.color = style.headingColor
      else heading.style.removeProperty('color')
      if (style.headingWidth == null) heading.style.removeProperty('width')
      else heading.style.width = `${style.headingWidth}px`
      heading.style.maxWidth = style.headingWidth == null ? '' : 'none'
    }
    if (!animateText || style.animateText === false) {
      titleWords.forEach(word => {
        wordMotion.get(word)?.cancel()
        wordMotion.delete(word)
      })
    }
    if (shouldAnimate) {
      titleWords.forEach((word, index) => {
        const previous = before[index]
        if (Math.abs(previous.y - word.offsetTop) < 1 && Math.abs(previous.x - word.offsetLeft) < 1) return
        wordMotion.get(word)?.cancel()
        const dx = previous.x - word.offsetLeft
        const dy = previous.y - word.offsetTop
        const animation = word.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 560 / 1.2, easing: 'cubic-bezier(.37, 0, .63, 1)' })
        wordMotion.set(word, animation)
      })
    }
  })
}

function applyLayout(order, metrics, nodes) {
  const placed = layoutMap(order, metrics)
  const pose = new Map()
  order.forEach((id, index) => {
    const slot = placed.get(id)
    const contentWidth = slot.width - 64
    const headingCap = index === 0 ? 430 : CARDS.find(card => card.id === id)?.tone === 'teal' ? 251 : 285
    pose.set(id, {
      x: slot.x,
      width: slot.width,
      opacity: 1,
      contentOpacity: 1,
      contentWidth,
      headingColor: null,
      headingWidth: Math.min(headingCap, contentWidth - (index === 0 ? 72 : 64)),
      z: index === 0 ? 3 : 1,
    })
  })
  applyPose(pose, nodes, false)
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
  const [entered, setEntered] = useState(false)
  const [cardsStarted, setCardsStarted] = useState(false)
  const [headingReady, setHeadingReady] = useState(false)

  const begin = (nextOrder, mode) => {
    if (runningRef.current) return false
    const current = orderRef.current
    if (!nextOrder?.length || nextOrder[0] === current[0]) return false
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
      const pose = sample(motion.fromOrder, motion.toOrder, u, metrics)
      // Reflow exactly once between endpoint layouts; words glide to their
      // final positions instead of wrapping at every intermediate width.
      pose.forEach((style, id) => {
        const incoming = id === motion.toOrder[0]
        const outgoing = id === motion.fromOrder[0]
        // The outgoing title stays wide until the card is invisible at
        // wrap, then adopts its narrow layout before entering from the right.
        const open = incoming ? u >= .5 : outgoing && u < WRAP_AT
        style.animateText = incoming
        const contentWidth = (open ? metrics.open : metrics.shut) - 64
        const cap = open ? 430 : CARDS.find(card => card.id === id)?.tone === 'teal' ? 251 : 285
        style.contentWidth = contentWidth
        style.headingWidth = Math.min(cap, contentWidth - (open ? 72 : 64))
      })
      applyPose(pose, nodes)
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
    let nextAt = performance.now() + 5000
    const timer = window.setInterval(() => {
      if (document.hidden || !sectionEngaged(rowRef.current)) {
        nextAt = performance.now() + 5000
        return
      }
      if (performance.now() < nextAt || runningRef.current) return
      const current = orderRef.current
      beginRef.current([...current.slice(1), current[0]], 'forward')
      nextAt = performance.now() + 5000
    }, 100)
    return () => window.clearInterval(timer)
  }, [order])

  // Reveal the row as one surface; endpoint text layouts are already set
  // in useLayoutEffect, so the narrow cards never animate from wide copy.
  useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setEntered(true)
      else if (entry.boundingClientRect.top > 0) {
        // Re-arm only when returning above the blog, never on the way to footer.
        setEntered(false)
        setCardsStarted(false)
        setHeadingReady(false)
      }
    }, { threshold: 0, rootMargin: `0px 0px -${window.innerHeight * 0.6}px 0px` })
    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [])

  // A drag is ignored; only an actual click selects a card.
  useEffect(() => {
    const row = rowRef.current
    let start = null
    const down = event => { start = [event.clientX, event.clientY] }
    const click = event => {
      if (start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 8) {
        event.preventDefault()
        event.stopPropagation()
      }
      start = null
    }
    row.addEventListener('pointerdown', down)
    row.addEventListener('click', click, true)
    return () => {
      row.removeEventListener('pointerdown', down)
      row.removeEventListener('click', click, true)
    }
  }, [])

  const byId = Object.fromEntries(CARDS.map((card) => [card.id, card]))
  const activeId = visualActiveId

  return (
    <section className={`breakthroughs-section${headingReady ? ' is-heading-ready' : ''}`} aria-labelledby="breakthroughs-heading" ref={rootRef}>
      <div className="breakthroughs-section__inner">
        <div className="breakthroughs-section__header">
          <div className="breakthroughs-section__copy">
            <p className="breakthroughs-section__eyebrow">Our breakthroughs</p>
            <AnimatedHeading as="h2" id="breakthroughs-heading" speed={1.69 * 1.5} enabled={entered} onRevealStart={() => { setCardsStarted(true); setHeadingReady(false) }} onRevealComplete={() => setHeadingReady(true)}>
              We are building the behavioral
              <br />
              layer for every future AI system
            </AnimatedHeading>
          </div>
          <RequestDemoButton
            className="breakthroughs-section__cta"
            label="Explore our vision"
            href="#vision"
            widen={40.022}
          />
        </div>

        <div className={`breakthroughs-section__row${cardsStarted ? ' is-visible' : ''}`} ref={rowRef}>
          {CARDS.map((source) => {
            const card = byId[source.id]
            const active = card.id === activeId
            return (
              <article
                key={card.id}
                style={{ '--entrance-delay': `${50 + CARDS.indexOf(source) * 250}ms` }}
                className={`breakthroughs-section__card breakthroughs-section__card--${card.tone}${active ? ' is-active' : ''} has-arrow`}
                ref={(node) => {
                  cardRefs.current[card.id] = node
                }}
                aria-current={active || undefined}
                onClick={() => begin(orderFor(card.id), 'forward')}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
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
                    {card.title.split(/\s+/).map((word, index) => (
                      <span key={index}>{index > 0 && ' '}<span className="breakthroughs-section__title-word">{word}</span></span>
                    ))}
                  </h3>
                </div>
                <button
                  type="button"
                  className="breakthroughs-section__next"
                  aria-label={`Read article: ${card.title}`}
                  disabled={!card.href}
                  title={card.href ? undefined : 'Article link coming soon'}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (card.href) window.location.assign(card.href)
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
