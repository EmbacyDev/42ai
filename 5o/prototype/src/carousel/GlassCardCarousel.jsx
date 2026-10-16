import { useEffect, useMemo, useRef, useState } from 'react'
import { useControls, Leva } from 'leva'
import * as THREE from 'three'
import { Carousel, CAROUSEL_REV } from './Carousel.js'
import { CARDS } from './cards.js'
import './glassCardCarousel.css'

/**
 * Ported from the standalone `files/glass-card-carousel` project — same
 * `Carousel.js`/`shaders.js`/`cards.js`, unchanged, so it stays a drop-in
 * update if that project moves on. Only this wrapper and its CSS differ
 * from that project's own `App.jsx`/`index.css`: there it owns the whole
 * page (`html, body, #root { height:100%; overflow:hidden }`, `.stage`
 * at 100vw/100vh); here it's the hero's second section, so it can't touch
 * anything outside its own box — see glassCardCarousel.css.
 */

function projectToScreen(x, y, z, camera, width, height) {
  const v = new THREE.Vector3(x, y, z).project(camera)
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
  }
}

function ArrowIcon({ dir }) {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d={dir === 'left' ? 'M15 5L8 12L15 19' : 'M9 5L16 12L9 19'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ensureOverlayNode(layer, nodes, overlay) {
  let el = nodes.get(overlay.id)
  if (el) return el
  el = document.createElement('div')
  el.className = 'card-text'
  if (overlay.card.figmaCard) el.classList.add('is-figma-reference')
  const headline = document.createElement('p')
  headline.className = 'headline'
  headline.textContent = overlay.card.headline
  el.appendChild(headline)
  const category = document.createElement('p')
  category.className = 'category'
  category.textContent = overlay.card.category
  el.appendChild(category)
  layer.appendChild(el)
  nodes.set(overlay.id, el)
  return el
}

function smooth01(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export default function GlassCardCarousel({
  backgroundColor = '#f7f7f6',
  // Called every carousel frame with the crystal's landing spot in
  // VIEWPORT pixels (not container-local — PageCrystal.jsx is a
  // position:fixed overlay, so it needs coordinates in that same space to
  // track a target that moves as the page scrolls this section into
  // view). Optional so this component still works stood up on its own.
  onCrystalAnchor,
  onSectionVisibilityChange,
} = {}) {
  const sectionRef = useRef(null)
  const containerRef = useRef(null)
  const overlayLayerRef = useRef(null)
  const overlayNodesRef = useRef(new Map())
  const carouselRef = useRef(null)
  const lastActiveRef = useRef(CARDS.find((c) => c.kind === 'photo')?.id ?? CARDS[0].id)
  const [activeCardId, setActiveCardId] = useState(lastActiveRef.current)

  // A ref, not a dependency of the mount effect below: onCrystalAnchor is
  // commonly an inline arrow (HeroTestPage.jsx), a fresh function every
  // render — the effect only runs once (see its own deps), so it needs
  // to read the latest version through here rather than closing over
  // whatever was passed on the first render.
  const onCrystalAnchorRef = useRef(onCrystalAnchor)
  onCrystalAnchorRef.current = onCrystalAnchor
  const onSectionVisibilityChangeRef = useRef(onSectionVisibilityChange)
  onSectionVisibilityChangeRef.current = onSectionVisibilityChange

  const params = useControls('Glass Carousel', {
    blurAmount: { value: 0.34, min: 0, max: 1, step: 0.01 },
    distortionStrength: { value: 0.77, min: 0, max: 1, step: 0.01 },
    debugWireframe: { value: false },
    glassDepth: { value: 71, min: 0, max: 100, step: 1 },
    glassDispersion: { value: 1, min: 0, max: 2, step: 0.01 },
    glassSplay: { value: 0.64, min: 0, max: 1, step: 0.01 },
    cardFold: { value: 1.0, min: 0, max: 1, step: 0.01 },
    sideGap: { value: 0.58, min: 0.35, max: 1.6, step: 0.01 },
    // 2/3 of the former size: the cards are now exactly 1.5x smaller.
    activeScale: { value: 2 / 3, min: 0.5, max: 1.3, step: 0.01 },
    transitionDuration: { value: 1.32, min: 0.3, max: 2.2, step: 0.01 },
    autoPlay: { value: true },
    autoInterval: { value: 5, min: 2, max: 12, step: 1 },
    autoResumeDelay: { value: 8, min: 3, max: 20, step: 1 },
  })

  useEffect(() => {
    const section = sectionRef.current
    if (!section || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        onSectionVisibilityChangeRef.current?.(
          entry.isIntersecting && entry.intersectionRatio >= 0.08,
        )
      },
      { threshold: [0, 0.08, 0.2] },
    )
    observer.observe(section)
    return () => {
      observer.disconnect()
      onSectionVisibilityChangeRef.current?.(false)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    const layer = overlayLayerRef.current
    const nodes = overlayNodesRef.current
    const carousel = new Carousel(el, CARDS, { ...params, clearColor: backgroundColor }, {
      onLayout: (list, ctx) => {
        const rect = el.getBoundingClientRect()
        if (ctx.crystalWorld && onCrystalAnchorRef.current) {
          const local = projectToScreen(
            ctx.crystalWorld.x,
            ctx.crystalWorld.y,
            ctx.crystalWorld.z,
            ctx.camera,
            rect.width,
            rect.height,
          )
          onCrystalAnchorRef.current(
            rect.left + local.x,
            rect.top + local.y,
            { sectionTop: rect.top, sectionBottom: rect.bottom },
          )
        }
        const seen = new Set()
        let closest = null
        for (const o of list) {
          const origin = projectToScreen(o.worldX, o.worldY, o.worldZ, ctx.camera, rect.width, rect.height)
          const right = projectToScreen(o.worldRightX, o.worldY, o.worldZ, ctx.camera, rect.width, rect.height)
          const node = ensureOverlayNode(layer, nodes, o)
          seen.add(o.id)
          const width = Math.max(80, right.x - origin.x)
          const isActive = o.focus > 0.55
          node.classList.toggle('is-active', isActive)
          node.classList.toggle('dim', !isActive)
          node.style.width = `${width}px`
          node.style.zIndex = String(Math.round(o.focus * 100))
          node.style.transform = `translate(${origin.x}px, ${origin.y}px) translate(0, -100%)`
          node.style.opacity = String(Math.max(0, 1 - Math.max(0, o.absOffset - 1.15) * 1.4))
          const catSize = Math.max(12, width * 0.075)
          const headSize = Math.max(14, width * 0.078)
          const category = node.querySelector('.category')
          const headline = node.querySelector('.headline')
          if (category) {
            category.style.fontSize = isActive ? `${Math.max(10, width * 0.036)}px` : `${catSize}px`
          }
          if (headline) {
            headline.style.fontSize = `${headSize}px`
            headline.style.width = isActive ? `${width * (257 / 303)}px` : '100%'
            headline.style.opacity = String(smooth01((o.focus - 0.45) / 0.4))
            headline.style.maxHeight = o.focus > 0.45 ? '8em' : '0px'
          }
          // The text remains a separate, flat DOM layer throughout the
          // transition. Its safe width follows the live deformation
          // continuously, so it never snaps into or out of the bent area.
          if (o.side !== 0 && o.deformation > 0.001) {
            const safeWidth = width * (1 - 0.36 * smooth01(o.deformation))
            node.style.width = `${safeWidth}px`
            if (o.side > 0) {
              node.style.transform = `translate(${origin.x + width - safeWidth}px, ${origin.y}px) translate(0, -100%)`
            }
          }
          if (!closest || o.absOffset < closest.absOffset) closest = o
        }
        for (const [id, node] of nodes) {
          if (!seen.has(id)) {
            node.remove()
            nodes.delete(id)
          }
        }
        if (closest && closest.card.id !== lastActiveRef.current) {
          lastActiveRef.current = closest.card.id
          setActiveCardId(closest.card.id)
        }
      },
    })
    carouselRef.current = carousel
    return () => {
      carousel.dispose()
      carouselRef.current = null
      for (const node of nodes.values()) node.remove()
      nodes.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CAROUSEL_REV])

  useEffect(() => {
    carouselRef.current?.updateParams(params)
    if (overlayLayerRef.current) {
      overlayLayerRef.current.style.visibility = params.debugWireframe ? 'hidden' : 'visible'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.blurAmount,
    params.distortionStrength,
    params.debugWireframe,
    params.glassDepth,
    params.glassDispersion,
    params.glassSplay,
    params.cardFold,
    params.sideGap,
    params.activeScale,
    params.transitionDuration,
    params.autoPlay,
    params.autoInterval,
    params.autoResumeDelay,
  ])

  const uniqueCards = useMemo(() => CARDS, [])

  return (
    <section ref={sectionRef} className="glass-carousel-section" aria-label="Solutions" style={{ background: backgroundColor }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <div className="overlay-layer" ref={overlayLayerRef} />

      <div className="dots">
        {uniqueCards.map((c) => (
          <div
            key={c.id}
            className={`dot ${c.id === activeCardId ? 'is-active' : ''}`}
            onClick={() => carouselRef.current?.goToCardId(c.id)}
          />
        ))}
      </div>

      <div className="nav-arrows">
        <div className="nav-btn" onClick={() => carouselRef.current?.prev(true)}>
          <ArrowIcon dir="left" />
        </div>
        <div className="nav-btn" onClick={() => carouselRef.current?.next(true)}>
          <ArrowIcon dir="right" />
        </div>
      </div>

      <Leva
        hidden={!new URLSearchParams(window.location.search).has('debug')}
        collapsed
        titleBar={{ title: 'Glass Carousel' }}
      />
    </section>
  )
}
