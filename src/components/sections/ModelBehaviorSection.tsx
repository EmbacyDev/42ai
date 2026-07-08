import { CrystalFieldShader, DEFAULT_CRYSTAL_SHADER_SETTINGS } from '../CrystalFieldShader'
import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { PillButton } from '../PillButton'
import { useHomePageVariant } from '../../context/HomePageVariantContext'
import { LANDSCAPE } from '../../data/content'
import { BehaviorLayersDiagram } from './BehaviorLayersDiagram'
import styles from './ModelBehaviorSection.module.css'

export function ModelBehaviorSection() {
  const { landscapeBackground, variant } = useHomePageVariant()
  const isShader = landscapeBackground === 'shader'
  const isShaderPreview = variant === 'shader-preview'

  const landscapeContent = (
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

      <div className={styles.landscapeCopy}>
        <h2 className={`${styles.landscapeTitle} gradientText`} id="landscape-heading">
          {LANDSCAPE.title}
        </h2>
        <p className={`${styles.landscapeSubtitle} gradientText`}>{LANDSCAPE.subtitle}</p>
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
      className={
        isShaderPreview
          ? `${styles.section} ${styles.sectionShader}`
          : styles.section
      }
      id="how-it-works"
      aria-labelledby="landscape-heading"
    >
      <div
        className={
          isShader ? `${styles.landscapePane} ${styles.landscapePaneShader}` : styles.landscapePane
        }
      >
        {isShader ? (
          <div className={styles.glassRoot}>{landscapeContent}</div>
        ) : (
          <LiquidGlassRoot className={styles.glassRoot}>{landscapeContent}</LiquidGlassRoot>
        )}
      </div>

      <div
        className={
          isShaderPreview ? `${styles.behaviorPane} ${styles.behaviorPaneShader}` : styles.behaviorPane
        }
        aria-labelledby="behavior-heading"
      >
        <div className={styles.behaviorHeader}>
          <h2 className={`${styles.behaviorTitle} gradientText`} id="behavior-heading">
            Behavior isn&apos;t one signal. It&apos;s four, stacked.
          </h2>
          <p className={`${styles.behaviorSubtitle} gradientText`}>
            Every prediction is built from layers you can see, audit, and trust —
            individually and together.
          </p>
        </div>

        <div className={styles.diagram}>
          <BehaviorLayersDiagram />
        </div>
      </div>
    </section>
  )
}
