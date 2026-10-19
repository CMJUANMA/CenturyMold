// Auditoría de seguridad: intentos de "romper" firestore.rules como un usuario malicioso (con sesión y sin perfil).
// Cada prueba intenta algo que NO debe pasar (assertFails) y, junto a cada bloque, la versión legítima que SÍ debe pasar (assertSucceeds),
// para que endurecer las reglas no rompa el uso normal. Ejecutar con npm run test:rules.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp as ts, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const sinSesion = () => env.unauthenticatedContext().firestore();

const N = { admin: '1', rh: '2', solP: '50532', aut1P: '50610', aut2: '11', solA: '50901', aut1A: '50988', ajeno: '50999' };
const NOMBRE = (uid) => `Usuario ${N[uid]}`;
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 86400000));
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayer(), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: 'admin', nombre: NOMBRE('admin') }, fechaAsignacion: Timestamp.now(),
});
const idAsig = (nomina, rol, area) => `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : area}`;
const ANIO = new Date().getFullYear();
const BR = 'BR-ABCDEFGH12';
const largo = (n) => 'x'.repeat(n);

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol] of [['admin', 'admin'], ['rh', 'rh'], ['solP', 'usuario'], ['aut1P', 'usuario'], ['aut2', 'usuario'], ['solA', 'usuario'], ['aut1A', 'usuario'], ['ajeno', 'usuario']]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: NOMBRE(uid), rol, nomina: N[uid], activo: true, preferencias: { tema: 'auto' } });
    }
    await setDoc(doc(db, 'usuarios', 'baja'), { nombre: 'Baja', rol: 'usuario', nomina: '777', activo: false });
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'areas', 'almacen'), { nombre: 'Almacén', participaTE: true, activa: true, orden: 2 });
    await setDoc(doc(db, 'areas', 'administrativo'), { nombre: 'Administrativo', participaTE: false, activa: true, orden: 3 });
    for (const [nomina, rol, area] of [[N.solP, 'solicitante', 'produccion'], [N.aut1P, 'aut1', 'produccion'], [N.aut2, 'aut2', null], [N.solA, 'solicitante', 'almacen'], [N.aut1A, 'aut1', 'almacen']]) {
      await setDoc(doc(db, 'asignaciones', idAsig(nomina, rol, area)), asig(nomina, rol, area));
    }
    await setDoc(doc(db, 'empleados', '600'), { nombre: 'OPERADOR 600', nomina: '600', areaId: 'produccion', rutaId: 'r1' });
    await setDoc(doc(db, 'empleados', '801'), { nombre: 'ALMACENISTA 801', nomina: '801', areaId: 'almacen' });
    await setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 12 });
    const te = (id, creadoPor, areaId, estatus, extra = {}) => setDoc(doc(db, 'tiempoExtra', id), {
      folio: `TE-${ANIO}-00${id.length}`, areaId, areaNombre: areaId === 'produccion' ? 'Producción' : 'Almacén', creadoPor, creadoPorNomina: N[creadoPor],
      creadoPorNombre: NOMBRE(creadoPor), fechaTE: '2026-11-02', motivo: 'Producción', comentario: 'Pedido urgente', estatus,
      resumen: { totalEmpleados: 1, totalHoras: 2, totalTransporte: 0, totalAlimentos: 1 }, fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now(), ...extra,
    });
    await te('TE-P1', 'solP', 'produccion', 'pendiente_aut1');
    await te('TE-A1', 'solA', 'almacen', 'pendiente_aut1');
    await te('TE-P2', 'solP', 'produccion', 'pendiente_aut2');
    await te('TE-B1', 'solP', 'produccion', 'borrador');
    await setDoc(doc(db, 'tiempoExtra', 'TE-P1', 'empleados', '600'), { nombre: 'OPERADOR 600', puesto: 'X', horas: 2 });
    await setDoc(doc(db, 'bitacora', 'b1'), { accion: 'asignar', entidad: 'asignacion', antes: null, despues: { id: 'x' }, porUid: 'admin', porNombre: NOMBRE('admin'), fecha: Timestamp.now() });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-auditoria', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

