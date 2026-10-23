// Las funciones de captura de tiempo extra (src/utils/tiempoExtraDb.js) contra el emulador con las reglas reales:
// guardar borrador en lotes, enviar con folio del contador, reenviar una devuelta, cancelar con motivo y eliminar borrador.
// Ejecutar con: npm run test:rules  (requiere Java 11+)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { datosTE, empleadoDesdePadron } from '../src/utils/tiempoExtra.js';
import { MOTIVOS_INICIALES, motivoVacio } from '../src/utils/motivosTE.js';

let env;
const ANIO = new Date().getFullYear();
const N = { solP: '50532', aut1P: '50610', aut2: '11' };
const USUARIOS = {
  aut2: { uid: 'aut2', nomina: N.aut2, nombre: 'MALDONADO SALVADOR' },
  rh: { uid: 'rh', nomina: '90001', nombre: 'ESPINOSA MARCO' },
  solP: { uid: 'solP', nomina: N.solP, nombre: 'ACOSTA MARCOS' },
  aut1P: { uid: 'aut1P', nomina: N.aut1P, nombre: 'GOMEZ ISMAEL' },
};
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 86400000));
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: nomina, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayer(), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: Timestamp.now(),
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, nomina, rol] of [['solP', N.solP, 'usuario'], ['aut1P', N.aut1P, 'usuario'], ['aut2', N.aut2, 'usuario'], ['rh', '90001', 'rh']]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: USUARIOS[uid]?.nombre ?? uid, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'asignaciones', `${N.solP}_solicitante_produccion`), asig(N.solP, 'solicitante', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.aut1P}_aut1_produccion`), asig(N.aut1P, 'aut1', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.aut2}_aut2_planta`), asig(N.aut2, 'aut2', null));
    await setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 12 });
    for (let i = 0; i < 40; i++) {
      await setDoc(doc(db, 'empleados', String(700 + i)), { nombre: `OPERADOR ${700 + i}`, nomina: String(700 + i), areaId: 'produccion', puesto: 'OPERATOR', turnoNomina: 'A' });
    }
  });
}

/** Carga tiempoExtraDb con `db` = el Firestore autenticado de ese usuario (las reglas se aplican de verdad) */
async function comoUsuario(uid) {
  vi.resetModules();
  const db = env.authenticatedContext(uid).firestore();
  vi.doMock('../src/firebase.js', () => ({ db }));
  return { db, m: await import('../src/utils/tiempoExtraDb.js') };
}

const turnos = [['7:00', '16:00'], ['16:00', '0:00'], ['19:00', '7:00']];
const empleados = (n, desde = 700) => Array.from({ length: n }, (_, i) => ({
  ...empleadoDesdePadron({ nomina: String(desde + i), nombre: `OPERADOR ${desde + i}`, puesto: 'OPERATOR', turnoNomina: 'A' }, {}),
  horaEntrada: turnos[i % 3][0], horaSalida: turnos[i % 3][1], rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', transporte: i % 4 !== 0, alimentos: i % 2 === 0,
}));
const base = (id, extra = {}) => ({
  id, existe: false, usuario: USUARIOS.solP, area: { id: 'produccion', nombre: 'Producción' }, fechaTE: '2026-12-01', motivo: 'Producción',
  comentario: 'Entrega urgente de pedido', sucios: new Set(), eliminados: new Set(), ...extra,
});
const guardarNuevo = (m, id, lista, extra = {}) => m.guardarBorrador(base(id, { empleados: lista, sucios: new Set(lista.map(e => e.nomina)), ...extra }));
const contar = async (db, id) => (await getDocs(collection(db, 'tiempoExtra', id, 'empleados'))).size;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-captura', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('guardar el borrador en lotes de 10', () => {
  it('crea la solicitud y 35 empleados (4 lotes) con barra de progreso', async () => {
    const { db, m } = await comoUsuario('solP');
    const avances = [];
    const lista = empleados(35);
    await m.guardarBorrador(base('BR-AAAAAAAAAA', { empleados: lista, sucios: new Set(lista.map(e => e.nomina)), onProgreso: (h, t) => avances.push([h, t]) }));
    expect(avances).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t).toMatchObject({ estatus: 'borrador', areaId: 'produccion', creadoPor: 'solP', motivo: 'Producción' });
    expect(t.folio).toBeUndefined();
    expect(t.resumen).toMatchObject({ totalEmpleados: 35 });
    expect(await contar(db, 'BR-AAAAAAAAAA')).toBe(35);
  });
  it('un borrador no gasta folio: el contador sigue igual', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-AAAAAAAAAA', empleados(3));
    expect((await getDoc(doc(db, 'contadores', `te-${ANIO}`))).data().ultimo).toBe(12);
  });
  it('se puede salir y continuar: solo se escriben los cambios y se borran los quitados', async () => {
    const { db, m } = await comoUsuario('solP');
    const lista = empleados(25);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista);
    const quedan = lista.slice(2).map((e, i) => (i === 0 ? { ...e, horaEntrada: '19:00', horaSalida: '7:00' } : e));
    await m.guardarBorrador(base('BR-AAAAAAAAAA', { existe: true, empleados: quedan, sucios: new Set([quedan[0].nomina]), eliminados: new Set([lista[0].nomina, lista[1].nomina]) }));
    expect(await contar(db, 'BR-AAAAAAAAAA')).toBe(23);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados', quedan[0].nomina))).data()).toMatchObject({ horaEntrada: '19:00', horas: 12 });
  });
  it('un empleado de otra área hace fallar su lote', async () => {
    const { m } = await comoUsuario('solP');
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'empleados', '801'), { nombre: 'AJENO', nomina: '801', areaId: 'calidad' }); });
    await expect(guardarNuevo(m, 'BR-AAAAAAAAAA', [...empleados(2), ...empleados(1, 801)])).rejects.toThrow();
  });
});

