// Reglas de tiempo extra (tiempoExtra, areasTE, config, contadores, padrón) contra el emulador de Firestore.
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

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const usuarios = {
      admin: ['admin', N.admin], rh: ['rh', N.rh], rh2: ['rh', N.rh2],
      solP: ['superintendente', N.solP], solP2: ['superintendente', N.solP2],
      aut1P: ['autorizador', N.aut1P], aut1PSup: ['autorizador', N.aut1PSup],
      solA: ['superintendente', N.solA], aut1A: ['autorizador', N.aut1A],
      aut1M: ['superintendente', N.aut1M], solM: ['superintendente', N.solM],
      aut2: ['autorizador', N.aut2], aut2Sup: ['autorizador', N.aut2Sup],
      ajeno: ['superintendente', N.ajeno],
    };
    for (const [uid, [rol, nomina]] of Object.entries(usuarios)) await setDoc(doc(db, 'usuarios', uid), perfil(rol, nomina));
    await setDoc(doc(db, 'usuarios', 'inactivo'), perfil('autorizador', N.inactivo, { activo: false }));

    // Matriz
    await setDoc(doc(db, 'areasTE', 'produccion'), {
      nombre: 'Producción', activa: true, autorizador1Nomina: N.aut1P, suplente1Nomina: N.aut1PSup,
      solicitantesNominas: [N.solP, N.solP2],
    });
    await setDoc(doc(db, 'areasTE', 'almacen'), {
      nombre: 'Almacén', activa: true, autorizador1Nomina: N.aut1A, solicitantesNominas: [N.solA],
    });
    // El Aut. 1 de Moldes también está entre sus solicitantes
    await setDoc(doc(db, 'areasTE', 'moldes'), {
      nombre: 'Moldes', activa: true, autorizador1Nomina: N.aut1M, solicitantesNominas: [N.solM, N.aut1M],
    });
    await setDoc(doc(db, 'config', 'tiempoExtra'), { autorizador2Nomina: N.aut2, suplente2Nomina: N.aut2Sup });
    await setDoc(doc(db, 'config', 'areasTE'), { reglas: [{ depto: '316', area: 'produccion' }] });
    await setDoc(doc(db, 'contadores', 'te-2026'), { ultimo: 12 });

    await setDoc(doc(db, 'empleados', '600'), { nombre: 'Operador 600', nomina: '600', areaTE: 'produccion', rutaId: 'r1' });

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

describe('configuración de áreas y niveles', () => {
  it('cualquier usuario activo lee areasTE, config/tiempoExtra y config/areasTE', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2', 'ajeno']) {
      const db = dbDe(uid);
      await assertSucceeds(getDoc(doc(db, 'areasTE', 'produccion')));
      await assertSucceeds(getDoc(doc(db, 'config', 'tiempoExtra')));
      await assertSucceeds(getDoc(doc(db, 'config', 'areasTE')));
    }
  });

  it('un usuario inactivo no lee nada de la configuración', async () => {
    const db = dbDe('inactivo');
    await assertFails(getDoc(doc(db, 'areasTE', 'produccion')));
    await assertFails(getDoc(doc(db, 'config', 'tiempoExtra')));
  });

  it('solicitantes, autorizadores y aut. 2 no pueden escribir la configuración', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2', 'aut2Sup']) {
      const db = dbDe(uid);
      await assertFails(setDoc(doc(db, 'areasTE', 'produccion'), { nombre: 'X', solicitantesNominas: [N[uid]] }));
      await assertFails(updateDoc(doc(db, 'areasTE', 'produccion'), { autorizador1Nomina: N[uid] }));
      await assertFails(updateDoc(doc(db, 'config', 'tiempoExtra'), { autorizador2Nomina: N[uid] }));
      await assertFails(setDoc(doc(db, 'config', 'areasTE'), { reglas: [] }));
      await assertFails(deleteDoc(doc(db, 'areasTE', 'produccion')));
    }
  });

  it('RH y admin escriben la configuración', async () => {
    for (const uid of ['rh', 'admin']) {
      const db = dbDe(uid);
      await assertSucceeds(setDoc(doc(db, 'areasTE', 'nueva'), { nombre: 'Nueva', activa: true, autorizador1Nomina: '1', solicitantesNominas: [] }));
      await assertSucceeds(updateDoc(doc(db, 'config', 'tiempoExtra'), { suplente2Nomina: '123' }));
      await assertSucceeds(setDoc(doc(db, 'config', 'areasTE'), { reglas: [] }));
    }
  });

  it('no se puede crear otro documento de config', async () => {
    await assertFails(setDoc(doc(dbDe('rh'), 'config', 'otra'), { x: 1 }));
    await assertFails(getDoc(doc(dbDe('rh'), 'config', 'otra')));
  });
});

