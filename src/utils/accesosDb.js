/**
 * accesosDb.js — Lectura de accesos/{nomina} (ver accesos.js). El login la hace SIN sesión: las reglas dejan `get` público de ese documento
 * (nunca `list`). Si no se puede leer (sin red, nómina rara) se usa la versión 1: el login normal sigue funcionando.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { nominaValidaParaAcceso, versionDe } from './accesos';

/** @returns {Promise<{ version: number, uid: string|null, existe: boolean }>} */
export async function leerAcceso(nomina) {
  const n = String(nomina ?? '').trim();
  if (!nominaValidaParaAcceso(n)) return { version: 1, uid: null, existe: false };
  try {
    const snap = await getDoc(doc(db, 'accesos', n));
    if (!snap.exists()) return { version: 1, uid: null, existe: false };
    return { version: versionDe(snap.data()), uid: snap.data().uid ?? null, existe: true };
  } catch (err) {
    console.warn('No se pudo leer accesos; se usa la versión 1:', err.code ?? err.message);
    return { version: 1, uid: null, existe: false };
  }
}
