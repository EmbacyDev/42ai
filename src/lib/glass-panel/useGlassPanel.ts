import { useEffect, useRef, type RefObject } from 'react'
import { GlassPanel } from './glass-panel.js'

/**
 * Attach glass refraction to a DOM node rendered by React.
 * Call once per glass panel; re-inits when `deps` change.
 */
export function useGlassPanel<T extends HTMLElement>(
  enabled = true,
  deps: unknown[] = [],
  externalRef?: RefObject<T | null>,
) {
  const internalRef = useRef<T | null>(null)
  const ref = externalRef ?? internalRef

  useEffect(() => {
    if (!enabled) return

    const panel = ref.current
    if (!panel) return

    GlassPanel.initPanel(panel)
    GlassPanel.refreshPanel(panel)

    return () => {
      delete panel.dataset.glassReady
      delete panel.dataset.glassFilterId
      delete panel.dataset.glassFallback
      panel.classList.remove('glass-panel')
      panel.style.removeProperty('--glass-filter-url')
      panel.style.removeProperty('--glass-blur')
      panel.style.removeProperty('--glass-saturation')
      panel.style.removeProperty('filter')
      panel.style.removeProperty('-webkit-filter')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ref, ...deps])

  return ref
}
