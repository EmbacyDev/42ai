import { useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './breakthroughsSection.css'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'

const STORIES = [
  {
    kicker: 'Foundational model',
    year: '/2025',
    title: 'Decoding the human factor:\nhigh fidelity behavioral predictions',
    tone: 'photo',
  },
  {
    kicker: 'Human nature',
    year: '/2025',
    title: 'Why AI agents must model what we do, not what we say',
    tone: 'teal',
  },
  {
    kicker: 'Human nature',
    year: '/2025',
    title: 'Why AI agents must model what we do, not what we say',
    tone: 'slate',
  },
]

/**
 * Figma block 8 (307:31189). Black breakthroughs band: one photographed
 * card, one colour card, and the next card peeking in from the right.
 */
export default function BreakthroughsSection() {
  const rootRef = useRef(null)
  // Static for now: the cards no longer cycle along the strip.
  const activeIndex = 0
  useSequentialReveal(rootRef)

  return (
    <section className="breakthroughs-section" id="vision" aria-labelledby="breakthroughs-heading" ref={rootRef}>
      <div className="breakthroughs-section__inner">
        <div className="breakthroughs-section__header">
          <div className="breakthroughs-section__copy scroll-reveal" data-reveal="0">
            <p className="breakthroughs-section__eyebrow">Our breakthroughs</p>
            <h2 id="breakthroughs-heading">
              We are building the behavioral
              <br />
              layer for every future AI system.
            </h2>
          </div>
          <RequestDemoButton
            className="breakthroughs-section__cta scroll-reveal"
            data-reveal="1"
            href="#vision"
            label="Explore our vision"
            fit="stretch"
            shapeFill="#ffffff"
          />
        </div>

        <div className="breakthroughs-section__row">
          {STORIES.map((story, index) => {
            const slot = (index - activeIndex + STORIES.length) % STORIES.length
            return (
            <article
              key={story.tone}
              className={`breakthroughs-section__card breakthroughs-section__card--${story.tone}${slot === 0 ? ' is-active' : ''} scroll-reveal`}
              data-slot={slot}
              data-reveal={String(index + 2)}
            >
              {story.tone === 'photo' && (
                <>
                  <img src="/images/figma/imgFoundationalModelImage.png" alt="" loading="lazy" />
                  <div className="breakthroughs-section__shade" aria-hidden="true"><span /></div>
                </>
              )}
              <div className="breakthroughs-section__card-copy">
                <div className="breakthroughs-section__meta">
                  <span>{story.kicker}</span>
                  <span>{story.year}</span>
                </div>
                <h3>{story.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h3>
                <a className="breakthroughs-section__arrow" href="#vision" aria-label={`Explore ${story.kicker}`}>
                  <svg viewBox="0 0 8.5 13.73" aria-hidden="true">
                    <path d="M0.43 0.49 L8.07 7.27 L0.43 13.21" />
                  </svg>
                </a>
              </div>
            </article>
            )
          })}
          <div className="breakthroughs-section__fade" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
