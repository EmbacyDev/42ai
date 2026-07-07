import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { GlassPanel } from './glass-panel.js'
import { defaultGlassSettings, type GlassSettings } from './glassSettings'

type GlassSettingsContextValue = {
  settings: GlassSettings
  setSettings: Dispatch<SetStateAction<GlassSettings>>
  resetSettings: () => void
}

const GlassSettingsContext = createContext<GlassSettingsContextValue | null>(null)

export function GlassSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GlassSettings>(defaultGlassSettings)

  useEffect(() => {
    document.documentElement.style.setProperty('--glass-hover-scale', String(settings.hoverScale))
    document.documentElement.style.setProperty('--glass-blur', `${settings.blur}px`)
    document.documentElement.style.setProperty('--glass-saturation', String(settings.saturation))
    document.documentElement.style.setProperty('--glass-specular', String(settings.specular))
    document.documentElement.style.setProperty('--glass-warmth', String(settings.warmth))
    GlassPanel.refreshAll()
  }, [settings])

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      resetSettings: () => setSettings(defaultGlassSettings),
    }),
    [settings],
  )

  return <GlassSettingsContext.Provider value={value}>{children}</GlassSettingsContext.Provider>
}

export function useGlassSettings() {
  const context = useContext(GlassSettingsContext)
  if (!context) {
    throw new Error('useGlassSettings must be used within GlassSettingsProvider')
  }
  return context
}