describe('enviar a autorización', () => {
  it('asigna el folio del contador al enviar, con su historial; el siguiente borrador recibe el consecutivo', async () => {
    const { db, m } = await comoUsuario('solP');
    const lista = empleados(12);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista);
    await guardarNuevo(m, 'BR-BBBBBBBBBB', lista);
    const datos = (id) => ({ id, devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente de pedido', empleados: lista });
    expect(await m.enviarSolicitud(datos('BR-AAAAAAAAAA'))).toBe(`TE-${ANIO}-0013`);
    expect(await m.enviarSolicitud(datos('BR-BBBBBBBBBB'))).toBe(`TE-${ANIO}-0014`);
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t).toMatchObject({ estatus: 'pendiente_aut1', folio: `TE-${ANIO}-0013` });
    expect(t.resumen.totalEmpleados).toBe(12);
    expect((await getDoc(doc(db, 'contadores', `te-${ANIO}`))).data().ultimo).toBe(14);
    const h = await m.leerHistorialTE('BR-AAAAAAAAAA');
    expect(h.map(x => x.accion)).toEqual(['enviada']);
  });
  it('el primer folio del año crea el contador', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await ctx.firestore().doc(`contadores/te-${ANIO}`).delete(); });
    const { db, m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-AAAAAAAAAA', empleados(2));
    const folio = await m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Calidad', comentario: 'Revisión de lotes', empleados: empleados(2) });
    expect(folio).toBe(`TE-${ANIO}-0001`);
    expect((await getDoc(doc(db, 'contadores', `te-${ANIO}`))).data().ultimo).toBe(1);
  });
  it('el Aut. 1 del área captura y su solicitud va directo a pendiente_aut2', async () => {
    const { db, m } = await comoUsuario('aut1P');
    const lista = empleados(3);
    await m.guardarBorrador({ ...base('BR-CCCCCCCCCC', { usuario: USUARIOS.aut1P }), empleados: lista, sucios: new Set(lista.map(e => e.nomina)) });
    await m.enviarSolicitud({ id: 'BR-CCCCCCCCCC', devuelta: false, usuario: USUARIOS.aut1P, estatus: 'pendiente_aut2', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Pedido especial', empleados: lista });
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-CCCCCCCCCC'))).data().estatus).toBe('pendiente_aut2');
  });
  it('quien no es el Aut. 1 no puede saltarse su nivel', async () => {
    const { m } = await comoUsuario('solP');
    const lista = empleados(2);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista);
    await expect(m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut2', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente', empleados: lista })).rejects.toThrow();
  });
  it('ya enviada, el Aut. 1 la ve; sus empleados y su borrador previo, no', async () => {
    const { m } = await comoUsuario('solP');
    const lista = empleados(2);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista);
    const { db: dbAut1 } = await comoUsuario('aut1P');
    await assertFails(getDoc(doc(dbAut1, 'tiempoExtra', 'BR-AAAAAAAAAA')));
    const { m: m2 } = await comoUsuario('solP');
    await m2.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente', empleados: lista });
    expect((await getDoc(doc(dbAut1, 'tiempoExtra', 'BR-AAAAAAAAAA'))).exists()).toBe(true);
  });
});

describe('devuelta: corregir y reenviar', () => {
  it('conserva su folio, quita las firmas y registra "reenviada"; el contador no se mueve', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'tiempoExtra', 'TE-2026-0004'), {
        folio: 'TE-2026-0004', areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: 'x', fechaTE: '2026-12-01',
        motivo: 'Producción', comentario: 'Entrega urgente de pedido', estatus: 'devuelta', resumen: { totalEmpleados: 2 }, fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now(),
        aut1: { nomina: N.aut1P, nombre: 'x', fecha: Timestamp.now(), comentario: '' }, devolucion: { nivel: 2, nomina: N.aut2, nombre: 'Salvador', motivo: 'Faltan horas', fecha: Timestamp.now() },
      });
    });
    const { db, m } = await comoUsuario('solP');
    const folio = await m.enviarSolicitud({ id: 'TE-2026-0004', devuelta: true, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-02', motivo: 'Calidad', comentario: 'Corregido el horario', empleados: empleados(2) });
    expect(folio).toBe('TE-2026-0004');
    const t = (await getDoc(doc(db, 'tiempoExtra', 'TE-2026-0004'))).data();
    expect(t).toMatchObject({ estatus: 'pendiente_aut1', fechaTE: '2026-12-02', motivo: 'Calidad' });
    expect(t.aut1).toBeUndefined();
    expect((await m.leerHistorialTE('TE-2026-0004')).map(x => x.accion)).toEqual(['reenviada']);
    expect((await getDoc(doc(db, 'contadores', `te-${ANIO}`))).data().ultimo).toBe(12);
  });
});

