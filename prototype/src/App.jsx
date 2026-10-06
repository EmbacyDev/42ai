import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HeroTestPage from './pages/HeroTestPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/hero-test" element={<HeroTestPage />} />
        <Route path="*" element={<Navigate to="/hero-test" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
