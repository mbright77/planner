import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/App';
import './app/styles/index.css';
import { initTheme } from './shared/lib/theme';

initTheme();

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Poll for updates every hour so long-lived tabs pick up new versions.
    setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});

// Reload the page as soon as a new SW takes control so users always run
// the latest version without needing a manual refresh.
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();
});

const route = new URLSearchParams(window.location.search).get('route');
if (route) {
  const url = new URL(window.location.href);
  url.searchParams.delete('route');

  const restored = new URL(decodeURIComponent(route), window.location.origin);
  url.pathname = restored.pathname;
  url.search = restored.search;
  url.hash = restored.hash;

  window.history.replaceState(null, '', url);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
