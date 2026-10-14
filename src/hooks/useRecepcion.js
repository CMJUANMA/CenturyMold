/**
 * useRecepcion.js — Solicitudes de tiempo extra AUTORIZADAS que RH aún no recibe, en tiempo real (onSnapshot).
 * Agrupadas por fecha del tiempo extra, la más próxima primero (ver agruparPorFecha). Solo RH y admin las leen.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { agruparPorFecha } from '../utils/tiempoExtra';

export function useRecepcion() {
  const uid = useAuth().usuario?.uid ?? null;
  const [estado, setEstado] = useState({ uid: null, lista: [], error: null });

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, 'tiempoExtra'), where('estatus', '==', 'autorizada')),
      snap => setEstado({ uid, lista: snap.docs.map(d => ({ id: d.id, ...d.data() })), error: null }),
      error => { console.error('Recepción:', error); setEstado({ uid, lista: [], error }); },
    );
  }, [uid]);

  const listo = estado.uid === uid;
  return useMemo(() => ({
    lista: listo ? estado.lista : [],
    porFecha: listo ? agruparPorFecha(estado.lista) : [],
    cargando: !!uid && !listo,
    error: listo ? estado.error : null,
  }), [listo, estado, uid]);
}
