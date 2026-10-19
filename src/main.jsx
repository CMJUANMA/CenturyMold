import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Tras publicar una versión nueva, una pestaña abierta puede pedir archivos con hash que ya no existen.
// Se recarga una sola vez (con margen de 1 minuto) para traer la versión vigente.
const RECARGA_KEY = 'cm_recarga_modulo';
const recargarUnaVez = () => {
  try {
    const ultima = Number(sessionStorage.getItem(RECARGA_KEY) || 0);
    if (Date.now() - ultima < 60000) return;
    sessionStorage.setItem(RECARGA_KEY, String(Date.now()));
  } catch { /* sin sessionStorage: se recarga de todos modos */ }
  window.location.reload();
};
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  recargarUnaVez();
});
window.addEventListener('unhandledrejection', (e) => {
  const mensaje = String(e.reason?.message || e.reason || '');
  if (/dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(mensaje)) {
    recargarUnaVez();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
