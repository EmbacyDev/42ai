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
    title: 'Decoding the human factor:\nhigh fidelity behavioral predictions',
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

const TRAVEL_MS = 640

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Figma block 8 (450:4656). The left card is the open one. Choosing another
 * card — by click, the arrow, or a scroll — sends it to the left slot as it
 * opens, and the card that was open collapses and leaves to the left.
 */
export default function BreakthroughsSection() {
  const rootRef = useRef(null)
  const rowRef = useRef(null)
  const cardRefs = useRef({})
  const orderRef = useRef(CARDS.map((card) => card.id))
  const motionRef = useRef(null)
  const lockRef = useRef(0)
  const activateRef = useRef(() => {})
  const [order, setOrder] = useState(orderRef.current)
  useSequentialReveal(rootRef)

  const activate = (id) => {
    const current = orderRef.current
    if (!id || id === current[0]) return
    if (performance.now() < lockRef.current) return
    Object.values(cardRefs.current).forEach((el) => {
      if (!el) return
      el.getAnimations?.().forEach((anim) => anim.cancel())
      el.style.zIndex = ''
    })
    const before = new Map()
    current.forEach((cardId) => {
      const el = cardRefs.current[cardId]
      if (el) before.set(cardId, el.getBoundingClientRect())
    })
    motionRef.current = { before, outgoingId: current[0] }
    const outgoing = current[0]
    const next = [id, ...current.filter((cardId) => cardId !== id && cardId !== outgoing), outgoing]
    orderRef.current = next
    lockRef.current = performance.now() + (prefersReducedMotion() ? 80 : 920)
    setOrder(next)
  }

  activateRef.current = activate

  useLayoutEffect(() => {
    const snapshot = motionRef.current
    if (!snapshot) return undefined
    motionRef.current = null
    if (prefersReducedMotion()) return undefined

    const cleanups = []
    order.forEach((cardId) => {
      const el = cardRefs.current[cardId]
      const first = snapshot.before.get(cardId)
      if (!el || !first) return
      const last = el.getBoundingClientRect()
      const dx = first.left - last.left

      if (cardId === snapshot.outgoingId) {
        el.getAnimations().forEach((anim) => anim.cancel())
        el.style.zIndex = '4'
        const shift = Math.min(180, first.width * 0.35)
        const leave = el.animate(
          [
            { transform: `translateX(${dx}px)`, width: `${first.width}px`, opacity: 1, offset: 0 },
            {
              transform: `translateX(${dx - shift}px)`,
              width: `${last.width}px`,
              opacity: 0,
              offset: 0.58,
            },
            { transform: 'translateX(0px)', width: `${last.width}px`, opacity: 0, offset: 0.62 },
            { transform: 'translateX(0px)', width: `${last.width}px`, opacity: 1, offset: 1 },
          ],
          { duration: 880, easing: 'linear', fill: 'none' },
        )
        const clear = () => {
          el.style.zIndex = ''
        }
        leave.onfinish = clear
        leave.oncancel = clear
        cleanups.push(() => {
          leave.onfinish = null
          leave.cancel()
        })
        return
      }

      if (Math.abs(dx) < 0.5 && Math.abs(first.width - last.width) < 0.5) return
      el.style.zIndex = cardId === order[0] ? '3' : '2'
      const travel = el.animate(
        [
          { transform: `translateX(${dx}px)`, width: `${first.width}px` },
          { transform: 'translateX(0px)', width: `${last.width}px` },
        ],
        { duration: TRAVEL_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'none' },
      )
      const clear = () => {
        el.style.zIndex = ''
      }
      travel.onfinish = clear
      travel.oncancel = clear
      cleanups.push(() => {
        travel.onfinish = null
        travel.oncancel = null
      })
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [order])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined

    let dragX = null

    const onPointerDown = (event) => {
      if (event.target.closest('button, a')) return
      dragX = event.clientX
    }

    const onPointerUp = (event) => {
      if (dragX == null) return
      const dx = event.clientX - dragX
      dragX = null
      if (Math.abs(dx) < 48) return
      const current = orderRef.current
      activateRef.current(dx < 0 ? current[1] : current[current.length - 1])
    }

    row.addEventListener('pointerdown', onPointerDown)
    row.addEventListener('pointerup', onPointerUp)
    return () => {
      row.removeEventListener('pointerdown', onPointerDown)
      row.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const byId = Object.fromEntries(CARDS.map((card) => [card.id, card]))
  const activeId = order[0]

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
          />
        </div>

        <div className="breakthroughs-section__row" ref={rowRef}>
          {order.map((cardId) => {
            const card = byId[cardId]
            const active = cardId === activeId
            return (
              <article
                key={card.id}
                className={`breakthroughs-section__card breakthroughs-section__card--${card.tone}${active ? ' is-active' : ''}`}
                ref={(node) => {
                  cardRefs.current[card.id] = node
                }}
                aria-current={active || undefined}
                onClick={() => activate(card.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activate(card.id)
                  }
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
                {active && (
                  <button
                    type="button"
                    className="breakthroughs-section__next"
                    aria-label="Next breakthrough"
                    onClick={(event) => {
                      event.stopPropagation()
                      activate(order[1])
                    }}
                  >
                    <img src="/images/v2/card-arrow.svg" alt="" width={9} height={14} />
                  </button>
                )}
              </article>
            )
          })}
          <div className="breakthroughs-section__fade" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
