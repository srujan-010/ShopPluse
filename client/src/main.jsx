import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Prevent mouse wheel from changing number inputs
document.addEventListener('wheel', (e) => {
  if (document.activeElement && document.activeElement.type === 'number') {
    e.preventDefault();
  }
}, { passive: false });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register Service Worker for Offline-First PWA capabilities (production only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Aggressively unregister service workers in development to prevent ESM/HMR interception issues
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister().then((success) => {
        if (success) console.log('Successfully unregistered Service Worker for development');
      });
    }
  });
}
