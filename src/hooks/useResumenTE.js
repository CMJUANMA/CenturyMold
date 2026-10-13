/**
 * useResumenTE.js — Solicitudes de tiempo extra que este usuario puede ver, en vivo, para su Inicio.
 *   propias: las que creó (solicitante / Aut. 1 / RH)
 *   delArea: las de sus áreas, sin borradores (Aut. 1; una consulta por área)
 *   planta:  las de toda la planta, sin borradores (Aut. 2, RH y admin)
 * Las consultas llevan estatus in [sin borrador] porque las reglas no dejan leer borradores ajenos.
 * Mientras no haya solicitudes, todo es 0 y no hay error.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useAccesos } from './useAccesos';
import { ESTATUS_TE_VISIBLES } from '../utils/tiempoExtra';

export { ESTATUS_TE_VISIBLES };
const VACIO = [];

export function useResumenTE() {
  const uid = useAuth().usuario?.uid ?? null;
  const { esRH, esAut2, areasAut1, areasSolicitante, cargando: cargandoAcc } = useAccesos();
  const claveAreas = [...areasAut1].sort().join(',');
  const pidePropias = esRH || areasSolicitante.length > 0 || areasAut1.length > 0;
  const pidePlanta = esRH || esAut2;
  const clave = `${uid}|${pidePropias}|${pidePlanta}|${claveAreas}`;
  const [estado, setEstado] = useState({ clave: null, fuentes: {}, error: null });

  useEffect(() => {
    if (!uid || cargandoAcc) return;
    const col = collection(db, 'tiempoExtra');
    const consultas = [];
    if (pidePropias) consultas.push(['propias', query(col, where('creadoPor', '==', uid))]);
    if (pidePlanta) consultas.push(['planta', query(col, where('estatus', 'in', ESTATUS_TE_VISIBLES))]);
    else for (const a of claveAreas ? claveAreas.split(',') : []) consultas.push([`area:${a}`, query(col, where('areaId', '==', a), where('estatus', 'in', ESTATUS_TE_VISIBLES))]);
    const fuentes = {};
    const pendientes = new Set(consultas.map(([k]) => k));
    const unsubs = consultas.map(([k, q]) => onSnapshot(
      q,
      (snap) => {
        fuentes[k] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        pendientes.delete(k);
        if (!pendientes.size) setEstado({ clave, fuentes: { ...fuentes }, error: null });
      },
      (error) => { console.error('Resumen TE:', k, error); setEstado({ clave, fuentes: {}, error }); },
    ));
    if (!consultas.length) Promise.resolve().then(() => setEstado({ clave, fuentes: {}, error: null }));
    return () => unsubs.forEach(u => u());
  }, [uid, cargandoAcc, pidePropias, pidePlanta, claveAreas, clave]);

  const listo = estado.clave === clave;
  return useMemo(() => {
    const f = listo ? estado.fuentes : {};
    const porId = (listas) => [...new Map(listas.flat().map(d => [d.id, d])).values()];
    return {
      cargando: !!uid && !listo && !estado.error,
      error: listo ? estado.error : null,
      propias: f.propias ?? VACIO,
      planta: f.planta ?? VACIO,
      delArea: porId(Object.entries(f).filter(([k]) => k.startsWith('area:')).map(([, v]) => v)),
    };
  }, [listo, estado, uid]);
}
