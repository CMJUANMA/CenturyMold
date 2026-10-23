// Reglas del rol Nóminas (usuarios/{uid}.rol == 'nomina'): lee toda la planta y solo ESCRIBE en el paso «Por enviar al proveedor» y en la bitácora
// (sus descargas); no crea, autoriza, devuelve, edita ni cancela tiempo extra, ni administra nada. Quién da el rol. Contra el emulador (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
const ts = serverTimestamp;
const ahora = () => Timestamp.now();
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const VISIBLES = ['pendiente_aut1', 'pendiente_aut2', 'autorizada', 'devuelta', 'procesada', 'cancelada'];

const N = { admin: '90000', rh: '90001', nom: '70001', nomSol: '70002', solP: '50532', aut1P: '50610', aut2: '11', ajeno: '50999', inactiva: '70003' };
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayer(), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: ahora(),
});
const idAsig = (nomina, rol, areaId) => `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`;
const firmaSemilla = (nomina) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ahora(), comentario: '' });
const teSemilla = (id, estatus, extra = {}) => ({
  folio: `TE-2026-${id}`, areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: 'solP',
  fechaTE: '2099-11-02', motivo: 'Producción', estatus,
  resumen: { totalEmpleados: 2, totalHoras: 17, totalTransporte: 1, totalAlimentos: 1 },
  aut1: firmaSemilla(N.aut1P), aut2: firmaSemilla(N.aut2), fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra,
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const usuarios = [['admin', 'admin', N.admin], ['rh', 'rh', N.rh], ['nom', 'nomina', N.nom], ['nomSol', 'nomina', N.nomSol], ['solP', 'usuario', N.solP],
      ['aut1P', 'usuario', N.aut1P], ['aut2', 'usuario', N.aut2], ['ajeno', 'usuario', N.ajeno]];
    for (const [uid, rol, nomina] of usuarios) await setDoc(doc(db, 'usuarios', uid), { nombre: uid, email: `${nomina}@rutas.app`, rol, nomina, activo: true });
    await setDoc(doc(db, 'usuarios', 'inactiva'), { nombre: 'inactiva', email: `${N.inactiva}@rutas.app`, rol: 'nomina', nomina: N.inactiva, activo: false });
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'puestos', 'operador'), { nombre: 'OPERADOR', areaId: 'produccion', activo: true, alias: [] });
    await setDoc(doc(db, 'turnosNomina', 'A'), { turno: 'A', entrada: '7:00', salida: '16:00', actualizadoPor: { uid: 'rh' }, fechaActualizacion: ahora() });
    await setDoc(doc(db, 'rutas', 'r1'), { nombre: 'Ruta 1', activa: true });
    for (const [nomina, rol, area] of [[N.solP, 'solicitante', 'produccion'], [N.aut1P, 'aut1', 'produccion'], [N.aut2, 'aut2', null], [N.nomSol, 'solicitante', 'produccion']]) {
      await setDoc(doc(db, 'asignaciones', idAsig(nomina, rol, area)), asig(nomina, rol, area));
    }
    await setDoc(doc(db, 'empleados', '600'), { nomina: '600', nombre: 'Operador 600', puestoId: 'operador', areaId: 'produccion', activo: true });
    await setDoc(doc(db, 'empleadosContacto', '600'), { telefono: '4421234567' });
    // 0001: autorizada con transporte · 0002: autorizada sin transporte · 0003: procesada (transporte pendiente de envío) · 0004: en nivel 2 · 0006: borrador
    await setDoc(doc(db, 'tiempoExtra', 'te1'), teSemilla('0001', 'autorizada'));
    await setDoc(doc(db, 'tiempoExtra', 'te2'), teSemilla('0002', 'autorizada', { resumen: { totalEmpleados: 1, totalHoras: 9, totalTransporte: 0, totalAlimentos: 0 } }));
    await setDoc(doc(db, 'tiempoExtra', 'te3'), teSemilla('0003', 'procesada', { solicitudTransporteId: 'sol3', recibidaPor: firmaSemilla(N.rh), fechaRecepcion: ahora() }));
    await setDoc(doc(db, 'tiempoExtra', 'te4'), teSemilla('0004', 'pendiente_aut2', { aut2: null }));
    await setDoc(doc(db, 'tiempoExtra', 'te6'), teSemilla('0006', 'borrador', { folio: null, aut1: null, aut2: null }));
    await setDoc(doc(db, 'tiempoExtra', 'te1', 'empleados', '600'), { nombre: 'Operador 600', puesto: 'OPERADOR', horaEntrada: '7:00', horaSalida: '16:00', horas: 9, requiereTransporte: true });
    await setDoc(doc(db, 'tiempoExtra', 'te1', 'historial', 'h1'), { accion: 'enviada', nivel: 0, porUid: 'solP', porNomina: N.solP, porNombre: 'solP', comentario: '', fecha: ahora() });
    await setDoc(doc(db, 'tiempoExtra', 'te6', 'empleados', '600'), { nombre: 'Operador 600', puesto: 'OPERADOR', horas: 9 });
    await setDoc(doc(db, 'solicitudes', 'sol3'), {
      fechaSolicitud: ahora(), fechaServicio: '2099-11-02', solicitanteNombre: 'solP', solicitanteNomina: N.solP, creadoPor: 'rh', areaId: 'produccion', estatus: 'aprobada',
      origen: 'tiempo_extra', tiempoExtraId: 'te3', folioTE: 'TE-2026-0003', totalPasajeros: 1, historial: [],
    });
    await setDoc(doc(db, 'solicitudes', 'sol3', 'pasajeros', '600'), { nomina: '600', nombre: 'Operador 600', creadoPor: 'rh' });
    await setDoc(doc(db, 'solicitudes', 'normal1'), { fechaSolicitud: ahora(), fechaServicio: '2099-11-02', solicitanteNombre: 'ajeno', creadoPor: 'ajeno', estatus: 'pendiente', historial: [] });
    await setDoc(doc(db, 'bitacora', 'b1'), { accion: 'asignar', entidad: 'asignacion', antes: null, despues: { id: 'x' }, porUid: 'admin', porNombre: 'admin', fecha: ahora() });
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();

