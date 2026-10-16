import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HeroTestPage from './pages/HeroTestPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/v1" element={<HeroTestPage />} />
        <Route path="*" element={<Navigate to="/v1" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
