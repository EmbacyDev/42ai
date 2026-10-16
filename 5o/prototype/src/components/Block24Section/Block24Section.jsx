import { createNativeCards } from '../NativeScroll/cards.js'
import ScrambleText from '../Scramble/ScrambleText.jsx'
import AnimatedHeading from '../AnimatedHeading.jsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import {
  applyBlock24Layout,
  BLOCK24_HANDOFF_ARM,
  BLOCK24_HANDOFF_EVENT,
  BLOCK24_RETURN_EVENT,
} from './block24Layout.js'
import { crystalHeroBlend, crystalTravelRangePx, smootherstep } from '../HeroScene/scrollShrink.js'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'
import PhotoRail3D, {
  BLOCK24_CARD_PHASES,
  BLOCK24_ENTRANCE_DURATION,
  BLOCK24_CARD_TRANSITION_DURATION,
} from './PhotoRail3D.jsx'
import {
  BAND_TRANSITION,
  MASK_TRANSITION,
  MASK_BURST,
  MASK_PRE_ZOOM,
  MASK_DESCENT,
  MASK_CONTENT_EXIT,
  maskState,
  BAND_IN,
  BAND_PEEK,
  BAND_STRETCH,
  BAND_PEEK_SHARE,
  bandState,
  BAND_CREST_PER_UNIT,
} from '../WorldModelSection/worldModelHandoff.js'
import './block24Section.css'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)
// The first state should establish the section without feeling stalled. Later
// cards get a little more reading time, counted only after the hand-off ends.
const INITIAL_AUTOPLAY_DELAY = 2600
const AUTOPLAY_DELAY = 4300
const AUTOPLAY_MIN_GAP = 2600
// Long enough that the hero's landing flick cannot carry straight through,
// short enough that two later gestures always reach block three. The first
// deliberate wheel after the cards are up starts the flight immediately.
const PIN_SCROLL_DISTANCE = '+=100%'
// v4: content starts as the crystal settles into its seat (not at the
// very end of the scroll, which left a long empty beat). At 0.85 the gem
// and its glow were still passing over the centre card, which read as the
// card blinking right after it appeared.
// Not earlier than the very end of the scroll, though: while the page
// was still settling onto the pin, the visible cards rode the last of the
// scroll and the pin's snap — the first card read as rolling in and
// blinking. Content now appears once the page has arrived, fast and with
// no extra pause.
const CONTENT_LAND_BLEND = 0.98
const CONTENT_UNLAND_BLEND = 0.9
const CONTENT_REVEAL_DELAY = 0
// Cards fade in over ~0.9s after the crystal docks. The cinematic must
// not arm until that reveal has actually landed — otherwise the same
// flick that finishes the hero snap eats block 2 before it can be read.
const CONTENT_SETTLE_ENTER = 1
const SETTLE_QUIET_MS = 360
// v4: the 2→3 exit, about three times slower and in sequence:
//  0.00  cards and copy fade out where they stand (CONTENT_EXIT)
//  0.00  the crystal starts its flight to the screen centre (1.8s)
//  1.25  the crystal is nearly centred: the light opens out of it and
//        the page starts carrying block three up under that light
const STUDIO_HANDOFF_DURATION = 1.8
const CONTENT_EXIT = 0.45
const COLOUR_START = 1.25
// v4: after a 3→2 return, upward scrolling waits this long (from the
// start of the page flight back) before it can head for the hero.
const RETURN_HOLD_MS = 1700
const studioEase = (t) => smootherstep(t)

const SLIDES = [
  {
    "id": "ai-labs-robotics",
    "image": "/images/figma/cards-801/ai-photo-3x.png",
    "gradient": "/images/figma/cards-801/ai-gradient-3x.png",
    "tab": "AI Labs & Robotics",
    "labelColor": "#121212",
    "title": "Give AI human intuition\nand simulate real reactions"
  },
  {
    "id": "hedge-funds",
    "image": "/images/figma/cards-801/hedge-photo-3x.png",
    "gradient": "/images/figma/cards-801/hedge-gradient-3x.png",
    "tab": "Hedge Funds & Asset Managers",
    "labelColor": "#121212",
    "title": "Alternative alpha\nin human behaviour"
  },
  {
    "id": "personalized-ai",
    "image": "/images/figma/cards-801/personalized-photo-3x.png",
    "gradient": "/images/figma/cards-801/personalized-gradient-3x.png",
    "tab": "Personalized AI",
    "labelColor": "#121212",
    "title": "Know who to target,\nwhat to offer, and why"
  },
  {
    "id": "brokerages",
    "image": "/images/figma/cards-801/brokerages-photo-3x.png",
    "gradient": "/images/figma/cards-801/brokerages-gradient-3x.png",
    "tab": "Brokerages & Market Makers",
    "labelColor": "#121212",
    "title": "Know what every trader will\ndo before they act"
  },
  {
    "id": "simulation-decision",
    "image": "/images/figma/cards-801/simulation-photo-3x.png",
    "gradient": "/images/figma/cards-801/simulation-gradient-3x.png",
    "tab": "Simulation & Decision Systems",
    "labelColor": "#121212",
    "title": "Simulate real\nhuman reactions"
  },
  {
    "id": "markets-risk",
    "image": "/images/figma/cards-801/markets-photo-3x.png",
    "gradient": "/images/figma/cards-801/markets-gradient-3x.png",
    "tab": "Markets & Risk",
    "labelColor": "#121212",
    "title": "Predicts financial book\u2019s exposure\nbefore it arrives"
  },
  {
    "id": "alm-treasury",
    "image": "/images/figma/cards-801/alm-photo-3x.png",
    "gradient": "/images/figma/cards-801/alm-gradient-3x.png",
    "tab": "ALM & Treasury",
    "labelColor": "#121212",
    "title": "Turn the client-side of your\nbalance sheet predictable"
  }
]

