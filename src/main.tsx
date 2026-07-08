import {StrictMode} from 'react';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/i18n';
import { Toaster } from "sonner";
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

if (process.env.NODE_ENV !== 'production') {
  import('@axe-core/react').then(axe => {
    axe.default(React, createRoot, 1000);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster 
      theme="dark" 
      position="top-right"
      toastOptions={{
        style: {
          background: "#111118",
          border: "1px solid #1E1E2E",
          color: "#F8FAFC",
        },
      }}
    />
  </StrictMode>,
);

