import { useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './breakthroughsSection.css'

const STORIES = [
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
  useSequentialReveal(rootRef)

  return (
    <section className="breakthroughs-section" aria-labelledby="breakthroughs-heading" ref={rootRef}>
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
          <a className="breakthroughs-section__cta scroll-reveal" data-reveal="1" href="#vision">
            Explore our vision
          </a>
        </div>

        <div className="breakthroughs-section__row">
          <article className="breakthroughs-section__card breakthroughs-section__card--photo scroll-reveal" data-reveal="2">
            <img src="/images/v2/breakthrough-foundational.png" alt="" />
            <div className="breakthroughs-section__card-copy">
              <div className="breakthroughs-section__meta">
                <span>foundational model</span>
                <span>/2025</span>
              </div>
              <h3>
                Decoding the human factor:
                <br />
                high fidelity behavioral predictions
              </h3>
            </div>
          </article>

          {STORIES.map((story, index) => (
            <article
              key={story.tone}
              className={`breakthroughs-section__card breakthroughs-section__card--${story.tone} scroll-reveal`}
              data-reveal={String(index + 3)}
            >
              <div className="breakthroughs-section__card-copy">
                <div className="breakthroughs-section__meta">
                  <span>{story.kicker}</span>
                  <span>{story.year}</span>
                </div>
                <h3>{story.title}</h3>
              </div>
            </article>
          ))}
          <div className="breakthroughs-section__fade" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