describe('cancelar y eliminar', () => {
  const enviada = async (m, id = 'BR-AAAAAAAAAA') => {
    const lista = empleados(2);
    await guardarNuevo(m, id, lista);
    await m.enviarSolicitud({ id, devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente', empleados: lista });
  };
  it('cancela una pendiente con motivo (queda en la solicitud y en el historial); sin motivo no', async () => {
    const { db, m } = await comoUsuario('solP');
    await enviada(m);
    await expect(m.cancelarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.solP, motivo: ' x ' })).rejects.toThrow();
    await new Promise(r => setTimeout(r, 25)); // el historial se ordena por fecha del servidor: que no empaten en el mismo milisegundo
    await m.cancelarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.solP, motivo: 'Ya no se necesita' });
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data()).toMatchObject({ estatus: 'cancelada', motivoCancelacion: 'Ya no se necesita' });
    const h = await m.leerHistorialTE('BR-AAAAAAAAAA');
    expect(h.map(x => x.accion)).toEqual(['enviada', 'cancelada']);
    expect(h[1].comentario).toBe('Ya no se necesita');
  });
  it('elimina un borrador de 25 empleados (sus lotes y luego la solicitud)', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-AAAAAAAAAA', empleados(25));
    await m.eliminarBorrador('BR-AAAAAAAAAA');
    // (sin la solicitud, las reglas ya no dejan leer nada: se comprueba con permisos de administración del emulador)
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), 'tiempoExtra', 'BR-AAAAAAAAAA'))).exists()).toBe(false);
      expect(await contar(ctx.firestore(), 'BR-AAAAAAAAAA')).toBe(0);
    });
    void db;
  });
  it('lo ya enviado no se elimina', async () => {
    const { m } = await comoUsuario('solP');
    await enviada(m);
    await expect(m.eliminarBorrador('BR-AAAAAAAAAA')).rejects.toThrow();
  });
});

