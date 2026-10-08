import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createHeroLight } from '../components/HeroScene/heroLight.js'
import { crystalScreen } from '../components/HeroScene/crystalScreen.js'
import { facetBeamState } from './facetBeamState.js'

/**
 * Block four: the hero's hover beam, aimed from the crystal at the facet
 * that has just separated. Drawn in its own premultiplied canvas for the
 * same reason as HeroLightLayer — inside the straight-alpha crystal
 * canvas the light composites as white rectangles.
 */
export default function FacetLightLayer({ config }) {
  const hostRef = useRef(null)
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    const canvas = renderer.domElement
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    host.appendChild(canvas)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    // One hover beam per facet; every facet that has left keeps its light.
    // The light cycles flow colours 1-4 evenly; lead with green so violet
    // (slot one of the crystal palette) stays an accent here too.
    const base = configRef.current || {}
    const lightConfig = {
      ...base,
      friendFlowColor1: base.friendFlowColor3 ?? '#29ae57',
      friendFlowColor2: base.friendFlowColor2 ?? '#1d81ed',
      friendFlowColor3: base.friendFlowColor4 ?? '#29ae57',
      friendFlowColor4: base.friendFlowColor1 ?? '#756cff',
    }
    const lights = [1, 2, 3, 4].map(() => createHeroLight(lightConfig))
    lights.forEach((light) => scene.add(light.object))

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
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const delta = clock.getDelta()
      const crystal = crystalScreen.valid ? crystalScreen : null
      const s = Math.max(40, (crystalScreen.r || 120) * 0.38)
      let poured = 0
      for (let state = 1; state <= 4; state += 1) {
        const facet = facetBeamState.facets[state]
        if (facet) poured += Math.min(1, Math.max(0, facet.progress))
      }
      // The first light carries the shared glow; it swells as facets leave.
      let newest = 0
      for (let state = 4; state >= 1; state -= 1) {
        if ((facetBeamState.facets[state]?.progress ?? 0) > 0.35) { newest = state; break }
      }
      let firstLit = -1
      lights.forEach((light, index) => {
        const facet = facetBeamState.facets[index + 1]
        const hover = facet && facet.progress > 0.35
          ? { cardId: index + 1, x: facet.x, y: facet.y, rect: [facet.x - s, facet.y - s, facet.x + s, facet.y + s] }
          : null
        if (hover && firstLit < 0) firstLit = index
        light.update(clock.elapsedTime, delta, {
          width,
          height,
          crystal,
          hover,
          inHero: true,
          idleOff: true,
          volume: poured / 4,
          ringOn: index === Math.max(firstLit, 0) ? 1 : 0,
          // Every facet keeps its beam; the newest leads, earlier ones glow
          // quieter so stacked beams do not burn out the page.
          gain: index + 1 === newest ? 0.85 : 0.4,
        })
      })
      // 4→5: this light fades together with the glass, while the swelling
      // portal light takes over, so no zoomed blob is left over the card.
      const portal = Number(document.querySelector('.physics-behavior-section')
        ?.style.getPropertyValue('--physics-portal')) || 0
      const t = Math.min(1, Math.max(0, (portal - 0.15) / 0.4))
      const fade = 1 - t * t * (3 - 2 * t)
      host.style.opacity = fade.toFixed(3)
      const anyVisible = fade > 0.002 && lights.some((light) => light.object.visible)
      if (anyVisible) {
        renderer.render(scene, camera)
        drawn = true
      } else if (drawn) {
        renderer.clear()
        drawn = false
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      lights.forEach((light) => light.dispose())
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