/** Lo que escribe «Por enviar al proveedor» en UNA operación: solicitud de transporte, pasajeros, TE procesada, historial y bitácora */
function recibir(uid, teId, { conTransporte = true, solId = 'solNueva', editarSol = {}, editarTE = {}, sinTE = false, sinHistorial = false, bitacora = true } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const folio = `TE-2026-000${teId.slice(2)}`;
  if (conTransporte) {
    b.set(doc(db, 'solicitudes', solId), {
      fechaSolicitud: ts(), fechaServicio: '2099-11-02', solicitanteNombre: 'solP', solicitanteNomina: N.solP, creadoPor: uid, creadoPorNombre: uid,
      areaId: 'produccion', estatus: 'aprobada', origen: 'tiempo_extra', tiempoExtraId: teId, folioTE: folio,
      totalPasajeros: 1, totalAlimentos: 1, conteoTurnos: { 1: 1 }, conteoPuestos: { OPERADOR: 1 },
      revisadoPor: uid, revisadoPorNombre: uid, fechaRevision: ts(), historial: [{ fecha: new Date().toISOString(), usuario: uid, accion: 'creada', comentario: '' }],
      ...editarSol,
    });
    b.set(doc(db, 'solicitudes', solId, 'pasajeros', '600'), { nomina: '600', nombre: 'Operador 600', puesto: 'OPERADOR', areaId: 'produccion', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: true, rutaId: 'r1', creadoPor: uid });
  }
  if (!sinTE) {
    b.update(doc(db, 'tiempoExtra', teId), {
      estatus: 'procesada', recibidaPor: { nomina: N[uid], nombre: uid, fecha: ts() }, fechaRecepcion: ts(),
      ...(conTransporte ? { solicitudTransporteId: solId } : {}), fechaActualizacion: ts(), ...editarTE,
    });
  }
  if (!sinHistorial) b.set(doc(collection(db, 'tiempoExtra', teId, 'historial')), { accion: 'recibida_rh', nivel: 0, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: '', fecha: ts() });
  if (bitacora) b.set(doc(collection(db, 'bitacora')), { accion: 'recibir', entidad: 'tiempoExtra', antes: { estatus: 'autorizada' }, despues: { estatus: 'procesada' }, porUid: uid, porNombre: uid, fecha: ts() });
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-nomina', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('Nóminas LEE toda la planta', () => {
  it('todo el tiempo extra salvo borradores: uno por uno y en lista, con empleados e historial', async () => {
    const db = dbDe('nom');
    for (const id of ['te1', 'te2', 'te3', 'te4']) await assertSucceeds(getDoc(doc(db, 'tiempoExtra', id)));
    await assertSucceeds(getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', VISIBLES))));
    await assertSucceeds(getDocs(query(collection(db, 'tiempoExtra'), where('estatus', '==', 'autorizada'))));
    await assertSucceeds(getDocs(collection(db, 'tiempoExtra', 'te1', 'empleados')));
    await assertSucceeds(getDocs(collection(db, 'tiempoExtra', 'te1', 'historial')));
  });
  it('NO ve los borradores (ni sus empleados), ni en lista', async () => {
    const db = dbDe('nom');
    await assertFails(getDoc(doc(db, 'tiempoExtra', 'te6')));
    await assertFails(getDocs(collection(db, 'tiempoExtra', 'te6', 'empleados')));
    await assertFails(getDocs(collection(db, 'tiempoExtra')));
    await assertFails(getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', [...VISIBLES, 'borrador']))));
  });
  it('solicitudes de transporte con sus pasajeros, padrón, teléfono (uno y en lista), áreas, puestos, turnos y rutas', async () => {
    const db = dbDe('nom');
    await assertSucceeds(getDocs(collection(db, 'solicitudes')));
    await assertSucceeds(getDocs(collection(db, 'solicitudes', 'sol3', 'pasajeros')));
    await assertSucceeds(getDocs(collection(db, 'empleados')));
    await assertSucceeds(getDoc(doc(db, 'empleadosContacto', '600')));
    await assertSucceeds(getDocs(collection(db, 'empleadosContacto')));
    for (const col of ['areas', 'puestos', 'turnosNomina', 'rutas']) await assertSucceeds(getDocs(collection(db, col)));
  });
  it('NO lee la bitácora, ni los usuarios de los demás, ni las asignaciones de los demás', async () => {
    const db = dbDe('nom');
    await assertFails(getDocs(collection(db, 'bitacora')));
    await assertFails(getDoc(doc(db, 'bitacora', 'b1')));
    await assertFails(getDocs(collection(db, 'usuarios')));
    await assertFails(getDoc(doc(db, 'usuarios', 'rh')));
    await assertFails(getDocs(collection(db, 'asignaciones')));
    await assertSucceeds(getDoc(doc(db, 'usuarios', 'nom')));
  });
  it('una cuenta de Nóminas desactivada no lee nada', async () => {
    const db = dbDe('inactiva');
    await assertFails(getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', VISIBLES))));
    await assertFails(getDocs(collection(db, 'empleados')));
    await assertFails(getDocs(collection(db, 'empleadosContacto')));
  });
  it('un usuario común no gana nada por existir el rol', async () => {
    const db = dbDe('ajeno');
    await assertFails(getDocs(collection(db, 'empleadosContacto')));
    await assertFails(getDocs(collection(db, 'empleados')));
    await assertFails(getDoc(doc(db, 'tiempoExtra', 'te1')));
  });
});

describe('Nóminas SÍ puede: el paso «Por enviar al proveedor»', () => {
  it('confirma un tiempo extra con transporte: solicitud de transporte, pasajeros, procesada, historial y bitácora, en la misma operación', async () => {
    await assertSucceeds(recibir('nom', 'te1'));
  });
  it('confirma uno sin transporte', async () => {
    await assertSucceeds(recibir('nom', 'te2', { conTransporte: false }));
  });
  it('sigue pudiendo si además tiene una asignación (solicitante)', async () => {
    await assertSucceeds(recibir('nomSol', 'te1'));
  });
  it('escribe en la bitácora sus descargas, con su nombre', async () => {
    const db = dbDe('nom');
    await assertSucceeds(setDoc(doc(db, 'bitacora', 'd1'), { accion: 'descargar_resumen_te', entidad: 'descarga', antes: null, despues: { solicitudes: 3 }, porUid: 'nom', porNombre: 'nom', fecha: ts() }));
  });
});

describe('Nóminas NO puede escribir nada más en el tiempo extra', () => {
  it('no crea tiempo extra (sin asignación de solicitante)', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'BR-abcdefghij1'), {
      areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'nom', creadoPorNomina: N.nom, creadoPorNombre: 'nom', fechaTE: '2099-11-05', motivo: 'Producción',
      estatus: 'borrador', resumen: { totalEmpleados: 0, totalHoras: 0, totalTransporte: 0, totalAlimentos: 0 }, tipo: 'turno_extra', fechaCreacion: ts(), fechaActualizacion: ts(),
    }));
  });
  it('no autoriza, no devuelve (ni en nivel 2 ni en nivel 3), no cancela y no edita', async () => {
    const db = dbDe('nom');
    const firma = { nomina: N.nom, nombre: 'nom', fecha: ts(), comentario: '', comoRH: true };
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te4'), { estatus: 'autorizada', aut2: firma, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te4'), { estatus: 'devuelta', devolucion: { nivel: 2, nomina: N.nom, nombre: 'nom', motivo: 'No cuadra el horario', fecha: ts() }, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te1'), { estatus: 'devuelta', devolucion: { nivel: 3, nomina: N.nom, nombre: 'nom', motivo: 'No cuadra el horario', fecha: ts() }, fechaActualizacion: ts() }));
    for (const id of ['te1', 'te3', 'te4']) {
      await assertFails(updateDoc(doc(db, 'tiempoExtra', id), {
        estatus: 'cancelada', motivoCancelacion: 'Ya no se necesita', canceladaPor: { nomina: N.nom, nombre: 'nom', fecha: ts(), comoRH: true }, fechaActualizacion: ts(),
      }));
    }
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te1'), { motivo: 'Otro', fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te1'), { resumen: { totalEmpleados: 99, totalHoras: 999, totalTransporte: 0, totalAlimentos: 0 }, fechaActualizacion: ts() }));
  });
  it('no borra, ni toca empleados o historial de un tiempo extra', async () => {
    const db = dbDe('nom');
    await assertFails(deleteDoc(doc(db, 'tiempoExtra', 'te1')));
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'te1', 'empleados', '601'), { nombre: 'X', puesto: 'Y', horas: 1 }));
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te1', 'empleados', '600'), { horas: 1 }));
    await assertFails(deleteDoc(doc(db, 'tiempoExtra', 'te1', 'empleados', '600')));
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'te1', 'historial', 'h2'), { accion: 'autorizada_2', nivel: 2, porUid: 'nom', porNomina: N.nom, porNombre: 'nom', comentario: '', fecha: ts() }));
    await assertFails(deleteDoc(doc(db, 'tiempoExtra', 'te1', 'historial', 'h1')));
  });
  it('confirmar solo funciona sobre lo autorizado: uno en nivel 2 o ya confirmado no', async () => {
    await assertFails(recibir('nom', 'te4', { conTransporte: false }));
    await assertFails(recibir('nom', 'te3', { solId: 'otra' }));
  });
  it('al confirmar solo toca la lista exacta de campos (nada de motivo, resumen, folio, firmas ni estatus raros)', async () => {
    await assertFails(recibir('nom', 'te1', { editarTE: { motivo: 'Otro' } }));
    await assertFails(recibir('nom', 'te1', { editarTE: { resumen: { totalEmpleados: 1, totalHoras: 1, totalTransporte: 1, totalAlimentos: 0 } } }));
    await assertFails(recibir('nom', 'te1', { editarTE: { folio: 'TE-2026-9999' } }));
    await assertFails(recibir('nom', 'te1', { editarTE: { aut2: { nomina: N.nom, nombre: 'nom', fecha: ts() } } }));
    await assertFails(recibir('nom', 'te1', { editarTE: { areaId: 'calidad' } }));
    await assertFails(recibir('nom', 'te1', { editarTE: { estatus: 'autorizada' } }));
  });
  it('firma con su propio nombre y nómina: no a nombre de otra persona', async () => {
    await assertFails(recibir('nom', 'te1', { editarTE: { recibidaPor: { nomina: N.rh, nombre: 'rh', fecha: ts() } } }));
    await assertFails(recibir('nom', 'te1', { editarTE: { recibidaPor: { nomina: N.nom, nombre: 'ESPINOSA MARCO', fecha: ts() } } }));
  });
  it('sin la solicitud de transporte en la misma operación, o sin pasar el tiempo extra a procesada, no se confirma', async () => {
    await assertFails(recibir('nom', 'te1', { conTransporte: false }));
    await assertFails(recibir('nom', 'te1', { sinTE: true }));
  });
  it('la solicitud de transporte debe corresponder a ese tiempo extra', async () => {
    await assertFails(recibir('nom', 'te1', { editarSol: { tiempoExtraId: 'te2' } }));
    await assertFails(recibir('nom', 'te1', { editarSol: { areaId: 'calidad' } }));
    await assertFails(recibir('nom', 'te1', { editarSol: { fechaServicio: '2026-12-25' } }));
    await assertFails(recibir('nom', 'te1', { editarSol: { creadoPor: 'rh' } }));
  });
});

