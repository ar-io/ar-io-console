import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

// Temporary: Suppress Privy's DOM nesting warnings
// TODO: Remove when Privy fixes their modal components
import { suppressPrivyDOMWarnings } from './utils/suppressPrivyWarnings';
suppressPrivyDOMWarnings();

// Service worker registration moved to BrowsePage to avoid affecting main bundle
// The SW will be registered when user first visits /browse

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);