describe('ruta en el padrón y avisos de la misma fecha', () => {
  it('el solicitante guarda ruta, comunidad y punto de su área', async () => {
    const { db, m } = await comoUsuario('solP');
    await m.guardarRutasEnPadron({ 700: { rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' }, 701: { rutaId: 'r2', comunidadId: 'c2', puntoReunionId: 'p2' } });
    expect((await getDoc(doc(db, 'empleados', '701'))).data()).toMatchObject({ rutaId: 'r2', puntoReunionId: 'p2' });
  });
  it('avisa de quien ya tiene otro tiempo extra no cancelado ese día (lo propio); ignora canceladas y la misma solicitud', async () => {
    const { m } = await comoUsuario('solP');
    const lista = empleados(3);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista, { fechaTE: '2026-12-01' });
    await guardarNuevo(m, 'BR-BBBBBBBBBB', lista.slice(0, 1), { fechaTE: '2026-12-02' });
    const ocupados = await m.leerOcupados({ uid: 'solP', areaId: 'produccion', fechaTE: '2026-12-01', esAut1DeLaArea: false, excluirId: 'BR-BBBBBBBBBB' });
    expect([...ocupados.keys()].sort()).toEqual(['700', '701', '702']);
    expect((await m.leerOcupados({ uid: 'solP', areaId: 'produccion', fechaTE: '2026-12-01', esAut1DeLaArea: false, excluirId: 'BR-AAAAAAAAAA' })).size).toBe(0);
    expect((await m.leerOcupados({ uid: 'solP', areaId: 'produccion', fechaTE: '2026-12-09', esAut1DeLaArea: false })).size).toBe(0);
  });
  it('el Aut. 1 del área también ve lo que capturaron otros del área', async () => {
    const { m } = await comoUsuario('solP');
    const lista = empleados(2);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista);
    await m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente', empleados: lista });
    const { m: m2 } = await comoUsuario('aut1P');
    const ocupados = await m2.leerOcupados({ uid: 'aut1P', areaId: 'produccion', fechaTE: '2026-12-01', esAut1DeLaArea: true });
    expect([...ocupados.keys()].sort()).toEqual(['700', '701']);
    expect(ocupados.get('700')).toMatchObject({ folio: `TE-${ANIO}-0013`, estatus: 'pendiente_aut1' });
  });
});

// ── Bandejas: autorizar y devolver ───────────────────────────────────────

describe('autorizar y devolver (cada acción en su transacción)', () => {
  const enviarComoOscar = async (id = 'BR-AAAAAAAAAA', estatus = 'pendiente_aut1') => {
    const { m } = await comoUsuario('solP');
    const lista = empleados(3);
    await guardarNuevo(m, id, lista);
    await m.enviarSolicitud({ id, devuelta: false, usuario: USUARIOS.solP, estatus, fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente', empleados: lista });
    return m;
  };

  it('Oscar envía → el Aut. 1 autoriza (firma con comentario) → la Aut. 2 autoriza → queda autorizada, con su historial', async () => {
    await enviarComoOscar();
    const a1 = await comoUsuario('aut1P');
    await a1.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1, comentario: 'Va bien' });
    let t = (await getDoc(doc(a1.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t.estatus).toBe('pendiente_aut2');
    expect(t.aut1).toMatchObject({ nomina: N.aut1P, comentario: 'Va bien', comoRH: false });
    const a2 = await comoUsuario('aut2');
    await a2.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut2, nivel: 2, comoRH: false });
    t = (await getDoc(doc(a2.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t.estatus).toBe('autorizada');
    expect(t.aut2).toMatchObject({ nomina: N.aut2, comoRH: false });
    expect((await a2.m.leerHistorialTE('BR-AAAAAAAAAA')).map(h => h.accion)).toEqual(['enviada', 'autorizada_1', 'autorizada_2']);
  });

  it('RH firma el nivel 2 con comoRH true; no puede decir que es la Aut. 2', async () => {
    await enviarComoOscar();
    const a1 = await comoUsuario('aut1P');
    await a1.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1 });
    const rh = await comoUsuario('rh');
    await expect(rh.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.rh, nivel: 2, comoRH: false })).rejects.toThrow();
    await rh.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.rh, nivel: 2, comoRH: true });
    expect((await getDoc(doc(rh.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().aut2.comoRH).toBe(true);
  });

  it('"Alguien más ya respondió esta solicitud": el segundo en responder aborta', async () => {
    await enviarComoOscar();
    const a1 = await comoUsuario('aut1P');
    await a1.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1 });
    await expect(a1.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1 })).rejects.toThrow('Alguien más ya respondió esta solicitud');
    await expect(a1.m.devolverSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1, motivo: 'Ya la había autorizado yo' })).rejects.toThrow('Alguien más ya respondió esta solicitud');
  });

  it('si el solicitante la cancela mientras está abierta, ya no se puede responder', async () => {
    const m = await enviarComoOscar();
    await m.cancelarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.solP, motivo: 'Cambió el pedido' });
    const a1 = await comoUsuario('aut1P');
    await expect(a1.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1 })).rejects.toThrow('Alguien más ya respondió esta solicitud');
  });

  it('devolver exige motivo de 10 caracteres; Oscar corrige y reenvía y vuelve a empezar en Aut. 1, con el mismo folio', async () => {
    await enviarComoOscar();
    const a1 = await comoUsuario('aut1P');
    await expect(a1.m.devolverSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1, motivo: 'corto' })).rejects.toThrow(/al menos 10/);
    await a1.m.devolverSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1, motivo: 'Faltan los horarios del turno B' });
    let t = (await getDoc(doc(a1.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t.estatus).toBe('devuelta');
    expect(t.devolucion).toMatchObject({ nivel: 1, nomina: N.aut1P, motivo: 'Faltan los horarios del turno B' });
    const folio = t.folio;
    const oscar = await comoUsuario('solP');
    await oscar.m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: true, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Corregí los horarios', empleados: empleados(3) });
    t = (await getDoc(doc(oscar.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t).toMatchObject({ estatus: 'pendiente_aut1', folio });
    const a1b = await comoUsuario('aut1P');
    await a1b.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut1P, nivel: 1 });
    expect((await a1b.m.leerHistorialTE('BR-AAAAAAAAAA')).map(h => h.accion)).toEqual(['enviada', 'devuelta', 'reenviada', 'autorizada_1']);
  });

  it('autorizar varias: cada una en su transacción; la que ya respondió otro falla y las demás pasan', async () => {
    await enviarComoOscar('BR-AAAAAAAAAA');
    await enviarComoOscar('BR-BBBBBBBBBB');
    await enviarComoOscar('BR-CCCCCCCCCC');
    const a1 = await comoUsuario('aut1P');
    await a1.m.devolverSolicitud({ id: 'BR-BBBBBBBBBB', usuario: USUARIOS.aut1P, nivel: 1, motivo: 'La devolvió otra persona' });
    const r = await a1.m.autorizarVarias({ tareas: ['BR-AAAAAAAAAA', 'BR-BBBBBBBBBB', 'BR-CCCCCCCCCC'].map(id => ({ id, nivel: 1 })), usuario: USUARIOS.aut1P, comoRH: false });
    expect(r.ok).toEqual(['BR-AAAAAAAAAA', 'BR-CCCCCCCCCC']);
    expect(r.fallidas).toEqual([{ id: 'BR-BBBBBBBBBB', motivo: 'Alguien más ya respondió esta solicitud' }]);
  });

  it('lo que capturó el Aut. 1 entra directo a nivel 2 y él no puede firmarlo', async () => {
    const a1 = await comoUsuario('aut1P');
    const lista = empleados(2);
    await a1.m.guardarBorrador({ ...base('BR-DDDDDDDDDD', { usuario: USUARIOS.aut1P }), empleados: lista, sucios: new Set(lista.map(e => e.nomina)) });
    await a1.m.enviarSolicitud({ id: 'BR-DDDDDDDDDD', devuelta: false, usuario: USUARIOS.aut1P, estatus: 'pendiente_aut2', fechaTE: '2026-12-01', motivo: 'Calidad', comentario: 'Revisión especial', empleados: lista });
    await expect(a1.m.autorizarSolicitud({ id: 'BR-DDDDDDDDDD', usuario: USUARIOS.aut1P, nivel: 1 })).rejects.toThrow();
    const a2 = await comoUsuario('aut2');
    await a2.m.autorizarSolicitud({ id: 'BR-DDDDDDDDDD', usuario: USUARIOS.aut2, nivel: 2, comoRH: false });
    expect((await getDoc(doc(a2.db, 'tiempoExtra', 'BR-DDDDDDDDDD'))).data().estatus).toBe('autorizada');
  });
});

