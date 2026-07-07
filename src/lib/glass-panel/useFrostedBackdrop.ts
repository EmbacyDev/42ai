import { useEffect, useRef } from 'react'

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
}

export function useFrostedBackdrop<T extends HTMLElement>(enabled = true) {
  const hostRef = useRef<T | null>(null)
  const backdropRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!enabled) return

    const host = hostRef.current
    const backdrop = backdropRef.current
    if (!host || !backdrop) return

    const source = findBackdropImage(host)
    if (!source) return

    const refresh = () => {
      if (!host.isConnected || !source.isConnected) return
      syncFrostedBackdrop(host, backdrop, source)
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
  }, [enabled])

  return { hostRef, backdropRef }
}
