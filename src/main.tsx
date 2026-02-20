import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

// Temporary: Suppress Privy's DOM nesting warnings
// TODO: Remove when Privy fixes their modal components
import { suppressPrivyDOMWarnings } from './utils/suppressPrivyWarnings';
suppressPrivyDOMWarnings();

// Proactively register browse service worker for content verification
import { swMessenger } from '@/features/browse/utils/serviceWorkerMessaging';
// Use relative path for Arweave subpath compatibility (app served from /txId/)
swMessenger.registerProactive(
  import.meta.env.DEV ? '/dev-sw.js?dev-sw' : './service-worker.js',
  import.meta.env.DEV ? { type: 'module' } : undefined
).catch(err => {
  console.warn('[Browse] Service worker registration failed:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);