describe('Aut. 2 captura y envía lo suyo: queda autorizada con su firma de nivel 2', () => {
  const COMENTARIO = 'Capturada y autorizada por Aut. 2';
  const ADM = (id, extra = {}) => ({ ...base(id, { usuario: USUARIOS.aut2, area: { id: 'administrativo', nombre: 'Administrativo' } }), ...extra });
  const listaAdm = () => empleados(2, 900);
  const sembrarAdm = () => env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'areas', 'administrativo'), { nombre: 'Administrativo', participaTE: false, activa: true, orden: 9 });
    for (let i = 0; i < 3; i++) await setDoc(doc(d, 'empleados', String(900 + i)), { nombre: `ADMIN ${900 + i}`, nomina: String(900 + i), areaId: 'administrativo', puesto: 'ANALISTA', turnoNomina: 'A' });
  });
  const borrador = async (m, id, usuario) => {
    const lista = listaAdm();
    await m.guardarBorrador({ ...ADM(id, { usuario }), empleados: lista, sucios: new Set(lista.map(e => e.nomina)) });
    return lista;
  };
  const enviar = (m, id, lista, usuario, estatus) => m.enviarSolicitud({ id, devuelta: false, usuario, estatus, fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente de pedido', empleados: lista });
  beforeEach(sembrarAdm);

  it('en Administrativo: queda autorizada al enviarla, con aut2 (nombre, fecha y comentario), su folio y una sola entrada clara en el historial', async () => {
    const { db, m } = await comoUsuario('aut2');
    const lista = await borrador(m, 'BR-AAAAAAAAAA', USUARIOS.aut2);
    expect(await enviar(m, 'BR-AAAAAAAAAA', lista, USUARIOS.aut2, 'autorizada')).toBe(`TE-${ANIO}-0013`);
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t.estatus).toBe('autorizada');
    expect(t.aut1).toBeUndefined();
    expect(t.aut2).toMatchObject({ nomina: N.aut2, nombre: USUARIOS.aut2.nombre, comentario: COMENTARIO, comoRH: false });
    expect(t.aut2.fecha).toBeTruthy();
    const h = await m.leerHistorialTE('BR-AAAAAAAAAA');
    expect(h.map(x => x.accion)).toEqual(['enviada_autorizada']);
    expect(h[0]).toMatchObject({ nivel: 2, comentario: COMENTARIO });
  });
  it('en un área donde es solicitante también queda autorizada (cualquier área donde pueda capturar)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'asignaciones', `${N.aut2}_solicitante_produccion`), asig(N.aut2, 'solicitante', 'produccion')); });
    const { db, m } = await comoUsuario('aut2');
    const lista = empleados(2);
    await m.guardarBorrador({ ...base('BR-BBBBBBBBBB', { usuario: USUARIOS.aut2 }), empleados: lista, sucios: new Set(lista.map(e => e.nomina)) });
    await enviar(m, 'BR-BBBBBBBBBB', lista, USUARIOS.aut2, 'autorizada');
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-BBBBBBBBBB'))).data().estatus).toBe('autorizada');
  });
  it('el Aut. 2 no deja la suya en pendiente_aut2 ni en pendiente_aut1', async () => {
    const { m } = await comoUsuario('aut2');
    const lista = await borrador(m, 'BR-AAAAAAAAAA', USUARIOS.aut2);
    await expect(enviar(m, 'BR-AAAAAAAAAA', lista, USUARIOS.aut2, 'pendiente_aut2')).rejects.toThrow();
    await expect(enviar(m, 'BR-AAAAAAAAAA', lista, USUARIOS.aut2, 'pendiente_aut1')).rejects.toThrow();
  });
  it('la firma debe ser suya: otra nómina u otro nombre no pasan', async () => {
    const { m } = await comoUsuario('aut2');
    const lista = await borrador(m, 'BR-AAAAAAAAAA', USUARIOS.aut2);
    await expect(enviar(m, 'BR-AAAAAAAAAA', lista, { ...USUARIOS.aut2, nomina: '99999' }, 'autorizada')).rejects.toThrow();
    await expect(enviar(m, 'BR-AAAAAAAAAA', lista, { ...USUARIOS.aut2, nombre: 'OTRA PERSONA' }, 'autorizada')).rejects.toThrow();
  });
  it('el Aut. 1 no autoriza lo suyo: sin ser Aut. 2 no puede enviar como autorizada (va al nivel 2)', async () => {
    const { m } = await comoUsuario('aut1P');
    const lista = empleados(2);
    await m.guardarBorrador({ ...base('BR-CCCCCCCCCC', { usuario: USUARIOS.aut1P }), empleados: lista, sucios: new Set(lista.map(e => e.nomina)) });
    await expect(enviar(m, 'BR-CCCCCCCCCC', lista, USUARIOS.aut1P, 'autorizada')).rejects.toThrow();
    await enviar(m, 'BR-CCCCCCCCCC', lista, USUARIOS.aut1P, 'pendiente_aut2');
  });
  it('un solicitante tampoco puede enviar como autorizada', async () => {
    const { m } = await comoUsuario('solP');
    const lista = empleados(2);
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista);
    await expect(enviar(m, 'BR-AAAAAAAAAA', lista, USUARIOS.solP, 'autorizada')).rejects.toThrow();
  });
  it('RH (sin ser Aut. 2) captura en Administrativo: queda en pendiente_aut2; no la firma él mismo y sí un Aut. 2', async () => {
    const rh = await comoUsuario('rh');
    const lista = await borrador(rh.m, 'BR-AAAAAAAAAA', USUARIOS.rh);
    await expect(enviar(rh.m, 'BR-AAAAAAAAAA', lista, USUARIOS.rh, 'autorizada')).rejects.toThrow();
    await enviar(rh.m, 'BR-AAAAAAAAAA', lista, USUARIOS.rh, 'pendiente_aut2');
    expect((await getDoc(doc(rh.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('pendiente_aut2');
    await expect(rh.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.rh, nivel: 2, comoRH: true })).rejects.toThrow();
    const a2 = await comoUsuario('aut2');
    await a2.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: USUARIOS.aut2, nivel: 2, comoRH: false });
    expect((await getDoc(doc(a2.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data()).toMatchObject({ estatus: 'autorizada', aut2: { comoRH: false } });
  });
  it('otra persona de RH distinta sí puede firmar lo de RH', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'usuarios', 'rh2'), { nombre: 'OTRA RH', rol: 'rh', nomina: '90002', activo: true }); });
    const rh = await comoUsuario('rh');
    const lista = await borrador(rh.m, 'BR-AAAAAAAAAA', USUARIOS.rh);
    await enviar(rh.m, 'BR-AAAAAAAAAA', lista, USUARIOS.rh, 'pendiente_aut2');
    const rh2 = await comoUsuario('rh2');
    await rh2.m.autorizarSolicitud({ id: 'BR-AAAAAAAAAA', usuario: { uid: 'rh2', nomina: '90002', nombre: 'OTRA RH' }, nivel: 2, comoRH: true });
    expect((await getDoc(doc(rh2.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().aut2).toMatchObject({ nomina: '90002', comoRH: true });
  });
  it('una devuelta que reenvía un Aut. 2 también queda autorizada: conserva su folio y quita la firma de nivel 1', async () => {
    const lista = listaAdm();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'tiempoExtra', 'TE-2026-0900'), {
        areaId: 'administrativo', areaNombre: 'Administrativo', creadoPor: 'aut2', creadoPorNomina: N.aut2, creadoPorNombre: USUARIOS.aut2.nombre,
        fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Entrega urgente de pedido', estatus: 'devuelta', folio: 'TE-2026-0900',
        aut1: { nomina: '1', nombre: 'X', fecha: Timestamp.now() }, resumen: {}, fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now(),
        devolucion: { nivel: 3, nomina: '90001', nombre: 'RH', motivo: 'Corrige los horarios', fecha: Timestamp.now() },
      });
      for (const e of lista) await setDoc(doc(d, 'tiempoExtra', 'TE-2026-0900', 'empleados', e.nomina), { nombre: e.nombre, puesto: 'ANALISTA', turnoNomina: 'A', horaEntrada: e.horaEntrada, horaSalida: e.horaSalida, horas: 9, requiereAlimentos: false, requiereTransporte: false });
    });
    const { db, m } = await comoUsuario('aut2');
    const folio = await m.enviarSolicitud({ id: 'TE-2026-0900', devuelta: true, usuario: USUARIOS.aut2, estatus: 'autorizada', fechaTE: '2026-12-01', motivo: 'Producción', comentario: 'Corregí los horarios', empleados: lista });
    expect(folio).toBe('TE-2026-0900');
    const t = (await getDoc(doc(db, 'tiempoExtra', 'TE-2026-0900'))).data();
    expect(t.estatus).toBe('autorizada');
    expect(t.aut1).toBeUndefined();
    expect(t.aut2).toMatchObject({ nomina: N.aut2, comentario: COMENTARIO, comoRH: false });
    expect((await m.leerHistorialTE('TE-2026-0900')).map(h => h.accion)).toEqual(['enviada_autorizada']);
  });
});

