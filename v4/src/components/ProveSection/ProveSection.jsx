import { useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './proveSection.css'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'

/**
 * Figma block 7 (307:31179). Proof banner with the request-demo pill.
 */
export default function ProveSection() {
  const rootRef = useRef(null)
  useSequentialReveal(rootRef)

  return (
    <section className="prove-section" id="request-demo" aria-labelledby="prove-heading" ref={rootRef}>
      <div className="prove-section__card">
        <div className="prove-section__copy scroll-reveal" data-reveal="0">
          <h2 id="prove-heading">
            <span className="prove-section__line">Don’t trust us. Let us prove</span>
            <span className="prove-section__line">it on your data</span>
          </h2>
          <p className="prove-section__line">for your most difficult &amp; valuable problems</p>
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
