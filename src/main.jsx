import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import ErrorBoundary, { CrashScreen } from '@/ErrorBoundary.jsx'

const root = ReactDOM.createRoot(document.getElementById('root'))

// App.jsx (and everything it imports, including the Supabase client) is
// loaded dynamically so a module-evaluation-time crash — e.g. missing
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — is a caught promise rejection
// instead of a silent blank page with nothing but a console error.
import('@/App.jsx')
  .then(({ default: App }) => {
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )
  })
  .catch((error) => {
    console.error('Failed to load app:', error)
    root.render(<CrashScreen error={error} />)
  })

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
