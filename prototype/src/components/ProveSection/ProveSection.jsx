import { useRef, useState } from 'react'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './proveSection.css'

/**
 * Figma block 7 (450:4647). Hovering the card plays the same morph
 * as hovering the Request demo button itself.
 */
export default function ProveSection() {
  const rootRef = useRef(null)
  const [cardHot, setCardHot] = useState(false)
  useSequentialReveal(rootRef)

  return (
    <section className="prove-section" id="request-demo" aria-labelledby="prove-heading" ref={rootRef}>
      <div
        className="prove-section__card"
        onPointerEnter={() => setCardHot(true)}
        onPointerLeave={() => setCardHot(false)}
      >
        <div className="prove-section__copy scroll-reveal" data-reveal="0">
          <h2 id="prove-heading">
            <span className="prove-section__line">Don’t trust us. Let us prove</span>
            <span className="prove-section__line">it on your data</span>
          </h2>
          <p className="prove-section__line">for your most difficult &amp; valuable problems</p>
        </div>
        <RequestDemoButton className="prove-section__cta" forceHover={cardHot} />
      </div>
    </section>
  )
}