function AutoplayRing() {
  return <svg className="autoplay-ring" viewBox="0 0 20 20" aria-hidden="true">
    <circle className="autoplay-ring__track" cx="10" cy="10" r="7.5" />
    <circle className="autoplay-ring__progress" cx="10" cy="10" r="7.5" pathLength="1" />
  </svg>
}

const TAB_ROW_HEIGHT = 15 * 1.15 + 14

/**
 * Figma Block 24 (node 122:2495), inserted between the hero and the glass
 * carousel. The page-level crystal and floating navigation stay shared;
 * this component only owns the section's central editorial composition.
 */
export default function Block24Section({
  backgroundColor = '#ffffff',
  onCrystalAnchor,
  onCrystalPulse,
  onSectionVisibilityChange,
  // See BulgeFeatureCard's own prefetch effect: held at true by default (a
  // standalone render of this section, outside the hero page, shouldn't
  // wait on anything), but the hero page passes its own `heroReady` so this
  // section's off-screen photo prefetching doesn't compete with the hero's
  // still-loading portraits over the browser's shared connection limit.
  nativeScroll = false,
  autoplayProgress = nativeScroll,
  heroReady = true,
  onImagesReady,
}) {
  const sectionRef = useRef(null)
  const entranceRef = useRef({ value: 0 })
  const tabletTabsRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [copyIndex, setCopyIndex] = useState(0)
  const [copyRevealDelay, setCopyRevealDelay] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [flight, setFlight] = useState(null)
  const flightRef = useRef(null)
  const lastAdvanceAtRef = useRef(0)
  const activeIndexRef = useRef(0)
  const wheelTargetRef = useRef(0)
  const wheelValueRef = useRef(0)
  const onCrystalAnchorRef = useRef(onCrystalAnchor)
  const onCrystalPulseRef = useRef(onCrystalPulse)
  const onSectionVisibilityChangeRef = useRef(onSectionVisibilityChange)
  onCrystalAnchorRef.current = onCrystalAnchor
  onCrystalPulseRef.current = onCrystalPulse
  onSectionVisibilityChangeRef.current = onSectionVisibilityChange

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    if (nativeScroll) return createNativeCards({ section, anchor: onCrystalAnchorRef,
      visibility: onSectionVisibilityChangeRef, entrance: entranceRef,
      setVisible: setIsVisible, setExiting: setIsExiting, setReady: setContentReady })

    let pinProgress = 0
    let handoffOn = false
    let returningFromWorld = false
    const handoffProxy = { value: 0 }
    let handoffTween
    let handoffScrollTween
    let contentExitTween
    // Band transition: cards + crystal fade/lift, 0 → 1 leaving block two.
    const exitFade = { value: 0 }
    let handoffDelays = []
    // True from the flick until the page flight starts (see COLOUR_START).
    let flightPending = false
    let returnHoldUntil = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const worldRestScrollY = () => {
      const world = document.querySelector('.world-model-section')
      const pinEnd = crystalTravelRangePx() + window.innerHeight
      if (!world) return pinEnd
      // The pin has no extra spacer: block 3 rides up behind this
      // section, the same way block 2 rides behind the hero. The rest
      // is the pixel where the world pane fills the viewport.
      const docTop = world.getBoundingClientRect().top + window.scrollY
      // One pixel past the pin end so the cards actually unpin. Landing
      // exactly on the boundary left the capture-phase wheel handler
      // thinking we were still on block 2, which froze the copy.
      return Math.max(pinEnd, docTop) + 2
    }

    const onMaskReady = () => {
      if (!handoffOn || !flightPending) return
      flightPending = false
      killScrollSnaps()
      window.scrollTo({ top: worldRestScrollY(), behavior: 'instant' })
    }
    window.addEventListener('42ai-world-mask-ready', onMaskReady)
    const dispatchHandoff = () => {
      window.dispatchEvent(new CustomEvent(BLOCK24_HANDOFF_EVENT))
    }

    const killScrollSnaps = () => {
      gsap.killTweensOf(window)
      gsap.killTweensOf(document.documentElement)
      gsap.killTweensOf(document.body)
    }

    // One committed flick: fade the editorial, fly the crystal to centre,
    // and carry the page onto block three so the colour drop can play.
    // None of that is scrubbed against further wheel ticks.
    const layoutSection = () => applyBlock24Layout(section)

    const updateAnchor = () => {
      const rect = section.getBoundingClientRect()
      const layout = layoutSection()
      onCrystalAnchorRef.current?.(
        rect.left + layout.originX + 720.5 * layout.scale,
        rect.top + layout.crystalCenterY,
        {
          sectionTop: rect.top,
          sectionBottom: rect.bottom,
          progress: pinProgress,
          // Band transition: the crystal does not fly to the centre; it is
          // carried up with the cards (`fade` = share of the viewport).
          handoff: BAND_TRANSITION ? 0 : handoffProxy.value,
          fade: BAND_TRANSITION ? exitFade.value : 0,
        },
      )
    }

    const playHandoffScroll = (forward) => {
      handoffScrollTween?.kill()
      killScrollSnaps()
      const dest = forward ? worldRestScrollY() : crystalTravelRangePx()
      const start = window.scrollY
      if (Math.abs(dest - start) < 8) {
        if (forward) dispatchHandoff()
        return
      }
      let handedOff = false
      const maybeHandoff = () => {
        if (!forward || handedOff) return
        const t = (window.scrollY - start) / Math.max(1, dest - start)
        // v4: the colour opening is normally already started by the
        // delayed call in setHandoff; this is only the fallback.
        if (t >= 0) {
          handedOff = true
          dispatchHandoff()
        }
      }
      // Proxy, not `window`: the hero inertia loop and other sections
      // kill window tweens, which aborted this flight and left the
      // reader parked on the cards.
      const proxy = { y: start }
      handoffScrollTween = gsap.to(proxy, {
        y: dest,
        duration: reduceMotion ? 0 : STUDIO_HANDOFF_DURATION,
        ease: studioEase,
        overwrite: true,
        onUpdate: () => {
          window.scrollTo(0, proxy.y)
          maybeHandoff()
        },
        onComplete: () => {
          window.scrollTo(0, dest)
          if (forward && !handedOff) dispatchHandoff()
        },
      })
    }

    const setHandoff = (next, instant = false) => {
      if (handoffOn === next && !instant) return
      handoffOn = next
      handoffTween?.kill()
      if (!next) {
        handoffScrollTween?.kill()
        queuedHandoff = false
      }
      if (reduceMotion || instant) {
        // Band transition: an instant reset must also bring the carried
        // stage back on screen.
        if (!next && BAND_TRANSITION) {
          contentExitTween?.kill()
          exitFade.value = 0
          section.style.setProperty('--block24-exit-scroll', '0')
        }
        handoffProxy.value = next ? 1 : 0
        section.style.setProperty('--block24-exit-content', handoffProxy.value.toFixed(4))
        setIsExiting(next)
        updateAnchor()
        if (next) {
          killScrollSnaps()
          window.scrollTo(0, worldRestScrollY())
          dispatchHandoff()
        }
        return
      }
      handoffTween = gsap.to(handoffProxy, {
        value: next ? 1 : 0,
        duration: reduceMotion || instant ? 0 : MASK_TRANSITION ? MASK_DESCENT / 2 : next ? STUDIO_HANDOFF_DURATION : 0.62,
        ease: MASK_TRANSITION ? 'sine.inOut' : next ? studioEase : 'power3.in',
        overwrite: true,
        onUpdate: () => {
          // v4: leaving, the cards and copy are gone within the first
          // fifth of the flight, before the page scroll can carry them up.
          // The crystal still uses the full-length handoff value.
          // Leaving, the content has its own quick fade (contentExitTween).
          if (!next && !BAND_TRANSITION) {
            section.style.setProperty('--block24-exit-content', handoffProxy.value.toFixed(4))
          }
          if (next && BAND_TRANSITION) return
          setIsExiting((current) => {
            const showing = handoffProxy.value > 0.02
            return current === showing ? current : showing
          })
          updateAnchor()
        },
        onComplete: () => {
          section.style.setProperty('--block24-exit-content', handoffProxy.value.toFixed(4))
          setIsExiting(next)
          updateAnchor()
        },
      })
      contentExitTween?.kill()
      handoffDelays.forEach((call) => call.kill())
      handoffDelays = []
      flightPending = false
      if (!next && BAND_TRANSITION) {
        // Back from block three: the band sinks and block two comes down
        // with it, from above the screen to its place.
        section.style.setProperty('--block24-exit-content', '0')
        contentExitTween = gsap.to(exitFade, {
          value: 0,
          duration: BAND_STRETCH + BAND_PEEK * 0.5,
          ease: 'power3.inOut',
          onUpdate: () => {
            section.style.setProperty('--block24-exit-scroll', exitFade.value.toFixed(4))
            updateAnchor()
          },
        })
      }
      if (next && BAND_TRANSITION) {
        // Band transition: cards, copy and crystal lift a little and fade
        // where they are, while block three's band rises from the bottom
        // edge (WorldModelSection). Once the band covers the screen the page
        // jumps to block three underneath it.
        // The stage (and the crystal, via `fade`) is carried up in step
        // with the band's top edge — a scroll, not an effect.
        exitFade.value = 0
        const writeCarry = () => {
          section.style.setProperty('--block24-exit-scroll', exitFade.value.toFixed(4))
          updateAnchor()
        }
        // Block two rides exactly on the dome's crest: its bottom edge is
        // pushed up by the rising colour, so no white page shows between
        // them (it ran ahead before, and the middle of the transition was
        // an empty white screen).
        const ride = () => {
          exitFade.value = Math.min(1, bandState.value * BAND_CREST_PER_UNIT)
          writeCarry()
        }
        gsap.ticker.add(ride)
        contentExitTween = gsap.delayedCall(BAND_IN + 0.1, () => {
          gsap.ticker.remove(ride)
          exitFade.value = 1
          writeCarry()
        })
        contentExitTween.eventCallback('onInterrupt', () => gsap.ticker.remove(ride))
        flightPending = true
        dispatchHandoff()
        handoffDelays = [
          gsap.delayedCall(BAND_IN + 0.03, () => {
            flightPending = false
            killScrollSnaps()
            window.scrollTo(0, worldRestScrollY())
          }),
        ]
      } else if (next) {
        // v4: the cards and copy are gone (CONTENT_EXIT) before the page
        // scroll starts, so nothing is seen riding upward. The colour
        // opening on block three starts just before they are fully gone.
        const fade = { value: 0 }
        contentExitTween = gsap.to(fade, {
          value: 1,
          duration: MASK_TRANSITION ? MASK_CONTENT_EXIT / 2 : CONTENT_EXIT,
          ease: 'none',
          onUpdate: () => section.style.setProperty('--block24-exit-content', fade.value.toFixed(4)),
        })
        flightPending = true
        handoffDelays = MASK_TRANSITION
          ? [
            // v5 mask: the crystal has settled in the centre; block three
            // bursts out of it (WorldModelSection, MASK_BURST). The page
            // jumps to block three only once that covers the screen.
            // The gem is in the centre once its descent has finished.
            gsap.delayedCall(MASK_DESCENT / 2, dispatchHandoff),
            // The completion event normally releases the pin. A lost event
            // must never leave all wheel input captured indefinitely.
            gsap.delayedCall(MASK_DESCENT + MASK_BURST + .5, onMaskReady),

          ]
          : [
            gsap.delayedCall(COLOUR_START, dispatchHandoff),
            gsap.delayedCall(COLOUR_START, () => {
              flightPending = false
              playHandoffScroll(true)
            }),
          ]
      }
    }

    // Card, titles and side copy stay invisible until the travelling
    // crystal has actually docked. Otherwise the editorial is already
    // sitting there while the crystal is still flying in from the hero.
    const enterProxy = entranceRef.current
    let enterTween
    let crystalLanded = false
    let intersecting = false
    let hasSettledOnBlock2 = false
    let settleTimer
    let lastMoveAt = performance.now()
    let lastScrollY = window.scrollY
    let lastWheelAt = 0
    let queuedHandoff = false
    let contentSettledAt = Infinity

    const noteMovement = () => {
      lastMoveAt = performance.now()
    }

    // True only when the pinned editorial is filling the viewport after
    // the hero has fully released. Used so the 2→3 cinematic cannot arm
    // from hero-landing inertia or from a wheel tick while still on the
    // first screen.
    const isAtBlock2Viewport = () => {
      if (handoffOn) return false
      const rect = section.getBoundingClientRect()
      // The reading rest sits a couple of pixels past this pin, so the
      // cards' box can still report top ≈ 0 while block 3 is already
      // full-screen. Claiming that wheel restarted the 2→3 flight and
      // the paragraph never moved.
      const worldTop = document.querySelector('.world-model-section')?.getBoundingClientRect().top
      if (worldTop != null && worldTop <= 48) return false
      return Math.abs(rect.top) <= 12
        && window.scrollY >= crystalTravelRangePx() - 16
    }

    const isOnBlock2Stage = () => (
      isAtBlock2Viewport()
      && crystalLanded
      && enterProxy.value >= CONTENT_SETTLE_ENTER
    )

    const tryMarkSettled = () => {
      if (handoffOn || hasSettledOnBlock2) return
      if (!isOnBlock2Stage()) return
      if (pinProgress >= BLOCK24_HANDOFF_ARM) return
      if (performance.now() - lastMoveAt < SETTLE_QUIET_MS) return
      hasSettledOnBlock2 = true
    }

    const scheduleSettlePoll = () => {
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        tryMarkSettled()
        if (!hasSettledOnBlock2 && crystalLanded && !handoffOn) scheduleSettlePoll()
      }, 80)
    }

    const canArmHandoff = () => {
      if (!hasSettledOnBlock2) return false
      // A finished return from block three still leaves this flag set.
      // Resting on the cards must be able to leave again.
      if (isOnBlock2Stage() && pinProgress <= 0.92) return true
      if (!returningFromWorld) return false
      const worldTop = document.querySelector('.world-model-section')?.getBoundingClientRect().top
      return crystalLanded && enterProxy.value >= CONTENT_SETTLE_ENTER
        && worldTop != null && worldTop < window.innerHeight * 1.5
    }

    const reportVisibility = () => {
      onSectionVisibilityChangeRef.current?.(intersecting && crystalLanded)
    }

    const setCrystalLanded = (next, instant = false) => {
      if (crystalLanded === next) return
      crystalLanded = next
      // Section entrance never inherits the delay from a previous tab change.
      setCopyRevealDelay(0)
      setContentReady(false)
      reportVisibility()
      window.clearTimeout(settleTimer)
      if (!next) {
        contentSettledAt = Infinity
        hasSettledOnBlock2 = false
        queuedHandoff = false
      }
      enterTween?.kill()
      enterTween = gsap.to(enterProxy, {
        value: next ? 1 : 0,
        duration: reduceMotion || instant ? 0 : next ? BLOCK24_ENTRANCE_DURATION : 0.28,
        delay: reduceMotion || instant || !next ? 0 : CONTENT_REVEAL_DELAY,
        ease: next ? 'none' : 'power2.in',
        overwrite: true,
        onUpdate: () => {
          section.style.setProperty('--block24-enter-content', Math.min(1, Math.max(0, (enterProxy.value * BLOCK24_ENTRANCE_DURATION - 0.8) / 0.35)).toFixed(4))
          if (
            next
            && queuedHandoff
            && enterProxy.value >= CONTENT_SETTLE_ENTER
            && isAtBlock2Viewport()
          ) {
            queuedHandoff = false
            hasSettledOnBlock2 = true
            returningFromWorld = false
            setHandoff(true)
          }
        },
        onComplete: () => {
          section.style.setProperty('--block24-enter-content', Math.min(1, Math.max(0, (enterProxy.value * BLOCK24_ENTRANCE_DURATION - 0.8) / 0.35)).toFixed(4))
          if (next) {
            contentSettledAt = performance.now()
            setContentReady(true)
            // Once the editorial reveal has completed, the section is a
            // deterministic reading rest. Waiting for an additional quiet
            // scroll poll made the same gesture work on some devices and be
            // swallowed on others.
            hasSettledOnBlock2 = true
            lastMoveAt = performance.now() - SETTLE_QUIET_MS
          }
        },
      })
      if (next) scheduleSettlePoll()
    }

    const updateContentEnter = (instant = false) => {
      const blend = crystalHeroBlend()
      // Begin the reveal in the final approach, just before the section pins.
      const arrived = window.scrollY >= crystalTravelRangePx() - 64
      if (blend >= CONTENT_LAND_BLEND && arrived) setCrystalLanded(true, instant)
      else if (
        blend < CONTENT_UNLAND_BLEND
        && window.scrollY < crystalTravelRangePx() - 80
      ) {
        setCrystalLanded(false, instant)
      }
    }

    layoutSection()
    section.style.setProperty('--block24-exit-glass', '0')
    section.style.setProperty('--block24-exit-origin-y', `${layoutSection().crystalCenterY}px`)
    updateAnchor()
    section.style.setProperty('--block24-enter-content', '0')
    updateContentEnter(true)
    const pinRestY = () => crystalTravelRangePx()

    // Hold the pin at its start until the reader has actually settled.
    // Doing this here, instead of with ScrollTrigger snap, keeps a second
    // scroll tween from fighting the 2→3 flight and stalling or aborting it.
    let correctingPin = false
    const clampUnsettledPin = () => {
      if (handoffOn || returningFromWorld || hasSettledOnBlock2) return false
      const start = pinRestY()
      const end = start + window.innerHeight
      if (window.scrollY <= start + 1 || window.scrollY > end + 48) return false
      correctingPin = true
      window.scrollTo(0, start)
      correctingPin = false
      return true
    }

    const handleScroll = () => {
      if (correctingPin) return
      // The flight tween is the only thing allowed to move the page.
      // A one-frame dip used to look like a reverse gesture and cancel it.
      if (handoffOn && handoffScrollTween?.isActive()) {
        lastScrollY = window.scrollY
        updateAnchor()
        updateContentEnter()
        return
      }
      if (clampUnsettledPin()) {
        lastScrollY = window.scrollY
        updateAnchor()
        updateContentEnter()
        tryMarkSettled()
        return
      }
      noteMovement()
      // On a reverse pass the world pane can uncover block two before the
      // pin's onEnterBack fires. Restore its editorial in that first frame,
      // otherwise the user sees a blank white stage with only the crystal.
      const world = document.querySelector('.world-model-section')
      const worldTop = world?.getBoundingClientRect().top
      const movingUp = window.scrollY < lastScrollY - 24
      lastScrollY = window.scrollY
      if (movingUp && worldTop > 0 && worldTop < window.innerHeight * 1.5) {
        returningFromWorld = true
        hasSettledOnBlock2 = true
      }
      // Only restore the cards once the world pane has actually left.
      // Doing it at 10% overlap flashed the editorial over the colour field.
      if (
        movingUp
        && handoffOn
        && !maskState.collapsing
        && worldTop > window.innerHeight * 0.72
      ) {
        returningFromWorld = true
        hasSettledOnBlock2 = true
        killScrollSnaps()
        setHandoff(false)
      }
      updateAnchor()
      updateContentEnter()
      tryMarkSettled()
    }
    const handleResize = () => {
      const layout = layoutSection()
      section.style.setProperty('--block24-exit-origin-y', `${layout.crystalCenterY}px`)
      updateAnchor()
      updateContentEnter()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(handleResize)
      : null
    resizeObserver?.observe(section)

    let observer
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          intersecting = entry.isIntersecting && entry.intersectionRatio >= 0.08
          setIsVisible(intersecting)
          reportVisibility()
        },
        { threshold: [0, 0.08, 0.2] },
      )
      observer.observe(section)
    }

    const pinTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: PIN_SCROLL_DISTANCE,
      pin: true,
      // Block 3 rides up behind this opaque pane, the same way this
      // section rides behind the hero. One viewport of pin, then a
      // committed flick eases the world pane into place.
      pinSpacing: false,
      invalidateOnRefresh: true,
      // Without this there's a single frame, right as the trigger crosses
      // its start point, where the section hasn't switched to fixed
      // positioning yet — visible as a hairline seam at the section edge.
      anticipatePin: 1,
      onUpdate: (self) => {
        pinProgress = self.progress
        noteMovement()
        tryMarkSettled()
        // Pin end is block 3's rest. Restore the cards only once the
        // world pane has actually given way and the editorial fills
        // the screen again.
        if (returningFromWorld && handoffOn && self.progress <= 0.08 && !maskState.collapsing) {
          killScrollSnaps()
          setHandoff(false)
        }
        if (!returningFromWorld
          && canArmHandoff() && self.progress >= BLOCK24_HANDOFF_ARM) {
          setHandoff(true)
        }
        updateAnchor()
        updateContentEnter()
      },
      onEnter: () => { returningFromWorld = false },
      onEnterBack: () => {
        if (handoffScrollTween?.isActive()) return
        returningFromWorld = true
        hasSettledOnBlock2 = true
      },
      onLeaveBack: () => {
        returningFromWorld = false
        setHandoff(false, true)
      },
    })

    const commitHandoffFromGesture = (event) => {
      if (handoffOn) {
        if (handoffScrollTween?.isActive()) event.preventDefault()
        return true
      }
      if (!canArmHandoff()) return false
      event.preventDefault()
      setHandoff(true)
      return true
    }

    const handleWheel = (event) => {
      const now = performance.now()
      const continuing = now - lastWheelAt < 320
      const freshGesture = !continuing
      // Track the full wheel burst, including packets received just before
      // block two reaches its pin. This distinguishes arrival momentum from
      // the reader's next deliberate gesture.
      lastWheelAt = now
      if (event.deltaY < 0 && now < returnHoldUntil) {
        event.preventDefault()
        // Momentum keeps the hold alive; a fresh gesture after it ends works.
        if (continuing) returnHoldUntil = Math.max(returnHoldUntil, now + 200)
        return
      }
      // v4: between the flick and the start of the page flight (cards
      // fading, crystal centring) the page must not move at all —
      // trackpad momentum used to scroll the cards up here.
      if (handoffOn && flightPending) {
        event.preventDefault()
        return
      }
      if (handoffOn && handoffScrollTween?.isActive()) {
        if (event.deltaY >= 0 || continuing || event.deltaY > -80) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        handoffScrollTween.kill()
        returningFromWorld = true
        setHandoff(false)
        playHandoffScroll(false)
        return
      }
      // Already on block 3: do not touch the wheel. The colour-field
      // copy rolls on native scroll from here.
      if (handoffOn) return
      if (event.deltaY <= 1) return
      if (!isAtBlock2Viewport()) return
      event.preventDefault()
      // Never let native scroll expose the seam while the crystal/content
      // is still landing. Once the reveal has visibly started, remember the
      // deliberate gesture and launch as soon as the stage is readable.
      if (!crystalLanded || enterProxy.value < 0.15) {
        if (freshGesture) queuedHandoff = true
        return
      }
      if (!isOnBlock2Stage()) {
        if (freshGesture) queuedHandoff = true
        return
      }
      // Reaching the readable reveal threshold is already a stable rest.
      // Do not consume a deliberate flick merely because the quiet timer
      // has not fired yet; that was the intermittent “brake” before block 3.
      if (!hasSettledOnBlock2) {
        hasSettledOnBlock2 = true
      }
      // Do not require an endless quiet gap once the screen is fully settled.
      if (!freshGesture && now - contentSettledAt < 350) return
      returningFromWorld = false
      queuedHandoff = false
      setHandoff(true)
    }

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat) return
      if (['PageUp', 'ArrowUp', 'Home'].includes(event.key)
        && handoffOn && handoffScrollTween?.isActive()) {
        handoffScrollTween.kill()
        setHandoff(false)
        return
      }
      if (!['PageDown', ' ', 'Spacebar', 'ArrowDown'].includes(event.key)) return
      commitHandoffFromGesture(event)
    }

    // v4 band transition: coming back from block three, the stage (cards,
    // copy, the list on the left) and the crystal always come down to their
    // places with the sinking band — whatever state the handoff flags are
    // in. Relying on setHandoff(false) alone left them parked above the
    // screen whenever that call was a no-op.
    const bringStageBack = () => {
      if (!BAND_TRANSITION) return
      contentExitTween?.kill()
      handoffDelays.forEach((call) => call.kill())
      handoffDelays = []
      flightPending = false
      section.style.setProperty('--block24-exit-content', '0')
      enterProxy.value = 1
      section.style.setProperty('--block24-enter-content', '1')
      setIsExiting(false)
      contentExitTween = gsap.to(exitFade, {
        value: 0,
        duration: BAND_STRETCH + BAND_PEEK * 0.5,
        ease: 'power3.inOut',
        overwrite: true,
        onUpdate: () => {
          section.style.setProperty('--block24-exit-scroll', exitFade.value.toFixed(4))
          updateAnchor()
        },
        onComplete: () => {
          section.style.setProperty('--block24-exit-scroll', '0')
          updateAnchor()
        },
      })
    }

    const onReturnedHome = (event) => {
      // A return invalidates every pending completion from the previous
      // forward flight, even if handoffOn was already cleared by the pin.
      handoffDelays.forEach(call => call.kill())
      handoffDelays = []
      flightPending = false
      handoffScrollTween?.kill()
      contentExitTween?.kill()
      // v4: back on block two from three — upward scrolling is held for a
      // moment, so one long flick cannot carry on straight to the hero.
      returnHoldUntil = performance.now() + RETURN_HOLD_MS
      lastMoveAt = performance.now() - 500
      hasSettledOnBlock2 = true
      returningFromWorld = true
      queuedHandoff = false
      if (event?.detail?.instant) {
        // v5: back from block three by a plain scroll — block two is
        // already at rest: cards shown, crystal on its seat.
        setHandoff(false, true)
        enterProxy.value = 1
        section.style.setProperty('--block24-enter-content', '1')
        crystalLanded = true
        setContentReady(true)
        return
      }
      setHandoff(false)
      bringStageBack()
      crystalLanded = true
      setContentReady(true)
    }
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    window.addEventListener('keydown', handleKeyDown)
    // Native/anchor re-entry must use the same descent as a wheel gesture.
    const replayHandoff = () => {
      if (flightPending || maskState.collapsing) return
      killScrollSnaps()
      setHandoff(false, true)
      window.scrollTo({ top: crystalTravelRangePx() + 2, behavior: 'instant' })
      returningFromWorld = false
      hasSettledOnBlock2 = true
      updateAnchor()
      setHandoff(true)
    }
    window.addEventListener('42ai-block24-replay-handoff', replayHandoff)
    window.addEventListener(BLOCK24_RETURN_EVENT, onReturnedHome)

    // The world-model trigger is created earlier, before this pin spacer
    // exists. Refresh now so its start/end include the spacer; otherwise
    // the 2→3 flight stops inside this pin and the first paragraph is
    // already past by the time block three is on screen.
    ScrollTrigger.refresh()
    // Same reasoning as heroTransition.js's own refresh: on first mount the
    // section can still measure 0 height for one frame, which would pin it
    // at zero size instead of a real viewport's worth.
    requestAnimationFrame(() => ScrollTrigger.refresh())

    return () => {
      enterTween?.kill()
      handoffTween?.kill()
      handoffScrollTween?.kill()
      window.clearTimeout(settleTimer)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('42ai-world-mask-ready', onMaskReady)
      window.removeEventListener('wheel', handleWheel, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(BLOCK24_RETURN_EVENT, onReturnedHome)
      window.removeEventListener('42ai-block24-replay-handoff', replayHandoff)
      resizeObserver?.disconnect()
      observer?.disconnect()
      pinTrigger.kill()
      onSectionVisibilityChangeRef.current?.(false)
    }
  }, [nativeScroll])

  // v4: decode every slide photo ahead of time, so the first card swap
  // never waits on a fresh decode while the current photo is hidden.
  useEffect(() => {
    if (!heroReady) return
    let cancelled = false
    const images = SLIDES.map(slide => {
      const image = new Image()
      image.src = slide.image
      return image.decode().catch(() => {})
    })
    // Include the page's mounted static imagery before opening the video stage.
    images.push(...Array.from(document.images, image => image.decode().catch(() => {})))
    Promise.allSettled(images).then(() => { if (!cancelled) onImagesReady?.() })
    return () => { cancelled = true }
  }, [heroReady, onImagesReady])

  const activeSlide = SLIDES[activeIndex]
  const copySlide = SLIDES[copyIndex]

  const tabCycleCenter = Math.floor(wheelTargetRef.current / SLIDES.length)
  const virtualTabs = [-1, 0, 1].flatMap((cycleOffset) => {
    const cycle = tabCycleCenter + cycleOffset
    return SLIDES.map((slide, index) => ({
      slide,
      index,
      virtualSlot: cycle * SLIDES.length + index,
    }))
  })

  const selectSlide = (
    index,
    automatic = false,
    directionHint = null,
    wheelStepOverride = null,
  ) => {
    const now = window.performance.now()
    if (flightRef.current) return
    if (automatic && now - lastAdvanceAtRef.current < AUTOPLAY_MIN_GAP) return
    const currentIndex = activeIndexRef.current
    const nextIndex = (index + SLIDES.length) % SLIDES.length
    if (nextIndex === currentIndex) return
    lastAdvanceAtRef.current = now
    const step = nextIndex - currentIndex
    const direction = directionHint || (step >= 0 ? 'next' : 'previous')
    const wheelStep = wheelStepOverride ?? (
      directionHint ? (direction === 'next' ? 1 : -1) : step
    )
    wheelTargetRef.current += wheelStep
    activeIndexRef.current = nextIndex
    setCopyRevealDelay(150)
    setCopyIndex(nextIndex)
    const nextFlight = {
      id: now + 150,
      direction,
      outgoing: currentIndex,
    }
    flightRef.current = nextFlight
    setFlight(nextFlight)
    setActiveIndex(nextIndex)
    onCrystalPulseRef.current?.()
  }

  const moveBy = (direction, automatic = false) => {
    selectSlide(
      activeIndexRef.current + direction,
      automatic,
      direction >= 0 ? 'next' : 'previous',
    )
  }

  // Vertical wheel gestures belong to page navigation, including over the rail.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wheel = { value: wheelValueRef.current }
    const render = () => {
      wheelValueRef.current = wheel.value
      section.style.setProperty('--tab-index', wheel.value.toFixed(4))
      section.querySelectorAll('.block24-section__tab').forEach((el) => {
        const slot = Number(el.dataset.tabSlot)
        const delta = slot - wheel.value
        const distance = Math.abs(delta)
        const windowFade = Math.min(1, Math.max(0, (3.45 - distance) / 0.4))
        el.style.transform = `translateY(calc(-50% + ${delta * TAB_ROW_HEIGHT}px * var(--block24-scale)))`
        el.classList.toggle('is-front', distance < 0.45)
        el.style.opacity = windowFade.toFixed(3)
        el.style.pointerEvents = windowFade < 0.35 ? 'none' : 'auto'
        el.style.filter = distance < 1.35
          ? 'none'
          : `blur(${Math.min((distance - 1.35) * 0.45, 0.9).toFixed(2)}px)`
      })
    }
    render()
    const tween = gsap.to(wheel, {
      value: wheelTargetRef.current,
      duration: reduceMotion ? 0 : 0.72,
      ease: 'power3.out',
      onUpdate: render,
      onComplete: render,
    })
    return () => tween.kill()
  }, [activeIndex])

  // Tablet strip (Figma 479:8839): keep the active industry on the centre
  // axis, gliding to it as the slides advance.
  useEffect(() => {
    const strip = tabletTabsRef.current
    if (!strip) return
    const center = () => {
      const tab = strip.children[activeIndex]
      if (!tab || strip.offsetParent === null) return
      strip.scrollTo({
        left: tab.offsetLeft + tab.offsetWidth / 2 - strip.clientWidth / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
    center()
    const resize = new ResizeObserver(center)
    resize.observe(strip)
    return () => resize.disconnect()
  }, [activeIndex])

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section || !flight) return undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      section.style.setProperty('--block24-card-motion', '0')
      flightRef.current = null
      setFlight((current) => (current?.id === flight.id ? null : current))
    }

    if (reduceMotion) {
      finish()
      return undefined
    }

    const edgeMotion = { progress: 0 }
    const renderEdgeMotion = () => {
      const progress = edgeMotion.progress
      // This matches the WebGL rail's middle phase exactly. The old photo is
      // already gone before the bend starts, and the incoming photo remains
      // hidden until the bend has completely returned to rest.
      const deformationProgress = Math.min(1, Math.max(0, (
        progress - BLOCK24_CARD_PHASES.transitionStart
      ) / (
        BLOCK24_CARD_PHASES.transitionEnd
        - BLOCK24_CARD_PHASES.transitionStart
      )))
      const motion = progress >= BLOCK24_CARD_PHASES.transitionStart
        && progress < BLOCK24_CARD_PHASES.transitionEnd
        ? Math.sin(Math.PI * deformationProgress) ** 1.12
        : 0
      section.style.setProperty('--block24-card-motion', motion.toFixed(4))
    }
    section.style.setProperty('--block24-card-motion', '0')

    const timeline = gsap.timeline({ delay: Math.max(0, (flight.id - performance.now()) / 1000), onComplete: finish })
    // One WebGL surface owns each photograph and caption for its entire life.
    // This timeline only drives the seam; there is no DOM image handoff.
    timeline.to(edgeMotion, {
      progress: 1,
      duration: BLOCK24_CARD_TRANSITION_DURATION,
      ease: 'none',
      onUpdate: renderEdgeMotion,
    }, 0)

    return () => {
      timeline.kill()
      section.style.setProperty('--block24-card-motion', '0')
    }
  }, [flight])

  // A timeout (rather than a permanent interval) means every manual click
  // grants the current story a full reading period before autoplay resumes.
  useEffect(() => {
    if (!isVisible || !contentReady || isExiting || flight) return undefined
    const delay = lastAdvanceAtRef.current === 0
      ? INITIAL_AUTOPLAY_DELAY
      : AUTOPLAY_DELAY
    const rings = autoplayProgress ? [...sectionRef.current.querySelectorAll('.autoplay-ring__progress')] : []
    // The exact same clock owns the visible ring and the next-card timeout.
    // No React updates or permanent animation-frame loop are needed.
    const animations = rings.map(ring => ring.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: delay, easing: 'linear', fill: 'forwards' },
    ))
    const timeout = window.setTimeout(() => moveBy(1, true), delay)
    return () => { window.clearTimeout(timeout); animations.forEach(animation => animation.cancel()) }
  }, [activeIndex, contentReady, flight, isExiting, isVisible, autoplayProgress])

  return (
    <section
      id="behavioral-solutions"
      ref={sectionRef}
      className={`block24-section${contentReady ? ' block24-section--content-ready' : ''}${isExiting ? ' block24-section--exiting' : ''}${flight ? ' block24-section--card-flight' : ''}`}
      aria-label="42AI solutions carousel"
      style={{ '--block24-page-background': backgroundColor }}
    >
      <button
        className="block24-section__crystal-switch"
        type="button"
        disabled={isExiting || !contentReady || Boolean(flight)}
        onClick={() => moveBy(1)}
        aria-label="Show next solution"
      />

      <div className="block24-section__stage">
        <div ref={tabletTabsRef} className="block24-section__tablet-tabs" role="tablist" aria-label="Solution industries">
          {SLIDES.map((slide, index) => (
            <button key={slide.id} type="button" role="tab" aria-selected={activeIndex === index}
              disabled={isExiting || !contentReady || Boolean(flight)}
              onClick={() => selectSlide(index, false, index >= activeIndex ? 'next' : 'previous')}>
              <ScrambleText text={slide.tab} />
              {autoplayProgress && activeIndex === index && <AutoplayRing />}
            </button>
          ))}
        </div>
        <div
          className="block24-section__tabs"
          role="listbox"
          aria-label="Industries"
        >
          <div className="block24-section__tabs-drum">
            {virtualTabs.map(({ slide, index, virtualSlot }) => {
              const isActiveVirtual = virtualSlot === wheelTargetRef.current
              return (
              <button
                key={`${virtualSlot}-${slide.id}`}
                type="button"
                role="option"
                data-tab-slot={virtualSlot}
                className={`block24-section__tab${isActiveVirtual ? ' is-front' : ''}`}
                aria-selected={isActiveVirtual}
                tabIndex={Math.abs(virtualSlot - wheelTargetRef.current) <= 4 ? 0 : -1}
                disabled={isExiting || !contentReady}
                onClick={() => {
                  const wheelStep = virtualSlot - wheelTargetRef.current
                  selectSlide(
                    index,
                    false,
                    wheelStep >= 0 ? 'next' : 'previous',
                    wheelStep,
                  )
                }}
              >
                {slide.tab}
                {autoplayProgress && isActiveVirtual && <AutoplayRing />}
              </button>
              )
            })}
          </div>
        </div>

        <div className="block24-section__hero">
          <span className="block24-section__sr-copy">Built for {activeSlide.tab}</span>
          <button
            className="block24-section__glass"
            type="button"
            disabled={isExiting || !contentReady || Boolean(flight)}
            onClick={() => moveBy(1)}
            aria-label="Show next solution"
          >
            <svg viewBox="0 0 6 10" aria-hidden="true">
              <path d="M1 1.2 L4.7 5 L1 8.8" />
            </svg>
          </button>
        </div>

        <PhotoRail3D
          slides={SLIDES}
          activeIndex={activeIndex}
          flight={flight}
          ready={heroReady}
          visible={isVisible && (nativeScroll || !isExiting)}
          entranceRef={entranceRef}
        />

        <div className="block24-section__contact-glass" aria-hidden="true" />
        {/* The gradient cards on the rail are clickable: the nearer one
            becomes the next slide, the farther one skips ahead two. */}
        {[1, 2].map((offset) => (
          <button
            key={offset}
            type="button"
            className={`block24-section__rail-hit block24-section__rail-hit--${offset}`}
            disabled={isExiting || !contentReady || Boolean(flight)}
            onClick={() => selectSlide(activeIndex + offset, false, 'next', offset)}
            aria-label={`Show ${SLIDES[(activeIndex + offset) % SLIDES.length].tab}`}
          />
        ))}
        {/* Figma 450:7343: frosted white fade over the rail's right edge. */}
        <div className="block24-section__edge-frost" aria-hidden="true" />

        <div
          key={copySlide.id}
          className="block24-section__copy"
        >
          <p className="block24-section__category">Product application</p>
          <AnimatedHeading as="h2" reveal="lines" delayMs={copyRevealDelay} maxDurationMs={1200} className="block24-section__title">{copySlide.title.split('\n').map((line, i) => <span className="block24-section__authored-line" key={i}>{line}</span>)}</AnimatedHeading>
          <RequestDemoButton
            className="block24-section__more"
            widen={-9}
            label="Learn more"
            href="#applications"
            preserveCase
            fit="stretch"
          />
        </div>
      </div>
    </section>
  )
}
