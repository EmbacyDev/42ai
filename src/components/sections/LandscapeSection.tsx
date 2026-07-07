import styles from './LandscapeSection.module.css'

export function LandscapeSection() {
  return (
    <section className={styles.section} aria-label="Technology landscape">
      <img
        className={styles.image}
        src="/assets/images/landscape.jpg"
        alt="Desert landscape with a glowing structure at twilight"
        loading="lazy"
      />
    </section>
  )
}
