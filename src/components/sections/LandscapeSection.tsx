import { CrystalFieldShader, DEFAULT_CRYSTAL_SHADER_SETTINGS } from '../CrystalFieldShader'
import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { PillButton } from '../PillButton'
import { useHomePageVariant } from '../../context/HomePageVariantContext'
import { LANDSCAPE } from '../../data/content'
import styles from './LandscapeSection.module.css'

const SHADER_HOME_SETTINGS = {
  ...DEFAULT_CRYSTAL_SHADER_SETTINGS,
  videoScale: DEFAULT_CRYSTAL_SHADER_SETTINGS.videoScale * 0.6,
}

export function LandscapeSection() {
  const { landscapeBackground, useLiquidGlassButtons } = useHomePageVariant()
  const isShader = landscapeBackground === 'shader'

  return (
    <section className={styles.section} aria-labelledby="landscape-heading">
      <LiquidGlassRoot className={styles.glassRoot}>
        {isShader ? (
          <div className={styles.shaderStage} aria-hidden="true">
            <CrystalFieldShader
              className={styles.shaderCanvas}
              settings={SHADER_HOME_SETTINGS}
              followPointer
              blockEdgeFade
            />
          </div>
        ) : (
          <img
            className={styles.image}
            src="/assets/images/landscape.jpg"
            alt="Desert landscape with a glowing structure at twilight"
            loading="lazy"
          />
        )}

        {!isShader ? <div className={styles.bottomShade} aria-hidden="true" /> : null}

        <div className={styles.overlay}>
          <div className={styles.content}>
            <div className={styles.copy}>
              <h2 className={`${styles.title} gradientText`} id="landscape-heading">
                {LANDSCAPE.title}
              </h2>
              <p className={`${styles.subtitle} gradientText`}>{LANDSCAPE.subtitle}</p>
            </div>
          </div>
        </div>

        {useLiquidGlassButtons ? (
          <LiquidGlassButton variant="ghost" className={styles.cta}>
            {LANDSCAPE.cta}
          </LiquidGlassButton>
        ) : (
          <PillButton variant="ghost" className={styles.cta}>
            {LANDSCAPE.cta}
          </PillButton>
        )}
      </LiquidGlassRoot>
    </section>
  )
}