/** Un borrador nuevo válido, con la forma real de la pantalla; `extra` lo estropea a propósito */
const borrador = (uid, extra = {}) => ({
  areaId: 'produccion', areaNombre: 'Producción', creadoPor: uid, creadoPorNomina: N[uid], creadoPorNombre: NOMBRE(uid),
  fechaTE: '2026-11-05', motivo: 'Producción', comentario: 'Pedido urgente del cliente', estatus: 'borrador',
  resumen: { totalEmpleados: 2, totalHoras: 4, totalTransporte: 1, totalAlimentos: 2, porBloque: { 'A 7:00': 2 } },
  fechaCreacion: ts(), fechaActualizacion: ts(), ...extra,
});
const crear = (uid, extra = {}, id = BR) => setDoc(doc(dbDe(uid), 'tiempoExtra', id), borrador(uid, extra));
const empleadoValido = { nombre: 'OPERADOR 600', puesto: 'X', turnoNomina: 'A', horaEntrada: '7:00AM', horaSalida: '4:00PM', horas: 9,
  requiereAlimentos: true, requiereTransporte: true, transporteLlegada: true, transporteSalida: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' };

describe('sin perfil (cuenta creada por cualquiera con la configuración pública) y sin sesión', () => {
  it('con sesión pero sin perfil no lee ni escribe nada, y no puede crearse un perfil', async () => {
    const db = dbDe('intruso');
    await assertFails(setDoc(doc(db, 'usuarios', 'intruso'), { nombre: 'Intruso', rol: 'admin', nomina: '1', activo: true }));
    await assertFails(setDoc(doc(db, 'usuarios', 'intruso'), { nombre: 'Intruso', rol: 'usuario', nomina: '50999', activo: true }));
    for (const col of ['areas', 'puestos', 'empleados', 'rutas', 'tiempoExtra', 'asignaciones', 'bitacora', 'contadores', 'turnosNomina', 'comunidades', 'puntosReunion']) {
      await assertFails(getDocs(collection(db, col)));
    }
    await assertFails(getDocs(collection(db, 'usuarios')));
    await assertFails(getDoc(doc(db, 'asignaciones', idAsig(N.aut2, 'aut2', null))));
    await assertFails(setDoc(doc(db, 'asignaciones', '99_aut2_planta'), { ...asig('99', 'aut2', null) }));
    await assertFails(setDoc(doc(db, 'tiempoExtra', BR), borrador('solP', { creadoPor: 'intruso' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'x'), { accion: 'a', entidad: 'e', antes: null, despues: null, porUid: 'intruso', porNombre: '', fecha: ts() }));
    await assertFails(setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: BR }));
  });
  it('puede leer su propio perfil inexistente (sin datos) pero no el de otro', async () => {
    await assertSucceeds(getDoc(doc(dbDe('intruso'), 'usuarios', 'intruso')));
    await assertFails(getDoc(doc(dbDe('intruso'), 'usuarios', 'rh')));
  });
  it('sin sesión: nada', async () => {
    const db = sinSesion();
    for (const col of ['usuarios', 'areas', 'empleados', 'tiempoExtra', 'asignaciones', 'bitacora']) await assertFails(getDocs(collection(db, col)));
    await assertFails(setDoc(doc(db, 'usuarios', 'x'), { nombre: 'x', rol: 'admin', nomina: '1', activo: true }));
  });
  it('un usuario dado de baja pierde todo (aunque su sesión siga abierta)', async () => {
    const db = dbDe('baja');
    await assertFails(getDocs(collection(db, 'areas')));
    await assertFails(getDocs(collection(db, 'empleados')));
    await assertFails(setDoc(doc(db, 'usuarios', 'baja'), { nombre: 'Baja', rol: 'admin', nomina: '777', activo: true }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'baja'), { activo: true }));
  });
});

