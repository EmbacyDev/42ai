import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createHeroLight } from '../components/HeroScene/heroLight.js'
import { crystalScreen } from '../components/HeroScene/crystalScreen.js'
import { heroLightState } from '../components/HeroScene/heroLightState.js'

/**
 * The hero crystal light in its own transparent canvas, stacked just above
 * the crystal canvas. It is kept out of the crystal canvas because that one
 * is straight-alpha and post-processed, which Safari composites as a white
 * wash. Photos and tags are masked out (rects from the hero scene), so the
 * light reads as passing behind them. Hero only.
 */
export default function HeroLightLayer({ config }) {
  const hostRef = useRef(null)
  // Created once; later config changes (the pulse) only matter for colour.
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true })
    renderer.setClearColor(0x000000, 0)
    // v4: the light is soft and blurry by nature; at 1× it looks the same
    // and the full-screen shader shades up to 2.25× fewer pixels.
    renderer.setPixelRatio(1)
    const canvas = renderer.domElement
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    host.appendChild(canvas)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const light = createHeroLight(configRef.current)
    scene.add(light.object)

    let width = 0
    let height = 0
    const resize = () => {
      width = host.clientWidth
      height = host.clientHeight
      renderer.setSize(width, height, false)
    }
    resize()
    window.addEventListener('resize', resize)

    const clock = new THREE.Clock()
    let raf = 0
    let drawn = false
    // v4: drawn right after the crystal writes its position (PageCrystal's
    // frame calls crystalScreen.afterFrame), so the rays move in the same
    // frame as the gem instead of a frame behind. The own rAF loop only
    // draws when the crystal canvas has not ticked for a moment.
    let lastSynced = 0
    let block2Covers = false
    let measureRaf = 0
    const measure = () => {
      measureRaf = 0
      const section = document.querySelector('.block24-section')
      if (!section) { block2Covers = false; return }
      const r = section.getBoundingClientRect()
      const mid = window.innerHeight / 2
      block2Covers = r.top <= mid && r.bottom >= mid
    }
    const scheduleMeasure = () => {
      if (!measureRaf) measureRaf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    const draw = () => {
      const delta = clock.getDelta()
      // v4: block two keeps the crystal's rays, drawn tighter around it.
      // "On block two" = its section covers the middle of the viewport.
      // Read from the scroll listener below, not measured here: this runs
      // inside the crystal's frame, and a layout read there forced a reflow
      // every frame.
      const onBlock2 = !heroLightState.inHero && block2Covers
      // v4: opening block three, the light behind the gem swells and
      // spreads with the colour, then gives way once the field is full.
      const opening = Math.min(1, Math.max(0, crystalScreen.worldExpansion ?? 0))
      const onOpening = opening > 0.005
      const swell = opening * (1 - Math.min(1, Math.max(0, (opening - 0.85) / 0.15)))
      light.update(clock.elapsedTime, delta, {
        width,
        height,
        spread: onOpening ? 0.45 + 4 * opening : onBlock2 ? 0.45 : 1,
        // v4: a quarter as strong on block two.
        gain: onOpening ? 0.25 + 2.75 * swell : onBlock2 ? 0.25 : 1,
        // Toward block three's teal-mint field, so the light hands over
        // to that background without a change of colour.
        tint: Math.min(1, opening * 2.5),
        crystal: crystalScreen.valid ? crystalScreen : null,
        // v4: no hover beam to the cards, only the idle rays behind the crystal.
        hover: null,
        inHero: heroLightState.inHero || onBlock2 || onOpening,
        masks: heroLightState.inHero ? heroLightState.masks : [],
      })
      if (light.object.visible) {
        renderer.render(scene, camera)
        drawn = true
      } else if (drawn) {
        renderer.clear()
        drawn = false
      }
    }
    crystalScreen.afterFrame = () => {
      lastSynced = performance.now()
      draw()
    }
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (performance.now() - lastSynced > 100) draw()
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      crystalScreen.afterFrame = null
      cancelAnimationFrame(measureRaf)
      window.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('resize', resize)
      light.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
