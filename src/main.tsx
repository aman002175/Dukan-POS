import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

// PWA stale-chunk guard
// Deploy ke baad purana khula tab purane hashed chunk (jaise
// /assets/InventorySection-CXmA8z-T.js) ko fetch karta hai — jo ab exist
// nahi karta — aur "Failed to fetch dynamically imported module" de deta hai.
// Aisa hote hi hum ek baar app reload kar dete hain taaki naya bundle load ho.
// Reload ke baad bhi same error aaye to infinite loop na ho, isliye 60s ka
// cooldown rakhte hain.
const CHUNK_RELOAD_KEY = 'dukaan_chunk_reload'
const CHUNK_RELOAD_COOLDOWN_MS = 60_000

function isStaleChunkError(message: string): boolean {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  )
}

function recoverFromStaleChunk(message: string) {
  if (!isStaleChunkError(message)) return

  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0')
  if (last && Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) {
    console.warn('Purana version ka chunk phir bhi load nahi hua. Page refresh karo.')
    return
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  console.warn('Purana version ka chunk mila — app refresh kar rahe hain…')
  location.reload()
}

window.addEventListener('error', (event) => {
  const target = event.target as { tagName?: string } | null
  const message =
    (event as ErrorEvent).message || (target && target.tagName) || ''
  recoverFromStaleChunk(String(message))
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as unknown
  const message =
    reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : ''
  recoverFromStaleChunk(message)
})

// Register Service Worker for PWA offline support
const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-update without user prompt
    updateSW(true)
  },
  onOfflineReady() {
    console.log('✅ Dukaan POS is ready to work OFFLINE!')
  },
  onRegistered(r) {
    console.log('✅ Service Worker registered:', r)
  },
  onRegisterError(error) {
    console.error('❌ SW registration error:', error)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="App load nahi ho paaya">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
