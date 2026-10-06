import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { smootherstep } from '../HeroScene/scrollShrink.js'
import { WORLD_MODEL_ABSORBED_EVENT, WORLD_MODEL_RETURN_EVENT } from '../WorldModelSection/worldModelHandoff.js'
import './physicsBehaviorSection.css'

gsap.registerPlugin(ScrollTrigger)

const clamp01 = (value) => Math.min(1, Math.max(0, value))
// The two final camera beats extend the section from 720 to 900svh. Scale the
// authored timeline by the same factor so every already-approved 2→3→4 pose
// keeps exactly the same physical scroll distance and only the continuation
// is appended after the fourth facet state.
const TIMELINE_SCALE = (27 / 13) * (900 / 720)
const STATE_SEQUENCE_START = 0.47 / TIMELINE_SCALE
const MAX_STATE_PROGRESS_PER_SECOND = 0.42
const MAX_STATE_REVERSE_PER_SECOND = 0.48
const INTRO_REST = 0.44 / TIMELINE_SCALE
const STATE_ONE_REST = 0.80 / TIMELINE_SCALE
const STATE_TWO_REST = 1.29 / TIMELINE_SCALE
const STATE_THREE_REST = 1.69 / TIMELINE_SCALE
const STATE_FOUR_REST = 2.0 / TIMELINE_SCALE
const CLEAN_FRAME_REST = 2.14 / TIMELINE_SCALE
const PORTAL_REST = 2.5 / TIMELINE_SCALE
const STATE_RESTS = [
  INTRO_REST,
  STATE_ONE_REST,
  STATE_TWO_REST,
  STATE_THREE_REST,
  STATE_FOUR_REST,
  CLEAN_FRAME_REST,
  PORTAL_REST,
]
const STATE_GLIDE_DURATION = 0.58
const WHEEL_GESTURE_GAP = 180

// Figma 450:6576. Coordinates live inside the 1280×720 rounded panel.
// They are intentionally faint in the transition frame; the real block-five
// section takes over the same field once the block-four sticky releases.
const PORTAL_DOTS = [
  [173.113, 234.994], [214.578, 193.917], [272.39, 256.199],
  [193.359, 307.935], [361.306, 356.079], [952.398, 175],
  [134, 369.754], [785, 292.07], [241.361, 363.189],
  [294.287, 206.182], [320.275, 313.952], [188.436, 438.137],
  [887.984, 292.07], [1004.234, 349.512], [823.703, 366.473],
  [868.836, 225.875], [916.844, 396.012], [973.188, 259.246],
  [358.224, 195.684],
]

/**
 * Block four opens with its original title + large lower crystal composition.
 * The shared crystal then moves to the viewport centre for the four stepped
 * Figma facet states. The same playhead is reversible all the way back through
 * the intro and into the block-three/block-two hand-off.
 */
