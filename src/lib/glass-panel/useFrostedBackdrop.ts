import { useEffect, useRef, type RefObject } from 'react'
import { GlassPanel } from './glass-panel.js'

function findBackdropImage(el: HTMLElement): HTMLImageElement | null {
  const root = el.closest('article, section, [class*="banner"]')
  if (!root) return null
  return root.querySelector('img')
}

function syncFrostedBackdrop(
  host: HTMLElement,
  backdrop: HTMLElement,
  source: HTMLImageElement,
) {
  const hostRect = host.getBoundingClientRect()
  const imageRect = source.getBoundingClientRect()
  const src = source.currentSrc || source.src

  if (!src || imageRect.width === 0 || imageRect.height === 0) return

  backdrop.style.backgroundImage = `url("${src}")`
  backdrop.style.backgroundSize = `${imageRect.width}px ${imageRect.height}px`
  backdrop.style.backgroundPosition = `${imageRect.left - hostRect.left}px ${imageRect.top - hostRect.top}px`

  if (backdrop.dataset.glassReady === 'true') {
    GlassPanel.refreshPanel(backdrop)
  }
}

export function useFrostedBackdrop<T extends HTMLElement>(
  enabled = true,
  blurRef?: RefObject<HTMLSpanElement | null>,
  refractRef?: RefObject<HTMLSpanElement | null>,
) {
  const hostRef = useRef<T | null>(null)
  const internalBlurRef = useRef<HTMLSpanElement | null>(null)
  const internalRefractRef = useRef<HTMLSpanElement | null>(null)
  const blurLayerRef = blurRef ?? internalBlurRef
  const refractLayerRef = refractRef ?? internalRefractRef

  useEffect(() => {
    if (!enabled) return

    const host = hostRef.current
    const blurLayer = blurLayerRef.current
    const refractLayer = refractLayerRef.current
    if (!host || !blurLayer || !refractLayer) return

    const source = findBackdropImage(host)
    if (!source) return

    const refresh = () => {
      if (!host.isConnected || !source.isConnected) return
      syncFrostedBackdrop(host, blurLayer, source)
      syncFrostedBackdrop(host, refractLayer, source)
    }

    const onSourceReady = () => refresh()

    refresh()

    const resizeObserver = new ResizeObserver(() => refresh())
    resizeObserver.observe(host)
    resizeObserver.observe(source)

    window.addEventListener('resize', refresh, { passive: true })
    window.addEventListener('scroll', refresh, { passive: true })
    source.addEventListener('load', onSourceReady)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh)
      source.removeEventListener('load', onSourceReady)
    }
  }, [enabled, blurLayerRef, refractLayerRef])

  return { hostRef, blurLayerRef, refractLayerRef }
}
