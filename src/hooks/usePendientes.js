/**
 * usePendientes.js — Contadores de pendientes de cada módulo (para la barra lateral).
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { FUNCIONES } from '../funciones';
import { esVencida } from '../utils/tiempoExtra';
import { useAhora } from './useAhora';
import { ESTATUS_SOLICITUD, ESTATUS_TE, ROLES_ENVIAN_PROVEEDOR, ROLES_RH } from '../utils/constantes';

/** Transporte: RH ve las solicitudes por revisar; cada solicitante, las novedades que no ha visto */
export function usePendientesRutas(usuario, accesos, activo = true) {
  const [pendientesRh, setPendientesRh] = useState(0);
  const [novedades, setNovedades] = useState(0);
  const uid = usuario?.uid;
  const esRH = ROLES_RH.includes(usuario?.rol);
  // Solo quien puede solicitar rutas (RH, admin o solicitante vigente de algún área) lee solicitudes
  const esSolicitante = esRH || (accesos?.areasSolicitante?.length ?? 0) > 0;
  // Apagado el transporte suelto (funciones.js) no hay nada que contar: no se escucha ninguna consulta
  const activa = activo && FUNCIONES.transporteSuelto;

  useEffect(() => {
    if (!uid || !activa) return;
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
  }, [uid, esRH, esSolicitante, activa]);

  return { pendientesRh, novedades, total: esRH ? pendientesRh : novedades };
}

/**
 * Por autorizar: lo que espera la firma de esta persona como Aut. 1 (pendiente_aut1 de sus áreas) o Aut. 2 (pendiente_aut2).
 * No cuenta lo que creó ella misma (el admin sí cuenta lo suyo) ni las vencidas (su fecha ya pasó). Devuelve { aut1, aut2, total }.
 */
export function usePorAutorizar(usuario, accesos, activo = true) {
  const uid = usuario?.uid;
  const { areasAut1, esAut2 } = accesos;
  const firmaNivel2 = esAut2 || ROLES_RH.includes(usuario?.rol); // RH y admin también firman el nivel 2
  const idsAut1 = useMemo(() => [...areasAut1].sort().join('|'), [areasAut1]);
  const [docs, setDocs] = useState({}); // clave → solicitudes que llegaron (se cuentan al dibujar: lo vencido cambia con la hora)
  const ahora = useAhora();

  useEffect(() => {
    if (!uid || !activo) return;
    const col = collection(db, 'tiempoExtra');
    const unsubs = [];
    const escuchar = (clave, q) => unsubs.push(onSnapshot(
      q,
      snap => {
        const lista = snap.docs.map(d => d.data()).filter(d => d.creadoPor !== uid || accesos.esAdmin);
        setDocs(c => ({ ...c, [clave]: lista }));
      },
      err => console.error('Por autorizar:', clave, err),
    ));
    for (const id of idsAut1 ? idsAut1.split('|') : []) {
      escuchar(`aut1:${id}`, query(col, where('areaId', '==', id), where('estatus', '==', ESTATUS_TE.PENDIENTE_AUT1)));
    }
    if (firmaNivel2) escuchar('aut2', query(col, where('estatus', '==', ESTATUS_TE.PENDIENTE_AUT2)));
    return () => { unsubs.forEach(u => u()); setDocs({}); };
  }, [uid, activo, idsAut1, firmaNivel2]);

  const vivas = (l = []) => l.filter(t => !esVencida(t, ahora)).length;
  const aut1 = Object.entries(docs).filter(([k]) => k.startsWith('aut1:')).reduce((a, [, l]) => a + vivas(l), 0);
  const aut2 = vivas(docs.aut2);
  return { aut1, aut2, total: aut1 + aut2 };
}

/** Autorizadas pendientes de enviar al proveedor (las confirman RH, admin y Nóminas): contador en vivo para el menú */
export function usePorRecibir(usuario, activo = true) {
  const uid = usuario?.uid;
  const esRH = ROLES_ENVIAN_PROVEEDOR.includes(usuario?.rol);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!uid || !activo || !esRH) return;
    return onSnapshot(
      query(collection(db, 'tiempoExtra'), where('estatus', '==', ESTATUS_TE.AUTORIZADA)),
      snap => setN(snap.size),
      err => console.error('Por recibir:', err),
    );
  }, [uid, activo, esRH]);

  return esRH ? n : 0;
}
