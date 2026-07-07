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

      <div className={styles.preview} role="tabpanel" aria-label={`Prediction preview for ${PREDICTION_TABS[activeTab]}`}>
        <img
          className={styles.previewBackground}
          src="/assets/images/prediction-background.jpg"
          alt=""
          loading="lazy"
        />

        <div className={styles.previewTitles}>
          <p>Gold suffers its sharpest one-day drop in more than a decade.</p>
          <p>Next action: close, reduce, hold, add, or flip?</p>
        </div>

        <img
          className={styles.interfaceImage}
          src="/assets/images/prediction-interface.png"
          alt="Ranked options interface showing Add Long Exposure as the top prediction with 81% confidence"
          loading="lazy"
        />
      </div>
    </section>
  )
}