describe('padrón con areaTE', () => {
  it('lo lee cualquier usuario activo, incluido un autorizador', async () => {
    for (const uid of ['aut1P', 'aut2', 'solP', 'ajeno']) await assertSucceeds(getDoc(doc(dbDe(uid), 'empleados', '600')));
  });
  it('un usuario inactivo no lo lee', async () => {
    await assertFails(getDoc(doc(dbDe('inactivo'), 'empleados', '600')));
  });
  it('solo RH cambia areaTE', async () => {
    for (const uid of ['solP', 'aut1P', 'aut2']) {
      await assertFails(updateDoc(doc(dbDe(uid), 'empleados', '600'), { areaTE: 'almacen', areaTEManual: true }));
    }
    // un solicitante de rutas sigue pudiendo cambiar la ruta, pero no colar areaTE junto con ella
    await assertSucceeds(updateDoc(doc(dbDe('solP'), 'empleados', '600'), { rutaId: 'r2' }));
    await assertFails(updateDoc(doc(dbDe('solP'), 'empleados', '600'), { rutaId: 'r2', areaTE: 'almacen' }));
    await assertSucceeds(updateDoc(doc(dbDe('rh'), 'empleados', '600'), { areaTE: 'almacen', areaTEManual: true }));
  });
  it('un autorizador no modifica el padrón', async () => {
    await assertFails(updateDoc(doc(dbDe('aut1P'), 'empleados', '600'), { rutaId: 'r2' }));
  });
});

describe('módulo de rutas y rol autorizador', () => {
  it('un autorizador no lee ni crea solicitudes de rutas', async () => {
    const db = dbDe('aut2');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'solicitudes', 'sol-x'), { creadoPor: 'aut2', estatus: 'pendiente' });
    });
    await assertFails(getDoc(doc(db, 'solicitudes', 'sol-x')));
    await assertFails(setDoc(doc(db, 'solicitudes', 'nueva'), { creadoPor: 'aut2', estatus: 'pendiente' }));
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

  it('un lote con muchos empleados no revienta el límite de lecturas de las reglas', async () => {
    await assertSucceeds(capturar('solP', 'produccion', { empleados: 40 }));
  });

  it('el Aut. 1 de esa área entra directo a pendiente_aut2', async () => {
    await assertSucceeds(capturar('aut1M', 'moldes', { extra: { estatus: 'pendiente_aut2' } }));
  });

  it('el Aut. 1 no puede capturar como pendiente_aut1, ni otro como pendiente_aut2', async () => {
    await assertFails(capturar('aut1M', 'moldes', { extra: { estatus: 'pendiente_aut1' } }));
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

  it('un usuario inactivo no captura', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'areasTE', 'produccion'), {
        nombre: 'Producción', activa: true, autorizador1Nomina: N.aut1P, solicitantesNominas: [N.inactivo],
      });
      await setDoc(doc(ctx.firestore(), 'usuarios', 'inactivo'), perfil('superintendente', N.inactivo, { activo: false }));
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
  it('el creador, el Aut. 1, su suplente, la Aut. 2, su suplente, RH y admin leen la solicitud', async () => {
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
    await assertSucceeds(getDocs(query(col('aut1PSup'), where('areaId', '==', 'produccion'))));
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

  it('el suplente del Aut. 1 también autoriza, y queda registrado quién fue', async () => {
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

  it('nadie autoriza lo que creó (aunque sea el suplente del Aut. 1)', async () => {
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
  it('la Aut. 2, su suplente y RH autorizan', async () => {
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
      await updateDoc(doc(ctx.firestore(), 'areasTE', 'produccion'), { solicitantesNominas: [N.solP2] });
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
