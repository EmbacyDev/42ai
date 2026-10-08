import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HERO_PIN_VIEWPORTS, smootherstep } from './scrollShrink.js'

gsap.registerPlugin(ScrollTrigger)

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * Pins the hero for one extra viewport of scroll and reports progress
 * (0 → 1) through that range via a ref. The pin is what makes the
 * crystal able to shrink and then travel independently of the page:
 * without it the whole hero would just scroll off. `+=100%` is chosen
 * so the pin releasing and block 2 filling the screen happen on the
 * same scroll pixel — pinSpacing is off so block 2 can ride up behind
 * the opaque pinned hero.
 *
 * Wheel/trackpad inside this pin is inertial: a tick accelerates, then
 * coasts and brakes. A committed downward gesture finishes the flight
 * onto block 2 on its own — the crystal is not left waiting for extra
 * scrolling.
 */
// v4: a wheel packet after this long a pause starts a new gesture.
const FRESH_GESTURE_GAP = 250

export function createHeroTransition({ heroEl, onProgress }) {
  const progress = { current: 0 }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const inertia = {
    active: false,
    current: 0,
    target: 0,
    lastWheelAt: 0,
    lastDelta: 0,
    snap: null,
    landFrom: 0,
    landStart: 0,
    landDuration: 0,
    raf: 0,
    lastTime: 0,
    writing: false,
  }

  const trigger = ScrollTrigger.create({
    trigger: heroEl,
    start: 'top top',
    end: () => `+=${window.innerHeight * HERO_PIN_VIEWPORTS}`,
    pin: true,
    // Subsequent sections must be allowed to ride up behind the pinned
    // hero. With spacing on, the pin would release a full viewport before
    // block 2 actually filled the screen.
    pinSpacing: false,
    invalidateOnRefresh: true,
    // Pins one tick early rather than exactly at the boundary — without it,
    // there's a single frame where the trigger has crossed its start point
    // but the pinned element hasn't switched to fixed positioning yet,
    // which shows up as a hairline gap/seam at the section boundary.
    anticipatePin: 1,
    scrub: true,
    onUpdate(self) {
      if (!inertia.active) progress.current = self.progress
      onProgress?.(progress.current)
    },
  })

  inertia.current = trigger.progress
  inertia.target = trigger.progress

  const pinSpan = () => Math.max(1, trigger.end - trigger.start)

  const writeProgress = (value) => {
    const next = Math.min(1, Math.max(0, value))
    inertia.writing = true
    window.scrollTo(0, trigger.start + next * pinSpan())
    inertia.writing = false
    progress.current = next
    onProgress?.(next)
  }

  const stopLoop = () => {
    if (inertia.raf) cancelAnimationFrame(inertia.raf)
    inertia.raf = 0
    inertia.active = false
    inertia.snap = null
  }

  const commitIfIdle = (now) => {
    if (inertia.snap != null) return
    if (now - inertia.lastWheelAt < 90) return
    const p = inertia.target
    const down = inertia.lastDelta > 0 || inertia.target >= inertia.current - 0.002
    if (down && p > 0.07) inertia.snap = 1
    else if (!down && p < 0.93) inertia.snap = 0
    else inertia.snap = p > 0.42 ? 1 : 0
    inertia.landFrom = inertia.current
    inertia.landStart = now
    inertia.landDuration = 0.85 + Math.abs(inertia.snap - inertia.current) * 0.75
    inertia.target = inertia.snap
  }

  const tick = (now) => {
    commitIfIdle(now)
    if (inertia.snap != null) {
      const t = Math.min(1, (now - inertia.landStart) / Math.max(16, inertia.landDuration * 1000))
      inertia.current = inertia.landFrom + (inertia.snap - inertia.landFrom) * smootherstep(t)
      writeProgress(inertia.current)
      if (t >= 1) {
        inertia.current = inertia.snap
        writeProgress(inertia.current)
        stopLoop()
        return
      }
      inertia.raf = requestAnimationFrame(tick)
      return
    }

    if (!inertia.lastTime) inertia.lastTime = now
    const dt = Math.min(0.05, (now - inertia.lastTime) / 1000)
    inertia.lastTime = now
    const k = 1 - Math.exp(-9.4 * dt)
    inertia.current += (inertia.target - inertia.current) * k
    writeProgress(inertia.current)
    if (Math.abs(inertia.target - inertia.current) < 0.0008 && now - inertia.lastWheelAt > 90) {
      commitIfIdle(now)
      inertia.raf = requestAnimationFrame(tick)
      return
    }
    inertia.raf = requestAnimationFrame(tick)
  }

  const startLoop = () => {
    if (inertia.raf) return
    inertia.active = true
    inertia.lastTime = 0
    inertia.raf = requestAnimationFrame(tick)
  }

  const ownsWheel = (deltaY) => {
    const y = window.scrollY
    const p = trigger.progress
    if (y < trigger.start - 8) return false
    if (p >= 0.999 && y >= trigger.end - 2) {
      if (deltaY > 0) return false
    }
    if (p <= 0.001 && deltaY < 0 && y <= trigger.start + 2) return false
    if (y > trigger.end + 24 && deltaY > 0) return false
    return y <= trigger.end + 24
  }

  const handleWheel = (event) => {
    if (event.defaultPrevented || event.ctrlKey) return
    if (reduceMotion) return
    if (!ownsWheel(event.deltaY)) return
    event.preventDefault()
    if (!inertia.active) {
      inertia.current = progress.current
      inertia.target = progress.current
    }
    // v4: one gesture, one move. The first packet commits the whole flight
    // (down → block two, up → hero) as a single eased landing. Before, the
    // crystal followed the wheel, braked with it, and only then a separate
    // landing accelerated it again — two steps with a pause in between.
    const now = performance.now()
    inertia.lastDelta = event.deltaY
    inertia.lastWheelAt = now
    const goal = event.deltaY > 0 ? 1 : 0
    // Only a fresh gesture may start (or reverse) the flight. Trackpad
    // momentum left over from another screen's gesture (e.g. arriving back
    // on block two from three) used to commit a flight to the hero.
    const fresh = gapBeforeThisWheel > FRESH_GESTURE_GAP
    if (!inertia.active && !fresh) return
    if (inertia.snap !== goal && Math.abs(event.deltaY) > 0.5 && (fresh || inertia.snap == null)) {
      inertia.snap = goal
      inertia.landFrom = inertia.current
      inertia.landStart = now
      inertia.landDuration = 0.5 + Math.abs(goal - inertia.current) * 1.1
      inertia.target = goal
    }
    startLoop()
  }

  const handleScroll = () => {
    if (inertia.writing || inertia.active) return
    inertia.current = trigger.progress
    inertia.target = trigger.progress
    progress.current = trigger.progress
  }

  // Every wheel packet, including ones other sections swallow, so the
  // gap before a packet tells a new gesture from momentum.
  let lastSeenWheelAt = 0
  let gapBeforeThisWheel = Infinity
  const noteWheel = () => {
    const now = performance.now()
    gapBeforeThisWheel = now - lastSeenWheelAt
    lastSeenWheelAt = now
  }
  window.addEventListener('wheel', noteWheel, { passive: true, capture: true })
  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('scroll', handleScroll, { passive: true })
  const onLeaveHero = () => stopLoop()
  window.addEventListener('42ai-block-handoff', onLeaveHero)

  // ScrollTrigger measures `heroEl` (and locks that measurement into the
  // pin-spacer/pinned element's own size) at the instant `create` runs —
  // if the page hasn't finished its first layout pass yet (React having
  // just mounted this in the same tick), that measurement can come back
  // 0×0, pinning the whole hero at zero size instead of a viewport's
  // worth. A refresh on the next frame re-measures against real layout
  // and corrects it; this is cheap and idempotent, so it's safe to always
  // do rather than trying to detect whether the first measurement was bad.
  requestAnimationFrame(() => ScrollTrigger.refresh())

  return {
    progress,
    dispose() {
      stopLoop()
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('wheel', noteWheel, { capture: true })
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('42ai-block-handoff', onLeaveHero)
      trigger.kill()
    },
  }
}
