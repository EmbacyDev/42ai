import { useEffect } from 'react'

/**
 * Fade each `[data-reveal]` child in, in source order, once it enters
 * the viewport. Delay is tied to the attribute so items that cross the
 * threshold together still appear one after another.
 */
export function useSequentialReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const nodes = [...root.querySelectorAll('[data-reveal]')]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-in'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const index = Number(entry.target.getAttribute('data-reveal') || 0)
          entry.target.style.transitionDelay = `${index * 140}ms`
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.28, rootMargin: '0px 0px -8% 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [rootRef])
}
