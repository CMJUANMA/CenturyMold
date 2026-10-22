/**
 * AccesosContext.jsx — Roles operativos del usuario (asignaciones/{nomina}_{rol}_{área}).
 * Una sola suscripción por sesión: las asignaciones de SU nómina, en vivo. Las vigentes se recalculan cada minuto,
 * así un rol temporal vence solo (y uno programado empieza solo) sin recargar. Las reglas de Firestore comprueban lo mismo.
 * Se consume con useAccesos() (hooks/useAccesos.js).
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { AccesosContext } from './accesosStore';
import { calcularAccesos } from '../utils/asignaciones';

const REVISION_MS = 60_000;

export function AccesosProvider({ children }) {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? null;
  const nomina = String(usuario?.nomina ?? '').trim();
  const [estado, setEstado] = useState({ nomina: null, asignaciones: [], error: null });
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!uid || !nomina) return;
    return onSnapshot(
      query(collection(db, 'asignaciones'), where('nomina', '==', nomina)),
      snap => setEstado({ nomina, asignaciones: snap.docs.map(d => ({ id: d.id, ...d.data() })), error: null }),
      error => { console.error('Asignaciones:', error); setEstado({ nomina, asignaciones: [], error }); },
    );
  }, [uid, nomina]);

  useEffect(() => {
    if (!uid) return;
    const t = setInterval(() => setAhora(Date.now()), REVISION_MS);
    return () => clearInterval(t);
  }, [uid]);

  const rol = usuario?.rol;
  const valor = useMemo(() => {
    const listo = !!nomina && estado.nomina === nomina;
    const asignaciones = listo ? estado.asignaciones : [];
    const accesos = calcularAccesos(asignaciones, { rol }, ahora);
    return {
      ...accesos,
      asignaciones,
      nomina,
      error: listo ? estado.error : null,
      // Sin nómina no hay nada que esperar (p. ej. un admin sin padrón)
      cargando: !!uid && !!nomina && !listo,
      tieneAcceso: accesos.esRH || accesos.esNomina || accesos.esAut2 || accesos.areasAut1.length > 0 || accesos.areasSolicitante.length > 0,
    };
  }, [estado, nomina, uid, rol, ahora]);

  return <AccesosContext.Provider value={valor}>{children}</AccesosContext.Provider>;
}
