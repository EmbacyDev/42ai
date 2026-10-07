import { useState } from 'react'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'
import './solutionsSection.css'

const TABS = ['Banks', 'Hedge Funds', 'Brokers', 'Physical AI', 'Foundational AI', 'Others']

const ROWS = [
  'See the book before it forms.',
  'Predict Delta & Gamma before exposure forms.',
  'Set margin and spreads against forward risk.',
  'Forecast hedge demand and liquidity needs.',
]

/**
 * Figma block 6 (450:7930). Industry pill, envelope, and the broker list.
 * Only the Brokers frame has copy, so the other pills switch selection
 * without inventing a second set of lines.
 */
export default function SolutionsSection() {
  const [activeTab, setActiveTab] = useState('Brokers')

  return (
    <section
      className="solutions-section"
      id="applications"
      aria-labelledby="solutions-heading"
    >
      <div className="solutions-section__intro">
        <h2 id="solutions-heading" className="solutions-section__title">
          Universal solution for human
          <br />
          and agentic behaviour.
        </h2>
        <p className="solutions-section__lead">
          One behavioral intelligence engine for your high-value environments.
        </p>
        <div className="solutions-section__tabs" role="tablist" aria-label="Industries">
          {TABS.map((tab) => {
            const active = tab === activeTab
            return (
              <button
                key={tab}
                type="button"
                className={`solutions-section__tab${active ? ' solutions-section__tab--active' : ''}`}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      <div className="solutions-section__panel">
        <img
          className="solutions-section__envelope"
          src="/images/v2/block6-envelope.png"
          alt=""
          width={267}
          height={312}
        />
        <div className="solutions-section__list">
          <ul>
            {ROWS.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          <RequestDemoButton className="solutions-section__more" label="Show more" />
        </div>
      </div>
    </section>
  )
}
