/**
 * migracionDb.js — Lecturas y escrituras de la migración al modelo de asignaciones (RH > Herramientas, solo admin).
 * El cálculo está en migracionAsignaciones.js. Orden: respaldo JSON → simular → ejecutar (escribir MIGRAR)
 * → verificar → limpiar estructura vieja (aparte, con confirmación).
 */
import { Timestamp, collection, deleteField, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ejecutarEnLotes, opBitacora } from './estructuraDb';
import { aFecha, resumenParaBitacora } from './asignaciones';
import { planearMigracion, MOTIVO_MIGRACION } from './migracionAsignaciones';

const docs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
/** Colección que puede no existir o no estar permitida: devuelve [] en vez de fallar */
const leerOpcional = (nombre) => getDocs(collection(db, nombre)).then(docs).catch(() => []);

/** Todo lo que el plan necesita, más lo que se respalda */
export async function leerDatosMigracion() {
  const [usuarios, areasTE, cfgTE, cfgAreas, accesosTE, empleados, areas, asignaciones] = await Promise.all([
    getDocs(collection(db, 'usuarios')).then(docs),
    getDocs(collection(db, 'areasTE')).then(docs),
    getDoc(doc(db, 'config', 'tiempoExtra')).then(s => (s.exists() ? s.data() : null)),
    getDoc(doc(db, 'config', 'areasTE')).then(s => (s.exists() ? s.data() : null)),
    leerOpcional('accesosTE'),
    getDocs(collection(db, 'empleados')).then(s => s.docs.map(d => ({ nomina: d.id, ...d.data() }))),
    getDocs(collection(db, 'areas')).then(docs),
    getDocs(collection(db, 'asignaciones')).then(docs),
  ]);
  return { usuarios, areasTE, cfgTE, cfgAreas, accesosTE, empleados, areas, asignaciones };
}

export const planDeDatos = (datos, ahora = new Date()) => planearMigracion({
  usuarios: datos.usuarios, areasTE: datos.areasTE, configTE: datos.cfgTE, accesosTE: datos.accesosTE,
  empleados: datos.empleados, areas: datos.areas, asignaciones: datos.asignaciones, ahora,
});

/** Respaldo JSON de lo que la migración y la limpieza tocan (las fechas salen en ISO) */
export function respaldoMigracionJson(datos) {
  const respaldo = {
    generado: new Date().toISOString(),
    usuarios: datos.usuarios, areasTE: datos.areasTE, 'config/tiempoExtra': datos.cfgTE,
    'config/areasTE': datos.cfgAreas, accesosTE: datos.accesosTE,
    // Solo lo que la limpieza borra del padrón
    empleadosConCamposViejos: datos.empleados
      .filter(e => e.areaTE !== undefined || e.areaTEManual !== undefined)
      .map(e => ({ nomina: e.nomina, areaTE: e.areaTE ?? null, areaTEManual: e.areaTEManual ?? null })),
  };
  return JSON.stringify(respaldo, (_, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v), 2);
}

const dosDigitos = (n) => String(n).padStart(2, '0');
export const nombreRespaldoMigracion = (prefijo, fecha = new Date()) =>
  `${prefijo}_${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}_${dosDigitos(fecha.getHours())}${dosDigitos(fecha.getMinutes())}.json`;

export function descargarJson(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const inicioDeHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** Escribe el plan: asignaciones, roles de usuarios y excepciones, cada una con su renglón de bitácora */
export async function ejecutarMigracion(plan, actor) {
  const quien = { uid: actor.uid, nombre: actor.nombre ?? '' };
  const hoy = inicioDeHoy();
  const ops = [];

  for (const a of plan.asignaciones) {
    const desde = Timestamp.fromDate(aFecha(a.desde) ?? hoy);
    const hasta = a.hasta ? Timestamp.fromDate(aFecha(a.hasta)) : null;
    const datos = {
      nomina: a.nomina, nombre: a.nombre, rol: a.rol, areaId: a.areaId, desde, hasta, motivo: a.motivo || MOTIVO_MIGRACION,
      activo: true, asignadoPor: quien, fechaAsignacion: serverTimestamp(),
    };
    ops.push(b => b.set(doc(db, 'asignaciones', a.id), datos));
    ops.push(b => b.set(doc(collection(db, 'bitacora')), {
      accion: 'migracion_asignacion', entidad: 'asignacion', antes: null,
      despues: { ...resumenParaBitacora({ ...datos, id: a.id }), origen: a.origen },
      porUid: actor.uid, porNombre: actor.nombre ?? '', fecha: serverTimestamp(),
    }));
  }
  for (const u of plan.usuariosCambios) {
    ops.push(b => b.update(doc(db, 'usuarios', u.uid), { rol: u.rolDespues }));
    ops.push(opBitacora({ accion: 'migracion_rol_usuario', entidad: `usuarios/${u.uid}`, antes: { rol: u.rolAntes }, despues: { rol: u.rolDespues, nomina: u.nomina } }, actor));
  }
  for (const e of plan.excepciones) {
    ops.push(b => b.update(doc(db, 'empleados', e.nomina), {
      areaExcepcion: e.areaExcepcion, areaId: e.areaExcepcion, areaExcepcionMotivo: 'Migrado de areaTEManual',
    }));
    ops.push(opBitacora({ accion: 'migracion_excepcion_area', entidad: `empleados/${e.nomina}`, antes: { areaId: e.areaAntes }, despues: { areaExcepcion: e.areaExcepcion } }, actor));
  }
  return ejecutarEnLotes(ops);
}

/** Qué borraría la limpieza (para mostrarlo antes) */
export function resumenLimpieza(datos) {
  return {
    areasTE: datos.areasTE.length,
    configAreasTE: datos.cfgAreas ? 1 : 0,
    accesosTE: datos.accesosTE.length,
    empleadosConCamposViejos: datos.empleados.filter(e => e.areaTE !== undefined || e.areaTEManual !== undefined).length,
  };
}

/** Borra la estructura vieja: areasTE, config/areasTE, accesosTE y los campos areaTE/areaTEManual del padrón */
export async function limpiarEstructuraVieja(datos, actor) {
  const ops = [];
  for (const a of datos.areasTE) ops.push(b => b.delete(doc(db, 'areasTE', a.id)));
  if (datos.cfgAreas) ops.push(b => b.delete(doc(db, 'config', 'areasTE')));
  for (const a of datos.accesosTE) ops.push(b => b.delete(doc(db, 'accesosTE', a.id)));
  for (const e of datos.empleados) {
    if (e.areaTE === undefined && e.areaTEManual === undefined) continue;
    ops.push(b => b.update(doc(db, 'empleados', e.nomina), { areaTE: deleteField(), areaTEManual: deleteField() }));
  }
  ops.push(opBitacora({ accion: 'limpiar_estructura_vieja', entidad: 'migracion', despues: resumenLimpieza(datos) }, actor));
  return ejecutarEnLotes(ops);
}
