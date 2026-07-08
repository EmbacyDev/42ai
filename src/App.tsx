import { HomePage } from './pages/HomePage'
import { ShaderHomePage } from './pages/ShaderHomePage'
import { ShaderLabPage } from './pages/ShaderLabPage'

function App() {
  const { pathname } = window.location

  if (pathname === '/shader-lab') {
    return <ShaderLabPage />
  }

  if (pathname === '/shader-home') {
    return <ShaderHomePage />
  }

  return <HomePage />
}

export default App
