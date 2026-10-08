import { useState } from 'react'
import './solutionsSection.css'
import { ScrambleLink } from '../Scramble/ScrambleText.jsx'

const SOLUTIONS = [
  { name: 'Banks', image: 'applications-tablet.png', lines: [
    'See the balance sheet before it moves.',
    'Predict deposits, withdrawals, draws and repayments.',
    'Stress-test behaviour through rate and market shocks.',
    'Forecast client liquidity and hedge demand.',
  ] },
  { name: 'Hedge Funds', image: 'slide-hedge.png', lines: ['Alternative alpha in human behaviour.'] },
  { name: 'Brokers', image: 'icy-glass-folders.png', lines: [
    'See the book before it forms.',
    'Predict Delta & Gamma before exposure forms.',
    'Set margin and spreads against forward risk.',
    'Forecast hedge demand and liquidity needs.',
  ] },
  { name: 'Physical AI', image: 'slide-ai.png', lines: ['Give AI human intuition and simulate real reactions.'] },
  { name: 'Foundational AI', image: 'slide-personalized.png', lines: ['Know who to target, what to offer, when to say it, and why.'] },
  { name: 'Treasury', image: 'slide-simulation.png', lines: ['Simulate real human reactions.'] },
]

export default function SolutionsSection() {
  const [active, setActive] = useState(() => window.matchMedia('(max-width: 980px)').matches ? 0 : 2)
  const solution = SOLUTIONS[active]
  const selectTab = (event, index) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % SOLUTIONS.length
    else if (event.key === 'ArrowLeft') next = (index + SOLUTIONS.length - 1) % SOLUTIONS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = SOLUTIONS.length - 1
    else return
    event.preventDefault()
    setActive(next)
    event.currentTarget.parentElement.children[next].focus()
  }
  return (
    <section className="solutions-section" id="applications" aria-labelledby="solutions-heading">
      <div className="solutions-section__intro">
        <h2 id="solutions-heading" className="solutions-section__title">
          Universal solution for human<br />and agentic behaviour.
        </h2>
        <p className="solutions-section__lead">One behavioral intelligence engine for your high-value environments.</p>
        <div className="solutions-section__tabs" role="tablist" aria-label="Industries">
          {SOLUTIONS.map((item, index) => (
            <button key={item.name} type="button" role="tab" id={`solution-tab-${index}`}
              aria-selected={active === index} aria-controls="solution-panel"
              tabIndex={active === index ? 0 : -1}
              className={`solutions-section__tab${active === index ? ' solutions-section__tab--active' : ''}`}
              onClick={() => setActive(index)} onKeyDown={(event) => selectTab(event, index)}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className={`solutions-section__body${active === 2 ? ' solutions-section__body--brokers' : ''}`}
        id="solution-panel" role="tabpanel" aria-labelledby={`solution-tab-${active}`} tabIndex={0}>
        <div className="solutions-section__image"><img src={`/images/figma/${solution.image}`} alt="" loading="lazy" /></div>
        <div className="solutions-section__details">
          <ul className="solutions-section__benefits">{solution.lines.map((line) => <li key={line}>{line}</li>)}</ul>
          <ScrambleLink className="solutions-section__more" href="#request-demo" text="SHOW MORE" />
        </div>
      </div>
    </section>
  )
}