describe('solicitante malicioso: escalar privilegios', () => {
  it('no cambia su rol, su nómina, su nombre ni su estado; no crea perfiles; no borra', async () => {
    const db = dbDe('solP');
    for (const cambio of [{ rol: 'admin' }, { rol: 'rh' }, { nomina: N.aut2 }, { nombre: 'Otro' }, { activo: false }, { debeCambiarPassword: true }]) {
      await assertFails(updateDoc(doc(db, 'usuarios', 'solP'), cambio));
    }
    await assertFails(setDoc(doc(db, 'usuarios', 'solP'), { nombre: 'x', rol: 'admin', nomina: N.aut2, activo: true }));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo'), { nombre: 'x', rol: 'usuario', nomina: '1', activo: true }));
    await assertFails(deleteDoc(doc(db, 'usuarios', 'ajeno')));
  });
  it('solo cambia sus preferencias, y válidas', async () => {
    const db = dbDe('solP');
    await assertSucceeds(updateDoc(doc(db, 'usuarios', 'solP'), { preferencias: { tema: 'oscuro', ayudas: true } }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'solP'), { preferencias: { tema: 'oscuro', rol: 'admin' } }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'solP'), { preferencias: { tema: 'oscuro', recorridosVistos: Array.from({ length: 50 }, (_, i) => `r${i}`) } }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'solP'), { preferencias: { tema: largo(500) } }));
  });
  it('no se asigna roles ni los da; no toca asignaciones ajenas', async () => {
    const db = dbDe('solP');
    await assertFails(setDoc(doc(db, 'asignaciones', idAsig(N.solP, 'aut2', null)), { ...asig(N.solP, 'aut2', null), asignadoPor: { uid: 'solP', nombre: NOMBRE('solP') }, fechaAsignacion: ts() }));
    await assertFails(setDoc(doc(db, 'asignaciones', idAsig(N.ajeno, 'solicitante', 'produccion')), { ...asig(N.ajeno, 'solicitante', 'produccion'), asignadoPor: { uid: 'solP', nombre: NOMBRE('solP') }, fechaAsignacion: ts() }));
    await assertFails(updateDoc(doc(db, 'asignaciones', idAsig(N.solP, 'solicitante', 'produccion')), { hasta: null, activo: true, motivo: 'extender' }));
    await assertFails(deleteDoc(doc(db, 'asignaciones', idAsig(N.solP, 'solicitante', 'produccion'))));
  });
  it('no lee la bitácora, a otros usuarios, ni asignaciones de otras áreas ni todo el padrón', async () => {
    const db = dbDe('solP');
    await assertFails(getDocs(collection(db, 'bitacora')));
    await assertFails(getDocs(collection(db, 'usuarios')));
    await assertFails(getDoc(doc(db, 'usuarios', 'rh')));
    await assertFails(getDoc(doc(db, 'asignaciones', idAsig(N.solA, 'solicitante', 'almacen'))));
    await assertFails(getDocs(collection(db, 'empleados')));
    await assertFails(getDoc(doc(db, 'empleados', '801')));
    await assertSucceeds(getDoc(doc(db, 'empleados', '600')));
  });
  it('no crea ni escribe la bitácora', async () => {
    const db = dbDe('solP');
    await assertFails(setDoc(doc(db, 'bitacora', 'nueva'), { accion: 'asignar', entidad: 'asignacion', antes: null, despues: null, porUid: 'solP', porNombre: NOMBRE('solP'), fecha: ts() }));
    await assertFails(updateDoc(doc(db, 'bitacora', 'b1'), { accion: 'borrado' }));
    await assertFails(deleteDoc(doc(db, 'bitacora', 'b1')));
  });
  it('en el padrón solo cambia ruta, comunidad y punto de su área, y con valores cortos', async () => {
    const db = dbDe('solP');
    await assertSucceeds(updateDoc(doc(db, 'empleados', '600'), { rutaId: 'r2', comunidadId: 'c2', puntoReunionId: 'p2' }));
    await assertFails(updateDoc(doc(db, 'empleados', '600'), { rutaId: largo(5000) }));
    await assertFails(updateDoc(doc(db, 'empleados', '600'), { rutaId: { a: 1 } }));
    await assertFails(updateDoc(doc(db, 'empleados', '600'), { nombre: 'OTRO', areaId: 'almacen' }));
    await assertFails(updateDoc(doc(db, 'empleados', '801'), { rutaId: 'r2' }));
    await assertFails(deleteDoc(doc(db, 'empleados', '600')));
  });
  it('no escribe catálogos, estructura, turnos ni contadores a su gusto', async () => {
    const db = dbDe('solP');
    await assertFails(setDoc(doc(db, 'areas', 'nueva'), { nombre: 'X', participaTE: true, activa: true, orden: 1 }));
    await assertFails(updateDoc(doc(db, 'areas', 'produccion'), { activa: false }));
    await assertFails(setDoc(doc(db, 'rutas', 'r9'), { nombre: 'x' }));
    await assertFails(setDoc(doc(db, 'puestos', 'p'), { nombre: 'X', areaId: 'produccion', activo: true, alias: [] }));
    await assertFails(setDoc(doc(db, 'turnosNomina', 'A'), { turno: 'A', entrada: '7:00', salida: '16:00' }));
    await assertFails(updateDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 99 }));
    await assertFails(updateDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13 })); // sin solicitud ligada
    await assertFails(setDoc(doc(db, 'contadores', 'te-2099'), { ultimo: 1 }));
  });
});

