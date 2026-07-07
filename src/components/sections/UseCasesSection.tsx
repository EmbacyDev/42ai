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
            <div className={styles.cardOverlayTop} aria-hidden="true" />
            <div className={styles.cardOverlayBottom} aria-hidden="true" />
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardDescription}>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
