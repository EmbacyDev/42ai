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
        <article className={styles.card}>
          <img
            className={styles.cardImage}
            src="/assets/images/product-1.jpg"
            alt="Person using a smartphone against a blue sky"
            loading="lazy"
          />
        </article>
        <article className={styles.card}>
          <img
            className={styles.cardImage}
            src="/assets/images/product-2.jpg"
            alt="Crowd in motion from above"
            loading="lazy"
          />
        </article>
      </div>
    </section>
  )
}
