// Reglas de los ajustes de uso: preferencias de cada usuario, turnos de nómina, tipo de tiempo extra, justificación de rutas
// y transporte de llegada/salida (extensión de turno). Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

let env;
const ts = serverTimestamp;
const ahora = () => Timestamp.now();
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const ANIO = new Date().getFullYear();
const BR = 'BR-ABCDEFGH12';
const FOLIO = `TE-${ANIO}-0013`;

const N = { admin: '90000', rh: '90001', sol: '50532', aut1: '50610', otro: '50999' };
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId, desde: ayer(), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: ahora(),
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['admin', 'admin', N.admin], ['rh', 'rh', N.rh], ['sol', 'usuario', N.sol], ['aut1', 'usuario', N.aut1], ['otro', 'usuario', N.otro]]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: `Usuario ${nomina}`, email: `${nomina}@rutas.app`, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'asignaciones', `${N.sol}_solicitante_produccion`), asig(N.sol, 'solicitante', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.aut1}_aut1_produccion`), asig(N.aut1, 'aut1', 'produccion'));
    await setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 12 });
    for (const n of ['600', '601']) await setDoc(doc(db, 'empleados', n), { nombre: `Operador ${n}`, nomina: n, areaId: 'produccion' });
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-ajustes', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('preferencias de cada usuario', () => {
  const pref = (extra = {}) => ({ ayudas: false, tamanoLetra: 'grande', tema: 'oscuro', recorridosVistos: ['solicitar'], ...extra });
  const guardar = (uid, prefs, objetivo = uid) => updateDoc(doc(dbDe(uid), 'usuarios', objetivo), { preferencias: prefs });

  it('cada usuario cambia las suyas (usuario, RH y admin)', async () => {
    for (const uid of ['sol', 'aut1', 'rh', 'admin']) await assertSucceeds(guardar(uid, pref()));
  });
  it('también valores parciales y los tres temas', async () => {
    await assertSucceeds(guardar('sol', { ayudas: true }));
    for (const tema of ['claro', 'oscuro', 'auto']) await assertSucceeds(guardar('sol', { tema }));
  });
  it('un usuario no cambia las preferencias de otra persona', async () => {
    await assertFails(guardar('otro', pref(), 'sol'));
    await assertFails(guardar('sol', pref(), 'aut1'));
  });
  it('solo ese campo: no se puede colar el rol ni otro dato del perfil en la misma escritura', async () => {
    const ref = doc(dbDe('sol'), 'usuarios', 'sol');
    await assertFails(updateDoc(ref, { preferencias: pref(), rol: 'admin' }));
    await assertFails(updateDoc(ref, { preferencias: pref(), activo: false }));
    await assertFails(updateDoc(ref, { rol: 'admin' }));
  });
  it('valores inválidos o campos desconocidos no pasan', async () => {
    await assertFails(guardar('sol', pref({ tamanoLetra: 'enorme' })));
    await assertFails(guardar('sol', pref({ tema: 'rosa' })));
    await assertFails(guardar('sol', pref({ ayudas: 'sí' })));
    await assertFails(guardar('sol', pref({ rol: 'admin' })));
    await assertFails(guardar('sol', pref({ recorridosVistos: 'solicitar' })));
    await assertFails(guardar('sol', 'texto'));
  });
  it('un usuario desactivado no cambia nada', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'usuarios', 'sol'), { activo: false }); });
    await assertFails(guardar('sol', pref()));
  });
});

describe('turnos de nómina', () => {
  const turno = (uid, t = 'A', extra = {}) => ({ turno: t, entrada: '7:00', salida: '16:00', actualizadoPor: { uid, nombre: uid }, fechaActualizacion: ts(), ...extra });

  it('RH y admin los capturan', async () => {
    for (const uid of ['rh', 'admin']) for (const t of ['A', 'B', 'C']) await assertSucceeds(setDoc(doc(dbDe(uid), 'turnosNomina', t), turno(uid, t)));
  });
  it('vacíos ("sin configurar") también valen', async () => {
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('rh', 'A', { entrada: '', salida: '' })));
  });
  it('cualquier usuario activo los lee; nadie más los escribe', async () => {
    await setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('rh', 'A'));
    for (const uid of ['sol', 'aut1', 'otro']) {
      await assertSucceeds(getDoc(doc(dbDe(uid), 'turnosNomina', 'A')));
      await assertFails(setDoc(doc(dbDe(uid), 'turnosNomina', 'A'), turno(uid, 'A')));
    }
  });
  it('solo A, B y C, solo los bloques de horario y con la firma de quien los guarda', async () => {
    await assertFails(setDoc(doc(dbDe('rh'), 'turnosNomina', 'D'), turno('rh', 'D')));
    await assertFails(setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('rh', 'A', { entrada: '8:30' })));
    await assertFails(setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('rh', 'B')));
    await assertFails(setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('admin', 'A')));
    await assertFails(setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('rh', 'A', { extra: 1 })));
  });
  it('no se borran', async () => {
    await setDoc(doc(dbDe('rh'), 'turnosNomina', 'A'), turno('rh', 'A'));
    await assertFails(env.authenticatedContext('admin').firestore().doc('turnosNomina/A').delete());
  });
});

describe('tipo de tiempo extra, rutas y transporte de llegada/salida', () => {
  const nuevo = (extra = {}) => ({
    areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'sol', creadoPorNomina: N.sol, creadoPorNombre: 'sol',
    fechaTE: '2026-11-05', motivo: 'Producción', comentario: 'Pedido urgente del cliente', estatus: 'borrador',
    resumen: { totalEmpleados: 2, totalHoras: 4, totalTransporte: 1, totalAlimentos: 2 },
    tipo: 'turno_extra', rutasDistintas: 1, desgloseRutas: [{ rutaId: 'r1', nombre: 'LA LIRA', empleados: 2, llegada: 2, salida: 2 }], justificacionRutas: '',
    fechaCreacion: ts(), fechaActualizacion: ts(), ...extra,
  });
  const empleado = (extra = {}) => ({
    nombre: 'Operador', puesto: 'X', turnoNomina: 'A', horaEntrada: '7:00', horaSalida: '16:00', horas: 9, requiereAlimentos: false, requiereTransporte: true,
    transporteLlegada: true, transporteSalida: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', ...extra,
  });
  const crear = (datos = {}, empleados = { 600: {} }) => {
    const db = dbDe('sol');
    const b = writeBatch(db);
    b.set(doc(db, 'tiempoExtra', BR), nuevo(datos));
    for (const [n, e] of Object.entries(empleados)) b.set(doc(db, 'tiempoExtra', BR, 'empleados', n), empleado(e));
    return b.commit();
  };
  /** Enviar a autorización con el folio del contador (lo que hace la pantalla en una transacción) */
  const enviar = async (cambios = {}) => {
    const db = dbDe('sol');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', BR), { estatus: 'pendiente_aut1', folio: FOLIO, fechaActualizacion: ts(), ...cambios });
    b.update(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: BR });
    b.set(doc(collection(db, 'tiempoExtra', BR, 'historial')), { accion: 'enviada', nivel: 0, porUid: 'sol', porNomina: N.sol, porNombre: 'sol', comentario: '', fecha: ts() });
    return b.commit();
  };

  it('el borrador nace con los campos nuevos (tipo, rutasDistintas, desgloseRutas, justificacionRutas)', async () => {
    await assertSucceeds(crear());
    await env.clearFirestore(); await sembrar();
    await assertSucceeds(crear({ tipo: 'extension' }, { 600: { transporteLlegada: false } }));
  });
  it('un tipo inventado no pasa', async () => {
    await assertFails(crear({ tipo: 'turno_loco' }));
  });
  it('un borrador sin los campos nuevos (como antes) sigue valiendo', async () => {
    const d = nuevo(); delete d.tipo; delete d.rutasDistintas; delete d.desgloseRutas; delete d.justificacionRutas;
    await assertSucceeds(setDoc(doc(dbDe('sol'), 'tiempoExtra', BR), d));
  });

  describe('enviar con más de una ruta', () => {
    const varias = { rutasDistintas: 3, desgloseRutas: [{ rutaId: 'r1', nombre: 'A', empleados: 1, llegada: 1, salida: 1 }, { rutaId: 'r2', nombre: 'B', empleados: 1, llegada: 1, salida: 1 }] };
    it('con una sola ruta se envía sin justificación', async () => {
      await crear();
      await assertSucceeds(enviar());
    });
    it('con más de una ruta, sin justificación, no se envía', async () => {
      await crear(varias);
      await assertFails(enviar());
      await assertFails(enviar({ justificacionRutas: '' }));
      await assertFails(enviar({ justificacionRutas: 'corto' }));
      await assertFails(enviar({ justificacionRutas: '               ' }));
    });
    it('con la justificación de 15 caracteres sí', async () => {
      await crear(varias);
      await assertSucceeds(enviar({ justificacionRutas: 'Viven en zonas muy distintas' }));
    });
    it('el borrador con varias rutas se puede guardar sin justificar (todavía no se envía)', async () => {
      await assertSucceeds(crear(varias));
    });
    it('no se puede cambiar el tipo a uno inventado al enviar', async () => {
      await crear();
      await assertFails(enviar({ tipo: 'raro' }));
    });
  });

  describe('empleados', () => {
    it('guardan el transporte de llegada y de salida; los campos desconocidos no pasan', async () => {
      await assertSucceeds(crear({}, { 600: { transporteLlegada: false } }));
      await env.clearFirestore(); await sembrar();
      await assertFails(crear({}, { 600: { transporteArriba: true } }));
    });
    it('una extensión de turno no puede llevar transporte de llegada (ya está en la planta)', async () => {
      await assertFails(crear({ tipo: 'extension' }, { 600: { transporteLlegada: true } }));
      await env.clearFirestore(); await sembrar();
      await assertFails(crear({ tipo: 'extension' }, { 600: {} })); // los dos sentidos
      await env.clearFirestore(); await sembrar();
      await assertSucceeds(crear({ tipo: 'extension' }, { 600: { transporteLlegada: false }, 601: { transporteLlegada: false, transporteSalida: false, requiereTransporte: false, rutaId: '', comunidadId: '', puntoReunionId: '' } }));
    });
    it('un turno extra sí puede llevar los dos sentidos, o solo uno', async () => {
      await assertSucceeds(crear({}, { 600: {}, 601: { transporteSalida: false } }));
    });
    it('los documentos anteriores (sin los campos nuevos) siguen aceptándose', async () => {
      const antiguo = empleado(); delete antiguo.transporteLlegada; delete antiguo.transporteSalida;
      const db = dbDe('sol');
      const b = writeBatch(db);
      b.set(doc(db, 'tiempoExtra', BR), nuevo());
      b.set(doc(db, 'tiempoExtra', BR, 'empleados', '600'), antiguo);
      await assertSucceeds(b.commit());
    });
  });
});
