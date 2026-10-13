/**
 * useTransporteAnterior.js — ¿Este usuario tiene solicitudes de transporte suyas de antes? Si las tiene, conserva su consulta
 * (los solicitantes ya no crean transporte suelto: lo piden dentro del tiempo extra). Una sola lectura de un documento por sesión.
 */
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export function useTransporteAnterior(uid, activo = true) {
  const [resultado, setResultado] = useState({ uid: null, hay: false });
  useEffect(() => {
    if (!uid || !activo) return;
    let vigente = true;
    getDocs(query(collection(db, 'solicitudes'), where('creadoPor', '==', uid), limit(1)))
      .then(s => { if (vigente) setResultado({ uid, hay: !s.empty }); })
      .catch(() => { if (vigente) setResultado({ uid, hay: false }); });
    return () => { vigente = false; };
  }, [uid, activo]);
  return resultado.uid === uid && resultado.hay;
}
