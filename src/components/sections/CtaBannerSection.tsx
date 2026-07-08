import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { CTA_BANNER } from '../../data/content'
import styles from './CtaBannerSection.module.css'

export function CtaBannerSection() {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      <LiquidGlassRoot className={styles.banner}>
        <img className={styles.image} src="/assets/images/cta-banner.jpg" alt="" loading="lazy" />

        <div className={styles.overlay}>
          <h2 className={`${styles.title} gradientText`} id="cta-heading">
            Bring your data.
            <br />
            See what it predicts.
          </h2>

          <div className={styles.side}>
            <p className={styles.subtitle}>{CTA_BANNER.subtitle}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <LiquidGlassButton variant="light">{CTA_BANNER.primaryCta}</LiquidGlassButton>
          <LiquidGlassButton variant="outline">{CTA_BANNER.secondaryCta}</LiquidGlassButton>
        </div>
      </LiquidGlassRoot>
    </section>
  )
}
