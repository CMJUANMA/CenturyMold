/**
 * matrizTE.js — Matriz de autorización de tiempo extra (areasTE + config/tiempoExtra).
 * Se lee UNA vez por sesión (por uid) y se comparte; la pantalla de niveles la invalida al guardar.
 * La parte pura (accesosDe) no depende de Firebase.
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ROLES_RH } from './constantes.js';

/** Áreas y niveles tal como están guardados */
export async function leerMatrizTE() {
  const [areasSnap, cfgSnap] = await Promise.all([
    getDocs(collection(db, 'areasTE')),
    getDoc(doc(db, 'config', 'tiempoExtra')),
  ]);
  const areas = areasSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es'));
  return { areas, config: cfgSnap.exists() ? cfgSnap.data() : {} };
}

/**
 * Qué puede hacer una persona en tiempo extra, según la matriz (por nómina, no por puesto).
 *   areasSolicitante: áreas donde su nómina está en solicitantesNominas
 *   areasAut1:        áreas donde es autorizador1 o suplente1
 *   esAut2:           autorizador2, suplente2 o rol RH/admin
 */
export function accesosDe(usuario, matriz) {
  const nomina = String(usuario?.nomina ?? '').trim();
  const activas = (matriz?.areas ?? []).filter(a => a.activa !== false);
  const config = matriz?.config ?? {};
  const es = (valor) => !!nomina && String(valor ?? '').trim() === nomina;
  return {
    areasSolicitante: activas.filter(a => (a.solicitantesNominas ?? []).some(es)),
    areasAut1: activas.filter(a => es(a.autorizador1Nomina) || es(a.suplente1Nomina)),
    esAut2: es(config.autorizador2Nomina) || es(config.suplente2Nomina) || ROLES_RH.includes(usuario?.rol),
  };
}

// ── Caché de sesión ───────────────────────────────────────────────────────
let cache = { uid: null, promesa: null, matriz: null };
const oyentes = new Set();

export function cargarMatrizTE(uid) {
  if (cache.uid !== uid) cache = { uid, promesa: null, matriz: null };
  if (!cache.promesa) {
    const mia = cache;
    mia.promesa = leerMatrizTE().then(m => { mia.matriz = m; return m; }).catch(err => {
      if (cache === mia) cache = { uid, promesa: null, matriz: null }; // permite reintentar
      throw err;
    });
  }
  return cache.promesa;
}

/** Matriz ya cargada para ese uid (o null) */
export const matrizEnCache = (uid) => (cache.uid === uid ? cache.matriz : null);

/** Descarta la caché (tras guardar la matriz) y avisa a los hooks montados para que relean */
export function invalidarMatrizTE() {
  cache = { uid: null, promesa: null, matriz: null };
  oyentes.forEach(fn => fn());
}

export function suscribirMatrizTE(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
