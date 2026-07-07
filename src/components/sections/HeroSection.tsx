import styles from './HeroSection.module.css'

export function HeroSection() {
  return (
    <section className={styles.section} aria-label="Hero">
      <img
        className={styles.image}
        src="/assets/images/hero.jpg"
        alt="A couple in a bright room with moving boxes"
        width={2880}
        height={1600}
        fetchPriority="high"
      />
    </section>
  )
}
