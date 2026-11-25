import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuthGate from './AuthGate'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.error('STILL could not register its offline app shell.', error)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
)