describe('solicitante malicioso: falsificar quién es y qué firmó', () => {
  it('el borrador legítimo sí se crea', async () => {
    await assertSucceeds(crear('solP'));
  });
  it('no aparenta ser otra persona, otra área ni otro creador', async () => {
    await assertFails(crear('solP', { creadoPorNombre: 'MALDONADO SALVADOR (Aut. 2)' }));
    await assertFails(crear('solP', { areaNombre: 'Almacén' }));
    await assertFails(crear('solP', { creadoPor: 'solA', creadoPorNomina: N.solA, creadoPorNombre: NOMBRE('solA') }));
    await assertFails(crear('solP', { creadoPorNomina: N.aut2 }));
    await assertFails(crear('solP', { areaId: 'almacen', areaNombre: 'Almacén' })); // no es su área
  });
  it('no se autoriza a sí mismo: ni firmas colgadas, ni estatus, ni folio', async () => {
    await assertFails(crear('solP', { aut1: { nomina: N.aut1P, nombre: NOMBRE('aut1P'), fecha: ts() } }));
    await assertFails(crear('solP', { estatus: 'autorizada' }));
    await assertFails(crear('solP', { folio: `TE-${ANIO}-9999` }));
    await assertFails(updateDoc(doc(dbDe('solP'), 'tiempoExtra', 'TE-P1'), { estatus: 'pendiente_aut2', aut1: { nomina: N.solP, nombre: NOMBRE('solP'), fecha: ts() }, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(dbDe('solP'), 'tiempoExtra', 'TE-P2'), { estatus: 'autorizada', aut2: { nomina: N.solP, nombre: NOMBRE('solP'), fecha: ts(), comoRH: false }, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(dbDe('solP'), 'tiempoExtra', 'TE-P1'), { estatus: 'procesada', fechaActualizacion: ts() }));
  });
  it('no lee lo de otra área ni el borrador de otro', async () => {
    const db = dbDe('solP');
    await assertFails(getDoc(doc(db, 'tiempoExtra', 'TE-A1')));
    await assertFails(getDocs(collection(db, 'tiempoExtra')));
    await assertFails(getDocs(query(collection(db, 'tiempoExtra'), where('areaId', '==', 'almacen'))));
    await assertSucceeds(getDoc(doc(db, 'tiempoExtra', 'TE-P1')));
    await assertFails(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-B1'))); // borrador ajeno, aunque sea Aut. 1 de su área
  });
  it('no edita ni cancela lo de otro', async () => {
    await assertFails(updateDoc(doc(dbDe('solA'), 'tiempoExtra', 'TE-P1'), { estatus: 'cancelada', motivoCancelacion: 'no es mío', fechaActualizacion: ts() }));
    await assertFails(deleteDoc(doc(dbDe('solA'), 'tiempoExtra', 'TE-B1')));
  });
});

describe('documentos enormes y datos del tipo equivocado en la solicitud', () => {
  it('textos con tope', async () => {
    await assertFails(crear('solP', { comentario: largo(5000) }));
    await assertFails(crear('solP', { motivo: largo(200) }));
    await assertFails(crear('solP', { justificacionRutas: largo(5000) }));
    await assertFails(crear('solP', { motivo: 'Otro', motivoOtro: largo(500) }));
    await assertFails(crear('solP', { fechaTE: 'mañana' }));
    await assertFails(crear('solP', { fechaTE: largo(1000) }));
  });
  it('resumen y rutas acotados', async () => {
    await assertFails(crear('solP', { resumen: { totalEmpleados: 999999, totalHoras: 1, totalTransporte: 0, totalAlimentos: 0 } }));
    await assertFails(crear('solP', { resumen: { totalEmpleados: 1, totalHoras: 1e9, totalTransporte: 0, totalAlimentos: 0 } }));
    await assertFails(crear('solP', { resumen: { totalEmpleados: 'muchos', totalHoras: 1, totalTransporte: 0, totalAlimentos: 0 } }));
    await assertFails(crear('solP', { resumen: { totalEmpleados: 1, totalHoras: 1, totalTransporte: 0, totalAlimentos: 0, extra: 1, otro: 2, mas: 3, y: 4, z: 5, w: 6 } }));
    await assertFails(crear('solP', { resumen: { totalEmpleados: 1, totalHoras: 1, totalTransporte: 0, totalAlimentos: 0, porBloque: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`b${i}`, 1])) } }));
    await assertFails(crear('solP', { desgloseRutas: Array.from({ length: 500 }, (_, i) => ({ rutaId: `r${i}` })), rutasDistintas: 500 }));
    await assertFails(crear('solP', { rutasDistintas: 1000000 }));
    await assertSucceeds(crear('solP', { rutasDistintas: 1, desgloseRutas: [{ rutaId: 'r1', nombre: 'LA LIRA', empleados: 2, llegada: 2, salida: 2 }] }));
  });
  it('lo mismo al corregir y al enviar (no se escapa por otra transición)', async () => {
    await assertFails(updateDoc(doc(dbDe('solP'), 'tiempoExtra', 'TE-B1'), { comentario: largo(5000), fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(dbDe('solP'), 'tiempoExtra', 'TE-B1'), { resumen: { totalEmpleados: 99999, totalHoras: 1, totalTransporte: 0, totalAlimentos: 0 }, fechaActualizacion: ts() }));
    await assertSucceeds(updateDoc(doc(dbDe('solP'), 'tiempoExtra', 'TE-B1'), { comentario: 'Pedido urgente de otro cliente', fechaActualizacion: ts() }));
    const db = dbDe('solP');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'TE-B1'), { estatus: 'pendiente_aut1', folio: `TE-${ANIO}-0013`, comentario: largo(5000), fechaActualizacion: ts() });
    b.update(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: 'TE-B1' });
    await assertFails(b.commit());
  });
  it('los empleados de la solicitud: solo los campos del modelo, del tipo correcto y cortos', async () => {
    const ref = (db, n = '600') => doc(db, 'tiempoExtra', BR, 'empleados', n);
    await assertSucceeds(crear('solP'));
    const db = dbDe('solP');
    await assertSucceeds(setDoc(ref(db), empleadoValido));
    for (const malo of [
      { ...empleadoValido, extra: 'x' }, { ...empleadoValido, nombre: largo(500) }, { ...empleadoValido, puesto: largo(500) }, { ...empleadoValido, horas: 1000 },
      { ...empleadoValido, horas: 'nueve' }, { ...empleadoValido, requiereAlimentos: 'si' }, { ...empleadoValido, requiereTransporte: 1 },
      { ...empleadoValido, rutaId: largo(5000) }, { ...empleadoValido, horaEntrada: largo(100) }, { ...empleadoValido, turnoNomina: largo(100) },
      { ...empleadoValido, comunidadId: ['a'] },
    ]) await assertFails(setDoc(ref(db), malo));
  });
  it('el historial: solo los campos del modelo, con su nombre real y comentario corto', async () => {
    const h = (extra = {}) => ({ accion: 'enviada', nivel: 0, porUid: 'solP', porNomina: N.solP, porNombre: NOMBRE('solP'), comentario: '', fecha: ts(), ...extra });
    const intentar = async (extra) => {
      const db = dbDe('solP');
      const b = writeBatch(db);
      b.update(doc(db, 'tiempoExtra', 'TE-B1'), { estatus: 'pendiente_aut1', folio: `TE-${ANIO}-0013`, fechaActualizacion: ts() });
      b.update(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: 'TE-B1' });
      b.set(doc(collection(db, 'tiempoExtra', 'TE-B1', 'historial')), h(extra));
      return b.commit();
    };
    await assertFails(intentar({ porNombre: 'MALDONADO SALVADOR' }));
    await assertFails(intentar({ comentario: largo(5000) }));
    await assertFails(intentar({ campoExtra: 'x' }));
    await assertFails(intentar({ nivel: 'dos' }));
    await assertSucceeds(intentar({}));
  });
});

