import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const clearVerdictCouncilCaches = async () => {
  if (!('caches' in window)) {
    return
  }

  const cacheKeys = await window.caches.keys().catch(() => [])
  await Promise.all(
    cacheKeys
      .filter(
        (key) => key.startsWith('verdictcouncil-pwa-') || key.startsWith('verdictcouncil-api-cache-'),
      )
      .map((key) => window.caches.delete(key)),
  )
}

const disableServiceWorkerInDev = async () => {
  if (!('serviceWorker' in navigator)) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => [])
  if (registrations.length === 0) {
    return
  }

  await Promise.all(registrations.map((registration) => registration.unregister()))
  await clearVerdictCouncilCaches()

  const flag = '__vc_sw_dev_unregistered__'
  if (!sessionStorage.getItem(flag)) {
    sessionStorage.setItem(flag, '1')
    window.location.reload()
  }
}

if (import.meta.env.DEV) {
  disableServiceWorkerInDev()
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      return
    }
  })
}
