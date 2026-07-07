import { useState } from 'react'
import { useGlassSettings } from '../lib/glass-panel/GlassSettingsProvider'
import type { GlassSettings } from '../lib/glass-panel/glassSettings'
import styles from './GlassControls.module.css'

type SliderConfig = {
  key: keyof GlassSettings
  label: string
  min: number
  max: number
  step: number
  format: (value: number) => string
}

const sliders: SliderConfig[] = [
  { key: 'hoverScale', label: 'Hover scale', min: 1, max: 1.12, step: 0.01, format: (v) => `${v.toFixed(2)}×` },
  { key: 'blur', label: 'Blur', min: 0, max: 20, step: 1, format: (v) => `${v}px` },
  { key: 'distortion', label: 'Distortion', min: 0, max: 100, step: 1, format: (v) => String(v) },
  { key: 'bezel', label: 'Bezel', min: 0.05, max: 0.4, step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'saturation', label: 'Saturation', min: 1, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'specular', label: 'Specular', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'warmth', label: 'Warmth', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'fillTop', label: 'Fill top', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'fillBottom', label: 'Fill bottom', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'edge', label: 'Edge', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'shadow', label: 'Shadow', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'burn', label: 'Burn', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
]

export function GlassControls() {
  const { settings, setSettings, resetSettings } = useGlassSettings()
  const [open, setOpen] = useState(true)

  return (
    <aside className={styles.panel} aria-label="Glass effect controls">
      <div className={styles.header}>
        <p className={styles.title}>Glass</p>
        <div>
          <button type="button" className={styles.reset} onClick={resetSettings}>
            Reset
          </button>
          <button type="button" className={styles.toggle} onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {open ? (
        <div className={styles.body}>
          {sliders.map((slider) => {
            const value = settings[slider.key]

            return (
              <label className={styles.row} key={slider.key}>
                <span className={styles.label}>{slider.label}</span>
                <span className={styles.value}>{slider.format(value)}</span>
                <input
                  className={styles.slider}
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={value}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setSettings((current) => ({ ...current, [slider.key]: next }))
                  }}
                />
              </label>
            )
          })}
        </div>
      ) : null}
    </aside>
  )
}
