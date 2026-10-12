/**
 * useCatalogos.js — Acceso a los catálogos compartidos (ver context/CatalogosContext.jsx).
 *
 *   const { rutasActivas, empleadosActivos, cargando, error, recargar } = useCatalogos();
 *   useCatalogos({ empleados: false })  // si la pantalla no necesita el padrón de empleados
 *
 * Devuelve completos (rutas, comunidades, puntos, empleados) y solo activos (rutasActivas, ...).
 * Cargar es perezoso: la primera pantalla que lo pide dispara la lectura; después se reutiliza.
 */
import { useContext, useEffect } from 'react';
import { CatalogosContext } from '../context/catalogosStore';

export function useCatalogos({ empleados = true } = {}) {
  const ctx = useContext(CatalogosContext);
  const { registrar } = ctx;

  useEffect(() => registrar('cat'), [registrar]);
  useEffect(() => (empleados ? registrar('emp') : undefined), [empleados, registrar]);

  // Cargando también antes de que arranque la primera carga (evita un destello de listas vacías)
  const pendiente = (g) => !!ctx.uid && ctx.listoG[g] !== ctx.uid && !ctx.errorG[g];
  const cargando = pendiente('cat') || ctx.cargandoG.cat || (empleados && (pendiente('emp') || ctx.cargandoG.emp));
  const error = ctx.errorG.cat || (empleados ? ctx.errorG.emp : null);
  return { ...ctx, cargando, error };
}

/** Solo la función recargar(), sin registrar la pantalla como consumidora (no dispara cargas). */
export function useRecargarCatalogos() {
  return useContext(CatalogosContext).recargar;
}
