import { useEffect, useRef } from 'react'
import { LiquidGlass } from '@ybouane/liquidglass'
import type { GlassConfig } from '@ybouane/liquidglass'

export function useLiquidGlass(
  rootRef: React.RefObject<HTMLElement | null>,
  defaults?: Partial<GlassConfig>,
) {
  const instanceRef = useRef<LiquidGlass | null>(null)
  const defaultsRef = useRef(defaults)
  defaultsRef.current = defaults

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let cancelled = false

    const setup = async () => {
      // The library only supports glass elements that are direct children
      // of the root — pass every marked element through so nested ones
      // trigger the library's console warning instead of failing silently.
      const glassElements = Array.from(
        root.querySelectorAll<HTMLElement>('[data-liquid-glass]'),
      )
      if (glassElements.length === 0) return

      const instance = await LiquidGlass.init({
        root,
        glassElements,
        defaults: defaultsRef.current,
      })

      if (cancelled) {
        instance.destroy()
        return
      }

      instanceRef.current = instance

      root.querySelectorAll('img').forEach((img) => {
        const refresh = () => instance.markChanged(img)
        if (img.complete) return
        img.addEventListener('load', refresh, { once: true })
      })
    }

    void setup()

    return () => {
      cancelled = true
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [rootRef])

  return instanceRef
}
