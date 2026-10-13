/**
 * useAreas.js — Catálogo de áreas (areas/{id}: nombre, participaTE, activa, orden), leído una vez por sesión.
 *   const { areas, nombres, cargando } = useAreas();   // nombres: Map id → nombre
 * invalidarAreas() fuerza una nueva lectura (tras editar áreas).
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

const SIN_AREAS = [];
let cache = { uid: null, promesa: null };

const leerAreas = () => getDocs(collection(db, 'areas')).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), 'es')));

export const invalidarAreas = () => { cache = { uid: null, promesa: null }; };

export function useAreas() {
  const uid = useAuth().usuario?.uid ?? null;
  const [estado, setEstado] = useState({ uid: null, areas: [], error: null });

  useEffect(() => {
    if (!uid) return;
    if (cache.uid !== uid || !cache.promesa) {
      const mia = { uid, promesa: leerAreas() };
      cache = mia;
      mia.promesa.catch(() => { if (cache === mia) cache = { uid: null, promesa: null }; });
    }
    let vigente = true;
    cache.promesa
      .then(areas => { if (vigente) setEstado({ uid, areas, error: null }); })
      .catch(error => { if (vigente) setEstado({ uid, areas: [], error }); });
    return () => { vigente = false; };
  }, [uid]);

  const listo = estado.uid === uid;
  const areas = listo ? estado.areas : SIN_AREAS;
  const nombres = useMemo(() => new Map(areas.map(a => [a.id, a.nombre ?? a.id])), [areas]);
  return { areas, nombres, error: listo ? estado.error : null, cargando: !!uid && !listo };
}
