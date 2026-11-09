/**
 * respaldoDb.js — Lectura de todas las colecciones para el respaldo completo (solo admin). La usan «Respaldo completo (JSON)» y «Preparar para producción».
 * Devuelve la forma que espera construirRespaldo: { colección: [{ id, data, sub }] }.
 * `conBorradores`: incluye los borradores de tiempo extra de todas las personas; solo se puede con la ventana de limpieza abierta (firestore.rules).
 * accesos no se puede listar (las reglas solo dejan leerlos por nómina): se leen los de cada usuario.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ESTATUS_TE_VISIBLES } from './tiempoExtra';
import { COLECCIONES_RESPALDO, SUBCOLECCIONES_RESPALDO } from './respaldoCompleto';

const LOTE = 8; // lecturas a la vez

export async function leerColeccionesParaRespaldo({ conBorradores = false, onProgreso = () => {} } = {}) {
  const colecciones = {};
  for (const nombre of COLECCIONES_RESPALDO) {
    onProgreso(`Leyendo ${nombre}…`);
    let docs;
    if (nombre === 'accesos') {
      const nominas = [...new Set((colecciones.usuarios ?? []).map(u => String(u.data?.nomina ?? '')).filter(Boolean))];
      docs = [];
      for (let i = 0; i < nominas.length; i += LOTE) {
        await Promise.all(nominas.slice(i, i + LOTE).map(async (n) => {
          const s = await getDoc(doc(db, 'accesos', n)).catch(() => null);
          if (s?.exists()) docs.push({ id: s.id, data: s.data(), sub: null });
        }));
      }
    } else {
      // Sin la ventana, una consulta de tiempo extra debe excluir los borradores (solo los ve su creador): las reglas no dejan pedirlos todos
      const base = collection(db, nombre);
      const snap = await getDocs(nombre === 'tiempoExtra' && !conBorradores ? query(base, where('estatus', 'in', ESTATUS_TE_VISIBLES)) : base);
      docs = snap.docs.map(d => ({ id: d.id, data: d.data(), sub: null }));
      const subs = SUBCOLECCIONES_RESPALDO[nombre];
      if (subs) {
        for (let i = 0; i < docs.length; i += LOTE) {
          onProgreso(`Leyendo ${nombre} (${Math.min(i + LOTE, docs.length)} de ${docs.length})…`);
          await Promise.all(docs.slice(i, i + LOTE).map(async (d) => {
            d.sub = {};
            for (const s of subs) {
              const ss = await getDocs(collection(db, nombre, d.id, s));
              d.sub[s] = ss.docs.map(x => ({ id: x.id, data: x.data() }));
            }
          }));
        }
      }
    }
    colecciones[nombre] = docs;
  }
  return colecciones;
}

/** Descarga un JSON en el navegador */
export function descargarArchivoJson(objeto, nombreArchivo) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(objeto)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
