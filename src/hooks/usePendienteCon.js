/**
 * usePendienteCon.js — Para "Mis solicitudes": con quién está cada solicitud pendiente ("Pendiente con: Jose Anselmo Mendoza · en espera desde hace 2 días").
 * Lee una sola vez las asignaciones vigentes de Aut. 1 de las áreas y de Aut. 2 que hagan falta (nunca usuarios) y recalcula el tiempo cada minuto.
 *
 *   const lineaPendiente = usePendienteCon(propias);   lineaPendiente(t) → texto, o null si no está pendiente
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useAreas } from './useAreas';
import { leerAsignacionesParaAvisar } from '../utils/avisosDb';
import { lineaPendiente } from '../utils/avisos';

export function usePendienteCon(solicitudes) {
  const nomina = String(useAuth().usuario?.nomina ?? '');
  const { nombres } = useAreas();
  const [datos, setDatos] = useState({ asignaciones: [], puestos: [] });
  const [ahora, setAhora] = useState(() => Date.now());
  const areasAut1 = [...new Set(solicitudes.filter(t => t.estatus === 'pendiente_aut1').map(t => t.areaId))].sort().join(',');
  const hayAut2 = solicitudes.some(t => t.estatus === 'pendiente_aut2');

  useEffect(() => {
    if (!areasAut1 && !hayAut2) return;
    let vigente = true;
    leerAsignacionesParaAvisar({ areaIds: areasAut1 ? areasAut1.split(',') : [], aut2: hayAut2 })
      .then(d => { if (vigente) setDatos(d); })
      .catch(err => console.error('Pendiente con:', err));
    return () => { vigente = false; };
  }, [areasAut1, hayAut2]);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60_000); return () => clearInterval(t); }, []);

  return useMemo(() => (t) => lineaPendiente(t, {
    asignaciones: datos.asignaciones, puestos: datos.puestos, excluirNomina: nomina, nombreArea: (id) => nombres.get(id) ?? id, ahora,
  }), [datos, nomina, nombres, ahora]);
}