describe('Nóminas NO crea ni cambia solicitudes de transporte sueltas', () => {
  const sueltaBase = (uid) => ({
    fechaSolicitud: ts(), fechaServicio: '2026-11-03', solicitanteNombre: 'x', creadoPor: uid, estatus: 'pendiente', historial: [],
  });
  it('no crea una solicitud de transporte suelta ni una aprobada', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'solicitudes', 'suelta'), sueltaBase('nom')));
    await assertFails(setDoc(doc(db, 'solicitudes', 'suelta2'), { ...sueltaBase('nom'), estatus: 'aprobada' }));
  });
  it('no cambia ni borra las existentes ni sus pasajeros', async () => {
    const db = dbDe('nom');
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol3'), { estatus: 'enviada al proveedor' }));
    await assertFails(updateDoc(doc(db, 'solicitudes', 'normal1'), { estatus: 'aprobada' }));
    await assertFails(deleteDoc(doc(db, 'solicitudes', 'sol3')));
    await assertFails(setDoc(doc(db, 'solicitudes', 'sol3', 'pasajeros', '601'), { nomina: '601', nombre: 'X', creadoPor: 'nom' }));
    await assertFails(updateDoc(doc(db, 'solicitudes', 'sol3', 'pasajeros', '600'), { nombre: 'Otro' }));
    await assertFails(deleteDoc(doc(db, 'solicitudes', 'sol3', 'pasajeros', '600')));
  });
});

