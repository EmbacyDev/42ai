import { PillButton } from '../PillButton'
import { SiteHeader } from '../SiteHeader'
import { useHomePageVariant } from '../../context/HomePageVariantContext'
import { HERO } from '../../data/content'
import { HeroBackgroundVideo } from './HeroBackgroundVideo'
import styles from './HeroSection.module.css'

export function HeroSection() {
  const { variant } = useHomePageVariant()
  const showHeroVideo = variant === 'shader-preview'

  return (
    <section className={styles.section} id="top" aria-label="Hero">
      <img
        className={styles.image}
        src="/assets/images/hero.jpg"
        alt="A couple in a bright room with moving boxes"
        width={2880}
        height={1600}
        fetchPriority="high"
      />

      {showHeroVideo ? <HeroBackgroundVideo /> : null}

      <div className={styles.overlay} aria-hidden="true" />

      <SiteHeader />

      <div className={styles.content}>
        <div className={styles.copy}>
          <h1 className={styles.title}>{HERO.title}</h1>
          <p className={styles.subtitle}>{HERO.subtitle}</p>
        </div>
        <PillButton variant="hero">{HERO.cta}</PillButton>
      </div>
    </section>
  )
}
