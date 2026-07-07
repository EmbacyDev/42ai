import { STATS } from '../../data/content'
import styles from './ProofSection.module.css'

export function ProofSection() {
  return (
    <section className={styles.section} aria-labelledby="proof-heading">
      <div className={styles.intro}>
        <p className={styles.label}>Proof</p>
        <h2 className={styles.title} id="proof-heading">
          Our models predict how specific people will act
        </h2>
      </div>

      <div className={styles.stats}>
        {STATS.map((stat) => (
          <div className={styles.row} key={stat.value}>
            <div className={styles.rowInner}>
              <p className={styles.value}>{stat.value}</p>
              <p className={styles.description}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
