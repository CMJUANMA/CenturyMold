// Reglas de tiempo extra (tiempoExtra, asignaciones vigentes, contadores, padrón) contra el emulador de Firestore.
// Ejecutar con: npm run test:rules  (requiere Java 11+; levanta el emulador por sí solo)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;

// uid = id del perfil. La nómina de cada quien es la que usan las reglas contra la matriz.
const N = {
  admin: '90000', rh: '90001', rh2: '90002',
  solP: '50532', solP2: '50009', aut1P: '50610', aut1PSup: '50611',
  solA: '50901', aut1A: '50988', aut1M: '50874', solM: '50272',
  aut2: '11', aut2Sup: '50296', ajeno: '50999', inactivo: '50998',
};

const perfil = (rol, nomina, extra = {}) => ({ nombre: `Usuario ${nomina}`, email: `${nomina}@rutas.app`, rol, nomina, activo: true, ...extra });
const ahora = () => Timestamp.now();

const teSemilla = (folio, creadoPor, areaId, estatus, extra = {}) => ({
  folio, areaId, areaNombre: areaId, creadoPor, creadoPorNomina: N[creadoPor] ?? '', creadoPorNombre: creadoPor,
  fechaTE: '2026-11-02', motivo: 'Entrega urgente', estatus,
  resumen: { totalEmpleados: 1, totalHoras: 2, totalTransporte: 0, totalAlimentos: 1 },
  fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra,
});
const firmaSemilla = (nomina) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ahora(), comentario: '' });

const ayer = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
/** Asignación válida (el emulador la escribe con las reglas apagadas) */
const asig = (nomina, rol, areaId, extra = {}) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId,
  desde: ayer(), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: ahora(), ...extra,
});
const idAsig = (nomina, rol, areaId) => `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`;

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const usuarios = {
      admin: ['admin', N.admin], rh: ['rh', N.rh], rh2: ['rh', N.rh2],
      solP: ['usuario', N.solP], solP2: ['usuario', N.solP2],
      aut1P: ['usuario', N.aut1P], aut1PSup: ['usuario', N.aut1PSup],
      solA: ['usuario', N.solA], aut1A: ['usuario', N.aut1A],
      aut1M: ['usuario', N.aut1M], solM: ['usuario', N.solM],
      aut2: ['usuario', N.aut2], aut2Sup: ['usuario', N.aut2Sup],
      ajeno: ['usuario', N.ajeno],
    };
    for (const [uid, [rol, nomina]] of Object.entries(usuarios)) await setDoc(doc(db, 'usuarios', uid), perfil(rol, nomina));
    await setDoc(doc(db, 'usuarios', 'inactivo'), perfil('usuario', N.inactivo, { activo: false }));

    // Áreas del catálogo (Administrativo no participa en TE)
    for (const [id, nombre, participaTE, orden] of [
      ['produccion', 'Producción', true, 1], ['almacen', 'Almacén', true, 2], ['calidad', 'Calidad', true, 3],
      ['mantenimiento', 'Mantenimiento', true, 4], ['moldes', 'Moldes', true, 5], ['administrativo', 'Administrativo', false, 6],
    ]) await setDoc(doc(db, 'areas', id), { nombre, participaTE, activa: true, orden });

    // Asignaciones vigentes. Aut. 1 de Producción y su suplente; el Aut. 1 de Moldes también es solicitante
    const todas = [
      [N.aut1P, 'aut1', 'produccion'], [N.aut1PSup, 'aut1', 'produccion'], [N.solP, 'solicitante', 'produccion'], [N.solP2, 'solicitante', 'produccion'],
      [N.aut1A, 'aut1', 'almacen'], [N.solA, 'solicitante', 'almacen'],
      [N.aut1M, 'aut1', 'moldes'], [N.solM, 'solicitante', 'moldes'], [N.aut1M, 'solicitante', 'moldes'],
      [N.aut2, 'aut2', null], [N.aut2Sup, 'aut2', null],
    ];
    for (const [nomina, rol, area] of todas) await setDoc(doc(db, 'asignaciones', idAsig(nomina, rol, area)), asig(nomina, rol, area));
    await setDoc(doc(db, 'contadores', 'te-2026'), { ultimo: 12 });

    // Padrón: el área efectiva de cada empleado (areaId) debe coincidir con la de la solicitud
    await setDoc(doc(db, 'empleados', '600'), { nombre: 'Operador 600', nomina: '600', areaId: 'produccion', rutaId: 'r1' });
    await setDoc(doc(db, 'empleados', '800'), { nombre: 'Operador 800', nomina: '800', areaId: 'produccion' });
    await setDoc(doc(db, 'empleados', '801'), { nombre: 'Auxiliar 801', nomina: '801', areaId: 'calidad' });
    await setDoc(doc(db, 'empleados', '810'), { nombre: 'Moldeador 810', nomina: '810', areaId: 'moldes' });
    await setDoc(doc(db, 'empleados', '802'), { nombre: 'Oficinista 802', nomina: '802', areaId: 'administrativo' });
    for (let i = 0; i < 40; i++) await setDoc(doc(db, 'empleados', String(700 + i)), { nombre: `Operador ${700 + i}`, nomina: String(700 + i), areaId: 'produccion' });
    for (let i = 0; i < 40; i++) await setDoc(doc(db, 'empleados', String(900 + i)), { nombre: `Administrativo ${900 + i}`, nomina: String(900 + i), areaId: 'administrativo' });

    // Solicitudes de tiempo extra
    const s = (folio, ...args) => setDoc(doc(db, 'tiempoExtra', folio), teSemilla(folio, ...args));
    await s('TE-2026-0001', 'solP', 'produccion', 'pendiente_aut1');
    await s('TE-2026-0002', 'solP', 'produccion', 'pendiente_aut2', { aut1: firmaSemilla(N.aut1P) });
    await s('TE-2026-0003', 'solP', 'produccion', 'autorizada', { aut1: firmaSemilla(N.aut1P), aut2: firmaSemilla(N.aut2) });
    await s('TE-2026-0004', 'solP', 'produccion', 'devuelta', {
      devolucion: { nivel: 1, nomina: N.aut1P, nombre: 'x', motivo: 'Falta motivo', fecha: ahora() },
    });
    await s('TE-2026-0005', 'aut1PSup', 'produccion', 'pendiente_aut1'); // creada por el suplente del Aut. 1
    await s('TE-2026-0006', 'aut2', 'produccion', 'pendiente_aut2'); // creada por el Aut. 2
    await s('TE-2026-0007', 'rh', 'produccion', 'pendiente_aut2'); // creada por un usuario de RH
    await s('TE-2026-0008', 'solA', 'almacen', 'pendiente_aut1');
    await s('TE-2026-0009', 'aut1M', 'moldes', 'devuelta', {
      devolucion: { nivel: 2, nomina: N.aut2, nombre: 'x', motivo: 'Corregir horas', fecha: ahora() },
      aut1: firmaSemilla(N.aut1M),
    });
    await s('TE-2026-0010', 'solP', 'produccion', 'devuelta', {
      aut1: firmaSemilla(N.aut1P),
      devolucion: { nivel: 2, nomina: N.aut2, nombre: 'x', motivo: 'Corregir horas', fecha: ahora() },
    });
    await s('TE-2026-0011', 'solP', 'produccion', 'cancelada');
    for (const folio of ['TE-2026-0001', 'TE-2026-0004']) {
      await setDoc(doc(db, 'tiempoExtra', folio, 'empleados', '600'), { nombre: 'Operador 600', puesto: 'OPERADOR', horas: 2 });
    }
    await setDoc(doc(db, 'tiempoExtra', 'TE-2026-0002', 'historial', 'h1'), {
      accion: 'creada', nivel: 0, porUid: 'solP', porNomina: N.solP, porNombre: 'x', comentario: '', fecha: ahora(),
    });
  });
}

