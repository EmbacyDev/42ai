import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { crystalTravelRangePx, smootherstep } from '../HeroScene/scrollShrink.js'
import { BLOCK24_HANDOFF_EVENT, BLOCK24_RETURN_EVENT } from '../Block24Section/block24Layout.js'
import { WORLD_MODEL_ABSORBED_EVENT, WORLD_MODEL_RETURN_EVENT } from './worldModelHandoff.js'
import './worldModelSection.css'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

const HEAD_COPY = [
  'Our Behavioural World Model',
  'understands the underlying forces',
  'that shape behaviour.',
]

const TAIL_COPY = [
  'The result is intelligence that',
  'predicts behaviours of every individual',
  'human and agent, adapts to new situations,',
  'and knows exactly how to respond.',
]

const HEAD_CENTER_SLOT = 0
// One short gap below the first paragraph. The edge fade hides it while
// that paragraph is centred, so the next sentence sits close without
// being readable yet.
const TAIL_CENTER_SLOT = 8
const EXIT_START = 0.9
// The drop finishes, and the first paragraph starts in that same moment.
// It does not ride the opening.
const COLOUR_OPEN_DURATION = 0.46
const COPY_FADE_DURATION = 0.24
// A short beat on the gem, then light rushes at the camera, and the
// colour field opens out of that flash.
const FLASH_DELAY = 0.04
const FLASH_BURST = 0.22
// Landing sits at 0.22 of this section. The roll used to wait until 0.36,
// which was a long dead scroll after the field was already full. It now
// starts on the next gesture, over the same distance as before.
const TEXT_ROLL_START = 0.24
const TEXT_ROLL_SPAN = 0.34
// The paragraph finishes here. Everything after it is empty section, so
// the page never asks the reader to scrub that tail.
const TEXT_END = TEXT_ROLL_START + TEXT_ROLL_SPAN
const STUDIO_HANDOFF_DURATION = 0.5
const SUCTION_DURATION = 0.48
const TEXT_ROLL_DURATION = 0.78
const READING_GESTURE_GAP = 220
const studioEase = (t) => smootherstep(t)

function FillLines({ lines, centerSlot }) {
  const center = (lines.length - 1) / 2

  return lines.map((line, lineIndex) => (
    <span
      className="world-model-section__line"
      key={line}
      data-wheel-slot={centerSlot + lineIndex - center}
    >
      {line}
    </span>
  ))
}

const clamp01 = (value) => Math.min(1, Math.max(0, value))

// The reveal is deliberately much larger than the viewport. Its mask is
// an asymmetric cloud with a very long translucent falloff, so the viewer
// never sees a geometric perimeter. Must stay in sync with the mask stops
// in worldModelSection.css.
const DROP_CORE_SHARE = 0.46

/**
 * Figma Block 21 (13:764). The long scroll range keeps the full-screen
 * glass fixed while the crystal colour-field opens and both paragraphs
 * of the one text fill word by word. The pane does not unpin until the
 * last word is solid.
 */