describe('Aut. 1 malicioso', () => {
  const firma = (uid, extra = {}) => ({ nomina: N[uid], nombre: NOMBRE(uid), fecha: ts(), comentario: '', comoRH: false, ...extra });
  const autorizar = (uid, id, f) => updateDoc(doc(dbDe(uid), 'tiempoExtra', id), { estatus: 'pendiente_aut2', aut1: f, fechaActualizacion: ts() });
  it('autoriza lo de su área, y solo con su firma real', async () => {
    await assertSucceeds(autorizar('aut1P', 'TE-P1', firma('aut1P')));
  });
  it('no autoriza otra área ni firma por otra persona ni con campos de más', async () => {
    await assertFails(autorizar('aut1P', 'TE-A1', firma('aut1P')));
    await assertFails(autorizar('aut1P', 'TE-P1', firma('aut1P', { nombre: 'MALDONADO SALVADOR' })));
    await assertFails(autorizar('aut1P', 'TE-P1', firma('aut1P', { nomina: N.aut2 })));
    await assertFails(autorizar('aut1P', 'TE-P1', firma('aut1P', { comoRH: true })));
    await assertFails(autorizar('aut1P', 'TE-P1', firma('aut1P', { rol: 'admin' })));
    await assertFails(autorizar('aut1P', 'TE-P1', firma('aut1P', { comentario: largo(5000) })));
    await assertFails(autorizar('aut1P', 'TE-P1', { ...firma('aut1P'), fecha: Timestamp.fromDate(new Date('2020-01-01')) }));
  });
  it('no firma el nivel 2, no recibe, no cancela lo autorizado ni devuelve sin motivo', async () => {
    await assertFails(updateDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-P2'), { estatus: 'autorizada', aut2: firma('aut1P'), fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-P1'), { estatus: 'devuelta', devolucion: { nivel: 1, nomina: N.aut1P, nombre: NOMBRE('aut1P'), motivo: 'no', fecha: ts() }, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-P1'), {
      estatus: 'devuelta', devolucion: { nivel: 1, nomina: N.aut1P, nombre: 'Otra persona', motivo: 'Faltan datos del turno', fecha: ts() }, fechaActualizacion: ts(),
    }));
    await assertFails(updateDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-P1'), {
      estatus: 'devuelta', devolucion: { nivel: 1, nomina: N.aut1P, nombre: NOMBRE('aut1P'), motivo: largo(5000), fecha: ts() }, fechaActualizacion: ts(),
    }));
    await assertSucceeds(updateDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-P1'), {
      estatus: 'devuelta', devolucion: { nivel: 1, nomina: N.aut1P, nombre: NOMBRE('aut1P'), motivo: 'Faltan datos del turno', fecha: ts() }, fechaActualizacion: ts(),
    }));
  });
  it('no da roles (ni Aut. 2 ni otros), no lee asignaciones de otra área ni la bitácora', async () => {
    const db = dbDe('aut1P');
    for (const rol of ['aut2', 'aut1', 'solicitante']) {
      await assertFails(setDoc(doc(db, 'asignaciones', idAsig(N.ajeno, rol, 'produccion')), {
        ...asig(N.ajeno, rol, 'produccion'), asignadoPor: { uid: 'aut1P', nombre: NOMBRE('aut1P') }, fechaAsignacion: ts(),
      }));
    }
    await assertFails(getDoc(doc(db, 'asignaciones', idAsig(N.solA, 'solicitante', 'almacen'))));
    await assertFails(getDocs(collection(db, 'bitacora')));
    await assertFails(getDocs(collection(db, 'empleados')));
  });
});

