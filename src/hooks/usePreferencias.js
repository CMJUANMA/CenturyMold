/**
 * usePreferencias.js — Configuración personal de quien tiene la sesión:
 *   const { preferencias: { ayudas, tamanoLetra, tema, recorridosVistos }, guardar, marcarRecorridoVisto } = usePreferencias();
 * Fuera del proveedor (pruebas, pantallas de acceso) devuelve los valores por omisión sin guardar nada.
 */
import { useContext } from 'react';
import { PREFERENCIAS_BASE, PreferenciasContext } from '../context/preferenciasStore';

const SIN_PROVEEDOR = { preferencias: PREFERENCIAS_BASE, guardar: async () => {}, marcarRecorridoVisto: async () => {} };

export function usePreferencias() {
  return useContext(PreferenciasContext) ?? SIN_PROVEEDOR;
}