describe('Nóminas NO administra nada', () => {
  it('no escribe en catálogos ni estructura: áreas, puestos, turnos, rutas, puntos, comunidades', async () => {
    const db = dbDe('nom');
    await assertFails(updateDoc(doc(db, 'areas', 'produccion'), { nombre: 'Otra' }));
    await assertFails(setDoc(doc(db, 'areas', 'nueva'), { nombre: 'Nueva', participaTE: true, activa: true, orden: 9 }));
    await assertFails(updateDoc(doc(db, 'puestos', 'operador'), { nombre: 'OTRO' }));
    await assertFails(setDoc(doc(db, 'turnosNomina', 'B'), { turno: 'B', entrada: '7:00', salida: '16:00', actualizadoPor: { uid: 'nom' }, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(db, 'rutas', 'r1'), { nombre: 'Otra' }));
    await assertFails(setDoc(doc(db, 'puntosReunion', 'p9'), { nombre: 'P' }));
    await assertFails(setDoc(doc(db, 'comunidades', 'c9'), { nombre: 'C' }));
    await assertFails(deleteDoc(doc(db, 'rutas', 'r1')));
  });
  it('no cambia el padrón ni los teléfonos', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'empleados', '601'), { nomina: '601', nombre: 'Nuevo', areaId: 'produccion', activo: true }));
    await assertFails(updateDoc(doc(db, 'empleados', '600'), { nombre: 'Otro' }));
    await assertFails(updateDoc(doc(db, 'empleados', '600'), { rutaId: 'r1' }));
    await assertFails(deleteDoc(doc(db, 'empleados', '600')));
    await assertFails(setDoc(doc(db, 'empleadosContacto', '600'), { telefono: '4420000000' }));
    await assertFails(deleteDoc(doc(db, 'empleadosContacto', '600')));
  });
  it('no administra usuarios, roles, contraseñas ni asignaciones', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo'), { nombre: 'Nuevo', email: 'n@rutas.app', rol: 'usuario', nomina: '70099', activo: true }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { rol: 'rh' }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { activo: false }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'nom'), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'nom'), { rol: 'rh' }));
    await assertFails(deleteDoc(doc(db, 'usuarios', 'ajeno')));
    await assertFails(setDoc(doc(db, 'accesos', '70099'), { version: 2, uid: 'x' }));
    await assertFails(setDoc(doc(db, 'asignaciones', idAsig('50999', 'solicitante', 'produccion')), asig('50999', 'solicitante', 'produccion')));
    await assertFails(updateDoc(doc(db, 'asignaciones', idAsig(N.solP, 'solicitante', 'produccion')), { activo: false }));
  });
  it('no escribe en la bitácora lo que no es suyo (asignaciones, usuarios, cambios) ni la edita o borra', async () => {
    const db = dbDe('nom');
    const fila = (extra) => ({ accion: 'a', entidad: 'asignacion', antes: null, despues: null, porUid: 'nom', porNombre: 'nom', fecha: ts(), ...extra });
    await assertFails(setDoc(doc(db, 'bitacora', 'x1'), fila({})));
    await assertFails(setDoc(doc(db, 'bitacora', 'x2'), fila({ entidad: 'usuarios/ajeno', accion: 'dar_rol_rh' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'x3'), fila({ entidad: 'tiempoExtra', accion: 'cancelar_autorizada' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'x4'), fila({ entidad: 'descarga', porUid: 'rh' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'x5'), fila({ entidad: 'descarga', porNombre: 'ESPINOSA MARCO' })));
    await assertFails(updateDoc(doc(db, 'bitacora', 'b1'), { accion: 'borrado' }));
    await assertFails(deleteDoc(doc(db, 'bitacora', 'b1')));
  });
  it('no toca los contadores de folio', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'contadores', 'te-2026'), { ultimo: 1, solicitudId: 'te6' }));
  });
});

