// Cancelar solicitudes de tiempo extra: quién puede, en qué estatus y con qué requisitos (motivo de 10+ caracteres, firma real, historial).
// Matriz rol × estatus, incluidos los casos que NO deben poder. Ejecutar con npm run test:rules.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, serverTimestamp as ts, setDoc, writeBatch } from 'firebase/firestore';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const N = { admin: '1', rh: '2', solP: '50532', solP2: '50533', aut1P: '50610', aut1A: '50988', aut2: '11', ajeno: '50999' };
const NOMBRE = (uid) => `Usuario ${N[uid]}`;
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 86400000));
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayer(), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: 'admin', nombre: NOMBRE('admin') }, fechaAsignacion: Timestamp.now(),
});
const ESTATUS = ['borrador', 'pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada', 'cancelada'];
const idDe = (estatus) => (estatus === 'borrador' ? 'BR-ABCDEFGH12' : `TE-${estatus}`);
const MOTIVO = 'Ya no se necesita el tiempo extra';

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol] of [['admin', 'admin'], ['rh', 'rh'], ['solP', 'usuario'], ['solP2', 'usuario'], ['aut1P', 'usuario'], ['aut1A', 'usuario'], ['aut2', 'usuario'], ['ajeno', 'usuario']]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: NOMBRE(uid), rol, nomina: N[uid], activo: true });
    }
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'areas', 'almacen'), { nombre: 'Almacén', participaTE: true, activa: true, orden: 2 });
    for (const [nomina, rol, area] of [[N.solP, 'solicitante', 'produccion'], [N.solP2, 'solicitante', 'produccion'], [N.aut1P, 'aut1', 'produccion'], [N.aut1A, 'aut1', 'almacen'], [N.aut2, 'aut2', null]]) {
      await setDoc(doc(db, 'asignaciones', `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : area}`), asig(nomina, rol, area));
    }
    for (const estatus of ESTATUS) {
      await setDoc(doc(db, 'tiempoExtra', idDe(estatus)), {
        areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: NOMBRE('solP'), fechaTE: '2026-11-02',
        motivo: 'Producción', comentario: 'Pedido urgente', estatus, ...(estatus === 'borrador' ? {} : { folio: `TE-2026-${ESTATUS.indexOf(estatus)}` }),
        resumen: { totalEmpleados: 1, totalHoras: 2, totalTransporte: 0, totalAlimentos: 1 }, fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now(),
      });
    }
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-cancelar', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

/** Lo que escribe la app al cancelar: estatus, motivo, quién (firma) y el renglón del historial, en un solo lote */
function cancelar(uid, estatus, { motivo = MOTIVO, firma, extra = {}, historial = {}, sinHistorial = false, sinFirma = false, comoRH = false } = {}) {
  const db = dbDe(uid);
  const b = writeBatch(db);
  const id = idDe(estatus);
  b.update(doc(db, 'tiempoExtra', id), {
    estatus: 'cancelada', motivoCancelacion: motivo, fechaActualizacion: ts(),
    ...(sinFirma ? {} : { canceladaPor: firma ?? { nomina: N[uid], nombre: NOMBRE(uid), fecha: ts(), comoRH } }), ...extra,
  });
  if (!sinHistorial) {
    b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), { accion: 'cancelada', nivel: 0, porUid: uid, porNomina: N[uid], porNombre: NOMBRE(uid), comentario: motivo, fecha: ts(), ...historial });
  }
  return b.commit();
}

// quién puede cancelar en qué estatus (lo acordado)
const PUEDE = {
  solP: ['pendiente_aut1', 'pendiente_aut2', 'devuelta'],
  aut1P: ['pendiente_aut1'],
  aut2: ['pendiente_aut2', 'autorizada'],
  rh: ['pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada'],
  admin: ['pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada'],
  solP2: [], aut1A: [], ajeno: [],
};

describe('matriz de quién puede cancelar y en qué estatus', () => {
  for (const [uid, lista] of Object.entries(PUEDE)) {
    for (const estatus of ESTATUS) {
      const puede = lista.includes(estatus);
      it(`${uid} ${puede ? 'PUEDE' : 'NO puede'} cancelar una solicitud «${estatus}»`, async () => {
        const op = cancelar(uid, estatus, { comoRH: ['rh', 'admin'].includes(uid) });
        await (puede ? assertSucceeds(op) : assertFails(op));
        if (puede) {
          const t = (await getDoc(doc(dbDe('admin'), 'tiempoExtra', idDe(estatus)))).data();
          if (t.estatus !== 'cancelada' || t.motivoCancelacion !== MOTIVO || t.canceladaPor.nomina !== N[uid] || !t.canceladaPor.fecha) throw new Error('No quedó quién, cuándo y por qué');
        }
      });
    }
  }
});