const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const ts = serverTimestamp;
const firma = (nomina, extra = {}) => ({ nomina, nombre: `Usuario ${nomina}`, fecha: ts(), comentario: '', ...extra });
const devolucion = (nivel, nomina, motivo = 'Revisar horas') => ({ nivel, nomina, nombre: `Usuario ${nomina}`, motivo, fecha: ts() });

const nuevo = (uid, areaId, extra = {}) => ({
  folio: 'TE-2026-0013', areaId, areaNombre: areaId, creadoPor: uid, creadoPorNomina: N[uid], creadoPorNombre: uid,
  fechaTE: '2026-11-05', motivo: 'Pedido urgente', estatus: 'pendiente_aut1',
  resumen: { totalEmpleados: 2, totalHoras: 4, totalTransporte: 1, totalAlimentos: 2 },
  fechaCreacion: ts(), fechaActualizacion: ts(), ...extra,
});

const historial = (db, folio, h) => ({
  ref: doc(collection(db, 'tiempoExtra', folio, 'historial')),
  data: { nivel: 0, porUid: h.uid, porNomina: N[h.uid], porNombre: h.uid, comentario: '', fecha: ts(), accion: h.accion, ...(h.nivel ? { nivel: h.nivel } : {}) },
});

/** Captura: solicitud + empleados + historial 'creada' en un solo lote */
function capturar(uid, areaId, { extra = {}, empleados = 2, folio = 'TE-2026-0013' } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  b.set(doc(db, 'tiempoExtra', folio), nuevo(uid, areaId, { folio, ...extra }));
  for (let i = 0; i < empleados; i++) {
    b.set(doc(db, 'tiempoExtra', folio, 'empleados', String(700 + i)), { nombre: `Operador ${700 + i}`, puesto: 'OPERADOR', horas: 2 });
  }
  const h = historial(db, folio, { uid, accion: 'creada' });
  b.set(h.ref, h.data);
  return b.commit();
}

/** Máximo de empleados que cabe en el lote de captura (medido con el emulador; ver docs/tiempo-extra.md) */
const LOTE_MAXIMO = 12;

/** Captura con empleados concretos (nóminas del padrón). conAut1: el estatus por defecto es el de un Aut. 1 que captura */
function capturarCon(uid, areaId, nominas, extra = {}, conAut1 = false) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const folio = 'TE-2026-0013';
  const estatus = extra.estatus ?? (conAut1 ? 'pendiente_aut2' : 'pendiente_aut1');
  b.set(doc(db, 'tiempoExtra', folio), nuevo(uid, areaId, { folio, ...extra, estatus }));
  for (const n of nominas) b.set(doc(db, 'tiempoExtra', folio, 'empleados', n), { nombre: `Empleado ${n}`, puesto: 'X', horas: 2 });
  const h = historial(db, folio, { uid, accion: 'creada' });
  b.set(h.ref, h.data);
  return b.commit();
}

/** Transición: cambios al padre + entrada de historial en el mismo lote */
function transicion(uid, folio, cambios, accion, nivel) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  b.update(doc(db, 'tiempoExtra', folio), { fechaActualizacion: ts(), ...cambios });
  const h = historial(db, folio, { uid, accion, nivel });
  b.set(h.ref, h.data);
  return b.commit();
}

const actualizar = (uid, folio, cambios) =>
  updateDoc(doc(dbDe(uid), 'tiempoExtra', folio), { fechaActualizacion: ts(), ...cambios });

/** Las transiciones cambian el estatus: cada intento exitoso necesita la solicitud recién sembrada */
async function reiniciar() {
  await env.clearFirestore();
  await sembrar();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-solicitud-rutas-te',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await sembrar();
});

describe('estructura anterior (areasTE, config, accesosTE)', () => {
  it('ya no tiene reglas: nadie la lee ni la escribe, ni siquiera el admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'areasTE', 'produccion'), { nombre: 'Producción' });
      await setDoc(doc(ctx.firestore(), 'config', 'tiempoExtra'), { autorizador2Nomina: N.aut2 });
      await setDoc(doc(ctx.firestore(), 'accesosTE', 'a1'), { nomina: '1' });
    });
    for (const uid of ['solP', 'aut2', 'rh', 'admin']) {
      const db = dbDe(uid);
      await assertFails(getDoc(doc(db, 'areasTE', 'produccion')));
      await assertFails(setDoc(doc(db, 'areasTE', 'x'), { nombre: 'X' }));
      await assertFails(getDoc(doc(db, 'config', 'tiempoExtra')));
      await assertFails(setDoc(doc(db, 'config', 'areasTE'), { reglas: [] }));
      await assertFails(getDoc(doc(db, 'accesosTE', 'a1')));
      await assertFails(deleteDoc(doc(db, 'accesosTE', 'a1')));
    }
  });
});

describe('padrón con areaId', () => {
  it('lo leen admin, RH y la Aut. 2 completo; el solicitante y el Aut. 1 solo los empleados de sus áreas', async () => {
    for (const uid of ['admin', 'rh', 'aut2', 'aut2Sup']) {
      await assertSucceeds(getDoc(doc(dbDe(uid), 'empleados', '600')));
      await assertSucceeds(getDoc(doc(dbDe(uid), 'empleados', '801')));
    }
    // Producción: su solicitante y su Aut. 1 leen al empleado 600 (de Producción) y no al 801 (Calidad)
    for (const uid of ['solP', 'aut1P']) {
      await assertSucceeds(getDoc(doc(dbDe(uid), 'empleados', '600')));
      await assertFails(getDoc(doc(dbDe(uid), 'empleados', '801')));
    }
    // De otra área o sin rol: no
    for (const uid of ['solA', 'aut1A', 'solM', 'ajeno']) await assertFails(getDoc(doc(dbDe(uid), 'empleados', '600')));
  });
  it('las consultas del solicitante y del Aut. 1 deben fijar su área; el padrón completo solo lo piden admin, RH y Aut. 2', async () => {
    const col = (uid) => collection(dbDe(uid), 'empleados');
    await assertSucceeds(getDocs(query(col('solP'), where('areaId', '==', 'produccion'))));
    await assertSucceeds(getDocs(query(col('aut1P'), where('areaId', '==', 'produccion'))));
    await assertFails(getDocs(query(col('solP'), where('areaId', '==', 'calidad'))));
    await assertFails(getDocs(col('solP')));
    await assertFails(getDocs(col('aut1P')));
    for (const uid of ['aut2', 'rh', 'admin']) await assertSucceeds(getDocs(col(uid)));
  });
  it('con varias áreas sirve where("areaId", "in", susÁreas); si una no es suya, la consulta completa se rechaza', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'asignaciones', idAsig(N.solP, 'solicitante', 'almacen')), asig(N.solP, 'solicitante', 'almacen'));
    });
    const col = collection(dbDe('solP'), 'empleados');
    await assertSucceeds(getDocs(query(col, where('areaId', '==', 'produccion'))));
    await assertSucceeds(getDocs(query(col, where('areaId', '==', 'almacen'))));
    await assertSucceeds(getDocs(query(col, where('areaId', 'in', ['produccion', 'almacen']))));
    await assertFails(getDocs(query(col, where('areaId', 'in', ['produccion', 'almacen', 'calidad']))));
  });
});

