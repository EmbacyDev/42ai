import { useState } from 'react'
import { PREDICTION_TABS } from '../../data/content'
import styles from './PredictionSection.module.css'

export function PredictionSection() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section className={styles.section} id="features" aria-labelledby="prediction-heading">
      <h2 className={styles.title} id="prediction-heading">
        Our models predict how specific people will act
      </h2>

      <div className={styles.tabs} role="tablist" aria-label="Prediction scenarios">
        {PREDICTION_TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            className={`${styles.tab} ${activeTab === index ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.preview} role="tabpanel">
        <img
          className={styles.previewImage}
          src="/assets/images/prediction-preview.jpg"
          alt={`Prediction preview for ${PREDICTION_TABS[activeTab]}`}
          loading="lazy"
        />
      </div>
    </section>
  )
}
