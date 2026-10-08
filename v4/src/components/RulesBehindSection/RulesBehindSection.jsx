import { useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './rulesBehindSection.css'

// Positions are the Figma dots inside the 1280×720 panel (450:6592).
const DOTS = [
  { x: 173.113, y: 234.994, label: true },
  { x: 214.578, y: 193.917, label: true },
  { x: 272.39, y: 256.199, label: true },
  { x: 193.359, y: 307.935, label: true },
  { x: 361.306, y: 356.079, label: true },
  { x: 952.398, y: 175, label: false },
  { x: 134, y: 369.754, label: false },
  { x: 785, y: 292.07, label: false },
  { x: 241.361, y: 363.189, label: false },
  { x: 294.287, y: 206.182, label: false },
  { x: 320.275, y: 313.952, label: false },
  { x: 188.436, y: 438.137, label: false },
  { x: 887.984, y: 292.07, label: false },
  { x: 1004.234, y: 349.512, label: false },
  { x: 823.703, y: 366.473, label: false },
  { x: 868.836, y: 225.875, label: true },
  { x: 916.844, y: 396.012, label: true },
  { x: 973.188, y: 259.246, label: true },
  { x: 358.224, y: 195.684, label: true },
]

const PANEL_W = 1280
const PANEL_H = 720
const DOT = 6.625

/**
 * Figma block 5 (307:31102). A pale field of dated points and the
 * centred line about the rules behind behaviour.
 */
export default function RulesBehindSection() {
  const rootRef = useRef(null)
  useSequentialReveal(rootRef)

  return (
    <section className="rules-section" aria-labelledby="rules-behind-heading" ref={rootRef}>
      <div className="rules-section__panel">
        <div className="rules-section__field" aria-hidden="true">
          {DOTS.map((dot) => (
            <span
              key={`${dot.x}-${dot.y}`}
              className="rules-section__point"
              style={{
                left: `${((dot.x + DOT / 2) / PANEL_W) * 100}%`,
                top: `${((dot.y + DOT / 2) / PANEL_H) * 100}%`,
              }}
            >
              <span className="rules-section__dot" />
              {dot.label ? <span className="rules-section__date">12.06.21</span> : null}
            </span>
          ))}
        </div>
        <h2 id="rules-behind-heading" className="rules-section__title">
          42AI learns the rules behind behaviour.
        </h2>
      </div>
    </section>
  )
}