describe('módulo de rutas: solicitante vigente de un área', () => {
  const solicitud = (uid, extra = {}) => ({ creadoPor: uid, estatus: 'pendiente', fechaServicio: '2026-11-10', ...extra });

  it('un solicitante vigente NO crea transporte suelto (con o sin areaId); lo piden dentro del tiempo extra', async () => {
    await assertFails(setDoc(doc(dbDe('solP'), 'solicitudes', 'nueva'), solicitud('solP', { areaId: 'produccion' })));
    await assertFails(setDoc(doc(dbDe('solP'), 'solicitudes', 'sin-area'), solicitud('solP')));
    await assertFails(setDoc(doc(dbDe('aut1P'), 'solicitudes', 'aut1'), solicitud('aut1P', { areaId: 'produccion' })));
  });
  it('un Aut. 1 o una Aut. 2 sin ser solicitantes no crean ni leen solicitudes de rutas', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitudes', 'sol-x'), { creadoPor: 'aut2', estatus: 'pendiente' });
    });
    for (const uid of ['aut2', 'aut1P', 'ajeno']) {
      await assertFails(setDoc(doc(dbDe(uid), 'solicitudes', 'nueva'), solicitud(uid, { areaId: 'produccion' })));
    }
    await assertFails(getDoc(doc(dbDe('aut1P'), 'solicitudes', 'sol-x')));
  });
  it('RH y admin crean con o sin área', async () => {
    await assertSucceeds(setDoc(doc(dbDe('rh'), 'solicitudes', 'rh-1'), solicitud('rh')));
    await assertSucceeds(setDoc(doc(dbDe('admin'), 'solicitudes', 'ad-1'), solicitud('admin', { areaId: 'produccion' })));
  });
  it('una solicitud anterior (sin areaId) sigue funcionando para su dueño', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitudes', 'vieja'), { creadoPor: 'ajeno', estatus: 'pendiente', fechaServicio: '2026-11-10' });
    });
    await assertSucceeds(getDoc(doc(dbDe('ajeno'), 'solicitudes', 'vieja')));
    await assertSucceeds(updateDoc(doc(dbDe('ajeno'), 'solicitudes', 'vieja'), { estatus: 'cancelada', historial: [] }));
  });
  it('si su rol de solicitante vence, edita nada pero sigue leyendo lo suyo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitudes', 'sol-p'), { creadoPor: 'solP', estatus: 'pendiente', areaId: 'produccion', fechaServicio: '2026-11-10' });
      await updateDoc(doc(ctx.firestore(), 'asignaciones', idAsig(N.solP, 'solicitante', 'produccion')), { hasta: Timestamp.fromDate(new Date(Date.now() - 1000)) });
    });
    await assertSucceeds(getDoc(doc(dbDe('solP'), 'solicitudes', 'sol-p')));
    await assertFails(updateDoc(doc(dbDe('solP'), 'solicitudes', 'sol-p'), { estatus: 'cancelada', historial: [] }));
  });
});

describe('contador del folio', () => {
  it('se incrementa solo de uno en uno', async () => {
    const ref = doc(dbDe('solP'), 'contadores', 'te-2026');
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { ultimo: 20 }));
    await assertFails(updateDoc(ref, { ultimo: 12 }));
    await assertFails(updateDoc(ref, { ultimo: 11 }));
    await assertSucceeds(updateDoc(ref, { ultimo: 13 }));
  });
  it('se crea con 1 y solo con el formato te-AAAA', async () => {
    const db = dbDe('solP');
    await assertSucceeds(setDoc(doc(db, 'contadores', 'te-2027'), { ultimo: 1 }));
    await assertFails(setDoc(doc(db, 'contadores', 'te-2028'), { ultimo: 5 }));
    await assertFails(setDoc(doc(db, 'contadores', 'otro'), { ultimo: 1 }));
  });
  it('un usuario inactivo no lo toca', async () => {
    await assertFails(updateDoc(doc(dbDe('inactivo'), 'contadores', 'te-2026'), { ultimo: 13 }));
  });
});

describe('capturar (crear)', () => {
  it('un solicitante del área captura: solicitud + empleados + historial en un lote', async () => {
    await assertSucceeds(capturar('solP', 'produccion'));
  });

  it('un lote con varios empleados cabe en el límite de lecturas de las reglas', async () => {
    await assertSucceeds(capturar('solP', 'produccion', { empleados: LOTE_MAXIMO }));
  });

  it('con un empleado más que el máximo medido, el lote supera el límite (hay que partirlo)', async () => {
    await assertFails(capturar('solP', 'produccion', { empleados: LOTE_MAXIMO + 1 }));
  });

  it('un solicitante de Producción no incluye a un empleado de Calidad ni de otra área', async () => {
    await assertFails(capturarCon('solP', 'produccion', ['801']));
    await assertFails(capturarCon('solP', 'produccion', ['700', '801'])); // basta uno ajeno
    await assertFails(capturarCon('solP', 'produccion', ['802']));
    await assertFails(capturarCon('solP', 'produccion', ['999'])); // ni uno que no está en el padrón
    await assertSucceeds(capturarCon('solP', 'produccion', ['600', '700']));
  });

  it('RH crea un TE de Administrativo (área sin participaTE): va directo a pendiente_aut2', async () => {
    await assertSucceeds(capturarCon('rh', 'administrativo', ['802'], { estatus: 'pendiente_aut2' }));
    await assertFails(capturarCon('rh', 'administrativo', ['802'], { estatus: 'pendiente_aut1' }));
    await assertFails(capturarCon('rh', 'administrativo', ['700'], { estatus: 'pendiente_aut2' })); // empleado de Producción
  });

  it('una Aut. 2 también captura en Administrativo; un solicitante, un Aut. 1 o un ajeno no', async () => {
    await assertSucceeds(capturarCon('aut2', 'administrativo', ['802'], { estatus: 'pendiente_aut2' }));
    for (const uid of ['solP', 'aut1P', 'solM', 'ajeno']) {
      await assertFails(capturarCon(uid, 'administrativo', ['802'], { estatus: 'pendiente_aut2' }));
    }
  });

  it('RH y la Aut. 2 no capturan en un área que sí participa (solo sus solicitantes)', async () => {
    await assertFails(capturar('rh', 'produccion', { extra: { estatus: 'pendiente_aut1' } }));
    await assertFails(capturar('aut2', 'produccion', { extra: { estatus: 'pendiente_aut2' } }));
  });

  it('quien es solicitante y Aut. 1 de esa área entra directo a pendiente_aut2', async () => {
    await assertSucceeds(capturarCon('aut1M', 'moldes', ['810'], { estatus: 'pendiente_aut2' }, true));
  });

  it('el Aut. 1 no puede capturar como pendiente_aut1, ni otro como pendiente_aut2', async () => {
    await assertFails(capturarCon('aut1M', 'moldes', ['810'], { estatus: 'pendiente_aut1' }, true));
    await assertFails(capturar('solP', 'produccion', { extra: { estatus: 'pendiente_aut2' } }));
  });

  it('no se crea con estatus autorizada ni con firmas ya puestas', async () => {
    await assertFails(capturar('solP', 'produccion', { extra: { estatus: 'autorizada' } }));
    await assertFails(capturar('solP', 'produccion', { extra: { aut1: firma(N.solP) } }));
    await assertFails(capturar('solP', 'produccion', { extra: { aut2: firma(N.solP) } }));
    await assertFails(capturar('solP', 'produccion', { extra: { devolucion: devolucion(1, N.solP) } }));
  });

  it('solo en un área donde su nómina es solicitante', async () => {
    await assertFails(capturar('solP', 'almacen'));
    await assertFails(capturar('solA', 'produccion'));
    await assertFails(capturar('ajeno', 'produccion'));
    await assertFails(capturar('aut1P', 'produccion')); // es Aut. 1 pero no está en solicitantes
    await assertFails(capturar('aut2', 'produccion'));
  });

  it('un área inexistente no sirve', async () => {
    await assertFails(capturar('solP', 'fantasma'));
  });

  it('a nombre de otro no; con nómina ajena no', async () => {
    await assertFails(capturar('solP', 'produccion', { extra: { creadoPor: 'solP2' } }));
    await assertFails(capturar('solP', 'produccion', { extra: { creadoPorNomina: N.solP2 } }));
  });

  it('el folio debe ser el id del documento y tener el formato TE-AAAA-NNNN', async () => {
    const db = dbDe('solP');
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'otro-id'), nuevo('solP', 'produccion')));
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'folio-malo'), nuevo('solP', 'produccion', { folio: 'folio-malo' })));
  });

  it('fechaCreacion y fechaActualizacion deben ser la hora del servidor', async () => {
    const db = dbDe('solP');
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'TE-2026-0013'), nuevo('solP', 'produccion', { fechaCreacion: Timestamp.fromDate(new Date(2020, 0, 1)) })));
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'TE-2026-0013'), nuevo('solP', 'produccion', { fechaActualizacion: Timestamp.fromDate(new Date(2020, 0, 1)) })));
  });

  it('no admite campos que no son del modelo', async () => {
    await assertFails(capturar('solP', 'produccion', { extra: { esAdmin: true } }));
  });

  it('un usuario inactivo no captura, aunque tenga el rol asignado', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'asignaciones', idAsig(N.inactivo, 'solicitante', 'produccion')), asig(N.inactivo, 'solicitante', 'produccion'));
    });
    const db = dbDe('inactivo');
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'TE-2026-0013'), nuevo('inactivo', 'produccion')));
  });

  it('la bitácora "creada" solo acompaña a la creación real', async () => {
    const db = dbDe('solP');
    const h = historial(db, 'TE-2026-0001', { uid: 'solP', accion: 'creada' });
    await assertFails(setDoc(h.ref, h.data)); // la solicitud ya existe
  });
});

