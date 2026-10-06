import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FriendLab from './FriendLab.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FriendLab />
  </StrictMode>,
)
