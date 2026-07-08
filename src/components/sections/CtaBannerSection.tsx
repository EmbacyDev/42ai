import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { CTA_BANNER } from '../../data/content'
import styles from './CtaBannerSection.module.css'

export function CtaBannerSection() {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      {/* Title, subtitle and both CTAs are direct children of the glass
          root: the library only applies the effect to direct children. */}
      <LiquidGlassRoot className={styles.banner}>
        <img className={styles.image} src="/assets/images/cta-banner.jpg" alt="" loading="lazy" />

        <h2 className={`${styles.title} gradientText`} id="cta-heading">
          Bring your data.
          <br />
          See what it predicts.
        </h2>

        <p className={styles.subtitle}>{CTA_BANNER.subtitle}</p>

        <LiquidGlassButton variant="light" className={styles.primaryCta}>
          {CTA_BANNER.primaryCta}
        </LiquidGlassButton>
        <LiquidGlassButton variant="outline" className={styles.secondaryCta}>
          {CTA_BANNER.secondaryCta}
        </LiquidGlassButton>
      </LiquidGlassRoot>
    </section>
  )
}
