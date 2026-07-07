import { PillButton } from '../PillButton'
import { CTA_BANNER } from '../../data/content'
import styles from './CtaBannerSection.module.css'

export function CtaBannerSection() {
  return (
    <section className={styles.section} aria-labelledby="cta-heading">
      <div className={styles.banner}>
        <img
          className={styles.image}
          src="/assets/images/cta-banner.jpg"
          alt=""
          loading="lazy"
        />

        <div className={styles.overlay}>
          <h2 className={`${styles.title} gradientText`} id="cta-heading">
            {CTA_BANNER.title}
          </h2>

          <div className={styles.side}>
            <p className={styles.subtitle}>{CTA_BANNER.subtitle}</p>
            <div className={styles.actions}>
              <PillButton variant="light" glass>
                {CTA_BANNER.primaryCta}
              </PillButton>
              <PillButton variant="outline" glass>
                {CTA_BANNER.secondaryCta}
              </PillButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
