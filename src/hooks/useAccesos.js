/**
 * useAccesos.js — Qué puede hacer el usuario, según su rol del sistema y sus asignaciones VIGENTES.
 *
 *   const { esAdmin, esRH, esAut2, areasAut1, areasSolicitante, tieneAcceso, cargando, error } = useAccesos();
 *
 * areasAut1 / areasSolicitante son ids de área (slugs). esAut2: tiene Aut. 2 vigente (RH también puede firmar el
 * nivel 2, pero por su rol; combínalo con esRH donde haga falta). Ver context/AccesosContext.jsx.
 */
import { useContext } from 'react';
import { AccesosContext } from '../context/accesosStore';

export function useAccesos() {
  const ctx = useContext(AccesosContext);
  if (!ctx) throw new Error('useAccesos debe usarse dentro de <AccesosProvider>.');
  return ctx;
}
