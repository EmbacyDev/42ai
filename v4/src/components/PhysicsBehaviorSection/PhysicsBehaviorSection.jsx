import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { smootherstep } from '../HeroScene/scrollShrink.js'
import { WORLD_MODEL_ABSORBED_EVENT, WORLD_MODEL_BACK_EVENT, WORLD_MODEL_RETURN_EVENT } from '../WorldModelSection/worldModelHandoff.js'
import BehaviorNetworkTransition from './BehaviorNetworkTransition.jsx'
import NetworkLightShader from './NetworkLightShader.jsx'
import { crystalScreen } from '../HeroScene/crystalScreen.js'
import './physicsBehaviorSection.css'

const clamp01 = (value) => Math.min(1, Math.max(0, value))

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
  const glideToRestRef = useRef(() => {})
  const networkMotionRef = useRef({ network: 0 })
  const onCrystalAnchorRef = useRef(onCrystalAnchor)
  const onSectionVisibilityChangeRef = useRef(onSectionVisibilityChange)
  onCrystalAnchorRef.current = onCrystalAnchor
  onSectionVisibilityChangeRef.current = onSectionVisibilityChange

  useEffect(() => {
    const section = sectionRef.current
    const panel = panelRef.current
    if (!section || !panel) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 4→5: the crystal's liquid. Lives on the body, above the WebGL gem
    // (z33), so it visibly pours out of the cracked crystal — like the
    // 2→3 mask — and floods the whole screen before block five shows.
    const liquid = document.createElement('div')
    liquid.className = 'physics-liquid'
    liquid.setAttribute('aria-hidden', 'true')
    liquid.innerHTML = '<div class="physics-liquid__soft"><div class="physics-liquid__clip"><div class="physics-liquid__field"></div></div></div><div class="physics-liquid__light"></div>'
    document.body.appendChild(liquid)
    // Screen four starts in its first selected state. There is deliberately
    // no neutral stop with an intact crystal between screens three and four.
    const playhead = { value: 1 }
    let target = 1
    let tween = null
    let locked = false
    let suspended = false
    // v1: upward travel is plain scrolling. The pane keeps whatever state
    // it shows and simply slides away; the steps replay only going down.
    let lastScrollY = window.scrollY
    let lastWheel = -Infinity
    // After a 3→4 arrival the heading holds until the next scroll; only
    // that gesture brings the crystal to the centre with its tabs.
    let awaitingStart = false
    // Wheel input is held while block three's wave is still opening.
    let holdUntil = 0
    let touchY = null
    let touchUsed = false
    const names = ['one', 'two', 'three', 'four']
    const top = () => section.getBoundingClientRect().top + window.scrollY
    // Seven rests now (block five has three steps, not four).
    const stride = () => (section.offsetHeight - window.innerHeight) / 6
    const set = (key, value) => section.style.setProperty('--physics-' + key, String(value))
    const render = () => {
      const value = playhead.value
      const rect = section.getBoundingClientRect()
      // v1: block four arrives by plain scrolling. Its first state is fully
      // formed as soon as the pane enters the viewport and rides up with it.
      const visible = !suspended && rect.top < window.innerHeight && rect.bottom > 0
      const reveal = visible ? 1 : 0
      const states = names.map((_, i) => clamp01(value - i))
      states[0] *= reveal
      const portal = smootherstep(clamp01(value - 4))
      // The 4→5 transition is the first network chapter: dots emerge while
      // the crystal light dissolves into the card, with no separate intro stop.
      // Block five, three steps. The network still reads stage 0..4; step
      // two now covers stage 1..3 in one go: the universe changes
      // perspective and swirls until it has gathered into the sphere, while
      // the relation lines keep drawing across it.
      const stage = value <= 5
        ? clamp01(value - 4)
        : value <= 6 ? 1 + 2 * (value - 5) : 3 + clamp01(value - 6)
      const chapter = Math.max(1, Math.min(3, Math.ceil(value - 4)))
      networkMotionRef.current = { network: stage / 4, stage, visible: portal > .1 }
      set('reveal', reveal)
      set('descent', reveal)
      set('focus', reveal)
      // As in v2: the section heading only introduces the block and fades
      // out while the first facet separates, so the states fit one screen.
      // The heading is read first, then scrolls up and away while the
      // crystal rises into the centre; the rail arrives with the first state.
      const intro = smootherstep(clamp01(value))
      set('copy', reveal * (1 - smootherstep(clamp01((value - .25) / .6))) * (1 - portal))
      set('copy-shift', intro)
      set('rail-visible', reveal * smootherstep(clamp01((value - .35) / .55)) * (1 - portal))
      set('rail-hit', reveal > .5 && portal < .1 ? 'auto' : 'none')
      names.forEach((name, i) => {
        const copy = smootherstep(clamp01((value - i - .65) / .35))
          * (1 - smootherstep(clamp01((value - i - 1) / .3)))
        set('state-' + name, states[i])
        set('state-' + name + '-copy', copy * reveal * (1 - portal))
        set('state-' + name + '-rail', value >= i + .5 && value < i + 1.5 ? 1 : 0)
      })
      // Liquid: after the shards have split off (portal .3), the hexagon of
      // the gem's own colour grows from its silhouette past the screen
      // corners, holds, and dissolves into block five underneath.
      const flood = smootherstep(clamp01((portal - .3) / .4))
      // Leaves earlier, so block five's field and points are already there
      // under it instead of an empty background.
      const liquidOn = portal > .3 ? 1 - smootherstep(clamp01((portal - .68) / .22)) : 0
      const gemR = Math.max(20, crystalScreen.r || 80)
      const coverR = Math.hypot(window.innerWidth, window.innerHeight) / 0.866 * 0.62
      const lx = crystalScreen.valid ? crystalScreen.x : window.innerWidth / 2
      const ly = crystalScreen.valid ? crystalScreen.y : window.innerHeight / 2
      // The flood also drifts the centre to the middle of the screen.
      liquid.style.setProperty('--liquid-x', `${lx + (window.innerWidth / 2 - lx) * flood}px`)
      liquid.style.setProperty('--liquid-y', `${ly + (window.innerHeight / 2 - ly) * flood}px`)
      liquid.style.setProperty('--liquid-r', `${(gemR + (coverR - gemR) * flood).toFixed(1)}px`)
      liquid.style.setProperty('--liquid-opacity', (liquidOn * smootherstep(clamp01((portal - .3) / .06))).toFixed(3))
      liquid.style.setProperty('--liquid-swirl', `${(portal * 40).toFixed(2)}deg`)
      // The flash over the cut, as in 2→3: it flares as the liquid breaks
      // out of the gem and dies down while the flood fills the screen.
      const flash = smootherstep(clamp01((portal - .28) / .08)) * (1 - smootherstep(clamp01((portal - .5) / .3)))
      liquid.style.setProperty('--liquid-light', flash.toFixed(3))
      set('clean-frame', portal)
      set('portal', portal)
      // Light swells from the start, peaks as the glass is gone and fades
      // under the forming card.
      set('portal-aura', smootherstep(clamp01(portal / .5)) * (1 - smootherstep(clamp01((portal - .7) / .3))))
      set('portal-field', portal)
      set('portal-scale', .7 + portal * .3)
      set('portal-blur', (1 - portal) * 18 + 'px')
      set('network', stage / 4)
      // The card forms out of the light only after the glass has faded.
      set('network-intro', smootherstep(clamp01((portal - .38) / .4)))
      section.dataset.released = portal >= .995 ? 'true' : 'false'
      section.dataset.darkCard = portal >= .48 ? 'true' : 'false'
      section.dataset.chapter = String(chapter)
      section.dataset.step = String(target)
      const networkNode = section.querySelector('.physics-behavior-section__network')
      if (networkNode) networkNode.inert = portal < .95
      networkNode?.setAttribute('aria-hidden', portal < .95 ? 'true' : 'false')
      section.querySelectorAll('[data-network-step]').forEach((button, i) => {
        button.setAttribute('aria-selected', String(chapter === i + 1))
        button.tabIndex = portal > .95 ? 0 : -1
      })
      onCrystalAnchorRef.current?.(window.innerWidth * .5, window.innerHeight * .52, {
        sectionTop: rect.top, sectionBottom: rect.bottom,
        progress: (value - 1) / 7, reveal, descent: reveal, focus: reveal,
        stateOne: states[0], stateTwo: states[1], stateThree: states[2], stateFour: states[3],
        cleanFrame: portal, portal,
      })
    }
    const go = (index) => {
      if (suspended || locked || index < 1 || index > 7) return
      target = index
      locked = true
      tween?.kill()
      const destination = top() + (index - 1) * stride()
      // Only the playhead moves while a step plays; the page is placed at
      // the step's scroll position once, at the end. Scrolling the window
      // every frame under the pinned screen made it judder up and down.
      const travel = { value: playhead.value }
      tween = gsap.to(travel, {
        value: index,
        // 4→5 is a slow, readable sequence: the shards fly out, the glass
        // fades, its light swells and settles into the card. The portal
        // curve is eased already, so the playhead itself runs evenly.
        // State to state 1.5× slower (1.15 → 1.725s): turn first, then the facet.
        // 4→5 is slower than 2→3: the crack, then the liquid flooding out.
        // Block five's step two (index 6) carries two old steps: longer.
        duration: reduced ? .01 : index === 5 ? 4.2 : index === 6 ? 2.8 : index === 7 ? 1.8 : 1.725,
        ease: index === 5 ? 'sine.inOut' : 'power2.inOut',
        onUpdate: () => {
          playhead.value = travel.value
          render()
        },
        onComplete: () => {
          playhead.value = index
          window.scrollTo(0, destination)
          lastScrollY = window.scrollY
          locked = false
          render()
        },
      })
    }
    glideToRestRef.current = go
    // 3→4 arrival, rest to rest: the heading is read, then the crystal turns
    // a little and the first facet separates (playhead 0 → 1).
    const settleFirstFacet = (delay = 0) => {
      locked = true
      tween?.kill()
      tween = gsap.to(playhead, {
        value: 1,
        delay: reduced ? 0 : delay,
        // 1.5× slower: the turn, then the facet, both readable.
        duration: reduced ? .01 : 3.3,
        ease: 'power2.inOut',
        onUpdate: render,
        onComplete: () => {
          playhead.value = 1
          locked = false
          render()
        },
      })
    }
    // 4→3 is that arrival backwards: the facet rejoins the gem and the
    // heading comes back; then block three plays its wave backwards.
    const leaveToBlockThree = () => {
      awaitingStart = false
      locked = true
      tween?.kill()
      tween = gsap.to(playhead, {
        value: 0,
        duration: reduced ? .01 : 1.8,
        ease: 'power2.inOut',
        onUpdate: render,
        onComplete: () => {
          // Back on the heading; the next scroll up returns to block three.
          playhead.value = 0
          locked = false
          awaitingStart = true
          render()
        },
      })
    }
    const consume = (direction, event, fresh) => {
      const rect = section.getBoundingClientRect()
      if (suspended || rect.top > 2 || rect.bottom < window.innerHeight - 2) return false
      if (performance.now() < holdUntil) {
        event.preventDefault()
        return true
      }
      if (awaitingStart) {
        // On the heading: down starts the block, up returns to block three.
        event.preventDefault()
        if (!fresh || locked) return true
        if (direction > 0) {
          awaitingStart = false
          settleFirstFacet()
        } else {
          awaitingStart = false
          window.dispatchEvent(new CustomEvent(WORLD_MODEL_BACK_EVENT))
        }
        return true
      }
      if (direction < 0 && (locked || (target === 1 && Math.abs(rect.top) <= 2))) {
        // At the first rest (or mid-arrival): step back to the heading,
        // never a native jump up into block three's pinned track.
        event.preventDefault()
        if (fresh && (!locked || playhead.value < 1)) leaveToBlockThree()
        return true
      }
      if (direction < 0) {
        // Going up plays every step backwards, one gesture per step (block
        // five's steps, then the facets back into the gem, the heading, and
        // the wave back to block three). It used to jump to the top of the
        // track and hand over to native scrolling, which ran straight
        // through blocks three and two without any of their animations.
        event.preventDefault()
        if (!locked && fresh) {
          if (target <= 1) leaveToBlockThree()
          else go(target - 1)
        }
        return true
      }
      if (!locked && fresh && ((target === 7 && direction > 0) || (target === 1 && direction < 0))) return false
      event.preventDefault()
      if (!locked && fresh) go(target + direction)
      return true
    }
    const wheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < 1 || event.defaultPrevented) return
      const now = performance.now()
      const fresh = now - lastWheel > 220
      lastWheel = now
      consume(Math.sign(event.deltaY), event, fresh)
    }
    const touchStart = (event) => { touchY = event.touches[0]?.clientY; touchUsed = false }
    const touchMove = (event) => {
      if (touchY == null || event.touches.length !== 1) return
      const distance = touchY - event.touches[0].clientY
      if (Math.abs(distance) < 16) return
      if (consume(Math.sign(distance), event, !touchUsed)) touchUsed = true
    }
    const key = (event) => {
      if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select')) return
      const direction = ['ArrowDown','PageDown',' '].includes(event.key) ? 1 : ['ArrowUp','PageUp'].includes(event.key) ? -1 : 0
      if (direction) consume(direction, event, !event.repeat)
    }
    const scroll = () => {
      const y = window.scrollY
      const goingUp = y < lastScrollY
      lastScrollY = y
      const rect = section.getBoundingClientRect()
      // Block three no longer hands off with an event; native scroll into
      // this pane is enough to wake it up.
      if (suspended && rect.top < window.innerHeight * .5) suspended = false
      if (!locked && !suspended && rect.top > 1) {
        // Entering from above (or from block three): the crystal arrives
        // whole; the first facet detaches once the pane is reached.
        if (!goingUp || rect.top >= window.innerHeight) {
          target = 1
          playhead.value = 0
        }
      } else if (!locked && !suspended && !awaitingStart && playhead.value < 1 && target === 1 && !goingUp) {
        // Reached block four: the crystal turns a little and the first
        // facet separates, rest to rest, without moving the page.
        settleFirstFacet()
      } else if (!locked && !suspended && !awaitingStart && !goingUp) {
        const raw = Math.max(1, Math.min(7, 1 + (window.scrollY - top()) / stride()))
        // Native scrolling owns entry, exit, scrollbar and anchor navigation.
        target = Math.round(raw)
        playhead.value = target
      }
      render()
    }
    const returned = () => {
      awaitingStart = false
      suspended = true
      tween?.kill()
      locked = false
      target = 1
      playhead.value = 1
      render()
    }
    const arrived = () => {
      // Arrives under block three's wave: the heading is already there as
      // the wave opens, and stays until the next scroll.
      suspended = false
      locked = false
      tween?.kill()
      target = 1
      playhead.value = 0
      awaitingStart = true
      lastWheel = performance.now()
      holdUntil = lastWheel + 1250
      render()
    }
    window.addEventListener('wheel', wheel, { passive: false, capture: true })
    window.addEventListener('touchstart', touchStart, { passive: true })
    window.addEventListener('touchmove', touchMove, { passive: false })
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', scroll)
    window.addEventListener(WORLD_MODEL_RETURN_EVENT, returned)
    window.addEventListener(WORLD_MODEL_ABSORBED_EVENT, arrived)
    scroll()
    return () => {
      tween?.kill()
      liquid.remove()
      window.removeEventListener('wheel', wheel, { capture: true })
      window.removeEventListener('touchstart', touchStart)
      window.removeEventListener('touchmove', touchMove)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll)
      window.removeEventListener('resize', scroll)
      window.removeEventListener(WORLD_MODEL_RETURN_EVENT, returned)
      window.removeEventListener(WORLD_MODEL_ABSORBED_EVENT, arrived)
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
          <p className="physics-behavior-section__lead">
            Bringing together psychology, psychiatry, biology and neuroscience, we
            identified the foundational drivers of behavior - and build an AI that
            truly understands humans.
          </p>
        </div>

        <ol className="physics-behavior-section__state-rail" aria-label="Behavior model layers">
          {[
            ['one', 'Foundational traits', 1],
            ['two', 'Personal interpretation', 2],
            ['three', 'Personal context', 3],
            ['four', 'The event', 4],
          ].map(([step, label, restIndex]) => (
            <li
              key={step}
              className={`physics-behavior-section__state-rail-item physics-behavior-section__state-rail-item--${step}`}
            >
              <button
                type="button"
                className="physics-behavior-section__state-rail-button"
                onClick={() => glideToRestRef.current(restIndex)}
              >
                <span>{label}</span>
              </button>
            </li>
          ))}
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

        <div className="physics-behavior-section__portal-aura" aria-hidden="true" />
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
        <div className="physics-behavior-section__network" aria-hidden="true">
          <NetworkLightShader motionRef={networkMotionRef} />
          <BehaviorNetworkTransition motionRef={networkMotionRef} />
          <p className="physics-behavior-section__network-copy physics-behavior-section__network-copy--one">
            Inside our world model, each person’s traits, personality, and context come alive.
          </p>
          <p className="physics-behavior-section__network-copy physics-behavior-section__network-copy--two">
            It models their interactions to predict how that person responds, now and over time.
          </p>
          <p className="physics-behavior-section__network-copy physics-behavior-section__network-copy--three">
            Connecting millions of human worlds together,<br />creating the foundation for human-aligned AI.
          </p>
          <div className="physics-behavior-section__network-tabs" role="tablist" aria-label="World model stages">
            {[1, 2, 3].map(step => <button key={step} data-network-step={step} role="tab" aria-selected="false" onClick={() => glideToRestRef.current(4 + step)}>{step}</button>)}
          </div>
        </div>
      </div>
    </section>
  )
}
