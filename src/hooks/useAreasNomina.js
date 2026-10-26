/**
 * useAreasNomina.js — Lo que necesitan Reportes de nómina y la revisión de un área para un periodo: las solicitudes autorizadas por Aut. 2, sus empleados
 * (se leen por solicitud y se guardan: cambiar de semana no vuelve a leer lo ya leído), los ajustes de Nóminas en vivo y, por área, sus renglones
 * ya ajustados. Un área sale si tiene tiempo extra autorizado en el periodo o ajustes guardados (por ejemplo, empleados agregados).
 *   const { areas, pendientes, cargando, cargandoDetalle, error } = useAreasNomina(periodo);
 *   area = { areaId, nombre, base (lo autorizado), filas (ajustadas), ajuste, totales, estado, fueraDeTiempo ({ total, folios, trasFirma }: lo autorizado fuera de tiempo) }
 */
import { useEffect, useMemo, useState } from 'react';
import { useAjustesNomina } from './useAjustesNomina';
import { useAhora } from './useAhora';
import { useAreas } from './useAreas';
import { useResumenTE } from './useResumenTE';
import {
  autorizadasDelPeriodo, estadoDeArea, fueraDeTiempoDelArea, filasAutorizadas, filasDelArea, pendientesDelPeriodo, totalesDeFilas,
} from '../utils/formatoNomina';
import { trozos } from '../utils/tiempoExtra';
import { leerSolicitudTE } from '../utils/tiempoExtraDb';

export function useAreasNomina(periodo) {
  const ahora = useAhora();
  const { planta, cargando, error } = useResumenTE();
  const { nombres } = useAreas();
  const { ajustes, error: errorAjustes } = useAjustesNomina(periodo);
  const autorizadas = useMemo(() => (periodo ? autorizadasDelPeriodo(planta, periodo) : []), [planta, periodo]);
  const pendientes = useMemo(() => (periodo ? pendientesDelPeriodo(planta, periodo, nombres, ahora) : { total: 0, porArea: [], vencidas: { total: 0, porArea: [] } }), [planta, periodo, nombres, ahora]);

  const [detalle, setDetalle] = useState(() => new Map());
  const [errorDetalle, setErrorDetalle] = useState('');
  const faltan = useMemo(() => autorizadas.filter(t => !detalle.has(t.id)), [autorizadas, detalle]);
  const claveFaltan = faltan.map(t => t.id).join(',');
  useEffect(() => {
    if (!claveFaltan) return undefined;
    let vigente = true;
    (async () => {
      for (const lote of trozos(claveFaltan.split(','), 5)) {
        const leidas = await Promise.all(lote.map(id => leerSolicitudTE(id).then(s => [id, s])));
        if (!vigente) return;
        setDetalle(prev => { const m = new Map(prev); leidas.forEach(([id, s]) => m.set(id, s ?? { id, empleados: [] })); return m; });
      }
    })().catch(err => { if (vigente) setErrorDetalle(err.message); });
    return () => { vigente = false; };
  }, [claveFaltan]);
  const cargandoDetalle = faltan.length > 0 && !errorDetalle;

  const areas = useMemo(() => {
    const ids = [...new Set([...autorizadas.map(t => t.areaId), ...[...ajustes.entries()].filter(([, a]) => (a.cambios ?? []).length > 0).map(([id]) => id)])];
    return ids.map(areaId => {
      const delArea = autorizadas.map(t => detalle.get(t.id)).filter(s => s && s.areaId === areaId);
      const ajuste = ajustes.get(areaId) ?? null;
      const base = periodo ? filasAutorizadas(delArea, periodo) : [];
      const filas = periodo ? filasDelArea({ solicitudes: delArea, periodo, ajuste }) : [];
      const totales = totalesDeFilas(filas, periodo);
      const fueraDeTiempo = fueraDeTiempoDelArea(autorizadas.filter(t => t.areaId === areaId), ajuste);
      return { areaId, nombre: nombres.get(areaId) ?? areaId, base, filas, ajuste, totales, estado: estadoDeArea(ajuste), fueraDeTiempo };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [autorizadas, detalle, ajustes, periodo, nombres]);

  return {
    areas, pendientes, cargando, cargandoDetalle, nombres,
    error: error ?? errorAjustes ?? (errorDetalle ? new Error(errorDetalle) : null),
  };
}
