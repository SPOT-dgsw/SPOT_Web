import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'
import App from './App.jsx'

const SW_VERSION_KEY = 'spot_sw_version'
const SW_VERSION = __SW_CACHE_VERSION__

async function purgeIfVersionChanged() {
  const stored = localStorage.getItem(SW_VERSION_KEY)
  if (stored === SW_VERSION) return false

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }

    localStorage.setItem(SW_VERSION_KEY, SW_VERSION)
    return registrations.length > 0
  } catch (e) {
    console.error('[PWA] purge failed:', e)
    localStorage.setItem(SW_VERSION_KEY, SW_VERSION)
    return false
  }
}

async function bootstrap() {
  if ('serviceWorker' in navigator) {
    const hadOldSW = await purgeIfVersionChanged()
    if (hadOldSW) {
      window.location.reload()
      return
    }

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        updateSW(true)
      },
      onRegisterError: (error) => {
        console.error('[PWA] Service worker registration failed:', error)
      },
    })
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

bootstrap()
