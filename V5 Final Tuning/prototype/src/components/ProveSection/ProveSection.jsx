import AnimatedHeading from '../AnimatedHeading.jsx'
import { useRef, useState } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './proveSection.css'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'

/**
 * Figma block 7 (307:31179). Proof banner with the request-demo pill.
 */
export default function ProveSection() {
  const rootRef = useRef(null)
  const [headingReady, setHeadingReady] = useState(false)
  useSequentialReveal(rootRef)

  return (
    <section className="prove-section" id="request-demo" aria-labelledby="prove-heading" ref={rootRef}>
      <div className="prove-section__card">
        <div className="prove-section__copy scroll-reveal" data-reveal="0">
          <AnimatedHeading as="h2" id="prove-heading" speed={1.95}
            onRevealComplete={() => setHeadingReady(true)} onRevealReset={() => setHeadingReady(false)}>
            <span className="prove-section__line">Don’t trust us. Let us prove</span>
            <span className="prove-section__line">it on your data</span>
          </AnimatedHeading>
          <p className={`prove-section__line prove-section__subtitle${headingReady ? ' is-visible' : ''}`}>for your most difficult &amp; valuable problems</p>
        </div>
        <RequestDemoButton
          className="prove-section__cta scroll-reveal"
          data-reveal="1"
          href="#request-demo"
          label="Request demo"
          widen={6.922}
        />
      </div>
    </section>
  )
}
