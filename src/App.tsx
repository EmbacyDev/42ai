import { HomePage } from './pages/HomePage'
import { ShaderLabPage } from './pages/ShaderLabPage'

function App() {
  const { pathname } = window.location

  if (pathname === '/shader-lab') {
    return <ShaderLabPage />
  }

  if (pathname === '/shader-home') {
    return <HomePage landscapeBackground="shader" />
  }

  return <HomePage />
}

export default App
