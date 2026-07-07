import { PillButton } from '../PillButton'
import { PRODUCTS } from '../../data/content'
import styles from './ProductsSection.module.css'

export function ProductsSection() {
  return (
    <section className={styles.section} aria-labelledby="products-heading">
      <div className={styles.header}>
        <p className={styles.label}>The Products</p>
        <h2 className={styles.title} id="products-heading">
          One core. Two ways to use it.
        </h2>
      </div>

      <div className={styles.grid}>
        {PRODUCTS.map((product) => (
          <article className={styles.card} key={product.id}>
            <img className={styles.cardImage} src={product.image} alt={product.alt} loading="lazy" />
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>{product.title}</h3>
              <p className={styles.cardDescription}>{product.description}</p>
              <PillButton className={styles.cardCta} variant="light" glass>
                {product.cta}
              </PillButton>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
