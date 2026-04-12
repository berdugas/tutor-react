import './styles/tokens.css'
import './index.css'
import './lib/supabase.js'  // initialises Supabase client and anonymous auth on app start
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
