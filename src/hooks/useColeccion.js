/**
 * useColeccion.js — Hook genérico para cargar una colección de Firestore.
 * Devuelve { datos, cargando, error, recargar }.
 */
import { useState, useEffect, useCallback } from 'react';
import { getDocs } from 'firebase/firestore';

export function useColeccion(queryRef) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [rev, setRev] = useState(0);

  const recargar = useCallback(() => setRev(r => r + 1), []);

  useEffect(() => {
    if (!queryRef) return;
    let cancelado = false;
    setCargando(true);
    setError(null);

    getDocs(queryRef)
      .then(snap => {
        if (!cancelado) setDatos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
      .catch(err => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  return { datos, cargando, error, recargar };
}