describe('Nóminas con una asignación conserva esos permisos (y solo esos)', () => {
  it('como solicitante de su área puede crear un borrador, pero eso no le da autorizar', async () => {
    const db = dbDe('nomSol');
    await assertSucceeds(setDoc(doc(db, 'tiempoExtra', 'BR-abcdefghij2'), {
      areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'nomSol', creadoPorNomina: N.nomSol, creadoPorNombre: 'nomSol', fechaTE: '2099-11-05', motivo: 'Producción',
      estatus: 'borrador', resumen: { totalEmpleados: 0, totalHoras: 0, totalTransporte: 0, totalAlimentos: 0 }, tipo: 'turno_extra', fechaCreacion: ts(), fechaActualizacion: ts(),
    }));
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te4'), { estatus: 'autorizada', aut2: { nomina: N.nomSol, nombre: 'nomSol', fecha: ts(), comentario: '', comoRH: true }, fechaActualizacion: ts() }));
  });
});

describe('Quién da (y quita) el rol Nóminas', () => {
  it('RH, Aut. 2 y admin se lo dan a un usuario y se lo quitan', async () => {
    for (const quien of ['rh', 'aut2', 'admin']) {
      await env.clearFirestore(); await sembrar();
      const db = dbDe(quien);
      await assertSucceeds(updateDoc(doc(db, 'usuarios', 'ajeno'), { rol: 'nomina' }));
      await assertSucceeds(updateDoc(doc(db, 'usuarios', 'ajeno'), { rol: 'usuario' }));
    }
  });
  it('nadie se lo da a sí mismo (ni el admin, ni RH, ni la Aut. 2)', async () => {
    for (const quien of ['rh', 'aut2', 'admin']) await assertFails(updateDoc(doc(dbDe(quien), 'usuarios', quien), { rol: 'nomina' }));
  });
  it('un usuario común, un solicitante, un Aut. 1 o la propia cuenta de Nóminas no se lo dan a nadie', async () => {
    for (const quien of ['solP', 'aut1P', 'nom']) await assertFails(updateDoc(doc(dbDe(quien), 'usuarios', 'ajeno'), { rol: 'nomina' }));
  });
  it('a quien ya es Nóminas solo se le cambia el rol (ni nombre ni estado), y nadie le da admin sin ser admin', async () => {
    const db = dbDe('rh');
    await assertFails(updateDoc(doc(db, 'usuarios', 'nom'), { nombre: 'Otro nombre' }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'nom'), { activo: false }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { rol: 'admin' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', 'nom'), { rol: 'usuario' }));
  });
  it('queda registrado en la bitácora con quien lo hizo (RH y Aut. 2)', async () => {
    const fila = (uid) => ({ accion: 'dar_rol_nomina', entidad: 'usuarios/ajeno', antes: { rol: 'usuario' }, despues: { rol: 'nomina' }, porUid: uid, porNombre: uid, fecha: ts() });
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'bitacora', 'n1'), fila('rh')));
    await assertSucceeds(setDoc(doc(dbDe('aut2'), 'bitacora', 'n2'), fila('aut2')));
  });
});