describe('motivo "Otro" (¿Cuál?) de las solicitudes anteriores en las reglas', () => {
  const lista = empleados(2);
  const otro = (texto) => ({ motivo: 'Otro', extras: { motivoOtro: texto } });
  const datosEnvio = (id, extra = {}) => ({ id, devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', motivo: 'Otro', comentario: 'Entrega urgente de pedido', empleados: lista, ...extra });

  it('un borrador con Otro y su ¿Cuál? se guarda y se envía; queda motivoOtro en la solicitud', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista, otro('Visita de cliente'));
    await m.enviarSolicitud(datosEnvio('BR-AAAAAAAAAA', { extras: { motivoOtro: 'Visita de cliente' } }));
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data()).toMatchObject({ motivo: 'Otro', motivoOtro: 'Visita de cliente', estatus: 'pendiente_aut1' });
  });
  it('más de 60 caracteres, o motivoOtro con otro motivo, se rechazan al guardar', async () => {
    const { m } = await comoUsuario('solP');
    await expect(guardarNuevo(m, 'BR-BBBBBBBBBB', lista, otro('x'.repeat(61)))).rejects.toThrow();
    await expect(guardarNuevo(m, 'BR-CCCCCCCCCC', lista, { motivo: 'Calidad', extras: { motivoOtro: 'sobra' } })).rejects.toThrow();
  });
  it('no se puede enviar con Otro sin ¿Cuál? o con menos de 3 caracteres', async () => {
    const { m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-DDDDDDDDDD', lista, { motivo: 'Otro' });
    await expect(m.enviarSolicitud(datosEnvio('BR-DDDDDDDDDD'))).rejects.toThrow();
    await expect(m.enviarSolicitud(datosEnvio('BR-DDDDDDDDDD', { extras: { motivoOtro: ' ab ' } }))).rejects.toThrow();
  });
  it('al cambiar a otro motivo, el campo se borra del borrador', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-EEEEEEEEEE', lista, otro('Visita de cliente'));
    await m.guardarBorrador(base('BR-EEEEEEEEEE', { existe: true, motivo: 'Calidad', empleados: lista, extras: { motivoOtro: '' } }));
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-EEEEEEEEEE'))).data();
    expect(t.motivo).toBe('Calidad');
    expect(t.motivoOtro).toBeUndefined();
  });
});

