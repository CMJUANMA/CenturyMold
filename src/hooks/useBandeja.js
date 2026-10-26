/**
 * useBandeja.js — Lo que le toca firmar a esta persona, en tiempo real (onSnapshot):
 *   nivel1: pendiente_aut1 de las áreas donde es Aut. 1 vigente (una consulta por área)
 *   nivel2: pendiente_aut2 de todas las áreas, para la Aut. 2 y para RH/admin
 * Las que vencen hoy primero y luego las más antiguas. Una persona con los dos roles recibe las dos listas.
 * Las VENCIDAS (su fecha ya pasó, esVencida) salen de nivel1 y nivel2 y van aparte en `vencidas`. La Aut. 2 vigente ve también las vencidas que estaban en nivel 1 de CUALQUIER área
 * (puede autorizarlas fuera de tiempo); a los demás solo les salen las de sus áreas y las de nivel 2, y todo es consulta.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { useAccesos } from './useAccesos';
import { conVenceHoyPrimero, esVencida } from '../utils/tiempoExtra';
import { useAhora } from './useAhora';

const VACIO = [];

export function useBandeja() {
  const uid = useAuth().usuario?.uid ?? null;
  const { esRH, esAut2, areasAut1, cargando: cargandoAcc } = useAccesos();
  const claveAreas = [...areasAut1].sort().join(',');
  const firmaNivel2 = esAut2 || esRH;
  const ahora = useAhora();
  const clave = `${uid}|${claveAreas}|${firmaNivel2}|${esAut2}`;
  const [estado, setEstado] = useState({ clave: null, fuentes: {}, error: null });

  useEffect(() => {
    if (!uid || cargandoAcc) return;
    const col = collection(db, 'tiempoExtra');
    const consultas = [];
    for (const a of claveAreas ? claveAreas.split(',') : []) consultas.push([`n1:${a}`, query(col, where('areaId', '==', a), where('estatus', '==', 'pendiente_aut1'))]);
    if (firmaNivel2) consultas.push(['n2', query(col, where('estatus', '==', 'pendiente_aut2'))]);
    if (esAut2) consultas.push(['v1', query(col, where('estatus', '==', 'pendiente_aut1'))]); // solo para las vencidas de nivel 1 de toda la planta
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
  }, [uid, cargandoAcc, claveAreas, firmaNivel2, esAut2, clave]);

  const listo = estado.clave === clave;
  return useMemo(() => {
    const f = listo ? estado.fuentes : {};
    const todas1 = Object.entries(f).filter(([k]) => k.startsWith('n1:')).flatMap(([, v]) => v);
    const todas2 = f.n2 ?? VACIO;
    const vivas = (l) => conVenceHoyPrimero(l.filter(t => !esVencida(t, ahora)), ahora);
    const deNivel1 = new Map([...todas1, ...(f.v1 ?? VACIO)].map(t => [t.id, t])); // las de mis áreas y, si soy Aut. 2, las de toda la planta (sin repetir)
    const vencidas = [...[...deNivel1.values()].map(t => ({ ...t, nivel: 1 })), ...todas2.map(t => ({ ...t, nivel: 2 }))].filter(t => esVencida(t, ahora))
      .sort((a, b) => String(b.fechaTE).localeCompare(String(a.fechaTE)));
    return { nivel1: vivas(todas1), nivel2: vivas(todas2), vencidas, cargando: !!uid && !listo && !estado.error, error: listo ? estado.error : null };
  }, [listo, estado, uid, ahora]);
}
