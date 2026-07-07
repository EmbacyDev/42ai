import { PillButton } from '../PillButton'
import { LANDSCAPE } from '../../data/content'
import styles from './LandscapeSection.module.css'

export function LandscapeSection() {
  return (
    <section className={styles.section} aria-labelledby="landscape-heading">
      <img
        className={styles.image}
        src="/assets/images/landscape.jpg"
        alt="Desert landscape with a glowing structure at twilight"
        loading="lazy"
      />

      <div className={styles.overlay}>
        <div className={styles.content}>
          <div className={styles.copy}>
            <h2 className={`${styles.title} gradientText`} id="landscape-heading">
              {LANDSCAPE.title}
            </h2>
            <p className={`${styles.subtitle} gradientText`}>{LANDSCAPE.subtitle}</p>
          </div>
          <PillButton variant="ghost">{LANDSCAPE.cta}</PillButton>
        </div>
      </div>
    </section>
  )
}
