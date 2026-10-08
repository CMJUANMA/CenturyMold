// Hook para escuchar un documento de Firestore en tiempo real
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {string} coleccion
 * @param {string | null} id
 */
export function useDocumento(coleccion, id) {
  const [dato, setDato] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setDato(null);
      setCargando(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, coleccion, id),
      (snap) => {
        setDato(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setCargando(false);
      },
      (err) => {
        setError(err);
        setCargando(false);
      }
    );
    return unsub;
  }, [coleccion, id]);

  return { dato, cargando, error };
}
