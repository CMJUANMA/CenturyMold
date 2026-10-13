/**
 * estructuraDb.js — Lecturas y escrituras de la estructura Áreas → Puestos → Empleados (Firestore).
 * Las escrituras se arman como listas de operaciones (`op(batch)`) y se ejecutan en lotes de 500;
 * cada cambio de estructura deja su renglón en la bitácora dentro del mismo lote.
 */
import { arrayUnion, collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { AREA_ADMIN, registroBitacora } from './estructura';

export const docsDe = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

/**
 * Lee una colección sin ocultar fallas: avisa con un toast y deja el código del error en la consola.
 * @returns {{ datos: object[], error: string|null }}
 */
export async function leerColeccion(nombre, toast) {
  try {
    return { datos: docsDe(await getDocs(collection(db, nombre))), error: null };
  } catch (e) {
    console.error(`[${nombre}] no se pudo leer:`, e.code, e);
    toast?.error(`No se pudo leer "${nombre}" (${e.code ?? e.message}).`, 8000);
    return { datos: [], error: e.code ?? e.message };
  }
}

/** Ejecuta las operaciones en lotes de 500; si un lote falla, dice cuántas ya se guardaron */
export async function ejecutarEnLotes(ops) {
  let guardadas = 0;
  try {
    for (let i = 0; i < ops.length; i += 500) {
      const batch = writeBatch(db);
      ops.slice(i, i + 500).forEach(op => op(batch));
      await batch.commit();
      guardadas = Math.min(i + 500, ops.length);
    }
  } catch (err) {
    console.error('Error al guardar en lotes:', err.code, err);
    err.message = guardadas
      ? `Se guardaron ${guardadas} de ${ops.length} cambios antes del error (${err.code ?? err.message}). Vuelva a intentarlo para completar.`
      : `${err.code ?? ''} ${err.message}`.trim();
    throw err;
  }
  return guardadas;
}

/** Operación que agrega un renglón a la bitácora (la fecha la pone el servidor) */
export const opBitacora = (registro, usuario) => (batch) =>
  batch.set(doc(collection(db, 'bitacora')), { ...registroBitacora(registro, usuario), fecha: serverTimestamp() });

/** Operaciones para guardar lo que RH decidió al resolver puestos: puestos nuevos y alias confirmados */
export function opsDeResolucion(resolucion, usuario, origen) {
  const ops = [];
  for (const p of resolucion.puestosNuevos) {
    ops.push(b => b.set(doc(db, 'puestos', p.id), {
      nombre: p.nombre, areaId: p.areaId, activo: true, alias: [],
      creadoPor: usuario?.uid ?? '', fechaCreacion: serverTimestamp(),
    }));
    ops.push(opBitacora({ accion: 'puesto_creado', entidad: `puestos/${p.id}`, despues: { nombre: p.nombre, areaId: p.areaId, origen } }, usuario));
  }
  const porPuesto = new Map();
  for (const a of resolucion.aliasNuevos) porPuesto.set(a.puestoId, [...(porPuesto.get(a.puestoId) ?? []), a.alias]);
  for (const [puestoId, alias] of porPuesto) {
    ops.push(b => b.update(doc(db, 'puestos', puestoId), { alias: arrayUnion(...alias) }));
    ops.push(opBitacora({ accion: 'alias_agregado', entidad: `puestos/${puestoId}`, despues: { alias, origen } }, usuario));
  }
  return ops;
}

/** Operaciones de "Crear estructura inicial" (sin sobrescribir nada que ya exista) */
export function opsEstructuraInicial(propuesta, { equivalencias, usuario }) {
  const ops = [];
  for (const a of propuesta.areasNuevas) {
    if (a.accion === 'crear') {
      ops.push(b => b.set(doc(db, 'areas', a.id), { nombre: a.nombre, participaTE: a.participaTE, activa: true, orden: a.orden }));
    } else if (a.accion === 'completar') {
      // Solo los campos que faltan: nombre y lo demás que ya tenga se respetan
      const faltan = Object.fromEntries(a.faltan.map(k => [k, k === 'activa' ? true : a[k]]));
      ops.push(b => b.set(doc(db, 'areas', a.id), faltan, { merge: true }));
    }
  }
  for (const p of propuesta.puestosNuevos.filter(x => x.accion === 'crear')) {
    ops.push(b => b.set(doc(db, 'puestos', p.id), {
      nombre: p.nombre, areaId: p.areaId, activo: true, alias: [],
      creadoPor: usuario?.uid ?? '', fechaCreacion: serverTimestamp(),
    }));
  }
  ops.push(opBitacora({
    accion: 'estructura_inicial', entidad: 'areas/puestos',
    despues: {
      areasCreadas: propuesta.areasNuevas.filter(a => a.accion === 'crear').map(a => a.id),
      areasCompletadas: propuesta.areasNuevas.filter(a => a.accion === 'completar').map(a => a.id),
      puestosCreados: propuesta.puestosNuevos.filter(p => p.accion === 'crear').length,
    },
  }, usuario));
  if (equivalencias) {
    for (const u of equivalencias) {
      ops.push(b => b.update(doc(db, 'usuarios', u.uid), { areaIds: u.despues }));
      ops.push(opBitacora({ accion: 'usuario_areas_equivalencia', entidad: `usuarios/${u.uid}`, antes: { areaIds: u.antes }, despues: { areaIds: u.despues } }, usuario));
    }
  }
  return ops;
}

/** Operaciones para mover un puesto de área: el puesto, los empleados indicados y la bitácora (primero, en el primer lote) */
export function opsCambioAreaPuesto(puesto, areaIdNueva, empleadosAMover, sinMover, usuario) {
  return [
    b => b.update(doc(db, 'puestos', puesto.id), { areaId: areaIdNueva }),
    opBitacora({
      accion: 'puesto_cambio_area', entidad: `puestos/${puesto.id}`,
      antes: { areaId: puesto.areaId }, despues: { areaId: areaIdNueva, empleadosMovidos: empleadosAMover.length, conExcepcion: sinMover },
    }, usuario),
    ...empleadosAMover.map(e => (b) => b.update(doc(db, 'empleados', String(e.id)), { areaId: areaIdNueva })),
  ];
}

export { AREA_ADMIN };
