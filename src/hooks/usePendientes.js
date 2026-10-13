/**
 * usePendientes.js — Contadores de pendientes de cada módulo (para las tarjetas del portal y la barra lateral).
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ESTATUS_SOLICITUD, ESTATUS_TE, ROLES_RH } from '../utils/constantes';

/** Transporte: RH ve las solicitudes por revisar; cada solicitante, las novedades que no ha visto */
export function usePendientesRutas(usuario, accesos, activo = true) {
  const [pendientesRh, setPendientesRh] = useState(0);
  const [novedades, setNovedades] = useState(0);
  const uid = usuario?.uid;
  const esRH = ROLES_RH.includes(usuario?.rol);
  // Solo quien puede solicitar rutas (RH, admin o solicitante vigente de algún área) lee solicitudes
  const esSolicitante = esRH || (accesos?.areasSolicitante?.length ?? 0) > 0;

  useEffect(() => {
    if (!uid || !activo) return;
    const unsubs = [];
    if (esRH) {
      unsubs.push(onSnapshot(
        query(collection(db, 'solicitudes'), where('estatus', '==', ESTATUS_SOLICITUD.PENDIENTE)),
        snap => setPendientesRh(snap.size),
        err => console.error('Pendientes RH:', err),
      ));
    }
    if (esSolicitante) unsubs.push(onSnapshot(
      query(collection(db, 'solicitudes'), where('creadoPor', '==', uid), where('vistoPorSolicitante', '==', false)),
      snap => setNovedades(snap.size),
      err => console.error('Novedades:', err),
    ));
    return () => unsubs.forEach(u => u());
  }, [uid, esRH, esSolicitante, activo]);

  return { pendientesRh, novedades, total: esRH ? pendientesRh : novedades };
}

/**
 * Tiempo extra: lo que espera una acción de esta persona.
 *   Aut. 1 → pendiente_aut1 de sus áreas · Aut. 2 (o RH) → pendiente_aut2 · RH → autorizadas por recibir
 *   Solicitante → devueltas que debe corregir.
 * Nunca cuenta lo que creó la propia persona (nadie autoriza lo suyo).
 */
export function usePendientesTE(usuario, accesos, activo = true) {
  const uid = usuario?.uid;
  const esRH = ROLES_RH.includes(usuario?.rol);
  const { areasSolicitante, areasAut1, esAut2 } = accesos;
  const idsAut1 = useMemo(() => [...areasAut1].sort().join('|'), [areasAut1]);
  const esSolicitante = areasSolicitante.length > 0;
  const firmaAut2 = esAut2 || esRH; // RH firma el nivel 2 por su rol
  const [conteos, setConteos] = useState({});

  useEffect(() => {
    if (!uid || !activo) return;
    const col = collection(db, 'tiempoExtra');
    const unsubs = [];
    const escuchar = (clave, q, propias = false) => unsubs.push(onSnapshot(
      q,
      snap => {
        const n = snap.docs.filter(d => propias || d.data().creadoPor !== uid).length;
        setConteos(c => (c[clave] === n ? c : { ...c, [clave]: n }));
      },
      err => console.error('Pendientes TE:', clave, err),
    ));
    // Una consulta por área: las reglas validan el área con igualdad
    for (const id of idsAut1 ? idsAut1.split('|') : []) {
      escuchar(`aut1:${id}`, query(col, where('areaId', '==', id), where('estatus', '==', ESTATUS_TE.PENDIENTE_AUT1)));
    }
    if (firmaAut2) escuchar('aut2', query(col, where('estatus', '==', ESTATUS_TE.PENDIENTE_AUT2)));
    if (esRH) escuchar('rh', query(col, where('estatus', '==', ESTATUS_TE.AUTORIZADA)));
    if (esSolicitante) {
      escuchar('devueltas', query(col, where('creadoPor', '==', uid), where('estatus', '==', ESTATUS_TE.DEVUELTA)), true);
    }
    return () => { unsubs.forEach(u => u()); setConteos({}); };
  }, [uid, activo, idsAut1, firmaAut2, esRH, esSolicitante]);

  return Object.values(conteos).reduce((a, b) => a + b, 0);
}
