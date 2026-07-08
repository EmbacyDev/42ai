import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  CRYSTAL_SHADER_CONTROL_GROUPS,
  CrystalFieldShader,
  DEFAULT_CRYSTAL_SHADER_SETTINGS,
  DEFAULT_SHADER_LAB_SETTINGS,
  SHADER_LAB_BACKDROP_CONTROLS,
  type ShaderSettings,
} from '../components/CrystalFieldShader'
import styles from './ShaderLabPage.module.css'

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

const SHADER_LAB_BACKDROP = '/assets/images/shader-lab-backdrop.png'

export function ShaderLabPage() {
  const [settings, setSettings] = useState<ShaderSettings>(DEFAULT_SHADER_LAB_SETTINGS)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [showMask, setShowMask] = useState(false)
  const [glError, setGlError] = useState<string | null>(null)

  const handleChange = (key: keyof ShaderSettings) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const particleBudget = useMemo(() => {
    const pointCount = Math.round(settings.density * 5)
    const blockPointCount = Math.round(settings.blockCount) * 12 * Math.round(settings.blockPointDensity)
    const rayPointCount = Math.round(settings.blockCount) * 20
    return pointCount + blockPointCount + rayPointCount
  }, [settings.density, settings.blockCount, settings.blockPointDensity])

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <CrystalFieldShader
          className={styles.canvas}
          settings={settings}
          showMask={showMask}
          onGlError={setGlError}
          backgroundImage={SHADER_LAB_BACKDROP}
        />
        {glError ? (
          <div className={styles.error} role="alert">
            <strong>WebGL error</strong>
            <pre>{glError}</pre>
          </div>
        ) : null}
      </div>

      <aside className={styles.panel} aria-label="Shader controls">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Internal WebGL lab</p>
            <h1 className={styles.title}>Crystal field shader</h1>
          </div>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setControlsOpen((isOpen) => !isOpen)}
            aria-label={controlsOpen ? 'Hide controls' : 'Show controls'}
          >
            {controlsOpen ? '-' : '+'}
          </button>
        </div>

        <div className={controlsOpen ? styles.controls : styles.hidden}>
          {CRYSTAL_SHADER_CONTROL_GROUPS.map((control) => (
            <label className={styles.control} key={control.key}>
              <span className={styles.labelRow}>
                <span>{control.label}</span>
                <span className={styles.value}>{formatValue(settings[control.key])}</span>
              </span>
              <input
                className={styles.range}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={settings[control.key]}
                onChange={handleChange(control.key)}
              />
            </label>
          ))}

          {SHADER_LAB_BACKDROP_CONTROLS.map((control) => (
            <label className={styles.control} key={control.key}>
              <span className={styles.labelRow}>
                <span>{control.label}</span>
                <span className={styles.value}>{formatValue(settings[control.key])}</span>
              </span>
              <input
                className={styles.range}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={settings[control.key]}
                onChange={handleChange(control.key)}
              />
            </label>
          ))}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => setSettings(DEFAULT_SHADER_LAB_SETTINGS)}
            >
              Reset
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => setShowMask((current) => !current)}
            >
              {showMask ? 'Hide mask' : 'Show mask'}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  videoOpacity: current.videoOpacity > 0 ? 0 : DEFAULT_CRYSTAL_SHADER_SETTINGS.videoOpacity,
                }))
              }
            >
              Toggle video
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.hud} aria-hidden="true">
        <span>
          <strong>{particleBudget.toLocaleString('en-US')}</strong> procedural vertices
        </span>
        <span>Sphere core, wireframe blocks, streak rays, mask pass + composite video</span>
      </div>
    </main>
  )
}
