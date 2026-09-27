import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

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
