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

// Disable SW aggressively in development/ngrok to avoid caching conflicts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Stale SW unregistered for stable dev environment');
    }
  });
}
