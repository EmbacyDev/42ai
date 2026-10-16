import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './industryIconScene.css'

/** Shared PNG scene: separate transforms keep tab, idle and pointer motion additive. */
export default function IndustryIconScene({ items, activeIndex, ready = true, interactionRef }) {
  const sceneRef = useRef(null)
  const objectRefs = useRef([])
  const previousRef = useRef(null)
  const pointerRef = useRef(null)
  const pointerFrameRef = useRef(0)
  const pointerEventRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useLayoutEffect(() => {
    const scene = sceneRef.current
    const panel = interactionRef?.current
    const rows = panel?.querySelector('.solutions-section__list--active ul')
    if (!rows) return
    const topWithinPanel = node => {
      let top = 0
      for (let current = node; current && current !== panel; current = current.offsetParent) top += current.offsetTop
      return top
    }
    const align = () => {
      const offset = topWithinPanel(rows) + rows.offsetHeight / 2 - scene.offsetTop - scene.offsetHeight / 2
      scene.style.setProperty('--icon-align-y', `${offset}px`)
      // Compensate transparent padding using measured alpha bounds, without scaling.
      objectRefs.current.forEach((object, index) => {
        const img = object.querySelector('.industry-icon__image')
        if (!img.naturalWidth) return
        const renderedHeight = Math.min(object.clientHeight, object.clientWidth * img.naturalHeight / img.naturalWidth)
        object.style.setProperty('--icon-optical-y', `${(0.5 - (items[index].visualCenterY ?? 0.5)) * renderedHeight}px`)
      })
    }
    const observer = new ResizeObserver(align)
    observer.observe(panel)
    observer.observe(rows)
    observer.observe(scene)
    const images = [...scene.querySelectorAll('.industry-icon__image')]
    images.forEach(img => img.addEventListener('load', align))
    align()
    return () => {
      observer.disconnect()
      images.forEach(img => img.removeEventListener('load', align))
    }
  }, [activeIndex, interactionRef, items, ready])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    let intersecting = false
    const update = () => setVisible(intersecting && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting
      update()
    })
    observer.observe(sceneRef.current)
    document.addEventListener('visibilitychange', update)
    return () => {
      media.removeEventListener('change', change)
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useLayoutEffect(() => {
    const objects = objectRefs.current
    const incoming = objects[activeIndex]
    const previous = previousRef.current
    const outgoing = previous === null ? null : objects[previous]
    previousRef.current = activeIndex
    const sweeps = objects.map(node => node.querySelector('.industry-icon__sweep'))
    gsap.set(sweeps, { opacity: 0, xPercent: -120 })
    objects.forEach((node, index) => {
      if (index !== activeIndex && index !== previous) gsap.set(node, { autoAlpha: 0 })
    })
    if (reduced || !ready || previous === null) {
      objects.forEach((node, index) => gsap.set(node, {
        autoAlpha: index === activeIndex ? 1 : 0,
        scale: 1, rotationX: 0, rotationY: 0, y: 0,
      }))
      return
    }

    const timeline = gsap.timeline()
    if (outgoing && outgoing !== incoming) {
      timeline.to(outgoing, {
        autoAlpha: 0, scale: 0.93, rotationY: -12, rotationX: 3, y: 4,
        duration: 0.34, ease: 'power2.inOut',
      }, 0)
    }
    // A rapid return to a still-visible object continues from its current pose.
    if (Number(gsap.getProperty(incoming, 'opacity')) < 0.01) {
      gsap.set(incoming, { autoAlpha: 0, scale: 0.93, rotationY: 12, rotationX: -3, y: 5 })
    }
    timeline.to(incoming, {
      autoAlpha: 1, scale: 1, rotationY: 0, rotationX: 0, y: 0,
      duration: 0.64, ease: 'power3.out',
    }, outgoing !== incoming ? 0.12 : 0)
    const sweep = sweeps[activeIndex]
    timeline.to(sweep, { xPercent: 120, duration: 1.3, ease: 'sine.inOut' }, 0.22)
      .to(sweep, { opacity: 0.1 * (items[activeIndex].lightStrength ?? 1), duration: 0.3, ease: 'sine.inOut' }, 0.22)
      .to(sweep, { opacity: 0, duration: 0.45, ease: 'sine.inOut' }, 1.07)
    return () => timeline.kill()
  }, [activeIndex, ready, reduced, items])

  useLayoutEffect(() => {
    const object = objectRefs.current[activeIndex]
    const lightPosition = object.querySelector('.industry-icon__light-position')
    const surfaceLight = object.querySelector('.industry-icon__surface-light')
    const hoverLight = object.querySelector('.industry-icon__hover-light')
    // No perpetual masked animation: the scene settles completely at rest.
    if (!reduced && visible && ready) {
      const quick = (target, property) => gsap.quickTo(target, property, { duration: 0.6, ease: 'power2.out' })
      pointerRef.current = {
        lightX: quick(lightPosition, 'x'), lightY: quick(lightPosition, 'y'),
        ...(surfaceLight ? {
          hoverX: gsap.quickTo(hoverLight, 'x', { duration: 0.18, ease: 'power2.out' }),
          hoverY: gsap.quickTo(hoverLight, 'y', { duration: 0.18, ease: 'power2.out' }),
        } : {}),
      }
    }
    return () => {
      cancelAnimationFrame(pointerFrameRef.current)
      pointerFrameRef.current = 0
      Object.values(pointerRef.current ?? {}).forEach(tween => tween.tween.kill())
      pointerRef.current = null
      gsap.set(lightPosition, { x: 0, y: 0 })
      if (surfaceLight) gsap.set(surfaceLight, { '--turn-x': 0, '--turn-y': 0 })
      if (hoverLight) gsap.set(hoverLight, { x: 0, y: 0, clearProps: 'opacity' })
    }
  }, [activeIndex, reduced, visible, ready, items])

  const updatePointer = (event) => {
    const motion = pointerRef.current
    if (!motion || event.pointerType !== 'mouse') return
    const rect = (interactionRef?.current ?? sceneRef.current).getBoundingClientRect()
    const clamp = value => Math.max(-1, Math.min(1, value))
    const x = clamp((event.clientX - rect.left) / rect.width * 2 - 1)
    const y = clamp((event.clientY - rect.top) / rect.height * 2 - 1)
    motion.lightX(-x * 12)
    motion.lightY(-y * 9)
    motion.hoverX?.(x * 28)
    motion.hoverY?.(y * 24)
  }
  const move = event => {
    if (!pointerRef.current || event.pointerType !== 'mouse') return
    pointerEventRef.current = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType }
    if (pointerFrameRef.current) return
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = 0
      updatePointer(pointerEventRef.current)
    })
  }
  const reset = () => {
    cancelAnimationFrame(pointerFrameRef.current)
    pointerFrameRef.current = 0
    Object.values(pointerRef.current ?? {}).forEach(tween => tween(0))
  }

  useEffect(() => {
    // One shared hover area: crossing from the image to copy must not reset it.
    const target = interactionRef?.current ?? sceneRef.current
    target.addEventListener('pointerenter', move)
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerleave', reset)
    target.addEventListener('pointercancel', reset)
    return () => {
      cancelAnimationFrame(pointerFrameRef.current)
      pointerFrameRef.current = 0
      target.removeEventListener('pointerenter', move)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerleave', reset)
      target.removeEventListener('pointercancel', reset)
    }
  }, [interactionRef])

  return (
    <div ref={sceneRef} className="solutions-section__icon-stage industry-icon-scene"
      aria-hidden="true">
      {items.map((item, index) => (
        <div key={item.id} ref={node => { objectRefs.current[index] = node }}
          className="industry-icon__object" data-active={index === activeIndex}
          data-material={item.material ?? 'glass'}>
          {item.dimensionalLight && (
            <div className="industry-icon__contact" style={{ top: item.contactTop, '--contact-width': item.contactWidth, '--contact-center': item.contactLeft }}>
              <div className="industry-icon__contact-soft" />
            </div>
          )}
          <div className="industry-icon__idle">
            <div className="industry-icon__tilt">
              <img className="industry-icon__image" src={item.icon} alt="" draggable="false" />
              <div className="industry-icon__light-mask" style={{ '--icon-mask': `url("${item.icon}")` }}>
                {item.dimensionalLight && (
                  <div className="industry-icon__surface-light" style={{ opacity: Math.sqrt(item.lightStrength ?? 1) }}>
                    <div className="industry-icon__hover-light" />
                  </div>
                )}
                <div className="industry-icon__light-position">
                  <div className="industry-icon__reflection" />
                </div>
                <div className="industry-icon__sweep" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
