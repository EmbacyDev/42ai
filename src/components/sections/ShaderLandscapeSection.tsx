import { CrystalFieldShader, DEFAULT_CRYSTAL_SHADER_SETTINGS } from '../CrystalFieldShader'
import { LiquidGlassButton } from '../LiquidGlassButton'
import { LiquidGlassRoot } from '../LiquidGlassRoot'
import { LANDSCAPE } from '../../data/content'
import styles from './ShaderLandscapeSection.module.css'

const SHADER_HOME_SETTINGS = {
  ...DEFAULT_CRYSTAL_SHADER_SETTINGS,
  videoScale: DEFAULT_CRYSTAL_SHADER_SETTINGS.videoScale * 0.6,
}

export function ShaderLandscapeSection() {
  return (
    <section className={styles.section} aria-labelledby="landscape-heading">
      <LiquidGlassRoot className={styles.glassRoot}>
        <div className={styles.shaderStage} aria-hidden="true">
          <CrystalFieldShader
            className={styles.shaderCanvas}
            settings={SHADER_HOME_SETTINGS}
            followPointer
            blockEdgeFade
          />
        </div>

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
