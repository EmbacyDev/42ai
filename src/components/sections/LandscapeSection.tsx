import { CrystalFieldShader } from '../CrystalFieldShader'
import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { LANDSCAPE } from '../../data/content'
import styles from './LandscapeSection.module.css'

type LandscapeSectionProps = {
  background?: 'image' | 'shader'
}

export function LandscapeSection({ background = 'image' }: LandscapeSectionProps) {
  return (
    <section className={styles.section} aria-labelledby="landscape-heading">
      <LiquidGlassRoot className={styles.glassRoot}>
        {background === 'shader' ? (
          <div className={styles.shaderStage} aria-hidden="true">
            <CrystalFieldShader className={styles.shaderCanvas} />
          </div>
        ) : (
          <img
            className={styles.image}
            src="/assets/images/landscape.jpg"
            alt="Desert landscape with a glowing structure at twilight"
            loading="lazy"
          />
        )}

        <div className={styles.bottomShade} aria-hidden="true" />

        <div className={styles.copy}>
          <h2 className={`${styles.title} gradientText`} id="landscape-heading">
            {LANDSCAPE.title}
          </h2>
          <p className={`${styles.subtitle} gradientText`}>{LANDSCAPE.subtitle}</p>
        </div>

        <LiquidGlassButton variant="ghost" className={styles.cta}>
          {LANDSCAPE.cta}
        </LiquidGlassButton>
      </LiquidGlassRoot>
    </section>
  )
}