describe('leer', () => {
  it('el creador, el Aut. 1 y su segundo Aut. 1, las Aut. 2, RH y admin leen la solicitud', async () => {
    for (const uid of ['solP', 'aut1P', 'aut1PSup', 'aut2', 'aut2Sup', 'rh', 'admin']) {
      await assertSucceeds(getDoc(doc(dbDe(uid), 'tiempoExtra', 'TE-2026-0001')));
    }
  });

  it('otro solicitante del área, el Aut. 1 de otra área y un ajeno no la leen', async () => {
    for (const uid of ['solP2', 'aut1A', 'solA', 'aut1M', 'ajeno', 'inactivo']) {
      await assertFails(getDoc(doc(dbDe(uid), 'tiempoExtra', 'TE-2026-0001')));
    }
  });

  it('el Aut. 1 de Almacén lee la de Almacén', async () => {
    await assertSucceeds(getDoc(doc(dbDe('aut1A'), 'tiempoExtra', 'TE-2026-0008')));
    await assertFails(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-2026-0008')));
  });

  it('consultas: cada quien solo puede listar lo suyo', async () => {
    const col = (uid) => collection(dbDe(uid), 'tiempoExtra');
    await assertSucceeds(getDocs(query(col('solP'), where('creadoPor', '==', 'solP'))));
    await assertSucceeds(getDocs(query(col('aut1P'), where('areaId', '==', 'produccion'), where('estatus', '==', 'pendiente_aut1'))));
    await assertFails(getDocs(query(col('aut1PSup'), where('areaId', '==', 'produccion')))); // podría traer borradores ajenos
    await assertSucceeds(getDocs(query(col('aut1PSup'), where('areaId', '==', 'produccion'), where('estatus', '!=', 'borrador'))));
    await assertSucceeds(getDocs(query(col('aut2'), where('estatus', '==', 'pendiente_aut2'))));
    await assertSucceeds(getDocs(query(col('aut2Sup'), where('estatus', '==', 'pendiente_aut2'))));
    await assertSucceeds(getDocs(query(col('rh'), where('estatus', '==', 'autorizada'))));
    await assertFails(getDocs(query(col('solP'), where('creadoPor', '==', 'solP2'))));
    await assertFails(getDocs(query(col('aut1A'), where('areaId', '==', 'produccion'))));
    await assertFails(getDocs(query(col('ajeno'), where('estatus', '==', 'pendiente_aut2'))));
    await assertFails(getDocs(col('aut1P'))); // sin filtro
  });
});

describe('Aut. 1: pendiente_aut1 → pendiente_aut2 o devuelta', () => {
  it('el Aut. 1 autoriza (con su historial)', async () => {
    await assertSucceeds(transicion('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }, 'autorizada_1', 1));
  });

  it('otro Aut. 1 vigente del área también autoriza, y queda registrado quién fue', async () => {
    await assertFails(actualizar('aut1PSup', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) })); // firma a nombre de otro
    await assertSucceeds(actualizar('aut1PSup', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1PSup) }));
  });

  it('la firma debe ser de quien autoriza y con la hora del servidor', async () => {
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1PSup) }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P, { fecha: Timestamp.fromDate(new Date(2020, 0, 1)) }) }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2' })); // sin firma
  });

  it('el Aut. 1 de otra área, el solicitante y el Aut. 2 no autorizan en nivel 1', async () => {
    for (const uid of ['aut1A', 'solP', 'solP2', 'aut2', 'aut2Sup', 'ajeno', 'rh', 'admin']) {
      await assertFails(actualizar(uid, 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N[uid]) }));
    }
  });

  it('nadie autoriza lo que creó (aunque sea Aut. 1 del área)', async () => {
    await assertFails(actualizar('aut1PSup', 'TE-2026-0005', { estatus: 'pendiente_aut2', aut1: firma(N.aut1PSup) }));
    await assertFails(actualizar('aut1PSup', 'TE-2026-0005', { estatus: 'devuelta', devolucion: devolucion(1, N.aut1PSup) }));
  });

  it('no puede saltarse la Aut. 2 ni cambiar otros campos al firmar', async () => {
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'autorizada', aut1: firma(N.aut1P), aut2: firma(N.aut1P) }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P), motivo: 'otro' }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P), creadoPor: 'aut1P' }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P), resumen: { totalHoras: 1 } }));
  });

  it('solo desde pendiente_aut1', async () => {
    await assertFails(actualizar('aut1P', 'TE-2026-0002', { estatus: 'devuelta', devolucion: devolucion(1, N.aut1P) }));
    await assertFails(actualizar('aut1P', 'TE-2026-0003', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
  });

  it('devuelve con motivo; sin motivo o con nivel equivocado no', async () => {
    await assertSucceeds(transicion('aut1P', 'TE-2026-0001', { estatus: 'devuelta', devolucion: devolucion(1, N.aut1P, 'Faltan horas') }, 'devuelta', 1));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'devuelta', devolucion: devolucion(1, N.aut1P, '') }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'devuelta', devolucion: devolucion(1, N.aut1P, '   ') }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'devuelta', devolucion: devolucion(2, N.aut1P) }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'devuelta', devolucion: devolucion(1, N.aut1PSup) }));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'devuelta' }));
  });

  it('el Aut. 1 no puede cancelar ni procesar', async () => {
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'cancelada' }));
    await assertFails(actualizar('aut1P', 'TE-2026-0003', { estatus: 'procesada' }));
  });
});

