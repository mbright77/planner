import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/App';
import './app/styles/index.css';
import { initTheme } from './shared/lib/theme';

initTheme();

// vite-plugin-pwa's autoUpdate registration never actually sends the
// SKIP_WAITING message, so a new worker installs but sits waiting forever
// until every open tab/window is closed. Send it ourselves so updates take
// effect immediately instead of requiring the user to clear site data.
function skipWaitingIfWaiting(registration: ServiceWorkerRegistration) {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    skipWaitingIfWaiting(registration);

    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', () => {
        skipWaitingIfWaiting(registration);
      });
    });

    // Poll for updates every hour so long-lived tabs pick up new versions.
    setInterval(() => registration.update(), 60 * 60 * 1000);

    // Re-check whenever the app regains focus, since an installed Android
    // PWA can sit backgrounded for days and miss the hourly timer entirely.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update();
        skipWaitingIfWaiting(registration);
      }
    });
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
