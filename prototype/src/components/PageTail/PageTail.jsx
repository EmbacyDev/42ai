import { useEffect, useRef } from 'react'
import RulesBehindSection from '../RulesBehindSection/RulesBehindSection.jsx'
import SolutionsSection from '../SolutionsSection/SolutionsSection.jsx'
import ProveSection from '../ProveSection/ProveSection.jsx'
import BreakthroughsSection from '../BreakthroughsSection/BreakthroughsSection.jsx'
import SiteFooter from '../SiteFooter/SiteFooter.jsx'

export default function PageTail({ onVisibilityChange }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const node = rootRef.current
    if (!node || !onVisibilityChange) return undefined
    if (!('IntersectionObserver' in window)) {
      onVisibilityChange(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibilityChange(entry.isIntersecting && entry.intersectionRatio >= 0.02)
      },
      { threshold: [0, 0.02, 0.08] },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [onVisibilityChange])

  return (
    <div ref={rootRef}>
      {/* Temporarily unmounted with block 4. Block 5 is the portal that
          section scrolls into, and it was stalling the screens below. */}
      {false && <RulesBehindSection />}
      <SolutionsSection />
      <ProveSection />
      <BreakthroughsSection />
      <SiteFooter />
    </div>
  )
}
