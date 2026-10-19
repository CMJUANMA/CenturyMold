// Reglas de la recepción de RH: recibir un tiempo extra autorizado (con su solicitud de transporte en la misma operación),
// devolver y cancelar lo autorizado o recibido. Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
const ts = serverTimestamp;
const ahora = () => Timestamp.now();
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));

const N = { admin: '90000', rh: '90001', solP: '50532', aut1P: '50610', aut2: '11', ajeno: '50999' };
const perfil = (rol, nomina) => ({ nombre: `Usuario ${nomina}`, email: `${nomina}@rutas.app`, rol, nomina, activo: true });
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayer(), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: ahora(),
});
const idAsig = (nomina, rol, areaId) => `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`;
const firmaSemilla = (nomina) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ahora(), comentario: '' });

const teSemilla = (id, estatus, extra = {}) => ({
  folio: `TE-2026-${id}`, areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: 'solP',
  fechaTE: '2026-11-02', motivo: 'Producción', estatus,
  resumen: { totalEmpleados: 2, totalHoras: 17, totalTransporte: 1, totalAlimentos: 1 },
  aut1: firmaSemilla(N.aut1P), aut2: firmaSemilla(N.aut2), fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra,
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['admin', 'admin', N.admin], ['rh', 'rh', N.rh], ['solP', 'usuario', N.solP], ['aut1P', 'usuario', N.aut1P], ['aut2', 'usuario', N.aut2], ['ajeno', 'usuario', N.ajeno]]) {
      await setDoc(doc(db, 'usuarios', uid), { ...perfil(rol, nomina), nombre: uid });
    }
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    for (const [nomina, rol, area] of [[N.solP, 'solicitante', 'produccion'], [N.aut1P, 'aut1', 'produccion'], [N.aut2, 'aut2', null]]) {
      await setDoc(doc(db, 'asignaciones', idAsig(nomina, rol, area)), asig(nomina, rol, area));
    }
    // 0001: autorizada con 1 empleado con transporte · 0002: autorizada sin transporte · 0003: ya procesada con su transporte · 0004: pendiente
    await setDoc(doc(db, 'tiempoExtra', 'te1'), teSemilla('0001', 'autorizada'));
    await setDoc(doc(db, 'tiempoExtra', 'te2'), teSemilla('0002', 'autorizada', { resumen: { totalEmpleados: 1, totalHoras: 9, totalTransporte: 0, totalAlimentos: 0 } }));
    await setDoc(doc(db, 'tiempoExtra', 'te3'), teSemilla('0003', 'procesada', { solicitudTransporteId: 'sol3', recibidaPor: firmaSemilla(N.rh), fechaRecepcion: ahora() }));
    await setDoc(doc(db, 'tiempoExtra', 'te4'), teSemilla('0004', 'pendiente_aut2', { aut2: null }));
    await setDoc(doc(db, 'tiempoExtra', 'te5'), teSemilla('0005', 'procesada', { solicitudTransporteId: 'sol5', recibidaPor: firmaSemilla(N.rh), fechaRecepcion: ahora() }));
    // Transporte de te3 (pendiente de envío) y de te5 (ya enviada al proveedor)
    const transporte = (te, folio, estatus) => ({
      fechaSolicitud: ahora(), fechaServicio: '2026-11-02', solicitanteNombre: 'solP', solicitanteNomina: N.solP, creadoPor: 'rh', areaId: 'produccion', estatus,
      origen: 'tiempo_extra', tiempoExtraId: te, folioTE: folio, totalPasajeros: 1, historial: [],
    });
    await setDoc(doc(db, 'solicitudes', 'sol3'), transporte('te3', 'TE-2026-0003', 'aprobada'));
    await setDoc(doc(db, 'solicitudes', 'sol5'), transporte('te5', 'TE-2026-0005', 'enviada al proveedor'));
    // Una solicitud de transporte normal de otro usuario
    await setDoc(doc(db, 'solicitudes', 'normal1'), { fechaSolicitud: ahora(), fechaServicio: '2026-11-02', solicitanteNombre: 'ajeno', creadoPor: 'ajeno', estatus: 'pendiente', historial: [] });
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();

