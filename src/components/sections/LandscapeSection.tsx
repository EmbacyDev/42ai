import { CrystalFieldShader, DEFAULT_CRYSTAL_SHADER_SETTINGS } from '../CrystalFieldShader'
import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { PillButton } from '../PillButton'
import { useHomePageVariant } from '../../context/HomePageVariantContext'
import { LANDSCAPE } from '../../data/content'
import styles from './LandscapeSection.module.css'

export function LandscapeSection() {
  const { landscapeBackground } = useHomePageVariant()
  const isShader = landscapeBackground === 'shader'

  const content = (
    <>
      {isShader ? (
        <div className={styles.shaderStage} aria-hidden="true">
          <CrystalFieldShader
            className={styles.shaderCanvas}
            settings={DEFAULT_CRYSTAL_SHADER_SETTINGS}
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

      <div className={styles.copy}>
        <h2 className={`${styles.title} gradientText`} id="landscape-heading">
          {LANDSCAPE.title}
        </h2>
        <p className={`${styles.subtitle} gradientText`}>{LANDSCAPE.subtitle}</p>
      </div>

      {isShader ? (
        <PillButton variant="hero" className={styles.shaderCta}>
          {LANDSCAPE.cta}
        </PillButton>
      ) : (
        <LiquidGlassButton variant="ghost">{LANDSCAPE.cta}</LiquidGlassButton>
      )}
    </>
  )

  return (
    <section
      className={isShader ? `${styles.section} ${styles.sectionShader}` : styles.section}
      aria-labelledby="landscape-heading"
    >
      {isShader ? (
        <div className={styles.glassRoot}>{content}</div>
      ) : (
        <LiquidGlassRoot className={styles.glassRoot}>{content}</LiquidGlassRoot>
      )}
    </section>
  )
}