describe('RH malicioso (el rol más alto sin ser admin)', () => {
  const bit = (extra = {}) => ({ accion: 'asignar', entidad: 'asignacion', antes: null, despues: { id: 'x' }, porUid: 'rh', porNombre: NOMBRE('rh'), fecha: ts(), ...extra });
  it('no cambia la nómina de un usuario (heredaría los roles de otra persona), ni lo hace rh/admin', async () => {
    const db = dbDe('rh');
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { nomina: N.aut2 }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { preferencias: { tema: 'oscuro' } }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', 'ajeno'), { nombre: 'Nombre corregido', activo: false }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'ajeno'), { nombre: largo(500) }));
    await assertFails(updateDoc(doc(db, 'usuarios', 'admin'), { activo: false }));
  });
  it('no crea perfiles enormes, sin nómina o con campos del tipo equivocado', async () => {
    const db = dbDe('rh');
    await assertSucceeds(setDoc(doc(db, 'usuarios', 'nuevo1'), { nombre: 'Nuevo', rol: 'usuario', nomina: '60001', activo: true, debeCambiarPassword: true }));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo2'), { nombre: 'Nuevo', rol: 'usuario', activo: true }));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo3'), { nombre: largo(500), rol: 'usuario', nomina: '60003', activo: true }));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo4'), { nombre: 'Nuevo', rol: 'usuario', nomina: largo(100), activo: true }));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo5'), { nombre: 'Nuevo', rol: 'usuario', nomina: '60005', activo: 'si' }));
    await assertFails(setDoc(doc(db, 'usuarios', 'nuevo6'), { nombre: 'Nuevo', rol: 'rh', nomina: '60006', activo: true }));
    await assertFails(deleteDoc(doc(db, 'usuarios', 'ajeno')));
  });
  it('la bitácora lleva su nombre y su uid reales; no se edita ni se borra', async () => {
    const db = dbDe('rh');
    await assertSucceeds(setDoc(doc(db, 'bitacora', 'ok1'), bit()));
    await assertFails(setDoc(doc(db, 'bitacora', 'f1'), bit({ porNombre: 'ESPINOSA MARCO (Administrador)' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'f2'), bit({ porUid: 'admin' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'f3'), bit({ accion: largo(500) })));
    await assertFails(setDoc(doc(db, 'bitacora', 'f4'), bit({ antes: 'texto suelto' })));
    await assertFails(setDoc(doc(db, 'bitacora', 'f5'), bit({ fecha: Timestamp.fromDate(new Date('2020-01-01')) })));
    await assertFails(setDoc(doc(db, 'bitacora', 'f6'), { ...bit(), extra: 'x' }));
    await assertFails(updateDoc(doc(db, 'bitacora', 'b1'), { accion: 'x' }));
    await assertFails(deleteDoc(doc(db, 'bitacora', 'b1')));
  });
  it('las asignaciones llevan quién las dio (nombre real), textos cortos y no se da Aut. 2', async () => {
    const db = dbDe('rh');
    const nueva = (extra = {}) => ({ ...asig(N.ajeno, 'solicitante', 'produccion'), asignadoPor: { uid: 'rh', nombre: NOMBRE('rh') }, fechaAsignacion: ts(), ...extra });
    const id = idAsig(N.ajeno, 'solicitante', 'produccion');
    await assertFails(setDoc(doc(db, 'asignaciones', id), nueva({ asignadoPor: { uid: 'rh', nombre: 'ESPINOSA MARCO' } })));
    await assertFails(setDoc(doc(db, 'asignaciones', id), nueva({ asignadoPor: { uid: 'rh', nombre: NOMBRE('rh'), extra: 'x' } })));
    await assertFails(setDoc(doc(db, 'asignaciones', id), nueva({ motivo: largo(2000) })));
    await assertFails(setDoc(doc(db, 'asignaciones', id), nueva({ nombre: largo(500) })));
    await assertFails(setDoc(doc(db, 'asignaciones', id), nueva({ puesto: largo(500) })));
    await assertFails(setDoc(doc(db, 'asignaciones', idAsig(N.ajeno, 'aut2', null)), { ...asig(N.ajeno, 'aut2', null), asignadoPor: { uid: 'rh', nombre: NOMBRE('rh') }, fechaAsignacion: ts() }));
    await assertFails(setDoc(doc(db, 'asignaciones', id), nueva({ areaId: 'administrativo' })));
    await assertSucceeds(setDoc(doc(db, 'asignaciones', id), nueva()));
    await assertFails(deleteDoc(doc(db, 'asignaciones', id)));
  });
  it('estructura y catálogos acotados', async () => {
    const db = dbDe('rh');
    await assertFails(setDoc(doc(db, 'puestos', 'grande'), { nombre: largo(500), areaId: 'produccion', activo: true, alias: [] }));
    await assertFails(setDoc(doc(db, 'puestos', 'alias'), { nombre: 'X', areaId: 'produccion', activo: true, alias: Array.from({ length: 500 }, (_, i) => `A${i}`) }));
    await assertFails(setDoc(doc(db, 'areas', 'grande'), { nombre: largo(500), participaTE: true, activa: true, orden: 1 }));
    await assertFails(setDoc(doc(db, 'rutas', 'enorme'), Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`c${i}`, i]))));
    await assertSucceeds(setDoc(doc(db, 'rutas', 'r1'), { nombre: 'RUTA NORTE', activo: true }));
    await assertSucceeds(deleteDoc(doc(db, 'rutas', 'r1')));
  });
});

