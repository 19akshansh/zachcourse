import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from "sonner";

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

