/**
 * useBandeja.js — Lo que le toca firmar a esta persona, en tiempo real (onSnapshot):
 *   nivel1: pendiente_aut1 de las áreas donde es Aut. 1 vigente (una consulta por área)
 *   nivel2: pendiente_aut2 de todas las áreas, para la Aut. 2 y para RH/admin
 * Las más antiguas primero. Una persona con los dos roles recibe las dos listas.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useAccesos } from './useAccesos';
import { masAntiguasPrimero } from '../utils/tiempoExtra';

const VACIO = [];

export function useBandeja() {
  const uid = useAuth().usuario?.uid ?? null;
  const { esRH, esAut2, areasAut1, cargando: cargandoAcc } = useAccesos();
  const claveAreas = [...areasAut1].sort().join(',');
  const firmaNivel2 = esAut2 || esRH;
  const clave = `${uid}|${claveAreas}|${firmaNivel2}`;
  const [estado, setEstado] = useState({ clave: null, fuentes: {}, error: null });

  useEffect(() => {
    if (!uid || cargandoAcc) return;
    const col = collection(db, 'tiempoExtra');
    const consultas = [];
    for (const a of claveAreas ? claveAreas.split(',') : []) consultas.push([`n1:${a}`, query(col, where('areaId', '==', a), where('estatus', '==', 'pendiente_aut1'))]);
    if (firmaNivel2) consultas.push(['n2', query(col, where('estatus', '==', 'pendiente_aut2'))]);
    const fuentes = {};
    const pendientes = new Set(consultas.map(([k]) => k));
    const unsubs = consultas.map(([k, q]) => onSnapshot(
      q,
      (snap) => {
        fuentes[k] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        pendientes.delete(k);
        if (!pendientes.size) setEstado({ clave, fuentes: { ...fuentes }, error: null });
      },
      (error) => { console.error('Bandeja:', k, error); setEstado({ clave, fuentes: {}, error }); },
    ));
    if (!consultas.length) Promise.resolve().then(() => setEstado({ clave, fuentes: {}, error: null }));
    return () => unsubs.forEach(u => u());
  }, [uid, cargandoAcc, claveAreas, firmaNivel2, clave]);

  const listo = estado.clave === clave;
  return useMemo(() => {
    const f = listo ? estado.fuentes : {};
    const nivel1 = masAntiguasPrimero(Object.entries(f).filter(([k]) => k.startsWith('n1:')).flatMap(([, v]) => v));
    return { nivel1, nivel2: masAntiguasPrimero(f.n2 ?? VACIO), cargando: !!uid && !listo && !estado.error, error: listo ? estado.error : null };
  }, [listo, estado, uid]);
}
