import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from '@/app/App'
import '@/app/styles.css'

registerSW({
  immediate: true,
  onNeedRefresh() {
    // Automatic updates are fetched on the next app open; no intrusive prompt.
  },
  onOfflineReady() {
    // The shell is ready for offline use.
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