export default function PhysicsBehaviorSection({
  onCrystalAnchor,
  onSectionVisibilityChange,
}) {
  const sectionRef = useRef(null)
  const panelRef = useRef(null)
  const copyRef = useRef(null)
  const onCrystalAnchorRef = useRef(onCrystalAnchor)
  const onSectionVisibilityChangeRef = useRef(onSectionVisibilityChange)
  onCrystalAnchorRef.current = onCrystalAnchor
  onSectionVisibilityChangeRef.current = onSectionVisibilityChange

  useEffect(() => {
    const section = sectionRef.current
    const panel = panelRef.current
    const copy = copyRef.current
    if (!section || !panel || !copy) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const descentEase = gsap.parseEase('power3.inOut')
    let progress = reduceMotion ? 1 : 0
    let reveal = reduceMotion ? 1 : 0
    let descent = reduceMotion ? 1 : 0
    let focus = reduceMotion ? 1 : 0
    let stateOne = 0
    let stateTwo = 0
    let stateThree = 0
    let stateFour = reduceMotion ? 1 : 0
    let cleanFrame = reduceMotion ? 1 : 0
    let portal = reduceMotion ? 1 : 0
    let autoArrival = reduceMotion ? 1 : 0
    let snapSuspended = false
    const arrivalProxy = { value: autoArrival }
    let arrivalTween
    let targetProgress = progress
    let progressRaf = 0
    let previousFrameTime = window.performance.now()
    let stateScrollTween
    let stateGlideActive = false
    let lastWheelAt = 0

    const updateAnchor = () => {
      const rect = section.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()
      const copyRect = copy.getBoundingClientRect()
      // Keep the original introductory composition: the title has the upper
      // half of the viewport and the large, whole crystal sits low enough to
      // be deliberately cropped by the bottom edge.
      const crystalHalfHeight = panelRect.height * 0.42
      const minimumGap = Math.max(36, panelRect.height * 0.04)
      // The intro copy is viewport-fixed, so its bottom is already in the
      // same screen coordinate system as the travelling crystal. Keeping
      // this independent of the rising panel lets the automatic arrival
      // reach the final low position without waiting for more scroll.
      const copyBottomAtRest = copyRect.bottom
      const clearOfCopyY = copyBottomAtRest + minimumGap + crystalHalfHeight
      const restingY = Math.min(
        panelRect.height * 1.16,
        Math.max(window.innerHeight * 0.81, clearOfCopyY),
      )
      onCrystalAnchorRef.current?.(
        panelRect.left + panelRect.width / 2,
        restingY,
        {
          sectionTop: rect.top,
          sectionBottom: rect.bottom,
          progress,
          reveal,
          descent,
          focus,
          stateOne,
          stateTwo,
          stateThree,
          stateFour,
          cleanFrame,
          portal,
        },
      )
    }

    const writeProgress = (value) => {
      progress = value
      const timeline = value * TIMELINE_SCALE
      // The scaled timeline preserves the cadence from the original
      // 380svh version. Reveal/descent deliberately wait until block three
      // dissolves to white and the small crystal holds at centre.
      const scrollReveal = smootherstep(clamp01((timeline - 0.235) / 0.025))
      const automaticReveal = smootherstep(clamp01(autoArrival / 0.22))
      reveal = Math.max(scrollReveal, automaticReveal)
      // A pronounced ease-in-out: once the white panel fills the viewport,
      // the crystal leaves the centre gently,
      // gains speed through the middle, then brakes into the lower dock.
      // Scale uses this same value in PageCrystal, so growth and travel
      // remain one continuous gesture.
      const scrollDescent = descentEase(clamp01((timeline - 0.265) / 0.105))
      descent = Math.max(scrollDescent, autoArrival)

      // Once the introductory frame has been read, the virtual camera moves
      // into the four-state sequence and the crystal settles at viewport
      // centre. Every authored state now takes two of the former physical
      // scroll beats, leaving time to read both the facet and its copy.
      focus = descentEase(clamp01((timeline - 0.47) / 0.10))
      stateOne = descentEase(clamp01((timeline - 0.52) / 0.14))
      stateTwo = descentEase(clamp01((timeline - 0.92) / 0.14))
      stateThree = descentEase(clamp01((timeline - 1.32) / 0.14))
      stateFour = descentEase(clamp01((timeline - 1.72) / 0.14))
      cleanFrame = descentEase(clamp01((timeline - 2.0) / 0.13))
      portal = descentEase(clamp01((timeline - 2.17) / 0.28))

      const scrollIntroCopy = smootherstep(clamp01((timeline - 0.365) / 0.045))
      // `autoArrival` is the same time-based landing that moves and grows
      // the crystal. Releasing the intro copy from its final braking means
      // the text appears on its own as soon as the crystal is in place —
      // no extra wheel/trackpad input is required.
      const automaticIntroCopy = smootherstep(clamp01((autoArrival - 0.88) / 0.12))
      const introCopy = Math.max(scrollIntroCopy, automaticIntroCopy)
        * (1 - smootherstep(clamp01((timeline - 0.475) / 0.05)))
      const stateOneCopy = smootherstep(clamp01((timeline - 0.585) / 0.065))
        * (1 - smootherstep(clamp01((timeline - 0.86) / 0.08)))
      const stateTwoCopy = smootherstep(clamp01((timeline - 0.985) / 0.065))
        * (1 - smootherstep(clamp01((timeline - 1.33) / 0.08)))
      const stateThreeCopy = smootherstep(clamp01((timeline - 1.385) / 0.065))
        * (1 - smootherstep(clamp01((timeline - 1.73) / 0.08)))
      const cleanCopyExit = 1 - smootherstep(clamp01((timeline - 2.0) / 0.10))
      const stateFourCopy = smootherstep(clamp01((timeline - 1.785) / 0.065))
        * cleanCopyExit
      const stateOneRail = smootherstep(clamp01((timeline - 0.52) / 0.08))
        * (1 - smootherstep(clamp01((timeline - 0.92) / 0.08)))
      const stateTwoRail = smootherstep(clamp01((timeline - 0.92) / 0.08))
        * (1 - smootherstep(clamp01((timeline - 1.32) / 0.08)))
      const stateThreeRail = smootherstep(clamp01((timeline - 1.32) / 0.08))
        * (1 - smootherstep(clamp01((timeline - 1.72) / 0.08)))
      const stateFourRail = smootherstep(clamp01((timeline - 1.72) / 0.08))
        * cleanCopyExit
      const portalField = smootherstep(clamp01((portal - 0.34) / 0.58))
      section.style.setProperty('--physics-reveal', reveal.toFixed(4))
      section.style.setProperty('--physics-descent', descent.toFixed(4))
      section.style.setProperty('--physics-focus', focus.toFixed(4))
      section.style.setProperty('--physics-state-one', stateOne.toFixed(4))
      section.style.setProperty('--physics-state-two', stateTwo.toFixed(4))
      section.style.setProperty('--physics-state-three', stateThree.toFixed(4))
      section.style.setProperty('--physics-state-four', stateFour.toFixed(4))
      section.style.setProperty('--physics-clean-frame', cleanFrame.toFixed(4))
      section.style.setProperty('--physics-portal', portal.toFixed(4))
      section.style.setProperty('--physics-portal-field', portalField.toFixed(4))
      section.style.setProperty('--physics-portal-scale', (0.72 + portalField * 0.28).toFixed(4))
      section.style.setProperty('--physics-portal-blur', `${((1 - portalField) * 18).toFixed(2)}px`)
      section.style.setProperty('--physics-copy', introCopy.toFixed(4))
      section.style.setProperty('--physics-state-one-copy', stateOneCopy.toFixed(4))
      section.style.setProperty('--physics-state-two-copy', stateTwoCopy.toFixed(4))
      section.style.setProperty('--physics-state-three-copy', stateThreeCopy.toFixed(4))
      section.style.setProperty('--physics-state-four-copy', stateFourCopy.toFixed(4))
      section.style.setProperty('--physics-state-one-rail', stateOneRail.toFixed(4))
      section.style.setProperty('--physics-state-two-rail', stateTwoRail.toFixed(4))
      section.style.setProperty('--physics-state-three-rail', stateThreeRail.toFixed(4))
      section.style.setProperty('--physics-state-four-rail', stateFourRail.toFixed(4))
      section.style.setProperty('--physics-state-one-offset', `${((1 - stateOneCopy) * 28).toFixed(2)}px`)
      section.style.setProperty('--physics-state-two-offset', `${((1 - stateTwoCopy) * -28).toFixed(2)}px`)
      section.style.setProperty('--physics-state-three-offset', `${((1 - stateThreeCopy) * 28).toFixed(2)}px`)
      section.style.setProperty('--physics-state-four-offset', `${((1 - stateFourCopy) * -28).toFixed(2)}px`)
      updateAnchor()
    }

    const setAutomaticArrival = (next, instant = false) => {
      arrivalTween?.kill()
      if (reduceMotion || instant) {
        arrivalProxy.value = next ? 1 : 0
        autoArrival = arrivalProxy.value
        writeProgress(progress)
        return
      }
      arrivalTween = gsap.to(arrivalProxy, {
        value: next ? 1 : 0,
        duration: next ? 0.64 : 0.32,
        ease: next ? 'power3.inOut' : 'power2.in',
        overwrite: true,
        onUpdate: () => {
          autoArrival = arrivalProxy.value
          writeProgress(progress)
        },
        onComplete: () => {
          autoArrival = arrivalProxy.value
          writeProgress(progress)
        },
      })
    }

    // Wheel and trackpad only pick a destination on the long scene
    // timeline. A time-based playhead then catches up, so a flick cannot
    // scrub every facet pose — each state still plays and remains readable.
    const settleProgress = (time) => {
      progressRaf = 0
      const delta = Math.min((time - previousFrameTime) / 1000, 0.05)
      previousFrameTime = time
      const follow = 1 - Math.exp(-6 * delta)
      const distance = targetProgress - progress
      let step = distance * follow
      if (progress >= STATE_SEQUENCE_START) {
        const maxRate = distance >= 0
          ? MAX_STATE_PROGRESS_PER_SECOND
          : MAX_STATE_REVERSE_PER_SECOND
        const maxStep = maxRate * delta
        step = Math.min(maxStep, Math.max(-maxStep, step))
      }
      progress += step
      if (Math.abs(targetProgress - progress) < 0.0001) progress = targetProgress
      writeProgress(progress)
      if (progress !== targetProgress) {
        progressRaf = window.requestAnimationFrame(settleProgress)
      }
    }

    const moveTimelineTo = (value, immediate = false) => {
      targetProgress = value
      if (reduceMotion || immediate) {
        progress = value
        writeProgress(progress)
        return
      }
      if (!progressRaf) {
        previousFrameTime = window.performance.now()
        progressRaf = window.requestAnimationFrame(settleProgress)
      }
    }

    const nearestRestIndex = (value) => {
      let bestIndex = 0
      let bestDistance = Infinity
      STATE_RESTS.forEach((rest, index) => {
        const distance = Math.abs(rest - value)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      })
      return bestIndex
    }

    const scrollYForRest = (rest) => {
      const sectionTop = section.getBoundingClientRect().top + window.scrollY
      return sectionTop - window.innerHeight + rest * section.offsetHeight
    }

    // One deliberate wheel/trackpad gesture advances exactly one authored
    // state and then coasts to its rest. Momentum packets from that same
    // gesture are consumed, so they cannot accidentally skip the next state.
    const handleStateWheel = (event) => {
      if (event.defaultPrevented || snapSuspended || Math.abs(event.deltaY) < 0.5) return
      const rect = section.getBoundingClientRect()
      if (rect.top > 2 || rect.bottom <= window.innerHeight) return

      const now = performance.now()
      const freshGesture = now - lastWheelAt > WHEEL_GESTURE_GAP
      lastWheelAt = now
      const currentIndex = nearestRestIndex(targetProgress)
      const direction = event.deltaY > 0 ? 1 : -1
      const nextIndex = currentIndex + direction

      // Release the wheel at the two outer edges: up from the intro returns
      // to block three, down from the final facet continues to block five.
      if ((!stateGlideActive && freshGesture)
        && (nextIndex < 0 || nextIndex >= STATE_RESTS.length)) return

      event.preventDefault()
      if (stateGlideActive || !freshGesture) return

      const nextRest = STATE_RESTS[nextIndex]
      const destination = scrollYForRest(nextRest)
      const proxy = { y: window.scrollY }
      stateScrollTween?.kill()
      stateGlideActive = true
      moveTimelineTo(nextRest)
      stateScrollTween = gsap.to(proxy, {
        y: destination,
        duration: reduceMotion ? 0 : STATE_GLIDE_DURATION,
        ease: 'power3.inOut',
        overwrite: true,
        onUpdate: () => window.scrollTo(0, proxy.y),
        onComplete: () => {
          window.scrollTo(0, destination)
          stateGlideActive = false
        },
      })
    }

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom bottom',
      snap: {
        snapTo: (value) => {
          if (snapSuspended || stateGlideActive) return value
          if (autoArrival < 0.98 && value < INTRO_REST + 0.02) return value
          if (value < 0.12) return value
          // The handoff lands with this pane filling the viewport, which
          // is below the intro rest. Snapping that landing forward yanks
          // the crystal after the arrival animation has already played.
          const landing = window.innerHeight / Math.max(1, section.offsetHeight)
          if (value <= landing + 0.015) return value
          if (value < INTRO_REST + 0.05) return INTRO_REST
          if (value >= STATE_ONE_REST - 0.05 && value < STATE_ONE_REST + 0.06) {
            return STATE_ONE_REST
          }
          if (value >= STATE_TWO_REST - 0.05 && value < STATE_TWO_REST + 0.06) {
            return STATE_TWO_REST
          }
          if (value >= STATE_THREE_REST - 0.05 && value < STATE_THREE_REST + 0.06) {
            return STATE_THREE_REST
          }
          if (value >= STATE_FOUR_REST - 0.05 && value < STATE_FOUR_REST + 0.045) {
            return STATE_FOUR_REST
          }
          if (value >= CLEAN_FRAME_REST - 0.045 && value < CLEAN_FRAME_REST + 0.05) {
            return CLEAN_FRAME_REST
          }
          if (value >= PORTAL_REST - 0.055) return PORTAL_REST
          return value
        },
        duration: { min: 0.4, max: 0.75 },
        delay: 0.06,
        ease: 'power3.inOut',
      },
      onEnter: () => {
        if (snapSuspended) return
        setAutomaticArrival(true)
      },
      onEnterBack: () => {
        if (snapSuspended) return
        setAutomaticArrival(true, true)
      },
      onLeaveBack: () => setAutomaticArrival(false),
      onUpdate: (self) => {
        if (snapSuspended) return
        moveTimelineTo(reduceMotion ? 1 : self.progress)
      },
      onRefresh: (self) => {
        if (snapSuspended) return
        moveTimelineTo(reduceMotion ? 1 : self.progress, true)
      },
    })

    const onWorldReturn = () => {
      snapSuspended = true
      stateScrollTween?.kill()
      stateGlideActive = false
      arrivalTween?.kill()
      setAutomaticArrival(false, true)
      // The reverse 4→3 hand-off takes ownership of the crystal immediately.
      // Reset the parked block-four playhead as well as the arrival tween;
      // otherwise its intro copy and large lower crystal remain frozen over
      // block two (and even the hero) while the page continues upward.
      window.cancelAnimationFrame(progressRaf)
      progressRaf = 0
      targetProgress = 0
      progress = 0
      writeProgress(0)
      gsap.killTweensOf(window)
      gsap.killTweensOf(document.documentElement)
      gsap.killTweensOf(document.body)
    }
    const onWorldAbsorbed = () => {
      snapSuspended = false
      // The wheel burst that launched block three's exit can still be
      // emitting momentum when block four becomes active. Mark it as the
      // current gesture so those trailing packets cannot skip the intro.
      lastWheelAt = performance.now()
      setAutomaticArrival(true)
    }
    window.addEventListener(WORLD_MODEL_RETURN_EVENT, onWorldReturn)
    window.addEventListener(WORLD_MODEL_ABSORBED_EVENT, onWorldAbsorbed)

    const observer = new IntersectionObserver(
      ([entry]) => {
        onSectionVisibilityChangeRef.current?.(
          entry.isIntersecting && entry.intersectionRatio >= 0.08,
        )
      },
      { threshold: [0, 0.08, 0.2] },
    )
    observer.observe(section)

    const handleResize = () => {
      updateAnchor()
      ScrollTrigger.refresh()
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('wheel', handleStateWheel, { passive: false, capture: true })
    writeProgress(progress)
    requestAnimationFrame(() => ScrollTrigger.refresh())

    return () => {
      trigger.kill()
      arrivalTween?.kill()
      stateScrollTween?.kill()
      window.cancelAnimationFrame(progressRaf)
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('wheel', handleStateWheel, { capture: true })
      window.removeEventListener(WORLD_MODEL_RETURN_EVENT, onWorldReturn)
      window.removeEventListener(WORLD_MODEL_ABSORBED_EVENT, onWorldAbsorbed)
      onSectionVisibilityChangeRef.current?.(false)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="technology"
      className="physics-behavior-section"
      aria-labelledby="physics-behavior-heading"
    >
      <div ref={panelRef} className="physics-behavior-section__sticky">
        <div ref={copyRef} className="physics-behavior-section__copy">
          <p className="physics-behavior-section__eyebrow">Technology</p>
          <h2 id="physics-behavior-heading">
            Modeling the physics that shape behavior.
          </h2>
          <p>
            Bringing together psychology, psychiatry, biology and neuroscience,
            we identified the foundational drivers of behavior - and build an AI
            that truly understands humans.
          </p>
        </div>

        <ol className="physics-behavior-section__state-rail" aria-label="Behavior model layers">
          <li className="physics-behavior-section__state-rail-item physics-behavior-section__state-rail-item--one">
            Foundational traits
          </li>
          <li className="physics-behavior-section__state-rail-item physics-behavior-section__state-rail-item--two">
            Personal interpretation
          </li>
          <li className="physics-behavior-section__state-rail-item physics-behavior-section__state-rail-item--three">
            Personal context
          </li>
          <li className="physics-behavior-section__state-rail-item physics-behavior-section__state-rail-item--four">
            The event
          </li>
        </ol>

        <article className="physics-behavior-section__state physics-behavior-section__state--one">
          <div>
            <h3>Foundational traits</h3>
            <p>
              Stable behavioral drivers that shape decision-making. They remain
              consistent over time.
            </p>
          </div>
        </article>

        <article className="physics-behavior-section__state physics-behavior-section__state--two">
          <div>
            <h3>Personal Interpretation</h3>
            <p>
              People react to their perception of events. The same event can mean
              different things.
            </p>
          </div>
        </article>

        <article className="physics-behavior-section__state physics-behavior-section__state--three">
          <div>
            <h3>Personal Context</h3>
            <p>
              Experience and environment shape how behavior is expressed. Context
              influences outcomes.
            </p>
          </div>
        </article>

        <article className="physics-behavior-section__state physics-behavior-section__state--four">
          <div>
            <h3>The Event</h3>
            <p>
              Stable behavioral drivers that shape decision-making. They remain
              consistent over time.
            </p>
          </div>
        </article>

        <div className="physics-behavior-section__portal" aria-hidden="true">
          {PORTAL_DOTS.map(([x, y], index) => (
            <span
              key={`${x}-${y}`}
              className="physics-behavior-section__portal-dot"
              style={{
                left: `${(x / 1280) * 100}%`,
                top: `${(y / 720) * 100}%`,
                '--portal-dot-delay': `${index % 5}`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