describe('requisitos al cancelar', () => {
  it('el motivo es obligatorio y de 10+ caracteres (también sin espacios de relleno)', async () => {
    for (const motivo of ['', 'x', 'corto', '   corto   ', 'nueve car']) await assertFails(cancelar('solP', 'pendiente_aut1', { motivo }));
    await assertFails(cancelar('aut1P', 'pendiente_aut1', { motivo: 'no sirve' }));
    await assertFails(cancelar('aut2', 'autorizada', { motivo: 'no sirve' }));
    await assertFails(cancelar('rh', 'procesada', { motivo: 'no sirve', comoRH: true }));
    await assertSucceeds(cancelar('solP', 'pendiente_aut1', { motivo: 'diez carac' }));
  });
  it('el motivo no pasa de 1000 caracteres', async () => {
    await assertFails(cancelar('solP', 'pendiente_aut1', { motivo: 'x'.repeat(1001) }));
  });
  it('queda la firma: sin ella, con otra persona, otro nombre, fecha falsa o campos de más, no pasa', async () => {
    const base = { nomina: N.solP, nombre: NOMBRE('solP'), fecha: ts(), comoRH: false };
    await assertFails(cancelar('solP', 'pendiente_aut1', { sinFirma: true }));
    await assertFails(cancelar('rh', 'procesada', { sinFirma: true }));
    for (const mala of [
      { ...base, nomina: N.aut2 }, { ...base, nombre: 'MALDONADO SALVADOR' }, { ...base, fecha: Timestamp.fromDate(new Date('2020-01-01')) },
      { ...base, rol: 'admin' }, { ...base, comoRH: true },
    ]) await assertFails(cancelar('solP', 'pendiente_aut1', { firma: mala }));
    await assertSucceeds(cancelar('solP', 'pendiente_aut1', { firma: base }));
  });
  it('no se tocan otros campos ni se cambia a otro estatus', async () => {
    await assertFails(cancelar('solP', 'pendiente_aut1', { extra: { motivo: 'Otro' } }));
    await assertFails(cancelar('solP', 'pendiente_aut1', { extra: { estatus: 'autorizada' } }));
    await assertFails(cancelar('aut2', 'pendiente_aut2', { extra: { folio: 'TE-2026-9999' } }));
  });
  // (Como en las demás transiciones, la app escribe el historial en el mismo lote; las reglas validan que el renglón, si viene, sea verdadero)
  it('el historial lleva la acción «cancelada» con el nombre real de quien cancela; un renglón falso o con otro nombre no pasa', async () => {
    await assertFails(cancelar('solP', 'pendiente_aut1', { historial: { porNombre: 'MALDONADO SALVADOR' } }));
    await assertFails(cancelar('aut1P', 'pendiente_aut1', { historial: { accion: 'autorizada_1' } }));
    await assertFails(cancelar('solP', 'pendiente_aut1', { historial: { campoExtra: 'x' } }));
  });
  it('quien cancela como RH sin serlo (o de otra área) no puede', async () => {
    await assertFails(cancelar('aut1A', 'pendiente_aut1', { comoRH: true }));
    await assertFails(cancelar('solP2', 'devuelta', { comoRH: true }));
    await assertFails(cancelar('ajeno', 'autorizada', { comoRH: true }));
  });
  it('un usuario dado de baja pierde el permiso aunque fuera el creador', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'usuarios', 'solP'), { nombre: NOMBRE('solP'), rol: 'usuario', nomina: N.solP, activo: false }); });
    await assertFails(cancelar('solP', 'pendiente_aut1'));
  });
  it('un Aut. 1 con la asignación vencida o revocada ya no cancela lo de su área', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'asignaciones', `${N.aut1P}_aut1_produccion`), { ...asig(N.aut1P, 'aut1', 'produccion'), activo: false }); });
    await assertFails(cancelar('aut1P', 'pendiente_aut1'));
  });
  it('una vez cancelada no se puede volver a cancelar ni cambiar el motivo', async () => {
    await assertSucceeds(cancelar('solP', 'pendiente_aut1'));
    for (const uid of ['solP', 'rh', 'admin', 'aut2']) await assertFails(cancelar(uid, 'pendiente_aut1', { comoRH: ['rh', 'admin'].includes(uid) }));
  });
});

describe('cancelar con transporte ya generado (RH)', () => {
  it('RH cancela una procesada con transporte solo si en el mismo lote la solicitud de transporte queda cancelada o marcada para revisión', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'solicitudes', 'sol1'), { estatus: 'aprobada', origen: 'tiempo_extra', tiempoExtraId: idDe('procesada'), creadoPor: 'rh', historial: [], areaId: 'produccion' });
      await setDoc(doc(db, 'tiempoExtra', idDe('procesada')), {
        areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: N.solP, creadoPorNombre: NOMBRE('solP'), fechaTE: '2026-11-02', motivo: 'Producción',
        estatus: 'procesada', folio: 'TE-2026-0005', solicitudTransporteId: 'sol1', resumen: { totalEmpleados: 1, totalHoras: 2, totalTransporte: 1, totalAlimentos: 1 },
        fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now(),
      });
    });
    await assertFails(cancelar('rh', 'procesada', { comoRH: true })); // sin tocar el transporte
    const db = dbDe('rh');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', idDe('procesada')), { estatus: 'cancelada', motivoCancelacion: MOTIVO, fechaActualizacion: ts(), canceladaPor: { nomina: N.rh, nombre: NOMBRE('rh'), fecha: ts(), comoRH: true } });
    b.update(doc(db, 'solicitudes', 'sol1'), { estatus: 'cancelada' });
    b.set(doc(collection(db, 'tiempoExtra', idDe('procesada'), 'historial')), { accion: 'cancelada', nivel: 0, porUid: 'rh', porNomina: N.rh, porNombre: NOMBRE('rh'), comentario: MOTIVO, fecha: ts() });
    await assertSucceeds(b.commit());
  });
});