describe('Aut. 2: pendiente_aut2 → autorizada o devuelta', () => {
  it('las Aut. 2 vigentes y RH autorizan', async () => {
    await assertSucceeds(transicion('aut2', 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N.aut2) }, 'autorizada_2', 2));
    for (const uid of ['aut2Sup', 'rh', 'admin']) {
      await reiniciar();
      await assertSucceeds(actualizar(uid, 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N[uid]) }));
    }
  });

  it('no autorizan en nivel 2: Aut. 1, solicitante, ajeno', async () => {
    for (const uid of ['aut1P', 'aut1PSup', 'solP', 'solP2', 'aut1A', 'ajeno', 'inactivo']) {
      await assertFails(actualizar(uid, 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N[uid]) }));
    }
  });

  it('nadie autoriza lo que creó: ni la Aut. 2 ni RH', async () => {
    await assertFails(actualizar('aut2', 'TE-2026-0006', { estatus: 'autorizada', aut2: firma(N.aut2) }));
    await assertFails(actualizar('aut2', 'TE-2026-0006', { estatus: 'devuelta', devolucion: devolucion(2, N.aut2) }));
    await assertFails(actualizar('rh', 'TE-2026-0007', { estatus: 'autorizada', aut2: firma(N.rh) }));
    // pero otro RH o la Aut. 2 sí pueden firmar la de RH
    await assertSucceeds(actualizar('rh2', 'TE-2026-0007', { estatus: 'autorizada', aut2: firma(N.rh2) }));
    await reiniciar();
    await assertSucceeds(actualizar('aut2', 'TE-2026-0007', { estatus: 'autorizada', aut2: firma(N.aut2) }));
  });

  it('la firma debe ser de quien autoriza', async () => {
    await assertFails(actualizar('aut2Sup', 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N.aut2) }));
    await assertFails(actualizar('aut2', 'TE-2026-0002', { estatus: 'autorizada' }));
  });

  it('RH no firma el nivel 1 (solo el 2)', async () => {
    await assertFails(actualizar('rh', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.rh) }));
    await assertFails(actualizar('rh', 'TE-2026-0001', { estatus: 'autorizada', aut2: firma(N.rh) }));
    await assertFails(actualizar('aut2', 'TE-2026-0001', { estatus: 'autorizada', aut2: firma(N.aut2) }));
  });

  it('si la Aut. 2 ya está firmada, RH solo consulta y descarga', async () => {
    const db = dbDe('rh');
    await assertSucceeds(getDoc(doc(db, 'tiempoExtra', 'TE-2026-0003')));
    await assertFails(actualizar('rh', 'TE-2026-0003', { estatus: 'devuelta', devolucion: devolucion(2, N.rh) }));
    await assertFails(actualizar('rh', 'TE-2026-0003', { aut2: firma(N.rh) }));
    await assertFails(actualizar('aut2', 'TE-2026-0003', { estatus: 'devuelta', devolucion: devolucion(2, N.aut2) }));
  });

  it('devuelve con motivo y nivel 2', async () => {
    await assertSucceeds(transicion('aut2', 'TE-2026-0002', { estatus: 'devuelta', devolucion: devolucion(2, N.aut2, 'Horas excesivas') }, 'devuelta', 2));
    await assertFails(actualizar('aut2', 'TE-2026-0002', { estatus: 'devuelta', devolucion: devolucion(1, N.aut2) }));
    await assertFails(actualizar('aut2', 'TE-2026-0002', { estatus: 'devuelta', devolucion: devolucion(2, N.aut2, '') }));
    await reiniciar();
    await assertSucceeds(actualizar('rh', 'TE-2026-0002', { estatus: 'devuelta', devolucion: devolucion(2, N.rh) }));
  });

  it('solo desde pendiente_aut2', async () => {
    await assertFails(actualizar('aut2', 'TE-2026-0004', { estatus: 'autorizada', aut2: firma(N.aut2) }));
    await assertFails(actualizar('aut2', 'TE-2026-0011', { estatus: 'autorizada', aut2: firma(N.aut2) }));
  });

  it('no puede cambiar otros campos al firmar', async () => {
    await assertFails(actualizar('aut2', 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N.aut2), motivo: 'otro' }));
    await assertFails(actualizar('aut2', 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N.aut2), aut1: firma(N.aut2) }));
  });
});

describe('RH recibe: autorizada → procesada', () => {
  it('RH y admin procesan una autorizada', async () => {
    await assertSucceeds(transicion('rh', 'TE-2026-0003', { estatus: 'procesada', solicitudRutaId: 'sol-123' }, 'recibida_rh'));
    await reiniciar();
    await assertSucceeds(actualizar('admin', 'TE-2026-0003', { estatus: 'procesada' }));
  });
  it('la Aut. 2 no titular-RH, el Aut. 1 y el solicitante no procesan', async () => {
    for (const uid of ['aut2', 'aut2Sup', 'aut1P', 'solP', 'ajeno']) {
      await assertFails(actualizar(uid, 'TE-2026-0003', { estatus: 'procesada' }));
    }
  });
  it('solo desde autorizada, y sin tocar otros campos', async () => {
    await assertFails(actualizar('rh', 'TE-2026-0002', { estatus: 'procesada' }));
    await assertFails(actualizar('rh', 'TE-2026-0001', { estatus: 'procesada' }));
    await assertFails(actualizar('rh', 'TE-2026-0003', { estatus: 'procesada', motivo: 'otro' }));
  });
});

describe('creador: cancelar, corregir y reenviar', () => {
  it('cancela mientras no esté autorizada', async () => {
    await assertSucceeds(transicion('solP', 'TE-2026-0001', { estatus: 'cancelada' }, 'cancelada'));
    await assertSucceeds(actualizar('solP', 'TE-2026-0002', { estatus: 'cancelada' }));
    await assertSucceeds(actualizar('solP', 'TE-2026-0004', { estatus: 'cancelada' }));
  });
  it('no cancela una autorizada, procesada o ya cancelada', async () => {
    await assertFails(actualizar('solP', 'TE-2026-0003', { estatus: 'cancelada' }));
    await assertFails(actualizar('solP', 'TE-2026-0011', { estatus: 'cancelada' }));
  });
  it('otro solicitante, el Aut. 1 y la Aut. 2 no cancelan lo ajeno', async () => {
    for (const uid of ['solP2', 'aut1P', 'aut2', 'rh', 'ajeno']) {
      await assertFails(actualizar(uid, 'TE-2026-0001', { estatus: 'cancelada' }));
    }
  });
  it('al cancelar no se tocan otros campos', async () => {
    await assertFails(actualizar('solP', 'TE-2026-0001', { estatus: 'cancelada', motivo: 'x' }));
  });

  it('corrige el contenido solo en estatus devuelta', async () => {
    await assertSucceeds(actualizar('solP', 'TE-2026-0004', { motivo: 'Corregido', fechaTE: '2026-11-09', resumen: { totalEmpleados: 3, totalHoras: 6, totalTransporte: 0, totalAlimentos: 3 } }));
    for (const folio of ['TE-2026-0001', 'TE-2026-0002', 'TE-2026-0003']) {
      await assertFails(actualizar('solP', folio, { motivo: 'Corregido' }));
    }
  });
  it('nadie más edita el contenido, ni siquiera los autorizadores', async () => {
    for (const uid of ['solP2', 'aut1P', 'aut2', 'rh', 'admin']) {
      await assertFails(actualizar(uid, 'TE-2026-0004', { motivo: 'Cambiado' }));
    }
  });
  it('la corrección no cambia área, creador ni folio', async () => {
    await assertFails(actualizar('solP', 'TE-2026-0004', { areaId: 'almacen' }));
    await assertFails(actualizar('solP', 'TE-2026-0004', { creadoPor: 'solP2' }));
    await assertFails(actualizar('solP', 'TE-2026-0004', { folio: 'TE-2026-9999' }));
  });

  it('reenvía a pendiente_aut1 y vuelve a empezar (con la bitácora)', async () => {
    await assertSucceeds(transicion('solP', 'TE-2026-0004', { estatus: 'pendiente_aut1' }, 'reenviada'));
  });
  it('al reenviar deben quitarse las firmas anteriores', async () => {
    await assertFails(actualizar('solP', 'TE-2026-0010', { estatus: 'pendiente_aut1' })); // trae aut1 de antes
    await assertSucceeds(actualizar('solP', 'TE-2026-0010', { estatus: 'pendiente_aut1', aut1: deleteField(), aut2: deleteField() }));
  });
  it('no reenvía a pendiente_aut2, a autorizada ni salta niveles (salvo el Aut. 1 del área)', async () => {
    await assertFails(actualizar('solP', 'TE-2026-0004', { estatus: 'pendiente_aut2' }));
    await assertFails(actualizar('solP', 'TE-2026-0004', { estatus: 'autorizada' }));
  });
  it('el Aut. 1 del área reenvía directo a pendiente_aut2, y no a pendiente_aut1', async () => {
    await assertSucceeds(actualizar('aut1M', 'TE-2026-0009', { estatus: 'pendiente_aut2', aut1: deleteField() }));
    await assertFails(actualizar('aut1M', 'TE-2026-0009', { estatus: 'pendiente_aut1', aut1: deleteField() }));
  });
  it('solo el creador reenvía y solo si sigue siendo solicitante del área', async () => {
    await assertFails(actualizar('solP2', 'TE-2026-0004', { estatus: 'pendiente_aut1' }));
    await assertFails(actualizar('aut1P', 'TE-2026-0004', { estatus: 'pendiente_aut1' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'asignaciones', idAsig(N.solP, 'solicitante', 'produccion')), { activo: false });
    });
    await assertFails(actualizar('solP', 'TE-2026-0004', { estatus: 'pendiente_aut1' }));
  });

  it('nadie borra solicitudes salvo el admin', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2', 'rh']) await assertFails(deleteDoc(doc(dbDe(uid), 'tiempoExtra', 'TE-2026-0001')));
    await assertSucceeds(deleteDoc(doc(dbDe('admin'), 'tiempoExtra', 'TE-2026-0001')));
  });

  it('el estatus no se cambia a un valor arbitrario', async () => {
    await assertFails(actualizar('solP', 'TE-2026-0001', { estatus: 'autorizada' }));
    await assertFails(actualizar('solP', 'TE-2026-0001', { estatus: 'procesada' }));
    await assertFails(actualizar('solP', 'TE-2026-0001', { estatus: 'devuelta' }));
  });
});

