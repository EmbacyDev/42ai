import { USE_CASES } from '../../data/content'
import styles from './UseCasesSection.module.css'

export function UseCasesSection() {
  return (
    <section className={styles.section} id="applications" aria-labelledby="use-cases-heading">
      <p className={styles.label} id="use-cases-heading">
        Use Cases
      </p>
      <div className={styles.track}>
        {USE_CASES.map((item) => (
          <article className={styles.card} key={item.id}>
            <img className={styles.cardImage} src={item.image} alt={item.alt} loading="lazy" />
          </article>
        ))}
      </div>
    </section>
  )
}