export default function WorldModelSection({
  onCrystalAnchor,
  onSectionVisibilityChange,
}) {
  const sectionRef = useRef(null)
  const panelRef = useRef(null)
  const onCrystalAnchorRef = useRef(onCrystalAnchor)
  const onSectionVisibilityChangeRef = useRef(onSectionVisibilityChange)
  onCrystalAnchorRef.current = onCrystalAnchor
  onSectionVisibilityChangeRef.current = onSectionVisibilityChange

  useLayoutEffect(() => {
    const section = sectionRef.current
    const panel = panelRef.current
    if (!section || !panel) return undefined

    let scrollProgress = 0
    let expansionValue = 0
    let exitValue = 0
    let absorbValue = 0
    let dropRadius = 1
    let cylinderRadius = Math.hypot(window.innerWidth / 2, window.innerHeight / 2) * 1.14
    let cylinderStepDeg = 8
    let cylinderPitchPx = 65
    let drumFlat = 1
    let wheelTarget = 0
    let wheelPosition = 0
    let wheelVelocity = 0
    const expandProxy = { value: 0 }
    const flashProxy = { value: 0 }
    const copyProxy = { value: 0 }
    const rollProxy = { value: 0 }
    const exitProxy = { copy: 0, reveal: 0, absorb: 0 }
    let rollTween
    let colourOpen = false
    let expandTween
    let copyTween
    let exitTimeline
    let arrivalScrollTween
    let exitFlying = false
    let exitCommitted = false
    let exitReversing = false
    // ScrollTrigger updates during mount/refresh are measurements, not user
    // intent. In particular, browser scroll restoration can put the trigger
    // directly on EXIT_START; treating that refresh as a forward gesture
    // skips the whole section and leaves the restored viewport on a white
    // hand-off frame. Arm the timed exit only from a real interaction or the
    // established block-two hand-off event.
    let exitArmed = false
    // The arrival flick must not roll the copy. The next fresh flick does.
    // A return home is its own tween, so a reverse from the first paragraph
    // does not die inside the block-two pin.
    let textRollArmed = false
    let lastArrivalWheelAt = 0
    let suppressColourOpen = false
    let returningHome = false
    let returnTween
    // The exit plays on its own. `handedOff` means it finished and block
    // four owns the page, so a later upward scroll must not replay it.
    let exitPlaying = false
    let handedOff = false
    let returningToCopy = false
    let restoreTailOnOpen = false
    let queuedExitAfterRoll = false
    let queuedHomeAfterRoll = false
    let lastScrollY = window.scrollY
    let refreshFrame = 0
    let armScrollFrame = 0
    const hasExitState = () => (
      exitCommitted
      || exitValue > 0.001
      || absorbValue > 0.001
      || section.classList.contains('world-model-section--gathering')
      || Number.parseFloat(section.style.getPropertyValue('--world-exit')) > 0.001
      || Number.parseFloat(section.style.getPropertyValue('--world-absorb')) > 0.001
    )
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const getWheelLines = () => Array.from(
      section.querySelectorAll('.world-model-section__line'),
    )

    const renderWheel = () => {
      const velocityBlur = Math.min(Math.abs(wheelVelocity) * 0.018, 0.55)
      // Same cylinder as before. At rest the radius grows so the facing
      // paragraph reads as a flat stack; the rows never jump between two
      // different layouts.
      const radius = cylinderRadius * (1 + drumFlat * 11)
      const liveStepDeg = (cylinderPitchPx / Math.max(1, radius)) * (180 / Math.PI)

      getWheelLines().forEach((line) => {
        const slot = Number(line.dataset.wheelSlot) || 0
        const offset = slot - wheelPosition
        const angleDeg = offset * liveStepDeg
        // Keep a full 5-line paragraph solid in the centre. Angle-based fade
        // used to eat the first and last rows on shorter viewports.
        const edgeFade = smootherstep(clamp01((Math.abs(offset) - 2.2) / 1.5))
        const visibility = 1 - edgeFade
        const blur = edgeFade * 2.35 + velocityBlur

        line.style.transform = `rotateX(${(-angleDeg).toFixed(4)}deg) translateZ(${radius.toFixed(1)}px)`
        line.style.setProperty('--line-visibility', visibility.toFixed(4))
        line.style.filter = `blur(${blur.toFixed(3)}px)`
      })
      section.style.setProperty('--cylinder-radius', `${radius.toFixed(1)}px`)
      section.querySelector('.world-model-section__copy')
        ?.style.setProperty('--cylinder-radius', `${radius.toFixed(1)}px`)
    }

    // A slightly over-damped spring gives the iOS-picker weight without
    // overshoot or bounce. Scroll changes the target; the rows catch up on
    // GSAP's ticker instead of receiving the scroll position directly.
    const tickWheel = (_time, deltaTime) => {
      if (reduceMotion) {
        wheelPosition = wheelTarget
        wheelVelocity = 0
        drumFlat = 1
        renderWheel()
        return
      }

      const safeDeltaTime = Number.isFinite(deltaTime) ? deltaTime : 1000 / 60
      if (!Number.isFinite(wheelPosition) || !Number.isFinite(wheelVelocity)) {
        wheelPosition = wheelTarget
        wheelVelocity = 0
      }
      const dt = Math.min(Math.max(safeDeltaTime / 1000, 1 / 240), 1 / 30)
      // The authored paragraph transition already has its own eased
      // acceleration and braking. Running the spring at the same time made
      // the drum lag behind its tween, then surge past it on reverse.
      if (rollTween?.isActive()) {
        drumFlat += (0 - drumFlat) * (1 - Math.exp(-20 * dt))
        renderWheel()
        return
      }
      const stiffness = 34
      const damping = 13.2
      const acceleration = (wheelTarget - wheelPosition) * stiffness
        - wheelVelocity * damping
      wheelVelocity += acceleration * dt
      const previousDistance = wheelTarget - wheelPosition
      const nextPosition = wheelPosition + wheelVelocity * dt
      const nextDistance = wheelTarget - nextPosition

      // Clamp an extremely small crossing at rest. This is not a visible
      // snap; it only prevents a numerical spring from oscillating forever.
      if (
        Math.sign(previousDistance) !== Math.sign(nextDistance)
        && Math.abs(previousDistance) < 0.008
      ) {
        wheelPosition = wheelTarget
        wheelVelocity = 0
      } else {
        wheelPosition = nextPosition
      }
      const traveling = Math.abs(wheelVelocity) > 0.06
        || Math.abs(wheelTarget - wheelPosition) > 0.03
      const flatTarget = traveling ? 0 : 1
      const flattenRate = traveling ? 28 : 6.5
      drumFlat += (flatTarget - drumFlat) * (1 - Math.exp(-flattenRate * dt))
      if (Math.abs(flatTarget - drumFlat) < 0.002) drumFlat = flatTarget
      renderWheel()
    }
    gsap.ticker.add(tickWheel)

    const copyIsUnlocked = () => copyProxy.value >= 0.85 && expansionValue >= 0.92

    const writeCopyProgress = () => {
      if (!copyIsUnlocked()) {
        if (!rollTween?.isActive()) wheelTarget = 0
        section.style.setProperty('--world-tail-enter', '0.0000')
        if (reduceMotion) {
          wheelPosition = wheelTarget
          renderWheel()
        }
        return
      }
      if (rollTween?.isActive() || reduceMotion) {
        const nextPosition = clamp01(rollProxy.value) * TAIL_CENTER_SLOT
        // One deterministic playhead controls both target and rendered
        // position while the paragraph is moving. `smootherstep` supplies
        // the inertia, so there is no second spring fighting the gesture.
        wheelVelocity = (nextPosition - wheelPosition) * 10
        wheelTarget = nextPosition
        wheelPosition = nextPosition
      }
      section.style.setProperty(
        '--world-tail-enter',
        (wheelTarget / TAIL_CENTER_SLOT).toFixed(4),
      )
      if (reduceMotion) {
        wheelPosition = wheelTarget
        renderWheel()
      }
    }

    let rollIntent = 0
    let copyReadyAt = 0
    let tailOverscroll = 0
    let tailGestureAt = 0
    let headOverscroll = 0
    let pendingWheelPx = 0
    let lastReadingWheelAt = 0
    // Line-mode notches (deltaMode 1) arrive as 1, which the old `> 1`
    // test threw away after preventDefault — the page was locked and the
    // paragraph never moved. Pixel mode keeps fractions and adds them up.
    const wheelPixels = (event) => {
      const scale = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? window.innerHeight : 1
      return event.deltaY * scale
    }
    const syncRollProxyFromWheel = () => {
      rollProxy.value = clamp01(wheelTarget / TAIL_CENTER_SLOT)
      rollIntent = rollProxy.value > 0.5 ? 1 : 0
      section.style.setProperty('--world-tail-enter', rollProxy.value.toFixed(4))
    }
    const nudgeWheelByPixels = (deltaY) => {
      rollTween?.kill()
      const line = Math.max(32, cylinderPitchPx)
      wheelTarget = Math.min(TAIL_CENTER_SLOT, Math.max(0, wheelTarget + deltaY / line))
      syncRollProxyFromWheel()
    }
    const atTailRest = () => (
      wheelTarget >= TAIL_CENTER_SLOT - 0.04
      && Math.abs(wheelPosition - TAIL_CENTER_SLOT) < 0.35
      && Math.abs(wheelVelocity) < 0.14
    )
    const atHeadRest = () => (
      wheelTarget <= 0.04
      && wheelPosition <= 0.35
      && Math.abs(wheelVelocity) < 0.14
    )
    const rollCopyTo = (next) => {
      const target = next ? 1 : 0
      textRollArmed = true
      const targetSlot = target * TAIL_CENTER_SLOT
      if (
        rollIntent === target
        && (
          rollTween?.isActive()
          || (
            Math.abs(rollProxy.value - target) < 0.02
            && Math.abs(wheelTarget - targetSlot) < 0.04
          )
        )
      ) {
        return
      }
      rollIntent = target
      rollTween?.kill()
      if (reduceMotion) {
        rollProxy.value = target
        writeCopyProgress()
        return
      }
      rollTween = gsap.to(rollProxy, {
        value: target,
        duration: TEXT_ROLL_DURATION,
        ease: studioEase,
        overwrite: true,
        onUpdate: writeCopyProgress,
        onComplete: () => {
          rollProxy.value = target
          // Finish at the authored reading rest instead of leaving the
          // physical spring to trail behind the scroll gesture. The travel
          // remains inertial, but every paragraph is fully sharp/readable
          // before the following gesture can advance to another block.
          wheelTarget = target * TAIL_CENTER_SLOT
          wheelPosition = wheelTarget
          wheelVelocity = 0
          writeCopyProgress()
          renderWheel()
          lastArrivalWheelAt = performance.now()
          if (target === 1 && queuedExitAfterRoll) {
            queuedExitAfterRoll = false
            if (!continuePastHiddenBlockFour()) playExit()
          } else if (target === 0 && queuedHomeAfterRoll) {
            queuedHomeAfterRoll = false
            flyBackToBlock2()
          }
        },
      })
    }

    const readingRestY = () => {
      const sectionTop = section.getBoundingClientRect().top + window.scrollY
      const pinEnd = crystalTravelRangePx() + window.innerHeight
      return Math.max(pinEnd, sectionTop) + 2
    }
    const fieldIsReadable = () => (
      colourOpen
      && expansionValue >= 0.92
      && copyProxy.value >= 0.85
      && !exitPlaying
      && !handedOff
      && !returningHome
      && !returningToCopy
    )

    const applyColourField = () => {
      const value = expansionValue
      // The original colour field contracts through one soft, asymmetric
      // mask; all three cloud lobes converge on the crystal's centre.
      const suck = smootherstep(absorbValue)
      const field = value * (1 - suck)
      // Ease the open so the first colour is a tight halo on the gem.
      // The absorb still collapses with the field itself.
      const opening = suck < 0.001
      const spread = opening ? smootherstep(value) : field
      const radius = Math.max(0.5, dropRadius * spread)
      const finish = smootherstep(clamp01((value - 0.68) / 0.3))
      const leak = opening ? 1 - smootherstep(clamp01((value - 0.02) / 0.45)) : 0
      const coreShare = Math.max(0.12, 0.16 + finish * 0.28 - suck * 0.1)
      const midShare = Math.min(0.82, 0.48 + finish * 0.18 - suck * 0.06)
      const softShare = Math.min(0.98, 0.82 + finish * 0.08 + suck * 0.08)
      section.style.setProperty('--world-expansion', value.toFixed(4))
      section.style.setProperty('--world-absorb', absorbValue.toFixed(4))
      // Keep the collapsing field an uneven cloud, not a tightening circle.
      section.style.setProperty('--world-rim-x', `${(radius * (1.18 + suck * 0.14)).toFixed(2)}px`)
      section.style.setProperty('--world-rim-y', `${(radius * (0.84 - suck * 0.14)).toFixed(2)}px`)
      // The field extends 6% past the sticky pane. Its exact 50%/50%
      // maps to the viewport centre, where the small shared mesh waits.
      section.style.setProperty('--world-mask-x', '50%')
      section.style.setProperty('--world-mask-y', '50%')
      // The opening stays soft. Once the field has covered the viewport the
      // mask has to be solid, or the pinned block behind it ghosts through.
      section.style.setProperty('--world-main-alpha', Math.min(1, 0.42 + finish * 0.58 + leak * 0.4).toFixed(4))
      section.style.setProperty('--world-main-mid-alpha', Math.min(1, 0.3 + finish * 0.7 + leak * 0.42).toFixed(4))
      section.style.setProperty('--world-main-soft-alpha', Math.min(1, 0.07 + finish * 0.93 + leak * 0.28).toFixed(4))
      section.style.setProperty('--world-soft-radius', `${(radius * softShare).toFixed(2)}px`)
      section.style.setProperty('--world-mid-radius', `${(radius * midShare).toFixed(2)}px`)
      section.style.setProperty('--world-core-radius', `${(radius * coreShare).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-radius', `${(radius * 0.86).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-offset-x', `${(radius * 0.3).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-offset-y', `${(radius * -0.18).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-b-radius', `${(radius * 0.78).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-b-offset-x', `${(radius * -0.3).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-b-offset-y', `${(radius * 0.24).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-c-radius', `${(radius * 0.58).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-c-offset-x', `${(radius * 0.08).toFixed(2)}px`)
      section.style.setProperty('--world-cloud-c-offset-y', `${(radius * 0.32).toFixed(2)}px`)
      section.style.setProperty('--world-glow-radius', `${(radius * 0.82).toFixed(2)}px`)
      const openGlow = Math.sin(Math.PI * clamp01(value)) * (1 - absorbValue)
      section.style.setProperty('--world-glow', openGlow.toFixed(4))
      section.style.setProperty('--world-ripple-b', clamp01((value - 0.1) / 0.9).toFixed(4))
      section.style.setProperty('--world-ripple-c', clamp01((value - 0.2) / 0.8).toFixed(4))
      // Keep the colour substantial until it is inside the small mesh.
      const bloomFade = smootherstep(clamp01((absorbValue - 0.94) / 0.06))
      section.style.setProperty('--world-bloom-opacity', (1 - bloomFade).toFixed(4))
      const coreGlow = Math.sin(Math.PI * absorbValue) * (1 - bloomFade)
      section.style.setProperty('--world-core-glow', coreGlow.toFixed(4))
    }

    const writeExit = () => {
      exitValue = exitProxy.reveal
      absorbValue = exitProxy.absorb
      section.style.setProperty('--world-copy-exit', exitProxy.copy.toFixed(4))
      section.style.setProperty('--world-exit', exitValue.toFixed(4))
      section.classList.toggle('world-model-section--gathering', exitValue > 0.2)
      applyColourField()
      updateAnchor()
    }

    const blockFourPresent = () => Boolean(document.querySelector('.physics-behavior-section'))
    // Block 4 is temporarily unmounted. Reaching the end of this copy used
    // to fly into that section and then hijack upward scrolls anywhere
    // below it. Without the section, release the hold and let the page
    // continue into the screens that are still mounted.
    const continuePastHiddenBlockFour = () => {
      if (blockFourPresent()) return false
      handedOff = true
      return true
    }

    const fourthIntroScrollY = () => {
      const fourth = document.querySelector('.physics-behavior-section')
      if (!fourth) return window.scrollY
      // Rest is the physics pane filling the viewport, not the moment its
      // top edge peeks in under the colour field.
      return fourth.getBoundingClientRect().top + window.scrollY
    }

    const releaseFourth = () => {
      window.dispatchEvent(new Event(WORLD_MODEL_ABSORBED_EVENT))
    }
    const scrollToFourthIntro = () => {
      const destination = fourthIntroScrollY()
      if (window.scrollY >= destination - 2) {
        window.scrollTo(0, destination)
        exitFlying = false
        handedOff = true
        setColourOpen(false, true)
        releaseFourth()
        return
      }
      if (arrivalScrollTween?.isActive()) return
      exitFlying = true
      // Block four must not scrub or snap while this flight still owns
      // the scroll. The absorbed event, which starts its arrival, fires
      // only once the pane is actually in place.
      window.dispatchEvent(new CustomEvent(WORLD_MODEL_RETURN_EVENT))
      const proxy = { y: window.scrollY }
      arrivalScrollTween?.kill()
      arrivalScrollTween = gsap.to(proxy, {
        y: destination,
        duration: reduceMotion ? 0 : STUDIO_HANDOFF_DURATION,
        ease: studioEase,
        overwrite: true,
        onUpdate: () => window.scrollTo(0, proxy.y),
        onComplete: () => {
          window.scrollTo(0, destination)
          exitFlying = false
          handedOff = true
          setColourOpen(false, true)
          releaseFourth()
        },
      })
    }

    // The ScrollTrigger range is measured before block two's pin spacer
    // exists, so it sits 2.5 viewports too early. The flight, the copy,
    // and the exit all have to follow the section's live box.
    const sectionRange = () => {
      const height = Math.max(1, section.offsetHeight)
      const start = section.getBoundingClientRect().top + window.scrollY - window.innerHeight
      return { start, end: start + height }
    }
    const yForProgress = (progress) => {
      const { start, end } = sectionRange()
      return start + progress * (end - start)
    }

    let exitHoldY = 0
    const playInwardLight = (timeline, at) => {
      const gatherProxy = { value: 0 }
      flashEl.classList.add('world-model-flash--inward')
      flashEl.style.setProperty('--world-gather', '0')
      writeFlash(0)
      timeline
        .to(gatherProxy, {
          value: 1,
          duration: reduceMotion ? 0 : 0.42,
          ease: 'power3.in',
          onUpdate: () => flashEl.style.setProperty('--world-gather', gatherProxy.value.toFixed(4)),
        }, at)
        .to(flashProxy, {
          value: 1,
          duration: reduceMotion ? 0 : 0.16,
          ease: 'power2.out',
          onUpdate: () => writeFlash(flashProxy.value),
        }, at)
        .to(flashProxy, {
          value: 0,
          duration: reduceMotion ? 0 : 0.18,
          ease: 'power2.in',
          onUpdate: () => writeFlash(flashProxy.value),
        }, at + 0.3)
    }
    const clearInwardLight = () => {
      flashEl.classList.remove('world-model-flash--inward')
      flashEl.style.setProperty('--world-gather', '0')
      writeFlash(0)
    }

    const playExit = () => {
      if (exitPlaying || exitReversing || returningHome || handedOff || returningToCopy) return
      queuedExitAfterRoll = false
      queuedHomeAfterRoll = false
      if (exitCommitted) {
        if (exitFlying || arrivalScrollTween?.isActive()) return
        exitCommitted = false
        exitTimeline?.kill()
        exitProxy.copy = 0
        exitProxy.reveal = 0
        exitProxy.absorb = 0
        writeExit()
      }
      exitCommitted = true
      exitPlaying = true
      handedOff = false
      // Stay on the full-screen field until the colour has started
      // falling into the crystal, then one inertial flick carries the
      // page onto block four — same rest-to-rest as 2→3.
      exitHoldY = window.scrollY
      exitFlying = false
      exitTimeline?.kill()
      exitTimeline = gsap.timeline({
        onUpdate: writeExit,
        onComplete: () => {
          exitPlaying = false
          clearInwardLight()
          if (!arrivalScrollTween?.isActive()) scrollToFourthIntro()
        },
      })
        .to(exitProxy, { copy: 1, duration: reduceMotion ? 0 : 0.14, ease: 'power2.in' }, 0)
        .to(exitProxy, { reveal: 1, duration: reduceMotion ? 0 : 0.12, ease: 'power2.out' }, 0.04)
        .to(exitProxy, {
          absorb: 1,
          duration: reduceMotion ? 0 : SUCTION_DURATION,
          ease: 'power3.inOut',
        }, 0.08)
      playInwardLight(exitTimeline, 0.08)
      // Let the field collapse almost completely into the light before the
      // page begins its flight. The crystal is revealed from that same core,
      // so the transition reads as the exact reverse of the 2→3 release.
      exitTimeline.call(scrollToFourthIntro, null, reduceMotion ? 0 : 0.44)
    }

    const reverseExit = () => {
      // Only an in-progress exit reverses. Once block four has the page,
      // scrolling up is ordinary reading — reversing here used to yank the
      // viewport back into the middle of this section.
      if (!exitPlaying || exitReversing) return
      exitPlaying = false
      exitReversing = true
      arrivalScrollTween?.kill()
      if (Math.abs(window.scrollY - exitHoldY) > 1) window.scrollTo(0, exitHoldY)
      if (!exitTimeline) {
        exitProxy.copy = 0
        exitProxy.reveal = 0
        exitProxy.absorb = 0
        exitCommitted = false
        exitReversing = false
        handedOff = false
        writeExit()
        return
      }
      exitTimeline.eventCallback('onReverseComplete', () => {
        exitCommitted = false
        exitReversing = false
        handedOff = false
        clearInwardLight()
        window.scrollTo(0, Math.max(0, Math.min(exitHoldY - 24, readingRestY())))
        rollCopyTo(true)
      })
      exitTimeline.timeScale(reduceMotion ? 1 : 1.5).reverse()
    }

    const resetExit = () => {
      if (!hasExitState() || exitReversing || exitTimeline?.isActive()) return
      arrivalScrollTween?.kill()
      clearInwardLight()
      exitTimeline?.pause(0)
      exitProxy.copy = 0
      exitProxy.reveal = 0
      exitProxy.absorb = 0
      exitCommitted = false
      writeExit()
    }

    const writeExpansion = (value) => {
      expansionValue = value
      applyColourField()
      writeCopyProgress()
      updateAnchor()
      // A restored page can already be at the exit threshold before the
      // colour-opening tween finishes. Start the committed exit then too.
    }

    const setCopyReveal = (value) => {
      copyProxy.value = value
      section.style.setProperty('--world-copy-reveal', value.toFixed(4))
      writeCopyProgress()
    }

    // The first paragraph fades in as the field finishes covering the
    // screen. Scrolling that paragraph is a separate, later gesture.
    const playCopyIn = () => {
      copyTween?.kill()
      copyTween = gsap.to(copyProxy, {
        value: 1,
        duration: reduceMotion ? 0 : COPY_FADE_DURATION,
        delay: 0,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          section.style.setProperty('--world-copy-reveal', copyProxy.value.toFixed(4))
          writeCopyProgress()
        },
        onComplete: () => {
          setCopyReveal(1)
          if (colourOpen && expansionValue >= 0.92) {
            textRollArmed = true
            copyReadyAt = performance.now()
            // Momentum from the 2→3 arrival belongs to the transition, not
            // to the text drum. Discard it so the first paragraph always
            // reaches a fully readable rest before the next fresh gesture.
            pendingWheelPx = 0
            writeCopyProgress()
            // A 4→3 return is staged: first rebuild the colour field and
            // readable first paragraph, then perform one controlled roll
            // to the remembered tail. This prevents the hidden text from
            // racing several lines ahead during the return flight.
            if (restoreTailOnOpen) {
              restoreTailOnOpen = false
              rollCopyTo(true)
            }
          }
        },
      })
    }

    const hideCopy = (instant = false) => {
      copyTween?.kill()
      rollTween?.kill()
      rollIntent = 0
      rollProxy.value = 0
      wheelTarget = 0
      tailOverscroll = 0
      headOverscroll = 0
      queuedExitAfterRoll = false
      queuedHomeAfterRoll = false
      if (instant || reduceMotion || copyProxy.value <= 0.001) {
        setCopyReveal(0)
        return
      }
      copyTween = gsap.to(copyProxy, {
        value: 0,
        duration: 0.22,
        ease: 'power2.in',
        overwrite: true,
        onUpdate: () => {
          section.style.setProperty('--world-copy-reveal', copyProxy.value.toFixed(4))
          writeCopyProgress()
        },
        onComplete: () => setCopyReveal(0),
      })
    }

    // Lives on the body, in front of the page crystal, so the burst reads
    // as light travelling toward the camera instead of a glow behind the gem.
    const flashEl = document.createElement('div')
    flashEl.className = 'world-model-flash'
    flashEl.setAttribute('aria-hidden', 'true')
    flashEl.innerHTML = '<div class="world-model-flash__core"></div>'
    document.body.appendChild(flashEl)
    const writeFlash = (value) => {
      flashProxy.value = value
      flashEl.style.setProperty('--world-flash', value.toFixed(4))
    }
    writeFlash(0)

    const setColourOpen = (next, instant = false, closeDuration = 0.5) => {
      if (colourOpen === next) {
        // A redundant instant close used to kill the opening tween on every
        // scroll tick while the pane was still below the fold.
        if (!instant) return
        const parked = next ? expandProxy.value >= 0.999 : expandProxy.value <= 0.001
        if (parked && !expandTween?.isActive()) return
      }
      colourOpen = next
      document.documentElement.classList.toggle('on-world-model', next)
      if (next) section.classList.add('world-model-section--open')
      expandTween?.kill()
      if (reduceMotion || instant) {
        writeFlash(0)
        expandProxy.value = next ? 1 : 0
        writeExpansion(expandProxy.value)
        if (next) setCopyReveal(1)
        else {
          textRollArmed = false
          hideCopy(true)
          section.classList.remove('world-model-section--open')
        }
        return
      }
      if (!next) {
        writeFlash(0)
        textRollArmed = false
        hideCopy(false)
        expandTween = gsap.to(expandProxy, {
          value: 0,
          duration: closeDuration,
          ease: 'power2.inOut',
          overwrite: true,
          onUpdate: () => writeExpansion(expandProxy.value),
          onComplete: () => {
            writeExpansion(expandProxy.value)
            if (!colourOpen) section.classList.remove('world-model-section--open')
          },
        })
        return
      }
      writeFlash(0)
      expandProxy.value = 0
      writeExpansion(0)
      expandTween = gsap.timeline({
        onComplete: () => {
          writeExpansion(expandProxy.value)
          writeFlash(0)
          if (colourOpen) playCopyIn()
        },
      })
      expandTween
        .to(flashProxy, {
          value: 1,
          duration: FLASH_BURST,
          delay: FLASH_DELAY,
          ease: 'power2.out',
          onUpdate: () => writeFlash(flashProxy.value),
        })
        .to(expandProxy, {
          value: 1,
          duration: COLOUR_OPEN_DURATION,
          ease: (t) => smootherstep(t),
          onUpdate: () => writeExpansion(expandProxy.value),
        }, `-=${FLASH_BURST * 0.28}`)
        .to(flashProxy, {
          value: 0,
          duration: 0.34,
          ease: 'power2.in',
          onUpdate: () => writeFlash(flashProxy.value),
        }, '<0.12')
    }

    const updateAnchor = () => {
      const rect = section.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()
      onCrystalAnchorRef.current?.(
        panelRect.left + panelRect.width / 2,
        panelRect.top + panelRect.height * 0.5,
        {
          sectionTop: rect.top,
          sectionBottom: rect.bottom,
          progress: scrollProgress,
          expansion: expansionValue,
          exit: exitValue,
          absorb: absorbValue,
        },
      )
    }

    // React Fast Refresh preserves the section DOM node and therefore its
    // inline CSS custom properties. If the previous effect was interrupted
    // during the absorb phase, the new effect otherwise inherits
    // --world-absorb/--world-exit at 1 while all of its JavaScript state has
    // restarted at 0, leaving the block permanently white. Establish one
    // coherent baseline before ScrollTrigger measures the restored scroll.
    writeExit()
    writeExpansion(0)

    // Live geometry, not the trigger's cached start. The block-two pin is
    // created after this trigger, and its spacer pushes this section down.
    // Scroll events keep the field and the copy in step even when that
    // cached range no longer covers the section.
    let previousPaneTop = panel.getBoundingClientRect().top
    const syncPresentation = () => {
      const rectTop = section.getBoundingClientRect().top
      scrollProgress = clamp01(
        (window.innerHeight - rectTop) / Math.max(1, section.offsetHeight),
      )
      if (
        scrollProgress < 0.08
        && !returningHome
        && !returningToCopy
        && panel.getBoundingClientRect().top > 64
      ) {
        textRollArmed = false
        if (!rollTween?.isActive()) {
          rollIntent = 0
          rollProxy.value = 0
          wheelTarget = 0
          tailOverscroll = 0
          headOverscroll = 0
          pendingWheelPx = 0
        }
      }
      writeCopyProgress()
      if (!exitTimeline?.isActive() && !exitCommitted && scrollProgress < EXIT_START - 0.012) resetExit()
      const paneTop = panel.getBoundingClientRect().top
      if (suppressColourOpen || returningToCopy || returningHome || handedOff) {
        // The return flights and the 3→4 landing own the colour field.
      } else if (paneTop <= 48 && scrollProgress >= 0.001 && scrollProgress < 0.82) {
        setColourOpen(true)
      } else if (
        colourOpen
        && scrollProgress < 0.9
        && !expandTween?.isActive()
        && paneTop > 64
        && paneTop > previousPaneTop + 12
      ) {
          // Only when the pane is travelling back down. The same test used
          // to match the forward rise, so the opening field was deleted
          // mid-flight and the gradient flashed as a panel over block 2.
      setColourOpen(false, true)
    }
    previousPaneTop = paneTop
    updateAnchor()
    }

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom bottom',
      onLeaveBack: () => {
        if (!returningHome) setColourOpen(false, true)
      },
      onUpdate: syncPresentation,
    })

    // Scroll restoration can mount the page with this sticky pane already
    // filling the viewport. Waiting for ScrollTrigger's first async refresh
    // used to leave a white screen (plus the small travelling crystal) while
    // the colour field replayed its opening animation from zero. Seed the
    // section from ScrollTrigger's measured position during layout instead,
    // before the browser paints the restored frame.
    const initialSectionRect = section.getBoundingClientRect()
    // ScrollTrigger's public progress can still be 0 until its first refresh,
    // even though the browser has already restored scrollY. Derive the same
    // `top bottom` → `bottom bottom` range directly from live geometry so the
    // very first painted frame is correct.
    scrollProgress = clamp01(
      (window.innerHeight - initialSectionRect.top)
      / Math.max(1, initialSectionRect.height),
    )
    const initialPaneRect = panel.getBoundingClientRect()
    if (
      scrollProgress > 0.001
      && initialPaneRect.top <= 48
      && initialPaneRect.bottom > 0
    ) {
      setColourOpen(true, true)
      if (scrollProgress > TEXT_ROLL_START + 0.04) {
        textRollArmed = true
        copyReadyAt = performance.now()
      }
      writeCopyProgress()
      updateAnchor()
    }
    // When restoration lands past the trigger's end, block four already
    // owns the viewport. Restore the completed absorb state immediately;
    // leaving the colour field open here paints block three over block four
    // and visibly stacks both headings. This is state restoration only — it
    // deliberately does not replay or auto-scroll the transition.
    if (scrollProgress >= 0.999) {
      exitProxy.copy = 1
      exitProxy.reveal = 1
      exitProxy.absorb = 1
      exitCommitted = true
      handedOff = true
      writeExit()
    }

    const block2RestY = () => crystalTravelRangePx()

    // Colour pulls back into the crystal, then the page flies to the cards.
    // The tween is not on `window`, because block two kills every window
    // tween the moment the pin is re-entered — that used to drop the reader
    // in the white gap and leave the next flick stuck.
    const flyBackToBlock2 = () => {
      if (returningHome && returnTween?.isActive()) return
      const dest = block2RestY()
      if (dest == null || dest >= window.scrollY - 8) return
      returningHome = true
      suppressColourOpen = true
      restoreTailOnOpen = false
      queuedExitAfterRoll = false
      queuedHomeAfterRoll = false
      section.classList.add('world-model-section--handoff-cover')
      rollCopyTo(false)
      window.dispatchEvent(new CustomEvent(WORLD_MODEL_RETURN_EVENT))
      gsap.killTweensOf(window)
      setColourOpen(false, false, 0.55)
      const proxy = { y: window.scrollY }
      returnTween?.kill()
      returnTween = gsap.to(proxy, {
        y: dest,
        duration: reduceMotion ? 0 : STUDIO_HANDOFF_DURATION,
        delay: 0,
        ease: studioEase,
        overwrite: true,
        onInterrupt: () => {
          section.classList.remove('world-model-section--handoff-cover')
          suppressColourOpen = false
          returningHome = false
        },
        onUpdate: () => window.scrollTo(0, proxy.y),
        onComplete: () => {
          window.scrollTo(0, dest)
          section.classList.remove('world-model-section--handoff-cover')
          suppressColourOpen = false
          returningHome = false
          textRollArmed = false
          window.dispatchEvent(new CustomEvent(BLOCK24_RETURN_EVENT))
        },
      })
    }

    // Scrolling back out of block four used to travel the empty tail of
    // this section with the colour already gone. Land on the finished
    // paragraph and open the field again.
    const returnToFinishedCopy = () => {
      if ((returningToCopy && returnTween?.isActive()) || exitPlaying || returningHome) return
      returningToCopy = true
      suppressColourOpen = true
      handedOff = false
      exitArmed = false
      exitPlaying = false
      exitReversing = false
      arrivalScrollTween?.kill()
      textRollArmed = true
      queuedExitAfterRoll = false
      queuedHomeAfterRoll = false
      restoreTailOnOpen = true
      // Always restart the return from a stable head position. The tail is
      // restored only after the field and copy have finished reopening.
      rollTween?.kill()
      rollIntent = 0
      rollProxy.value = 0
      wheelTarget = 0
      wheelPosition = 0
      wheelVelocity = 0
      drumFlat = 1
      renderWheel()
      // Reverse the absorb instead of popping the field back on. The
      // colour leaves the crystal while the page eases onto the finished
      // paragraph — the same accel/brake as the forward 3→4 flight.
      if (hasExitState()) {
        exitTimeline?.kill()
        gsap.to(exitProxy, {
          copy: 0,
          reveal: 0,
          absorb: 0,
          duration: reduceMotion ? 0 : SUCTION_DURATION,
          ease: studioEase,
          overwrite: true,
          onUpdate: writeExit,
          onComplete: () => {
            exitCommitted = false
            writeExit()
          },
        })
      } else {
        resetExit()
      }
      setColourOpen(true)
      const dest = readingRestY()
      window.dispatchEvent(new CustomEvent(WORLD_MODEL_RETURN_EVENT))
      const releaseSnap = () => {
        gsap.killTweensOf(window, document.documentElement, document.body)
        window.scrollTo(0, dest)
      }
      const proxy = { y: window.scrollY }
      returnTween?.kill()
      returnTween = gsap.to(proxy, {
        y: dest,
        duration: reduceMotion ? 0 : STUDIO_HANDOFF_DURATION,
        ease: studioEase,
        overwrite: true,
        onInterrupt: () => {
          returningToCopy = false
          suppressColourOpen = false
        },
        onUpdate: () => {
          gsap.killTweensOf(window, document.documentElement, document.body)
          window.scrollTo(0, proxy.y)
        },
        onComplete: () => {
          releaseSnap()
          window.setTimeout(releaseSnap, 80)
          window.setTimeout(() => {
            releaseSnap()
            returningToCopy = false
            suppressColourOpen = false
            textRollArmed = true
            setColourOpen(true)
            if (copyIsUnlocked() && restoreTailOnOpen) {
              restoreTailOnOpen = false
              rollCopyTo(true)
            }
          }, 180)
        },
      })
    }

    const holdExitScroll = (event) => {
      if (returningHome && !returnTween?.isActive()) returningHome = false
      if (returningToCopy && !returnTween?.isActive()) returningToCopy = false
      if (returningHome || returningToCopy) {
        event.preventDefault()
        return
      }
      if (exitReversing) {
        event.preventDefault()
        return
      }
      if (exitPlaying) {
        event.preventDefault()
        if (event.deltaY < -80) reverseExit()
        return
      }
      if (arrivalScrollTween?.isActive() || exitFlying) {
        event.preventDefault()
        if (event.deltaY < -80) {
          arrivalScrollTween?.kill()
          exitFlying = false
          handedOff = true
          returnToFinishedCopy()
        }
        return
      }
      if (handedOff) {
        if (event.deltaY < -50 && blockFourPresent()) {
          const fourth = document.querySelector('.physics-behavior-section')
          const stateOne = Number.parseFloat(
            fourth ? getComputedStyle(fourth).getPropertyValue('--physics-state-one') : '',
          ) || 0
          const stateTwo = Number.parseFloat(
            fourth ? getComputedStyle(fourth).getPropertyValue('--physics-state-two') : '',
          ) || 0
          if (stateTwo < 0.08 && stateOne < 0.55) {
            event.preventDefault()
            returnToFinishedCopy()
          }
        }
        return
      }
      if (!(colourOpen && !exitPlaying && !returningHome && !returningToCopy)) return
      const pixels = wheelPixels(event)
      if (!pixels) return
      // Hold the page once the field owns the screen. Deltas that arrive
      // before the paragraph is readable are kept and applied below,
      // instead of being discarded after preventDefault.
      event.preventDefault()
      if (!fieldIsReadable()) {
        pendingWheelPx += pixels
        return
      }
      if (!textRollArmed) {
        textRollArmed = true
        copyReadyAt = 0
      }
      const delta = pendingWheelPx + pixels
      pendingWheelPx = 0
      const now = performance.now()
      const freshGesture = now - lastReadingWheelAt > READING_GESTURE_GAP
      lastReadingWheelAt = now
      // A short beat after the copy appears only delays the exit and the
      // return to the cards. The paragraph itself has to move immediately.
      const holdExit = copyReadyAt > 0 && performance.now() - copyReadyAt < 240
      if (delta > 0) {
        headOverscroll = 0
        if (rollTween?.isActive() && rollIntent === 1) {
          // If the reader makes the next deliberate flick before the text
          // has quite finished braking, remember it and leave as soon as the
          // paragraph reaches its exact rest. Momentum packets do not arm it.
          if (freshGesture) queuedExitAfterRoll = true
          return
        }
        if (rollTween?.isActive() && rollIntent === 0 && freshGesture) {
          queuedHomeAfterRoll = false
          rollCopyTo(true)
          return
        }
        const tailParked = wheelTarget >= TAIL_CENTER_SLOT - 0.04
        if (!tailParked) {
          if (freshGesture) rollCopyTo(true)
          tailOverscroll = 0
          return
        }
        // The second paragraph is already centred. A trackpad keeps
        // sending small deltas while the spring brakes, and those used
        // to reset the exit gesture, so the page sat still indefinitely.
        if (!atTailRest()) {
          if (freshGesture) queuedExitAfterRoll = true
          return
        }
        if (holdExit || !freshGesture) return
        tailOverscroll = 0
        if (continuePastHiddenBlockFour()) {
          window.scrollBy(0, event.deltaY)
          return
        }
        playExit()
        return
      }
      tailOverscroll = 0
      if (rollTween?.isActive() && rollIntent === 0) {
        if (freshGesture) queuedHomeAfterRoll = true
        return
      }
      if (rollTween?.isActive() && rollIntent === 1 && freshGesture) {
        queuedExitAfterRoll = false
        rollCopyTo(false)
        return
      }
      if (!atHeadRest()) {
        if (freshGesture) rollCopyTo(false)
        headOverscroll = 0
        return
      }
      if (holdExit || !freshGesture) {
        headOverscroll = 0
        return
      }
      headOverscroll = 0
      flyBackToBlock2()
    }
    const holdExitKeys = (event) => {
      const forwardKey = ['ArrowDown', 'PageDown', ' ', 'Spacebar', 'End'].includes(event.key)
      const reverseKey = ['ArrowUp', 'PageUp', 'Home'].includes(event.key)
      if (!forwardKey && !reverseKey) return
      if (returningHome || returningToCopy || exitReversing) {
        event.preventDefault()
        return
      }
      if (exitPlaying) {
        event.preventDefault()
        if (reverseKey) reverseExit()
        return
      }
      if (handedOff) {
        if (reverseKey && blockFourPresent()) {
          const fourth = document.querySelector('.physics-behavior-section')
          const stateOne = Number.parseFloat(
            fourth ? getComputedStyle(fourth).getPropertyValue('--physics-state-one') : '',
          ) || 0
          const stateTwo = Number.parseFloat(
            fourth ? getComputedStyle(fourth).getPropertyValue('--physics-state-two') : '',
          ) || 0
          if (stateTwo < 0.08 && stateOne < 0.55) {
            event.preventDefault()
            returnToFinishedCopy()
          }
        }
        return
      }
      if (!(colourOpen && fieldIsReadable()) || !textRollArmed) return
      event.preventDefault()
      if (forwardKey) {
        if (!atTailRest()) {
          const jump = event.key === 'PageDown' || event.key === ' ' || event.key === 'Spacebar'
            ? TAIL_CENTER_SLOT
            : 2
          nudgeWheelByPixels(jump * Math.max(32, cylinderPitchPx))
          return
        }
        if (continuePastHiddenBlockFour()) {
          window.scrollBy(0, window.innerHeight * 0.85)
          return
        }
        playExit()
        return
      }
      if (!atHeadRest()) {
        const jump = event.key === 'PageUp' || event.key === 'Home'
          ? TAIL_CENTER_SLOT
          : 2
        nudgeWheelByPixels(-jump * Math.max(32, cylinderPitchPx))
        return
      }
      flyBackToBlock2()
    }
    const armExitFromTouch = () => {}
    window.addEventListener('wheel', holdExitScroll, { passive: false, capture: true })
    window.addEventListener('keydown', holdExitKeys)
    window.addEventListener('touchstart', armExitFromTouch, { passive: true })

    // How far the drop has to travel to clear the screen: from the impact
    // point (centre of the pane, where the crystal now sits) to the
    // farthest viewport corner, plus the share of the radius the CSS
    // spends on the soft rim.
    const updateDropRadius = () => {
      const rect = panel.getBoundingClientRect()
      const reach = Math.hypot(rect.width / 2, rect.height / 2)
      dropRadius = Math.ceil(reach / DROP_CORE_SHARE)
      section.style.setProperty('--drop-radius', `${dropRadius}px`)
      writeExpansion(expansionValue)
    }

    // The gradient is treated as one enormous crystal surface. Its text
    // sphere extends beyond the farthest viewport corner, so scrolling
    // feels like travelling over that crystal rather than turning a small
    // drum placed in the middle of it. The step remains the angle whose
    // arc equals one line, preserving exact line spacing at any viewport.
    const fitCylinder = () => {
      const viewportReach = Math.hypot(window.innerWidth / 2, window.innerHeight / 2)
      const radius = viewportReach * 1.14
      const copy = section.querySelector('.world-model-section__copy')
      const copyStyle = copy ? getComputedStyle(copy) : null
      const fontSize = parseFloat(copyStyle?.fontSize) || 52
      const parsedLineHeight = parseFloat(copyStyle?.lineHeight)
      // Baseline distance is the full 125% line box, not the tight glyph
      // height. Measuring a transformed row reports the foreshortened box
      // and pulls the next line up into the letters.
      const pitch = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.25
      const step = (pitch / radius) * (180 / Math.PI)
      cylinderRadius = radius
      cylinderStepDeg = step
      cylinderPitchPx = pitch
      section.style.setProperty('--cylinder-radius', `${radius.toFixed(1)}px`)
      copy?.style.setProperty('--cylinder-radius', `${radius.toFixed(1)}px`)
      section.style.setProperty('--cylinder-step', step.toFixed(3))
      renderWheel()
    }

    const handleHandoff = () => {
      // The 2→3 flight dispatches this while block 2 is still on screen.
      // Keep only the transparent effects layer fixed over the viewport
      // until the real sticky pane arrives. This removes the moving section
      // edge without painting an opaque rectangle over block two.
      section.classList.add('world-model-section--handoff-cover')
      setColourOpen(true)
    }
    window.addEventListener(BLOCK24_HANDOFF_EVENT, handleHandoff)

    const handleScroll = () => {
      const nextScrollY = window.scrollY
      if (
        section.classList.contains('world-model-section--handoff-cover')
        && !returningHome
        && section.getBoundingClientRect().top <= 2
      ) {
        section.classList.remove('world-model-section--handoff-cover')
      }
      scrollProgress = clamp01(
        (window.innerHeight - section.getBoundingClientRect().top)
        / Math.max(1, section.offsetHeight),
      )
      const flightActive = exitFlying || Boolean(arrivalScrollTween?.isActive())
      // Park the page for the absorption. Once the 3→4 flight starts,
      // that tween owns the scroll — clamping here used to cancel it.
      if (exitPlaying && !exitReversing && !flightActive) {
        if (Math.abs(nextScrollY - exitHoldY) > 1) window.scrollTo(0, exitHoldY)
        lastScrollY = exitHoldY
        syncPresentation()
        return
      }
      if (returningHome || returningToCopy || flightActive) {
        lastScrollY = nextScrollY
        syncPresentation()
        return
      }
      if (
        colourOpen
        && !handedOff
        && !exitPlaying
        && !exitCommitted
        && !exitFlying
      ) {
        const rest = readingRestY()
        if (nextScrollY > rest + 16) {
          window.scrollTo(0, rest)
          lastScrollY = rest
          syncPresentation()
          return
        }
      }
      const seam = yForProgress(1)
      if (
        blockFourPresent()
        && handedOff
        && nextScrollY < lastScrollY - 24
        && nextScrollY < seam - 64
      ) {
        lastScrollY = nextScrollY
        returnToFinishedCopy()
        return
      }
      lastScrollY = nextScrollY
      syncPresentation()
    }
    const handleResize = () => {
      fitCylinder()
      updateDropRadius()
      updateAnchor()
      ScrollTrigger.refresh()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)
    updateDropRadius()
    fitCylinder()
    document.fonts?.load?.('400 52px "TT Hoves Pro Trial Variable"')?.then(() => fitCylinder())
    updateAnchor()

    const observer = new IntersectionObserver(
      ([entry]) => {
        onSectionVisibilityChangeRef.current?.(entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-8% 0px -45% 0px' },
    )
    observer.observe(section)

    refreshFrame = requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      lastScrollY = window.scrollY
      // Give browser scroll restoration and ScrollTrigger's refresh one full
      // paint to settle before later position changes are treated as intent.
      armScrollFrame = requestAnimationFrame(() => {
        lastScrollY = window.scrollY
      })
    })

    return () => {
      expandTween?.kill()
      returnTween?.kill()
      flashEl.remove()
      copyTween?.kill()
      rollTween?.kill()
      exitTimeline?.kill()
      arrivalScrollTween?.kill()
      cancelAnimationFrame(refreshFrame)
      cancelAnimationFrame(armScrollFrame)
      gsap.ticker.remove(tickWheel)
      trigger.kill()
      observer.disconnect()
      window.removeEventListener(BLOCK24_HANDOFF_EVENT, handleHandoff)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('wheel', holdExitScroll, { capture: true })
      window.removeEventListener('keydown', holdExitKeys)
      window.removeEventListener('touchstart', armExitFromTouch)
      section.classList.remove('world-model-section--handoff-cover')
      document.documentElement.classList.remove('on-world-model')
      onSectionVisibilityChangeRef.current?.(false)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="world-model-section"
      aria-labelledby="world-model-heading"
    >
      <div ref={panelRef} className="world-model-section__sticky">
        <div className="world-model-section__field" aria-hidden="true">
          <div className="world-model-section__bloom">
            <div className="world-model-section__expansion-glow" />
          </div>
          <div className="world-model-section__corner-light" />
        </div>
        <div className="world-model-section__ripples" aria-hidden="true">
          <span className="world-model-section__ripple world-model-section__ripple--a" />
          <span className="world-model-section__ripple world-model-section__ripple--b" />
          <span className="world-model-section__ripple world-model-section__ripple--c" />
        </div>
        <img
          className="world-model-section__dots"
          src="/images/world-model/dot-field.svg"
          alt=""
          aria-hidden="true"
        />

        <h2
          id="world-model-heading"
          className="world-model-section__copy"
          aria-label={`${HEAD_COPY.join(' ')} ${TAIL_COPY.join(' ')}`}
        >
          <span className="world-model-section__drum">
            <span
              className="world-model-section__copy-block world-model-section__copy-block--head"
              aria-hidden="true"
            >
              <FillLines lines={HEAD_COPY} centerSlot={HEAD_CENTER_SLOT} />
            </span>
            <span
              className="world-model-section__copy-block world-model-section__copy-block--tail"
              aria-hidden="true"
            >
              <FillLines lines={TAIL_COPY} centerSlot={TAIL_CENTER_SLOT} />
            </span>
          </span>
        </h2>
      </div>
    </section>
  )
}
