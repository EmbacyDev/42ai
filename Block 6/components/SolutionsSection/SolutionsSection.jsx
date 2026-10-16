import AnimatedHeading from '../AnimatedHeading.jsx'
import IndustryIconScene from './IndustryIconScene.jsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import RequestDemoButton, {
  DEMO_REST_PATH,
  demoShapePathAt,
} from '../RequestDemoButton/RequestDemoButton.jsx'
import banksIcon from '../../icons/Banks.png?v=20261016'
import brokersIcon from '../../icons/Brokers.png?v=20261016'
import foundationalIcon from '../../icons/Foundational AI.png?v=20261016'
import hedgeFundsIcon from '../../icons/Hedge Funds.png?v=20261016'
import physicalIcon from '../../icons/Physical AI.png?v=20261016'
import treasuryIcon from '../../icons/Treasury.png?v=20261016'
import './solutionsSection.css'
import '../../styles/fonts.css'
import '../../styles/landing-context.css'

const SOLUTIONS = [
  {
    id: 'banks',
    label: 'Banks',
    icon: banksIcon,
    visualCenterY: 302 / 699,
    contactTop: '68.7%',
    contactWidth: '58%',
    contactLeft: '48.6%',
    dimensionalLight: true,
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
    visualCenterY: 312 / 699,
    dimensionalLight: true,
    contactTop: '70.2%',
    contactWidth: '56%',
    contactLeft: '52.1%',
    rows: [
      'Forecast trader flow before it reaches the market.',
      'Predict instrument, direction, timing and size.',
      'Simulate reactions to shocks and new information.',
      'Turn human behavior into alternative alpha.',
    ],
  },
  {
    id: 'brokers',
    label: 'Brokers',
    icon: brokersIcon,
    visualCenterY: 319.5 / 706,
    material: 'layered-glass',
    dimensionalLight: true,
    contactTop: '71.9%',
    contactWidth: '58%',
    contactLeft: '58.6%',
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
    visualCenterY: 296 / 699,
    dimensionalLight: true,
    contactTop: '70.5%',
    contactWidth: '48%',
    contactLeft: '59%',
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
    visualCenterY: 320.5 / 699,
    material: 'layered-glass',
    dimensionalLight: true,
    contactTop: '76.8%',
    contactWidth: '29%',
    contactLeft: '48.5%',
    lightStrength: 0.65,
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
    visualCenterY: 312 / 699,
    material: 'glass-metal',
    dimensionalLight: true,
    contactTop: '76.1%',
    contactWidth: '51%',
    contactLeft: '48.7%',
    lightStrength: 0.55,
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

/** Industry tabs share one illustration scene and the existing copy reveal. */
export default function SolutionsSection() {
  const sectionRef = useRef(null)
  const iconInteractionRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [headingReady, setHeadingReady] = useState(false)
  const [revealCycle, setRevealCycle] = useState(0)
  const panelReady = headingReady
  const [panelSettled, setPanelSettled] = useState(false)
  const [listReady, setListReady] = useState(false)
  useEffect(() => {
    if (!panelReady) return
    const timer = setTimeout(() => setPanelSettled(true), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1070)
    return () => clearTimeout(timer)
  }, [panelReady])
  useEffect(() => {
    const restart = () => {
      setHeadingReady(false)
      setPanelSettled(false)
      setListReady(false)
      setRevealCycle(cycle => cycle + 1)
    }
    const section = sectionRef.current
    let previousY = window.scrollY
    let aboveEntry = section.getBoundingClientRect().top >= window.innerHeight
    const onScroll = () => {
      const y = window.scrollY
      const top = section.getBoundingClientRect().top
      const approaching = section.classList.contains('solutions-section--approaching')
      if (!approaching && y > previousY && aboveEntry && top < window.innerHeight) restart()
      aboveEntry = top >= window.innerHeight
      previousY = y
    }
    // Cinematic and ordinary downward entries both re-arm the reveal.
    // Upward scrolling never resets the already visible text.
    const onForwardEntry = () => {
      aboveEntry = false
      restart()
    }
    window.addEventListener('42ai-solutions-forward-entry', onForwardEntry)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('42ai-solutions-forward-entry', onForwardEntry)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  const supportingRevealTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(supportingRevealTimer.current), [])
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
      ref={sectionRef}
      className="solutions-section"
      data-heading-ready={headingReady}
      data-panel-ready={panelReady}
      data-more-ready={panelSettled && listReady}
      id="applications"
      aria-labelledby="solutions-heading"
    >
      <div className="solutions-section__intro">
        <AnimatedHeading key={revealCycle} as="h2" id="solutions-heading" className="solutions-section__title"
          reveal="lines" lineDurationMs={600} lineStaggerMs={150} visibilityCheckMs={16}
          once
          onRevealStart={() => {
            window.clearTimeout(supportingRevealTimer.current)
            // Heading starts at 400ms; supporting content at 800ms.
            supportingRevealTimer.current = window.setTimeout(() => setHeadingReady(true), 400)
          }}
          onRevealComplete={() => {
            window.clearTimeout(supportingRevealTimer.current)
            setHeadingReady(true)
          }}
          onRevealReset={() => {
            window.clearTimeout(supportingRevealTimer.current)
            setHeadingReady(false)
          }}>
          Universal solution for human
          <br />
          and agentic behaviour
        </AnimatedHeading>
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

      <div ref={iconInteractionRef} className="solutions-section__panel">
        <IndustryIconScene items={SOLUTIONS} activeIndex={activeIndex} ready={panelReady} interactionRef={iconInteractionRef} />
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
                <AnimatedHeading key={revealCycle} as="ul" once reveal="characters" blurPx={4} enabled={active && panelReady} onRevealComplete={() => { if (active) setListReady(true) }} onRevealReset={() => { if (active) setListReady(false) }} speed={1 / 1.3} lineDurationMs={225 + 300 / 1.3} lineStaggerMs={100}>
                  {solution.rows.map((row, rowIndex) => <li key={row} style={{ '--row-delay': `${rowIndex * 130}ms` }}>{row}</li>)}
                </AnimatedHeading>
                <RequestDemoButton
                  className="solutions-section__more"
                  label="Show more"
                  tabIndex={active && panelSettled && listReady ? 0 : -1}
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
