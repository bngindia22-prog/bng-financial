import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Service worker: only in production builds.
// In dev, unregister any stale worker + clear caches so Vite serves fresh JS.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      if (import.meta.env.DEV) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        if (window.caches) {
          const keys = await window.caches.keys();
          await Promise.all(keys.map(k => window.caches.delete(k)));
        }
      } else {
        await navigator.serviceWorker.register('/sw.js');
      }
    } catch (e) {
      // ignore SW errors
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)