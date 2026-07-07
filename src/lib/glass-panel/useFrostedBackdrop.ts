import { useEffect, useRef, type RefObject } from 'react'
import { GlassPanel } from './glass-panel.js'

function findBackdropImage(el: HTMLElement): HTMLImageElement | null {
  const root = el.closest('article, section, [class*="banner"]')
  if (!root) return null
  return root.querySelector('img')
}

function syncFrostedBackdrop(
  host: HTMLElement,
  surface: HTMLImageElement,
  source: HTMLImageElement,
) {
  const hostRect = host.getBoundingClientRect()
  const imageRect = source.getBoundingClientRect()
  const src = source.currentSrc || source.src

  if (!src || imageRect.width === 0 || imageRect.height === 0) return

  if (surface.src !== src) {
    surface.src = src
  }

  surface.style.width = `${imageRect.width}px`
  surface.style.height = `${imageRect.height}px`
  surface.style.left = `${imageRect.left - hostRect.left}px`
  surface.style.top = `${imageRect.top - hostRect.top}px`

  if (surface.dataset.glassReady === 'true') {
    GlassPanel.refreshPanel(surface)
  }
}

export function useFrostedBackdrop<T extends HTMLElement>(
  enabled = true,
  surfaceRef?: RefObject<HTMLImageElement | null>,
) {
  const hostRef = useRef<T | null>(null)
  const internalSurfaceRef = useRef<HTMLImageElement | null>(null)
  const layerRef = surfaceRef ?? internalSurfaceRef

  useEffect(() => {
    if (!enabled) return

    const host = hostRef.current
    const surface = layerRef.current
    if (!host || !surface) return

    const source = findBackdropImage(host)
    if (!source) return

    const refresh = () => {
      if (!host.isConnected || !source.isConnected) return
      syncFrostedBackdrop(host, surface, source)
    }

    const onSourceReady = () => refresh()
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'padding') refresh()
    }

    refresh()

    const resizeObserver = new ResizeObserver(() => refresh())
    resizeObserver.observe(host)
    resizeObserver.observe(source)

    window.addEventListener('resize', refresh, { passive: true })
    window.addEventListener('scroll', refresh, { passive: true })
    source.addEventListener('load', onSourceReady)
    host.addEventListener('transitionend', onTransitionEnd)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh)
      source.removeEventListener('load', onSourceReady)
      host.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [enabled, layerRef])

  return { hostRef, surfaceRef: layerRef }
}
