import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './app/styles/index.css';

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
