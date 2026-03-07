import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'prosemirror-view/style/prosemirror.css'
import './index.css'
import App from './App.tsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

// Apply saved dark mode preference synchronously before first paint to prevent flash
try {
  const saved = localStorage.getItem('prose-arc-theme')
  if (saved && JSON.parse(saved).state?.isDark) {
    document.documentElement.classList.add('dark')
  }
} catch { /* ignore parse errors */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
