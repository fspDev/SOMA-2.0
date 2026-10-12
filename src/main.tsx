import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';
import App from './App';
import { ToastProvider } from './ui/kit';
import { loadSyncState, startAutoSync } from './sync/sync';

// Pide al navegador que no borre los datos locales cuando le falte espacio.
void navigator.storage?.persist?.();

void loadSyncState().then(() => {
  startAutoSync();
  render();
});

function render() {
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
}