describe('motivos del catálogo en las reglas (varios por solicitud, P.O./TB y motivoIndex por empleado)', () => {
  const lista = empleados(3).map((e, i) => ({ ...e, motivoIndex: i === 1 ? 1 : 0 }));
  const mot = (motivoId, extra = {}) => ({ ...motivoVacio(motivoId), ...extra });
  const dos = [mot('inventario-fisico', { detalle: 'apoyo a inventario' }), mot('cargo-po', { numero: '4551099797' })];
  const extrasDe = (motivos, empleadosLista = lista) => datosTE({ tipo: 'turno_extra', empleados: empleadosLista, motivos, catalogoMotivos: MOTIVOS_INICIALES });
  const envio = (id, extra = {}) => ({ id, devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', fechaTE: '2026-12-01', comentario: 'Entrega urgente de pedido', empleados: lista, extras: extrasDe(dos), ...extra });
  const guardarCon = (m, id, extras, l = lista, extra = {}) => m.guardarBorrador(base(id, { motivo: undefined, empleados: l, sucios: new Set(l.map(e => e.nomina)), extras, ...extra }));

  it('guarda el borrador con sus motivos (nombre copiado) y el motivoIndex de cada empleado; se envía y la bitácora lleva los motivos', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarCon(m, 'BR-AAAAAAAAAA', extrasDe(dos));
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t.motivo).toBe('Inventario físico');
    expect(t.motivos).toEqual([
      { motivoId: 'inventario-fisico', nombre: 'Inventario físico', numero: '', comentario: '', detalle: 'apoyo a inventario', tipoNumero: '' },
      { motivoId: 'cargo-po', nombre: 'Cargo a P.O.', numero: '4551099797', comentario: '', detalle: '', tipoNumero: 'po' },
    ]);
    expect(t.motivoOtro).toBeUndefined();
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados', lista[1].nomina))).data().motivoIndex).toBe(1);
    await m.enviarSolicitud(envio('BR-AAAAAAAAAA'));
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data()).toMatchObject({ estatus: 'pendiente_aut1', motivo: 'Inventario físico' });
    const h = await m.leerHistorialTE('BR-AAAAAAAAAA');
    expect(h[0].comentario).toBe('Motivos: Inventario físico · apoyo a inventario / Cargo a P.O. 4551099797');
  });
  it('el Aut. 1 lee los motivos; el Aut. 2 que captura la deja autorizada con sus motivos', async () => {
    const { m } = await comoUsuario('solP');
    await guardarCon(m, 'BR-AAAAAAAAAA', extrasDe(dos));
    await m.enviarSolicitud(envio('BR-AAAAAAAAAA'));
    const a1 = await comoUsuario('aut1P');
    expect((await getDoc(doc(a1.db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().motivos).toHaveLength(2);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'areas', 'administrativo'), { nombre: 'Administrativo', participaTE: false, activa: true, orden: 9 });
      for (let i = 0; i < 3; i++) await setDoc(doc(d, 'empleados', String(900 + i)), { nombre: `ADMIN ${900 + i}`, nomina: String(900 + i), areaId: 'administrativo', puesto: 'ANALISTA', turnoNomina: 'A' });
    });
    const a2 = await comoUsuario('aut2');
    const lista2 = empleados(2, 900).map((e, i) => ({ ...e, motivoIndex: i }));
    await guardarCon(a2.m, 'BR-BBBBBBBBBB', extrasDe(dos, lista2), lista2, { usuario: USUARIOS.aut2, area: { id: 'administrativo', nombre: 'Administrativo' } });
    await a2.m.enviarSolicitud(envio('BR-BBBBBBBBBB', { usuario: USUARIOS.aut2, estatus: 'autorizada', empleados: lista2, extras: extrasDe(dos, lista2) }));
    expect((await getDoc(doc(a2.db, 'tiempoExtra', 'BR-BBBBBBBBBB'))).data()).toMatchObject({ estatus: 'autorizada', motivo: 'Inventario físico' });
    expect((await a2.m.leerHistorialTE('BR-BBBBBBBBBB')).map(h => h.accion)).toEqual(['enviada_autorizada']);
  });
  it('no se pasa de cinco motivos ni se aceptan campos que no son del motivo ni nombres larguísimos', async () => {
    const { m } = await comoUsuario('solP');
    const cinco = ['cubrir-vacante', 'embarques-fin-de-semana', 'inventario-fisico', 'cubrir-vacaciones', 'adecuacion-contenedores'].map(id => mot(id));
    const ok = extrasDe(cinco);
    await expect(guardarCon(m, 'BR-BBBBBBBBBB', { ...ok, motivos: [...ok.motivos, ok.motivos[0]] })).rejects.toThrow();
    await expect(guardarCon(m, 'BR-CCCCCCCCCC', { ...ok, motivos: [{ ...ok.motivos[0], extra: 'x'.repeat(2000) }] })).rejects.toThrow();
    await expect(guardarCon(m, 'BR-DDDDDDDDDD', { ...ok, motivos: [{ ...ok.motivos[0], nombre: 'x'.repeat(61) }] })).rejects.toThrow();
    await guardarCon(m, 'BR-EEEEEEEEEE', ok);
  });
  it('no se envía sin motivos, ni con un motivo que no es el del primero', async () => {
    const { m } = await comoUsuario('solP');
    await guardarCon(m, 'BR-AAAAAAAAAA', extrasDe([mot('')]));
    await expect(m.enviarSolicitud(envio('BR-AAAAAAAAAA', { extras: extrasDe([mot('')]) }))).rejects.toThrow();
    await expect(m.enviarSolicitud(envio('BR-AAAAAAAAAA', { extras: { ...extrasDe(dos), motivo: 'Otro nombre' } }))).rejects.toThrow();
    await m.enviarSolicitud(envio('BR-AAAAAAAAAA'));
  });
  it('el motivoIndex de un empleado es un entero de 0 a 4', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarCon(m, 'BR-GGGGGGGGGG', extrasDe(dos), [lista[0]]);
    // La app ya normaliza el índice; las reglas lo exigen aunque alguien escriba directo
    const ref = doc(db, 'tiempoExtra', 'BR-GGGGGGGGGG', 'empleados', lista[0].nomina);
    const actual = (await getDoc(ref)).data();
    for (const indice of [5, -1, 1.5, '1', null]) await assertFails(setDoc(ref, { ...actual, motivoIndex: indice }));
    await setDoc(ref, { ...actual, motivoIndex: 4 });
    expect((await getDoc(ref)).data().motivoIndex).toBe(4);
  });
  it('una solicitud anterior (motivo y motivoOtro) se puede corregir con motivos nuevos: se borra el ¿Cuál?', async () => {
    const { db, m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista, { motivo: 'Otro', extras: { motivoOtro: 'Visita de cliente' } });
    await m.guardarBorrador(base('BR-AAAAAAAAAA', { existe: true, motivo: undefined, empleados: lista, extras: extrasDe(dos) }));
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t.motivo).toBe('Inventario físico');
    expect(t.motivoOtro).toBeUndefined();
    expect(t.motivos).toHaveLength(2);
  });
  it('la solicitud anterior sin motivos nuevos se sigue enviando con su ¿Cuál? de siempre', async () => {
    const { m } = await comoUsuario('solP');
    await guardarNuevo(m, 'BR-AAAAAAAAAA', lista, { motivo: 'Otro', extras: { motivoOtro: 'Visita de cliente' } });
    await m.enviarSolicitud({ ...envio('BR-AAAAAAAAAA'), motivo: 'Otro', extras: { motivoOtro: 'Visita de cliente' } });
  });
});