describe('descargas: la Aut. 2 y RH las registran con su nombre real', () => {
  const des = (uid, extra = {}) => ({ accion: 'descargar_consulta_te', entidad: 'descarga', antes: null, despues: { archivo: 'x.xlsx', filas: 3 }, porUid: uid, porNombre: NOMBRE(uid), fecha: ts(), ...extra });
  it('Aut. 2 y RH sí; un Aut. 1 o un solicitante no; y no firmar por otro', async () => {
    await assertSucceeds(setDoc(doc(dbDe('aut2'), 'bitacora', 'd1'), des('aut2')));
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'bitacora', 'd2'), des('rh')));
    await assertFails(setDoc(doc(dbDe('aut1P'), 'bitacora', 'd3'), des('aut1P')));
    await assertFails(setDoc(doc(dbDe('solP'), 'bitacora', 'd4'), des('solP')));
    await assertFails(setDoc(doc(dbDe('aut2'), 'bitacora', 'd5'), des('aut2', { porNombre: 'Otro' })));
    await assertFails(setDoc(doc(dbDe('aut2'), 'bitacora', 'd6'), des('aut2', { entidad: 'usuarios' })));
  });
  it('la Aut. 2 no lee las descargas (solo lo de asignaciones)', async () => {
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'bitacora', 'd7'), des('rh')));
    await assertFails(getDoc(doc(dbDe('aut2'), 'bitacora', 'd7')));
    await assertSucceeds(getDoc(doc(dbDe('rh'), 'bitacora', 'd7')));
  });
});

