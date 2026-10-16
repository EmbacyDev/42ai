import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HeroTestPage from './pages/HeroTestPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/v1" element={<HeroTestPage />} />
        <Route path="/5o" element={<HeroTestPage optimizedCrystal nativeScroll />} />
        <Route path="/5osw" element={<HeroTestPage optimizedCrystal swipeVariant />} />
        <Route path="/5o-steps" element={<HeroTestPage optimizedCrystal />} />
        <Route path="*" element={<Navigate to="/5o" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
