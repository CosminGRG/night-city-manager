import '@fontsource-variable/inter'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import './styles/tokens.css'
import './styles/global.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
