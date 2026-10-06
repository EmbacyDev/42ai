import { useState } from 'react'
import { PREDICTION_SCENARIOS } from '../../data/content'
import styles from './PredictionSection.module.css'

export function PredictionSection() {
  const [activeTab, setActiveTab] = useState(0)
  const activeScenario = PREDICTION_SCENARIOS[activeTab]

  return (
    <section className={styles.section} id="features" aria-labelledby="prediction-heading">
      <h2 className={styles.title} id="prediction-heading">
        Pick your industry and watch one real event become a prediction.
      </h2>

      <div className={styles.tabs} role="tablist" aria-label="Prediction scenarios">
        {PREDICTION_SCENARIOS.map((scenario, index) => (
          <button
            key={scenario.tab}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            className={`${styles.tab} ${activeTab === index ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {scenario.tab}
          </button>
        ))}
      </div>

      <div className={styles.preview} role="tabpanel" aria-label={`Prediction preview for ${activeScenario.tab}`}>
        <img
          className={styles.previewBackground}
          src="/assets/images/prediction-background.jpg"
          alt=""
          loading="lazy"
        />

        <div className={styles.previewTitles} key={`${activeScenario.tab}-titles`}>
          <p>{activeScenario.event}</p>
          <p>{activeScenario.question}</p>
        </div>

        <img
          key={`${activeScenario.tab}-interface`}
          className={styles.interfaceImage}
          src={activeScenario.interfaceImage}
          alt={`${activeScenario.tab} ranked prediction interface`}
          loading="lazy"
        />
      </div>
    </section>
  )
}