/** Lo que escribe la pantalla de Recepción en UNA operación: solicitud de transporte, pasajeros, TE procesada, historial y bitácora */
function recibir(uid, teId, { conTransporte = true, solId = 'solNueva', editarSol = {}, editarTE = {}, sinTE = false, sinSol = false, sinHistorial = false } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const folio = teId === 'te2' ? 'TE-2026-0002' : `TE-2026-000${teId.slice(2)}`;
  if (conTransporte && !sinSol) {
    b.set(doc(db, 'solicitudes', solId), {
      fechaSolicitud: ts(), fechaServicio: '2026-11-02', solicitanteNombre: 'solP', solicitanteNomina: N.solP, creadoPor: uid, creadoPorNombre: uid,
      areaId: 'produccion', estatus: 'aprobada', origen: 'tiempo_extra', tiempoExtraId: teId, folioTE: folio,
      totalPasajeros: 1, totalAlimentos: 1, conteoTurnos: { 1: 1 }, conteoPuestos: { OPERADOR: 1 },
      revisadoPor: uid, revisadoPorNombre: uid, fechaRevision: ts(), historial: [{ fecha: new Date().toISOString(), usuario: uid, accion: 'creada', comentario: '' }],
      ...editarSol,
    });
    b.set(doc(db, 'solicitudes', solId, 'pasajeros', '600'), { nomina: '600', nombre: 'Operador 600', puesto: 'OPERADOR', areaId: 'produccion', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', creadoPor: uid });
  }
  if (!sinTE) {
    b.update(doc(db, 'tiempoExtra', teId), {
      estatus: 'procesada', recibidaPor: { nomina: N[uid], nombre: uid, fecha: ts() }, fechaRecepcion: ts(),
      ...(conTransporte ? { solicitudTransporteId: solId } : {}), fechaActualizacion: ts(), ...editarTE,
    });
  }
  if (!sinHistorial) {
    b.set(doc(collection(db, 'tiempoExtra', teId, 'historial')), { accion: 'recibida_rh', nivel: 0, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: '', fecha: ts() });
  }
  b.set(doc(collection(db, 'bitacora')), { accion: 'recibir', entidad: 'tiempoExtra', antes: { estatus: 'autorizada' }, despues: { estatus: 'procesada' }, porUid: uid, porNombre: uid, fecha: ts() });
  return b.commit();
}

function devolver(uid, teId, { nivel = 3, motivo = 'El horario no coincide con el pedido' } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  b.update(doc(db, 'tiempoExtra', teId), { estatus: 'devuelta', devolucion: { nivel, nomina: N[uid], nombre: uid, motivo, fecha: ts() }, fechaActualizacion: ts() });
  b.set(doc(collection(db, 'tiempoExtra', teId, 'historial')), { accion: 'devuelta', nivel, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: motivo, fecha: ts() });
  return b.commit();
}

function cancelar(uid, teId, { motivo = 'El pedido del cliente se canceló', sol = null, solCambios = null, sinHistorial = false } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  b.update(doc(db, 'tiempoExtra', teId), { estatus: 'cancelada', motivoCancelacion: motivo, canceladaPor: { nomina: N[uid], nombre: uid, fecha: ts(), comoRH: true }, fechaActualizacion: ts() });
  if (sol) b.update(doc(db, 'solicitudes', sol), solCambios ?? { estatus: 'cancelada' });
  if (!sinHistorial) b.set(doc(collection(db, 'tiempoExtra', teId, 'historial')), { accion: 'cancelada', nivel: 0, porUid: uid, porNomina: N[uid], porNombre: uid, comentario: motivo, fecha: ts() });
  return b.commit();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-recepcion', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('recibir con transporte', () => {
  it('RH y admin reciben: la solicitud de transporte nace aprobada y el TE pasa a procesada en la misma operación', async () => {
    await assertSucceeds(recibir('rh', 'te1'));
    await env.clearFirestore(); await sembrar();
    await assertSucceeds(recibir('admin', 'te1'));
  });
  it('un solicitante no puede crear transporte de tiempo extra', async () => {
    await assertFails(recibir('solP', 'te1'));
  });
  it('un Aut. 2 que no es RH, un Aut. 1 y un ajeno tampoco', async () => {
    for (const uid of ['aut2', 'aut1P', 'ajeno']) await assertFails(recibir(uid, 'te1'));
  });
  it('la solicitud de transporte aislada (sin pasar el TE a procesada) falla', async () => {
    await assertFails(recibir('rh', 'te1', { sinTE: true }));
  });
  it('procesar el TE apuntando a un transporte que no se crea en la misma operación falla', async () => {
    await assertFails(recibir('rh', 'te1', { sinSol: true, editarTE: { solicitudTransporteId: 'fantasma' } }));
    await assertFails(recibir('rh', 'te1', { sinSol: true, editarTE: { solicitudTransporteId: 'normal1' } }));
  });
  it('el TE debe seguir autorizado: uno pendiente, devuelto o ya procesado no genera transporte', async () => {
    await assertFails(recibir('rh', 'te4'));
    await assertFails(recibir('rh', 'te3', { solId: 'otraSol' }));
  });
  it('si el TE trae empleados con transporte no se puede recibir sin generar la solicitud', async () => {
    await assertFails(recibir('rh', 'te1', { conTransporte: false }));
  });
  it('la solicitud de transporte debe corresponder al TE: su id, su área, su fecha y su folio', async () => {
    await assertFails(recibir('rh', 'te1', { editarSol: { tiempoExtraId: 'te2' } }));
    await assertFails(recibir('rh', 'te1', { editarSol: { areaId: 'calidad' } }));
    await assertFails(recibir('rh', 'te1', { editarSol: { fechaServicio: '2026-12-25' } }));
    await assertFails(recibir('rh', 'te1', { editarSol: { folioTE: 'TE-2026-9999' } }));
  });
  it('nace aprobada, creada por quien recibe, sin campos de más', async () => {
    await assertFails(recibir('rh', 'te1', { editarSol: { estatus: 'pendiente' } }));
    await assertFails(recibir('rh', 'te1', { editarSol: { estatus: 'enviada al proveedor' } }));
    await assertFails(recibir('rh', 'te1', { editarSol: { creadoPor: 'admin' } }));
    await assertFails(recibir('rh', 'te1', { editarSol: { campoRaro: true } }));
  });
  it('el historial de la recepción debe acompañar la transición (y solo lo escribe RH)', async () => {
    await assertSucceeds(recibir('rh', 'te1'));
    await env.clearFirestore(); await sembrar();
    const db = dbDe('aut2');
    await assertFails(setDoc(doc(collection(db, 'tiempoExtra', 'te1', 'historial')), { accion: 'recibida_rh', nivel: 0, porUid: 'aut2', porNomina: N.aut2, porNombre: 'x', comentario: '', fecha: ts() }));
  });
  it('quien recibe firma con su propia nómina y la fecha del servidor', async () => {
    await assertFails(recibir('rh', 'te1', { editarTE: { recibidaPor: { nomina: N.admin, nombre: 'x', fecha: ts() } } }));
    await assertFails(recibir('rh', 'te1', { editarTE: { fechaRecepcion: Timestamp.fromDate(new Date(2020, 0, 1)) } }));
  });
});

describe('recibir sin transporte', () => {
  it('RH solo marca el TE como procesada, sin solicitud de transporte', async () => {
    await assertSucceeds(recibir('rh', 'te2', { conTransporte: false }));
  });
  it('un solicitante o una Aut. 2 que no es RH no lo procesan', async () => {
    for (const uid of ['solP', 'aut2', 'aut1P']) await assertFails(recibir(uid, 'te2', { conTransporte: false }));
  });
});

describe('devolver desde la recepción', () => {
  it('RH devuelve una autorizada con motivo de 10+ caracteres (nivel 3)', async () => {
    await assertSucceeds(devolver('rh', 'te1'));
    await env.clearFirestore(); await sembrar();
    await assertSucceeds(devolver('admin', 'te2'));
  });
  it('sin motivo, con motivo corto o de otro nivel no pasa', async () => {
    await assertFails(devolver('rh', 'te1', { motivo: '' }));
    await assertFails(devolver('rh', 'te1', { motivo: 'corto' }));
    await assertFails(devolver('rh', 'te1', { nivel: 2 }));
  });
  it('un Aut. 2 que no es RH, el solicitante o un ajeno no devuelven una autorizada', async () => {
    for (const uid of ['aut2', 'solP', 'aut1P', 'ajeno']) await assertFails(devolver(uid, 'te1'));
  });
  it('solo se devuelve desde autorizada', async () => {
    await assertFails(devolver('rh', 'te3'));
    await assertFails(devolver('rh', 'te4'));
  });
});

describe('cancelar lo autorizado o recibido (RH)', () => {
  it('cancela una autorizada con motivo', async () => {
    await assertSucceeds(cancelar('rh', 'te1'));
  });
  it('cancela una recibida junto con su transporte (cancelado)', async () => {
    await assertSucceeds(cancelar('rh', 'te3', { sol: 'sol3', solCambios: { estatus: 'cancelada' } }));
  });
  it('si el transporte ya se envió al proveedor, queda marcado para revisión (y se cancela el TE)', async () => {
    await assertSucceeds(cancelar('rh', 'te5', { sol: 'sol5', solCambios: { requiereRevision: true, motivoRevision: 'TE cancelado' } }));
  });
  it('cancelar una recibida sin tocar su transporte no pasa (nada a medias)', async () => {
    await assertFails(cancelar('rh', 'te3'));
    await assertFails(cancelar('rh', 'te5'));
    await assertFails(cancelar('rh', 'te3', { sol: 'sol3', solCambios: { totalPasajeros: 9 } }));
  });
  it('el motivo es obligatorio (10+ caracteres)', async () => {
    await assertFails(cancelar('rh', 'te1', { motivo: '' }));
    await assertFails(cancelar('rh', 'te1', { motivo: 'no' }));
    await assertFails(cancelar('rh', 'te1', { motivo: 'corto' }));
  });
  it('el solicitante, un Aut. 2 que no es RH, un Aut. 1 y un ajeno no cancelan lo autorizado ni lo recibido', async () => {
    for (const uid of ['solP', 'aut2', 'aut1P', 'ajeno']) {
      await assertFails(cancelar(uid, 'te1'));
      await assertFails(cancelar(uid, 'te3', { sol: 'sol3' }));
    }
  });
  it('no cancela lo que está en autorización', async () => {
    await assertFails(cancelar('rh', 'te4'));
  });
});

describe('nadie más pasa un TE a procesada', () => {
  it('ni siquiera con campos mínimos', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2', 'ajeno']) {
      await assertFails(updateDoc(doc(dbDe(uid), 'tiempoExtra', 'te2'), { estatus: 'procesada', fechaActualizacion: ts() }));
    }
  });
});

