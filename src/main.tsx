import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './lib/glass-panel/glass-panel.css'
import { GlassSettingsProvider } from './lib/glass-panel/GlassSettingsProvider'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlassSettingsProvider>
      <App />
    </GlassSettingsProvider>
  </StrictMode>,
)
