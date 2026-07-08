import { GlassButton } from '../GlassButton'
import { GlassSurface } from '../GlassSurface'
import { CTA_BANNER } from '../../data/content'
import styles from './CtaBannerSection.module.css'

export function CtaBannerSection() {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      <GlassSurface className={styles.banner}>
        <img className={styles.image} src="/assets/images/cta-banner.jpg" alt="" loading="lazy" />

        <div className={styles.overlay}>
          <h2 className={`${styles.title} gradientText`} id="cta-heading">
            Bring your data.
            <br />
            See what it predicts.
          </h2>

          <div className={styles.side}>
            <p className={styles.subtitle}>{CTA_BANNER.subtitle}</p>

            <div className={styles.actions}>
              <GlassButton variant="light">{CTA_BANNER.primaryCta}</GlassButton>
              <GlassButton variant="outline">{CTA_BANNER.secondaryCta}</GlassButton>
            </div>
          </div>
        </div>
      </GlassSurface>
    </section>
  )
}
