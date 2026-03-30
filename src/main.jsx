import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

const clearVerdictCouncilCaches = async () => {
  if (!('caches' in window)) {
    return
  }

  const cacheKeys = await window.caches.keys().catch(() => [])
  await Promise.all(
    cacheKeys
      .filter((key) => key.startsWith('verdictcouncil-pwa-'))
      .map((key) => window.caches.delete(key)),
  )
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      return
    }

    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => [])
    await Promise.all(registrations.map((registration) => registration.unregister()))
    await clearVerdictCouncilCaches()
  })
}