describe('respaldo completo: el admin lee todo lo que respalda; nadie más', () => {
  const visibles = ['pendiente_aut1', 'pendiente_aut2', 'autorizada', 'devuelta', 'procesada', 'cancelada'];
  it('el admin lee cada colección (tiempo extra sin borradores) y sus subcolecciones', async () => {
    const db = dbDe('admin');
    for (const col of ['usuarios', 'asignaciones', 'areas', 'puestos', 'empleados', 'rutas', 'comunidades', 'puntosReunion', 'turnosNomina', 'contadores', 'bitacora', 'solicitudes']) {
      await assertSucceeds(getDocs(collection(db, col)));
    }
    await assertSucceeds(getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', visibles))));
    await assertSucceeds(getDocs(collection(db, 'tiempoExtra', 'TE-P1', 'empleados')));
    await assertSucceeds(getDocs(collection(db, 'tiempoExtra', 'TE-P1', 'historial')));
    await assertFails(getDocs(collection(db, 'tiempoExtra'))); // sin filtro: los borradores de otros no se leen
  });
  it('un solicitante o un Aut. 1 no pueden leer los usuarios ni la bitácora para respaldarlos', async () => {
    for (const uid of ['solP', 'aut1P']) {
      await assertFails(getDocs(collection(dbDe(uid), 'usuarios')));
      await assertFails(getDocs(collection(dbDe(uid), 'bitacora')));
    }
  });
});

describe('Aut. 2 autoriza lo que ella misma captura (y nadie más lo hace con lo suyo)', () => {
  const COMENTARIO = 'Capturada y autorizada por Aut. 2';
  const crearAdm = async (uid) => {
    await setDoc(doc(dbDe(uid), 'tiempoExtra', BR), { ...borrador(uid), areaId: 'administrativo', areaNombre: 'Administrativo' });
  };
  const enviarComo = (uid, { estatus = 'autorizada', aut2, extra = {}, historialExtra = {} } = {}) => {
    const db = dbDe(uid);
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', BR), {
      estatus, folio: `TE-${ANIO}-0013`, fechaActualizacion: ts(),
      ...(aut2 ? { aut2 } : {}), ...extra,
    });
    b.update(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: BR });
    b.set(doc(collection(db, 'tiempoExtra', BR, 'historial')), {
      accion: 'enviada_autorizada', nivel: 2, porUid: uid, porNomina: N[uid], porNombre: NOMBRE(uid), comentario: COMENTARIO, fecha: ts(), ...historialExtra,
    });
    return b.commit();
  };
  const firmaAut2 = (uid, extra = {}) => ({ nomina: N[uid], nombre: NOMBRE(uid), fecha: ts(), comentario: COMENTARIO, comoRH: false, ...extra });

  it('la Aut. 2 envía su solicitud de Administrativo: queda autorizada con su firma', async () => {
    await crearAdm('aut2');
    await assertSucceeds(enviarComo('aut2', { aut2: firmaAut2('aut2') }));
  });
  it('la firma debe ser exacta: otro comentario, comoRH, otro nombre, otra nómina, campos de más o una firma de nivel 1 colgada', async () => {
    for (const mala of [
      firmaAut2('aut2', { comentario: 'Autorizada' }), firmaAut2('aut2', { comoRH: true }), firmaAut2('aut2', { nombre: 'MALDONADO SALVADOR' }),
      firmaAut2('aut2', { nomina: N.rh }), firmaAut2('aut2', { rol: 'admin' }), firmaAut2('aut2', { fecha: Timestamp.fromDate(new Date('2020-01-01')) }),
    ]) {
      await env.clearFirestore(); await sembrar();
      await crearAdm('aut2');
      await assertFails(enviarComo('aut2', { aut2: mala }));
    }
    await assertFails(enviarComo('aut2', { aut2: firmaAut2('aut2'), extra: { aut1: { nomina: N.aut1P, nombre: NOMBRE('aut1P'), fecha: ts() } } }));
    await assertFails(enviarComo('aut2', { aut2: firmaAut2('aut2'), historialExtra: { nivel: 1 } }));
    await assertFails(enviarComo('aut2', { aut2: firmaAut2('aut2'), historialExtra: { porNombre: 'Otro' } }));
  });
  it('quien no es Aut. 2 no puede enviar como autorizada: ni RH, ni el Aut. 1, ni el solicitante', async () => {
    await crearAdm('rh');
    await assertFails(enviarComo('rh', { aut2: firmaAut2('rh') }));
    await assertFails(enviarComo('rh', { aut2: firmaAut2('rh', { comoRH: true }) }));
    await assertSucceeds(enviarComo('rh', { estatus: 'pendiente_aut2', historialExtra: { accion: 'enviada', nivel: 0, comentario: '' } })); // RH: nivel 2, lo firma otra persona
    await env.clearFirestore(); await sembrar();
    await setDoc(doc(dbDe('aut1P'), 'tiempoExtra', BR), borrador('aut1P'));
    await assertFails(enviarComo('aut1P', { aut2: firmaAut2('aut1P') }));
    await env.clearFirestore(); await sembrar();
    await crear('solP');
    await assertFails(enviarComo('solP', { aut2: firmaAut2('solP') }));
  });
  it('la Aut. 2 no deja la suya en un nivel inferior (pendiente_aut1 / pendiente_aut2) ni firma la de otro con este atajo', async () => {
    await crearAdm('aut2');
    await assertFails(enviarComo('aut2', { estatus: 'pendiente_aut2' }));
    await assertFails(enviarComo('aut2', { estatus: 'pendiente_aut1' }));
    // la solicitud de otra persona no se autoriza al "enviarla": no es su borrador
    await env.clearFirestore(); await sembrar();
    const db = dbDe('aut2');
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'TE-B1'), { estatus: 'autorizada', aut2: firmaAut2('aut2'), fechaActualizacion: ts() }));
  });
  it('en un área que participa necesita su asignación de solicitante o Aut. 1; sin ella no captura ni autoriza', async () => {
    await assertFails(setDoc(doc(dbDe('aut2'), 'tiempoExtra', BR), borrador('aut2'))); // produccion: no es suya
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'tiempoExtra', BR), { ...borrador('aut2'), fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now() }); });
    await assertFails(enviarComo('aut2', { aut2: firmaAut2('aut2') }));
  });
});
