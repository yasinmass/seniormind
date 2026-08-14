import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SeniorApp from './SeniorApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SeniorApp />
  </StrictMode>,
)

