/**
 * avisosDb.js — Lecturas únicas para los recordatorios de "a quién avisar". Solo asignaciones (y el nivel jerárquico de los puestos);
 * nunca se leen usuarios. Las consultas son las que permiten las reglas: where('areaId' == área) + where('rol' == 'aut1') y where('rol' == 'aut2').
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const docs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

/**
 * Asignaciones de Aut. 1 de las áreas dadas y/o de Aut. 2, más los puestos (para ordenar a los Aut. 2).
 * @returns {Promise<{ asignaciones: object[], puestos: object[] }>}
 */
export async function leerAsignacionesParaAvisar({ areaIds = [], aut2 = false } = {}) {
  const col = collection(db, 'asignaciones');
  const consultas = [...new Set(areaIds.filter(Boolean))].map(a => getDocs(query(col, where('areaId', '==', a), where('rol', '==', 'aut1'))));
  if (aut2) consultas.push(getDocs(query(col, where('rol', '==', 'aut2'))));
  const [resultados, puestos] = await Promise.all([
    Promise.all(consultas),
    aut2 ? getDocs(collection(db, 'puestos')).then(docs).catch(() => []) : Promise.resolve([]),
  ]);
  return { asignaciones: resultados.flatMap(docs), puestos };
}
