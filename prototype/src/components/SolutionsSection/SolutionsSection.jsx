import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import RequestDemoButton, {
  DEMO_REST_PATH,
  demoShapePathAt,
} from '../RequestDemoButton/RequestDemoButton.jsx'
import banksIcon from '../../../assets/icons/Banks.png'
import brokersIcon from '../../../assets/icons/Brokers.png'
import foundationalIcon from '../../../assets/icons/Foundational AI.png'
import hedgeFundsIcon from '../../../assets/icons/Hedge Funds.png'
import physicalIcon from '../../../assets/icons/Physical AI.png'
import treasuryIcon from '../../../assets/icons/Treasury.png'
import './solutionsSection.css'

const SOLUTIONS = [
  {
    id: 'banks',
    label: 'Banks',
    icon: banksIcon,
    rows: [
      'See the balance sheet before it moves.',
      'Predict deposits, withdrawals, draws and repayments.',
      'Stress-test behavior through rate and market shocks.',
      'Forecast client liquidity and hedge demand.',
    ],
  },
  {
    id: 'hedge-funds',
    label: 'Hedge Funds',
    icon: hedgeFundsIcon,
    rows: [
      'See the balance sheet before it moves.',
      'Predict deposits, withdrawals, draws and repayments.',
      'Stress-test behavior through rate and market shocks.',
      'Forecast client liquidity and hedge demand.',
    ],
  },
  {
    id: 'brokers',
    label: 'Brokers',
    icon: brokersIcon,
    rows: [
      'See the book before it forms.',
      'Predict Delta & Gamma before exposure forms.',
      'Set margin and spreads against forward risk.',
      'Forecast hedge demand and liquidity needs.',
    ],
  },
  {
    id: 'physical-ai',
    label: 'Physical AI',
    icon: physicalIcon,
    rows: [
      'Train in simulated worlds of human interaction.',
      'Adapt actions in real time around people.',
      'Know what nearby humans are likely to do next.',
      'Understand intent, emotion and changing human state.',
    ],
  },
  {
    id: 'foundational-ai',
    label: 'Foundational AI',
    icon: foundationalIcon,
    rows: [
      'Give AI a working model of the human.',
      'Predict how each person will react before the agent acts.',
      'Understand motivations, emotions and changing state.',
      'Train agents against behaviorally realistic humans.',
    ],
  },
  {
    id: 'treasury',
    label: 'Treasury',
    icon: treasuryIcon,
    rows: [
      'Churn, monetization and reward response.',
      'Adherence and care-plan response.',
      'Policyholder behaviour and optionality.',
      'Pricing, offers and product-change response.',
    ],
  },
]

const DEMO_SHAPE_HEIGHT = 40
const DEMO_REST_LEFT = 7.193
const DEMO_REST_RIGHT = 156.785
const DEMO_SHAPE_CENTER = (DEMO_REST_LEFT + DEMO_REST_RIGHT) / 2
const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+/g

function mapDemoShapeToTab(path, width, height) {
  const scale = height / DEMO_SHAPE_HEIGHT
  let coordinateIndex = 0

  return (path.match(PATH_TOKEN) ?? []).map((token) => {
    if (/^[A-Za-z]$/.test(token)) {
      coordinateIndex = 0
      return token
    }

    const value = Number(token)
    const isX = coordinateIndex % 2 === 0
    coordinateIndex += 1

    if (!isX) return String(Math.round(value * scale * 1000) / 1000)

    // Preserve the exact left/right silhouette of the CTA hover morph.
    // Only the straight middle span grows with wider tab labels.
    const mapped = value <= DEMO_SHAPE_CENTER
      ? (value - DEMO_REST_LEFT) * scale
      : width - ((DEMO_REST_RIGHT - value) * scale)

    return String(Math.round(mapped * 1000) / 1000)
  }).join(' ')
}

