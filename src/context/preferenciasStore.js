import { createContext } from 'react';

/** Contexto de las preferencias de la persona (proveedor en PreferenciasContext.jsx; se consume con hooks/usePreferencias.js) */
export const PreferenciasContext = createContext(null);

/** Valores por omisión: ayudas activas, letra normal y tema automático */
export const PREFERENCIAS_BASE = { ayudas: true, tamanoLetra: 'normal', tema: 'auto', recorridosVistos: [] };

export const TAMANOS_LETRA = { normal: '100%', grande: '120%' };

/** Preferencias guardadas (usuarios/{uid}.preferencias) completadas con los valores por omisión; lo inválido se ignora */
export function normalizarPreferencias(p) {
  const x = p && typeof p === 'object' ? p : {};
  return {
    ayudas: typeof x.ayudas === 'boolean' ? x.ayudas : PREFERENCIAS_BASE.ayudas,
    tamanoLetra: x.tamanoLetra === 'grande' ? 'grande' : 'normal',
    tema: ['claro', 'oscuro', 'auto'].includes(x.tema) ? x.tema : PREFERENCIAS_BASE.tema,
    recorridosVistos: Array.isArray(x.recorridosVistos) ? x.recorridosVistos.filter(v => typeof v === 'string').slice(0, 20) : [],
  };
}
