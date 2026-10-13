/**
 * useAsignaciones.js — Asignaciones que este usuario puede leer (lo exigen las reglas de Firestore), en vivo.
 *   Aut. 2, RH y admin: todas.
 *   Aut. 1: las de sus áreas y las de rol aut2 (el Nivel 2 que ve arriba en su organigrama).
 *   Solicitante: solo las suyas.
 * Nunca pide la colección completa a quien no puede leerla.
 *
 *   const { asignaciones, cargando, error } = useAsignaciones();
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useAccesos } from './useAccesos';

const SIN_DATOS = [];

/** Consultas que pide este alcance. Cada una es [clave, Query] */
function consultasDe({ completo, areasAut1, nomina }) {
  const col = collection(db, 'asignaciones');
  if (completo) return [['todas', col]];
  const lista = [];
  if (nomina) lista.push(['propias', query(col, where('nomina', '==', nomina))]);
  for (let i = 0; i < areasAut1.length; i += 10) lista.push([`area${i}`, query(col, where('areaId', 'in', areasAut1.slice(i, i + 10)))]);
  if (areasAut1.length) lista.push(['aut2', query(col, where('rol', '==', 'aut2'))]);
  return lista;
}

export function useAsignaciones() {
  const uid = useAuth().usuario?.uid ?? null;
  const { esRH, esAut2, areasAut1, nomina, cargando: cargandoAcc } = useAccesos();
  const completo = esRH || esAut2;
  const claveAreas = [...areasAut1].sort().join(',');
  const clave = `${uid}|${completo ? '*' : claveAreas}|${nomina}`;
  const [estado, setEstado] = useState({ clave: null, asignaciones: SIN_DATOS, error: null });

  useEffect(() => {
    if (!uid || cargandoAcc) return;
    const consultas = consultasDe({ completo, areasAut1: claveAreas ? claveAreas.split(',') : [], nomina });
    const porFuente = new Map();
    const pendientes = new Set(consultas.map(([k]) => k));
    const unsubs = consultas.map(([k, q]) => onSnapshot(
      q,
      (snap) => {
        porFuente.set(k, snap.docs.map(d => ({ id: d.id, ...d.data() })));
        pendientes.delete(k);
        if (pendientes.size) return;
        const mapa = new Map();
        for (const lista of porFuente.values()) for (const a of lista) mapa.set(a.id, a);
        setEstado({ clave, asignaciones: [...mapa.values()], error: null });
      },
      (error) => { console.error('Asignaciones:', error); setEstado({ clave, asignaciones: SIN_DATOS, error }); },
    ));
    if (consultas.length === 0) Promise.resolve().then(() => setEstado({ clave, asignaciones: SIN_DATOS, error: null }));
    return () => unsubs.forEach(u => u());
  }, [uid, cargandoAcc, completo, claveAreas, nomina, clave]);

  const listo = estado.clave === clave;
  return useMemo(() => ({
    asignaciones: listo ? estado.asignaciones : SIN_DATOS,
    cargando: !!uid && !listo && !estado.error,
    error: listo ? estado.error : null,
  }), [listo, estado, uid]);
}