function TabIndicatorShape({ transitionKey, width, height }) {
  const pathRef = useRef(null)
  const amountRef = useRef(0)
  const dimensionsRef = useRef({ width, height })
  const firstRunRef = useRef(true)

  dimensionsRef.current = { width, height }

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false
      return undefined
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      amountRef.current = 0
      pathRef.current?.setAttribute('d', mapDemoShapeToTab(DEMO_REST_PATH, width, height))
      return undefined
    }

    const duration = 560
    const from = amountRef.current
    const started = performance.now()
    let frame = 0

    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration)
      const distortInProgress = Math.min(1, progress / 0.14)
      const distortIn = 1 - ((1 - distortInProgress) ** 3)
      const distortOutProgress = Math.max(0, Math.min(1, (progress - 0.38) / 0.62))
      const distortOut = 1 - (distortOutProgress < 0.5
        ? 4 * (distortOutProgress ** 3)
        : 1 - (((-2 * distortOutProgress) + 2) ** 3) / 2)
      const movingShape = Math.min(distortIn, distortOut)
      // If another tab is clicked mid-flight, ease out of the current shape
      // instead of snapping back to a capsule before the next movement.
      const restartBlend = Math.min(1, progress / 0.05)
      const easedBlend = 1 - ((1 - restartBlend) ** 3)
      const amount = from + (movingShape - from) * easedBlend
      const currentDimensions = dimensionsRef.current

      amountRef.current = amount
      pathRef.current?.setAttribute(
        'd',
        mapDemoShapeToTab(
          demoShapePathAt(amount),
          currentDimensions.width,
          currentDimensions.height,
        ),
      )

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        amountRef.current = 0
        pathRef.current?.setAttribute(
          'd',
          mapDemoShapeToTab(
            DEMO_REST_PATH,
            currentDimensions.width,
            currentDimensions.height,
          ),
        )
      }
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [transitionKey])

  return (
    <svg
      className="solutions-section__tab-indicator-shape"
      viewBox={`0 0 ${Math.max(width, height)} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d={mapDemoShapeToTab(demoShapePathAt(amountRef.current), width, height)}
      />
    </svg>
  )
}

/**
 * Figma block 6 (450:8178 and its five tab states). The temporary 3D
 * envelope is intentionally shared by every panel until the final set of
 * industry illustrations is ready.
 */
export default function SolutionsSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const tabsRef = useRef(null)
  const tabRefs = useRef([])
  const [indicator, setIndicator] = useState(null)

  const measureIndicator = useCallback(() => {
    const tabs = tabsRef.current
    const tab = tabRefs.current[activeIndex]
    if (!tabs || !tab) return

    const tabsRect = tabs.getBoundingClientRect()
    const tabRect = tab.getBoundingClientRect()

    setIndicator({
      x: tabRect.left - tabsRect.left,
      y: tabRect.top - tabsRect.top,
      width: tabRect.width,
      height: tabRect.height,
    })
  }, [activeIndex])

  useLayoutEffect(() => {
    measureIndicator()

    const tabs = tabsRef.current
    if (!tabs || !('ResizeObserver' in window)) {
      window.addEventListener('resize', measureIndicator)
      return () => window.removeEventListener('resize', measureIndicator)
    }

    const observer = new ResizeObserver(measureIndicator)
    observer.observe(tabs)
    return () => observer.disconnect()
  }, [measureIndicator])

  const selectTab = (index) => {
    setActiveIndex(index)
  }

  const handleTabKeyDown = (event, index) => {
    let nextIndex = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % SOLUTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + SOLUTIONS.length) % SOLUTIONS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = SOLUTIONS.length - 1
    }

    if (nextIndex === null) return
    event.preventDefault()
    selectTab(nextIndex)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <section
      className="solutions-section"
      id="applications"
      aria-labelledby="solutions-heading"
    >
      <div className="solutions-section__intro">
        <h2 id="solutions-heading" className="solutions-section__title">
          Universal solution for human
          <br />
          and agentic behaviour.
        </h2>
        <p className="solutions-section__lead">
          One behavioral intelligence engine for your high-value environments.
        </p>
        <div
          ref={tabsRef}
          className={`solutions-section__tabs${indicator ? ' solutions-section__tabs--ready' : ''}`}
          role="tablist"
          aria-label="Industries"
        >
          <span
            className="solutions-section__tab-indicator"
            aria-hidden="true"
            style={indicator ? {
              width: indicator.width,
              height: indicator.height,
              transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            } : undefined}
          >
            <TabIndicatorShape
              transitionKey={activeIndex}
              width={indicator?.width ?? 36}
              height={indicator?.height ?? 36}
            />
          </span>
          {SOLUTIONS.map((solution, index) => {
            const active = index === activeIndex
            return (
              <button
                key={solution.id}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                type="button"
                className={`solutions-section__tab${active ? ' solutions-section__tab--active' : ''}`}
                role="tab"
                aria-selected={active}
                aria-controls={`solution-panel-${solution.id}`}
                id={`solution-tab-${solution.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(index)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {solution.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="solutions-section__panel">
        <div className="solutions-section__icon-stage">
          {SOLUTIONS.map((solution, index) => (
            <img
              key={solution.id}
              className={`solutions-section__icon${index === activeIndex ? ' solutions-section__icon--active' : ''}`}
              src={solution.icon}
              alt=""
            />
          ))}
        </div>
        <div className="solutions-section__content-stage">
          {SOLUTIONS.map((solution, index) => {
            const active = index === activeIndex
            const direction = index < activeIndex ? -1 : 1
            return (
              <div
                key={solution.id}
                className={`solutions-section__list${active ? ' solutions-section__list--active' : ''}`}
                id={`solution-panel-${solution.id}`}
                role="tabpanel"
                aria-labelledby={`solution-tab-${solution.id}`}
                aria-hidden={!active}
                style={{ '--solutions-panel-direction': direction }}
              >
                <ul>
                  {solution.rows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
                <RequestDemoButton
                  className="solutions-section__more"
                  label="Show more"
                  tabIndex={active ? 0 : -1}
                  hidden={!active}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