describe('subcolección empleados', () => {
  const emp = (folio, id = '800') => ['tiempoExtra', folio, 'empleados', id];

  it('el creador agrega y quita empleados mientras la solicitud está devuelta', async () => {
    const db = dbDe('solP');
    await assertSucceeds(setDoc(doc(db, ...emp('TE-2026-0004')), { nombre: 'Nuevo', puesto: 'OPERADOR', horas: 3 }));
    await assertSucceeds(updateDoc(doc(db, ...emp('TE-2026-0004', '600')), { horas: 4 }));
    await assertSucceeds(deleteDoc(doc(db, ...emp('TE-2026-0004', '600'))));
  });

  it('puede corregir empleados y reenviar en el mismo lote', async () => {
    const db = dbDe('solP');
    const b = writeBatch(db);
    b.set(doc(db, ...emp('TE-2026-0004')), { nombre: 'Nuevo', puesto: 'OPERADOR', horas: 3 });
    b.update(doc(db, 'tiempoExtra', 'TE-2026-0004'), { estatus: 'pendiente_aut1', fechaActualizacion: ts() });
    await assertSucceeds(b.commit());
  });

  it('no los modifica fuera de devuelta (pendiente, autorizada, cancelada)', async () => {
    const db = dbDe('solP');
    for (const folio of ['TE-2026-0001', 'TE-2026-0002', 'TE-2026-0003', 'TE-2026-0011']) {
      await assertFails(setDoc(doc(db, ...emp(folio)), { nombre: 'Nuevo' }));
    }
    await assertFails(deleteDoc(doc(db, ...emp('TE-2026-0001', '600'))));
    await assertFails(updateDoc(doc(db, ...emp('TE-2026-0001', '600')), { horas: 9 }));
  });

  it('los autorizadores y RH no tocan los empleados (en ningún estatus)', async () => {
    for (const uid of ['aut1P', 'aut1PSup', 'aut2', 'aut2Sup', 'rh', 'admin', 'solP2']) {
      const db = dbDe(uid);
      await assertFails(setDoc(doc(db, ...emp('TE-2026-0001')), { nombre: 'Nuevo' }));
      await assertFails(setDoc(doc(db, ...emp('TE-2026-0004')), { nombre: 'Nuevo' }));
      await assertFails(updateDoc(doc(db, ...emp('TE-2026-0001', '600')), { horas: 9 }));
      await assertFails(deleteDoc(doc(db, ...emp('TE-2026-0001', '600'))));
    }
  });

  it('no se escriben empleados bajo un folio que no se está creando', async () => {
    await assertFails(setDoc(doc(dbDe('solP'), ...emp('TE-2026-0099')), { nombre: 'Huérfano' }));
  });

  it('los leen el creador, el Aut. 1, la Aut. 2 y RH; no un ajeno', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2', 'aut2Sup', 'rh']) {
      await assertSucceeds(getDoc(doc(dbDe(uid), ...emp('TE-2026-0001', '600'))));
      await assertSucceeds(getDocs(collection(dbDe(uid), 'tiempoExtra', 'TE-2026-0001', 'empleados')));
    }
    for (const uid of ['solP2', 'aut1A', 'ajeno']) await assertFails(getDoc(doc(dbDe(uid), ...emp('TE-2026-0001', '600'))));
  });
});

describe('historial', () => {
  it('nunca se edita ni se borra', async () => {
    const ref = doc(dbDe('solP'), 'tiempoExtra', 'TE-2026-0002', 'historial', 'h1');
    await assertFails(updateDoc(ref, { comentario: 'editado' }));
    await assertFails(deleteDoc(ref));
    await assertFails(deleteDoc(doc(dbDe('admin'), 'tiempoExtra', 'TE-2026-0002', 'historial', 'h1')));
    await assertFails(updateDoc(doc(dbDe('admin'), 'tiempoExtra', 'TE-2026-0002', 'historial', 'h1'), { comentario: 'x' }));
  });

  it('solo con porUid == uid, su nómina y la hora del servidor', async () => {
    const db = dbDe('aut1P');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'TE-2026-0001'), { estatus: 'pendiente_aut2', aut1: firma(N.aut1P), fechaActualizacion: ts() });
    const h = historial(db, 'TE-2026-0001', { uid: 'aut1P', accion: 'autorizada_1', nivel: 1 });
    b.set(h.ref, { ...h.data, porUid: 'solP' });
    await assertFails(b.commit());

    const b2 = writeBatch(db);
    b2.update(doc(db, 'tiempoExtra', 'TE-2026-0001'), { estatus: 'pendiente_aut2', aut1: firma(N.aut1P), fechaActualizacion: ts() });
    b2.set(h.ref, { ...h.data, porNomina: N.solP });
    await assertFails(b2.commit());

    const b3 = writeBatch(db);
    b3.update(doc(db, 'tiempoExtra', 'TE-2026-0001'), { estatus: 'pendiente_aut2', aut1: firma(N.aut1P), fechaActualizacion: ts() });
    b3.set(h.ref, { ...h.data, fecha: Timestamp.fromDate(new Date(2020, 0, 1)) });
    await assertFails(b3.commit());
  });

  it('no se puede crear una entrada suelta (sin la transición real en el mismo lote)', async () => {
    for (const [uid, folio, accion, nivel] of [
      ['aut1P', 'TE-2026-0002', 'autorizada_1', 1],
      ['aut2', 'TE-2026-0002', 'autorizada_2', 2],
      ['aut2', 'TE-2026-0002', 'devuelta', 2],
      ['rh', 'TE-2026-0003', 'recibida_rh', 0],
      ['solP', 'TE-2026-0001', 'cancelada', 0],
      ['solP', 'TE-2026-0004', 'reenviada', 0],
    ]) {
      const h = historial(dbDe(uid), folio, { uid, accion, nivel });
      await assertFails(setDoc(h.ref, h.data));
    }
  });

  it('cada acción la hace quien tiene ese rol', async () => {
    // un solicitante no puede dejar constancia de que el Aut. 1 autorizó
    const db = dbDe('solP');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'TE-2026-0001'), { estatus: 'cancelada', fechaActualizacion: ts() });
    const h = historial(db, 'TE-2026-0001', { uid: 'solP', accion: 'autorizada_1', nivel: 1 });
    b.set(h.ref, h.data);
    await assertFails(b.commit());
  });

  it('la acción no corresponde al cambio de estatus: no vale', async () => {
    const db = dbDe('aut1P');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'TE-2026-0001'), { estatus: 'devuelta', devolucion: devolucion(1, N.aut1P), fechaActualizacion: ts() });
    const h = historial(db, 'TE-2026-0001', { uid: 'aut1P', accion: 'autorizada_1', nivel: 1 });
    b.set(h.ref, h.data);
    await assertFails(b.commit());
  });

  it('la leen quienes pueden leer la solicitud, no un ajeno', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2', 'rh']) await assertSucceeds(getDoc(doc(dbDe(uid), 'tiempoExtra', 'TE-2026-0002', 'historial', 'h1')));
    for (const uid of ['solP2', 'aut1A', 'ajeno']) await assertFails(getDoc(doc(dbDe(uid), 'tiempoExtra', 'TE-2026-0002', 'historial', 'h1')));
  });
});

