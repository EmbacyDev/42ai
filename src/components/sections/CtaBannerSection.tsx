import styles from './CtaBannerSection.module.css'

export function CtaBannerSection() {
  return (
    <section className={styles.section} aria-label="Call to action">
      <div className={styles.banner}>
        <img
          className={styles.image}
          src="/assets/images/cta-banner.jpg"
          alt="Abstract light streaks on dark background"
          loading="lazy"
        />
      </div>
    </section>
  )
}
