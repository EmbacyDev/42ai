import { useEffect, useRef } from 'react'
import { GlassPanel } from './glass-panel.js'

/**
 * Attach glass refraction to a DOM node rendered by React.
 * Call once per glass panel; re-inits when `deps` change.
 */
export function useGlassPanel<T extends HTMLElement>(enabled = true, deps: unknown[] = []) {
  const ref = useRef<T | null>(null)

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return ref
}