describe('vigencia de las asignaciones en tiempo extra', () => {
  const cambiar = (nomina, rol, area, cambios) => env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'asignaciones', idAsig(nomina, rol, area)), cambios);
  });
  const manana = () => Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000));
  const hace = (ms) => Timestamp.fromDate(new Date(Date.now() - ms));

  it('un Aut. 1 con asignación vigente (con fecha final futura) autoriza', async () => {
    await cambiar(N.aut1P, 'aut1', 'produccion', { hasta: manana() });
    await assertSucceeds(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
  });
  it('programada (desde en el futuro): no autoriza ni lee', async () => {
    await cambiar(N.aut1P, 'aut1', 'produccion', { desde: manana() });
    await assertFails(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-2026-0001')));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
  });
  it('vencida (hasta ya pasó): no autoriza ni lee', async () => {
    await cambiar(N.aut1P, 'aut1', 'produccion', { hasta: hace(1000) });
    await assertFails(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-2026-0001')));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
  });
  it('revocada (activo false): no autoriza ni lee', async () => {
    await cambiar(N.aut1P, 'aut1', 'produccion', { activo: false });
    await assertFails(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-2026-0001')));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
  });
  it('una Aut. 2 vencida o revocada deja de firmar y de leer', async () => {
    await cambiar(N.aut2, 'aut2', null, { hasta: hace(1000) });
    await cambiar(N.aut2Sup, 'aut2', null, { activo: false });
    for (const uid of ['aut2', 'aut2Sup']) {
      await assertFails(actualizar(uid, 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N[uid]) }));
      await assertFails(getDoc(doc(dbDe(uid), 'tiempoExtra', 'TE-2026-0002')));
    }
  });
  it('un Aut. 1 de Moldes no autoriza en Producción aunque esté vigente en Moldes', async () => {
    await assertFails(actualizar('aut1M', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1M) }));
  });
  it('un solicitante vencido no captura', async () => {
    await cambiar(N.solP, 'solicitante', 'produccion', { hasta: hace(1000) });
    await assertFails(capturar('solP', 'produccion'));
  });
});