describe('lectura de la solicitud de transporte de un tiempo extra', () => {
  it('RH, el solicitante original y el Aut. 1 y la Aut. 2 del TE la leen; un ajeno, no', async () => {
    for (const uid of ['rh', 'admin', 'solP', 'aut1P', 'aut2']) await assertSucceeds(getDoc(doc(dbDe(uid), 'solicitudes', 'sol3')));
    await assertFails(getDoc(doc(dbDe('ajeno'), 'solicitudes', 'sol3')));
  });
  it('una solicitud normal sigue visible solo para su dueño y RH', async () => {
    await assertSucceeds(getDoc(doc(dbDe('ajeno'), 'solicitudes', 'normal1')));
    await assertSucceeds(getDoc(doc(dbDe('rh'), 'solicitudes', 'normal1')));
    await assertFails(getDoc(doc(dbDe('solP'), 'solicitudes', 'normal1')));
  });
  it('las consultas por creador siguen funcionando para quien las hizo', async () => {
    await assertSucceeds(getDocs(query(collection(dbDe('ajeno'), 'solicitudes'), where('creadoPor', '==', 'ajeno'))));
  });
});

describe('transporte normal y de tiempo extra', () => {
  it('RH sigue creando solicitudes normales pendientes; no con origen ni ya aprobadas', async () => {
    const base = { fechaSolicitud: ts(), fechaServicio: '2026-11-03', solicitanteNombre: 'rh', creadoPor: 'rh', estatus: 'pendiente', historial: [] };
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'solicitudes', 'n1'), base));
    await assertFails(setDoc(doc(dbDe('rh'), 'solicitudes', 'n2'), { ...base, estatus: 'aprobada' }));
    await assertFails(setDoc(doc(dbDe('rh'), 'solicitudes', 'n3'), { ...base, origen: 'tiempo_extra', tiempoExtraId: 'te1', folioTE: 'TE-2026-0001' }));
    await assertFails(setDoc(doc(dbDe('solP'), 'solicitudes', 'n4'), { ...base, creadoPor: 'solP' }));
  });
});