describe('borrador: se arma en lotes y se envía a autorización', () => {
  const FOLIO = 'TE-2026-0013';
  const crearBorrador = (uid, areaId, extra = {}) => {
    const db = dbDe(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'tiempoExtra', FOLIO), nuevo(uid, areaId, { folio: FOLIO, estatus: 'borrador', ...extra }));
    const h = historial(db, FOLIO, { uid, accion: 'creada' });
    b.set(h.ref, h.data);
    return b.commit();
  };
  /** Agrega empleados (nóminas del padrón) a un borrador ya creado, en un lote */
  const agregar = (uid, nominas, cambiosPadre = null) => {
    const db = dbDe(uid);
    const b = writeBatch(db);
    for (const n of nominas) b.set(doc(db, 'tiempoExtra', FOLIO, 'empleados', n), { nombre: `Empleado ${n}`, puesto: 'X', horas: 2 });
    if (cambiosPadre) b.update(doc(db, 'tiempoExtra', FOLIO), { fechaActualizacion: ts(), ...cambiosPadre });
    return b;
  };
  const nominas = (desde, n) => Array.from({ length: n }, (_, i) => String(desde + i));

  it('el solicitante del área crea el borrador; sin empleados y con bitácora', async () => {
    await assertSucceeds(crearBorrador('solP', 'produccion'));
  });
  it('no lo crea quien no puede capturar en esa área', async () => {
    await assertFails(crearBorrador('solA', 'produccion'));
    await assertFails(crearBorrador('aut1P', 'produccion'));
    await assertFails(crearBorrador('rh', 'produccion'));
  });
  it('no se crea con firmas ni con estatus raro', async () => {
    await assertFails(crearBorrador('solP', 'produccion', { aut1: firma(N.solP) }));
    await assertFails(crearBorrador('solP', 'produccion', { estatus: 'autorizada' }));
  });

  it('solo el creador lo ve: ni el Aut. 1, ni la Aut. 2, ni RH, ni admin', async () => {
    await crearBorrador('solP', 'produccion');
    await assertSucceeds(getDoc(doc(dbDe('solP'), 'tiempoExtra', FOLIO)));
    for (const uid of ['aut1P', 'aut1PSup', 'aut2', 'rh', 'admin', 'solP2', 'ajeno']) {
      await assertFails(getDoc(doc(dbDe(uid), 'tiempoExtra', FOLIO)));
    }
  });
  it('sus empleados e historial tampoco los ve nadie más', async () => {
    await crearBorrador('solP', 'produccion');
    await assertSucceeds(agregar('solP', ['700']).commit());
    await assertSucceeds(getDoc(doc(dbDe('solP'), 'tiempoExtra', FOLIO, 'empleados', '700')));
    for (const uid of ['aut1P', 'aut2', 'rh']) {
      await assertFails(getDoc(doc(dbDe(uid), 'tiempoExtra', FOLIO, 'empleados', '700')));
      await assertFails(getDocs(collection(dbDe(uid), 'tiempoExtra', FOLIO, 'historial')));
    }
  });
  it('las consultas de autorizadores y RH que excluyen borradores no lo traen y no fallan', async () => {
    await crearBorrador('solP', 'produccion');
    const col = (uid) => collection(dbDe(uid), 'tiempoExtra');
    await assertSucceeds(getDocs(query(col('aut1P'), where('areaId', '==', 'produccion'), where('estatus', '==', 'pendiente_aut1'))));
    await assertSucceeds(getDocs(query(col('aut2'), where('estatus', '==', 'pendiente_aut2'))));
    await assertSucceeds(getDocs(query(col('solP'), where('creadoPor', '==', 'solP'))));
  });

  it('las bandejas de consulta (Aut. 1 por área, Aut. 2 de toda la planta) usan estatus in [sin borrador]', async () => {
    await crearBorrador('solP', 'produccion');
    const visibles = ['pendiente_aut1', 'pendiente_aut2', 'autorizada', 'devuelta', 'procesada', 'cancelada'];
    const col = (uid) => collection(dbDe(uid), 'tiempoExtra');
    const aut1 = await assertSucceeds(getDocs(query(col('aut1P'), where('areaId', '==', 'produccion'), where('estatus', 'in', visibles))));
    const aut2 = await assertSucceeds(getDocs(query(col('aut2'), where('estatus', 'in', visibles))));
    if (aut1.docs.some(d => d.id === FOLIO) || aut2.docs.some(d => d.id === FOLIO)) throw new Error('el borrador no debe aparecer');
    await assertSucceeds(getDocs(query(col('rh'), where('estatus', 'in', visibles))));
    await assertFails(getDocs(query(col('aut2'), where('estatus', 'in', [...visibles, 'borrador']))));
  });
  it('se agregan empleados del área en lotes de 10 (y quitan), cada uno validado contra el padrón', async () => {
    await crearBorrador('solP', 'produccion');
    await assertSucceeds(agregar('solP', nominas(700, 10)).commit());
    await assertSucceeds(agregar('solP', nominas(710, 10)).commit());
    await assertSucceeds(agregar('solP', nominas(720, 10)).commit());
    const db = dbDe('solP');
    await assertSucceeds(deleteDoc(doc(db, 'tiempoExtra', FOLIO, 'empleados', '700')));
    await assertSucceeds(updateDoc(doc(db, 'tiempoExtra', FOLIO, 'empleados', '701'), { horas: 4 }));
  });
  it('un empleado de otra área (o inexistente) hace fallar el lote', async () => {
    await crearBorrador('solP', 'produccion');
    await assertFails(agregar('solP', ['700', '801']).commit());
    await assertFails(agregar('solP', ['700', '802']).commit());
    await assertFails(agregar('solP', ['700', '99999']).commit());
  });
  it('nadie más agrega empleados al borrador', async () => {
    await crearBorrador('solP', 'produccion');
    for (const uid of ['solP2', 'aut1P', 'aut2', 'rh', 'admin']) await assertFails(agregar(uid, ['700']).commit());
  });
  it('el creador edita el contenido del borrador; otros no; el área no cambia', async () => {
    await crearBorrador('solP', 'produccion');
    await assertSucceeds(actualizar('solP', FOLIO, { motivo: 'Cambiado', fechaTE: '2026-11-09' }));
    await assertFails(actualizar('solP', FOLIO, { areaId: 'almacen' }));
    await assertFails(actualizar('solP', FOLIO, { estatus: 'autorizada' }));
    for (const uid of ['solP2', 'aut1P', 'aut2', 'rh', 'admin']) await assertFails(actualizar(uid, FOLIO, { motivo: 'X' }));
  });

  it('"Enviar a autorización": pasa a pendiente_aut1 con el resumen calculado y su bitácora', async () => {
    await crearBorrador('solP', 'produccion');
    await assertSucceeds(agregar('solP', nominas(700, 3)).commit());
    const db = dbDe('solP');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', FOLIO), {
      estatus: 'pendiente_aut1', fechaActualizacion: ts(), resumen: { totalEmpleados: 3, totalHoras: 6, totalTransporte: 0, totalAlimentos: 3 },
    });
    const h = historial(db, FOLIO, { uid: 'solP', accion: 'enviada' });
    b.set(h.ref, h.data);
    await assertSucceeds(b.commit());
    // ya enviada: la ven el Aut. 1 y los demás
    await assertSucceeds(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', FOLIO)));
  });
  it('un último lote de empleados puede viajar junto con el envío', async () => {
    await crearBorrador('solP', 'produccion');
    await assertSucceeds(agregar('solP', nominas(700, 10), { estatus: 'pendiente_aut1' }).commit());
  });
  it('quien es Aut. 1 de su área lo envía a pendiente_aut2, no a pendiente_aut1', async () => {
    await crearBorrador('aut1M', 'moldes');
    await assertFails(actualizar('aut1M', FOLIO, { estatus: 'pendiente_aut1' }));
    await assertSucceeds(actualizar('aut1M', FOLIO, { estatus: 'pendiente_aut2' }));
  });
  it('en Administrativo, RH lo envía directo a pendiente_aut2', async () => {
    await crearBorrador('rh', 'administrativo');
    await assertSucceeds(agregar('rh', nominas(900, 10)).commit());
    await assertFails(actualizar('rh', FOLIO, { estatus: 'pendiente_aut1' }));
    await assertSucceeds(actualizar('rh', FOLIO, { estatus: 'pendiente_aut2' }));
  });
  it('no se envía a autorizada ni por otra persona; sin firmas colgadas', async () => {
    await crearBorrador('solP', 'produccion');
    await assertFails(actualizar('solP', FOLIO, { estatus: 'autorizada' }));
    await assertFails(actualizar('solP', FOLIO, { estatus: 'pendiente_aut1', aut1: firma(N.solP) }));
    for (const uid of ['solP2', 'aut1P', 'aut2', 'rh', 'admin']) await assertFails(actualizar(uid, FOLIO, { estatus: 'pendiente_aut1' }));
  });
  it('si ya no es solicitante vigente del área, no lo puede enviar', async () => {
    await crearBorrador('solP', 'produccion');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'asignaciones', idAsig(N.solP, 'solicitante', 'produccion')), { activo: false });
    });
    await assertFails(actualizar('solP', FOLIO, { estatus: 'pendiente_aut1' }));
  });
  it('el creador lo cancela (descarta) y nadie más', async () => {
    await crearBorrador('solP', 'produccion');
    for (const uid of ['solP2', 'aut1P', 'aut2', 'rh', 'admin']) await assertFails(actualizar(uid, FOLIO, { estatus: 'cancelada' }));
    const db = dbDe('solP');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', FOLIO), { estatus: 'cancelada', fechaActualizacion: ts() });
    const h = historial(db, FOLIO, { uid: 'solP', accion: 'cancelada' });
    b.set(h.ref, h.data);
    await assertSucceeds(b.commit());
  });
  it('el borrador no pasa por Aut. 1 ni Aut. 2 (no firman ni devuelven un borrador)', async () => {
    await crearBorrador('solP', 'produccion');
    await assertFails(actualizar('aut1P', FOLIO, { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
    await assertFails(actualizar('aut2', FOLIO, { estatus: 'autorizada', aut2: firma(N.aut2) }));
    await assertFails(actualizar('rh', FOLIO, { estatus: 'autorizada', aut2: firma(N.rh) }));
  });
});

describe('usuario inactivo en tiempo extra', () => {
  it('un Aut. 1 desactivado no lee ni autoriza', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'usuarios', 'aut1P'), { activo: false });
    });
    await assertFails(getDoc(doc(dbDe('aut1P'), 'tiempoExtra', 'TE-2026-0001')));
    await assertFails(actualizar('aut1P', 'TE-2026-0001', { estatus: 'pendiente_aut2', aut1: firma(N.aut1P) }));
  });
  it('una Aut. 2 y un RH desactivados tampoco', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'usuarios', 'aut2'), { activo: false });
      await updateDoc(doc(ctx.firestore(), 'usuarios', 'rh2'), { activo: false });
    });
    await assertFails(actualizar('aut2', 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N.aut2) }));
    await assertFails(actualizar('rh2', 'TE-2026-0002', { estatus: 'autorizada', aut2: firma(N.rh2) }));
    await assertFails(getDoc(doc(dbDe('rh2'), 'tiempoExtra', 'TE-2026-0002')));
  });
  it('un solicitante desactivado no cancela ni corrige', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'usuarios', 'solP'), { activo: false });
    });
    await assertFails(actualizar('solP', 'TE-2026-0001', { estatus: 'cancelada' }));
    await assertFails(actualizar('solP', 'TE-2026-0004', { motivo: 'x' }));
  });
});
