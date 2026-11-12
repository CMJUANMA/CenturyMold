// Regresión del error «maximum of 1000 expressions to evaluate has been reached» al enviar a autorización (prueba de usabilidad con Diana, Producción):
// el envío real de la app (guardar el borrador con 2 motivos, 2 rutas y justificación y enviarlo) y los caminos grandes y pesados, contra las reglas reales.
// Ejecutar con: npm run test:rules  (requiere Java 11+)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { ANIO, ESCENARIOS, USUARIOS, comoUsuario, extrasTE, listaEmpleados, montar, sembrarBase, sembrarTE } from './helpers/envio-te.js';

let env;
beforeAll(async () => { env = await montar(readFileSync('firestore.rules', 'utf8')); });
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await sembrarBase(env); });

const datosEnvio = () => ({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut1', extras: extrasTE(listaEmpleados(4, 2), 2) });
const guardarYEnviar = async (uid, usuario, estatus, n, nMotivos) => {
  const { db, m } = await comoUsuario(env, uid);
  const lista = listaEmpleados(n, nMotivos);
  const extras = extrasTE(lista, nMotivos);
  const comun = { fechaTE: '2099-12-01', motivo: extras.motivo, comentario: 'Se requiere apoyo para embarques y pedido urgente' };
  await m.guardarBorrador({
    id: 'BR-AAAAAAAAAA', existe: false, usuario, area: { id: 'produccion', nombre: 'Producción' }, ...comun, empleados: lista, sucios: new Set(lista.map(e => e.nomina)), eliminados: new Set(), extras,
  });
  const folio = await m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario, estatus, ...comun, empleados: lista, extras });
  return { db, m, folio };
};

describe('enviar a autorización (el borrador se guarda con la app y luego se envía)', () => {
  it('Diana: 4 empleados con transporte, 2 motivos (uno con P.O.) y 2 rutas con justificación', async () => {
    const { db, folio } = await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 4, 2);
    expect(folio).toBe(`TE-${ANIO}-0013`);
    const t = (await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data();
    expect(t).toMatchObject({ estatus: 'pendiente_aut1', rutasDistintas: 2 });
    expect(t.motivos.map(x => x.numero)).toEqual(['', '4551099797']);
    expect((await getDocs(collection(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados'))).size).toBe(4);
  });
  it('sus teléfonos se guardan aparte (empleadosContacto, otra escritura: la app los guarda antes de enviar y no van en el lote del envío)', async () => {
    const { db } = await comoUsuario(env, 'solP');
    const { guardarTelefonosEnPadron } = await import('../src/utils/contactosDb.js');
    await guardarTelefonosEnPadron({ 700: '4421000001', 701: '4421000002', 702: '4421000003', 703: '4421000004' });
    expect((await getDoc(doc(db, 'empleadosContacto', '700'))).data()).toMatchObject({ telefono: '4421000001' });
    const { folio } = await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 4, 2);
    expect(folio).toBe(`TE-${ANIO}-0013`);
  });
  it('40 empleados con 5 motivos', async () => { expect((await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 40, 5)).folio).toBe(`TE-${ANIO}-0013`); });
  it('150 empleados con 5 motivos (el máximo)', async () => { expect((await guardarYEnviar('solP', USUARIOS.solP, 'pendiente_aut1', 150, 5)).folio).toBe(`TE-${ANIO}-0013`); });
  it('el Aut. 1 del área: va directo a Aut. 2', async () => {
    const { db } = await guardarYEnviar('aut1P', USUARIOS.aut1P, 'pendiente_aut2', 4, 2);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('pendiente_aut2');
  });
  it('una Aut. 2 que captura su propia solicitud: queda autorizada (4 y 150 empleados, 5 motivos)', async () => {
    const { db } = await guardarYEnviar('aut2s', USUARIOS.aut2s, 'autorizada', 4, 2);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('autorizada');
    await sembrarBase(env);
    expect((await guardarYEnviar('aut2s', USUARIOS.aut2s, 'autorizada', 150, 5)).folio).toBe(`TE-${ANIO}-0013`);
  });
  it('el admin que captura su propia solicitud: queda autorizada (4 y 150 empleados, 5 motivos)', async () => {
    const { db } = await guardarYEnviar('adm', USUARIOS.adm, 'autorizada', 4, 2);
    expect((await getDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'))).data().estatus).toBe('autorizada');
    await sembrarBase(env);
    expect((await guardarYEnviar('adm', USUARIOS.adm, 'autorizada', 150, 5)).folio).toBe(`TE-${ANIO}-0013`);
  });
});

describe('los demás caminos pesados (solicitudes grandes ya sembradas)', () => {
  for (const e of ESCENARIOS.filter(x => !x.id.startsWith('enviar'))) {
    it(e.nombre, async () => { await e.preparar(env); await e.ejecutar(env); });
  }
});

describe('la seguridad sigue en pie', () => {
  it('quien no es el Aut. 1 no se salta su nivel, aunque mande todo bien formado', async () => {
    await ESCENARIOS[0].preparar(env);
    const { m } = await comoUsuario(env, 'solP');
    const lista = listaEmpleados(4, 2);
    await expect(m.enviarSolicitud({ id: 'BR-AAAAAAAAAA', devuelta: false, usuario: USUARIOS.solP, estatus: 'pendiente_aut2', fechaTE: '2099-12-01', motivo: 'x', comentario: 'Se requiere apoyo', empleados: lista, extras: extrasTE(lista, 2) })).rejects.toThrow();
  });
  it('con 2 rutas y sin justificación guardada no se envía; tampoco se puede agregar al enviar', async () => {
    await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', extra: { justificacionRutas: '' } });
    const { db, m } = await comoUsuario(env, 'solP');
    await expect(m.enviarSolicitud(datosEnvio())).rejects.toThrow();
    await expect(updateDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'), { estatus: 'pendiente_aut1', folio: `TE-${ANIO}-0013`, justificacionRutas: 'Ahora sí hay una justificación larga', fechaActualizacion: serverTimestamp() })).rejects.toThrow();
  });
  it('el contenido se valida al GUARDAR el borrador: motivos con campos de más, nombres enormes o de 6 en adelante se rechazan', async () => {
    await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador' });
    const { m } = await comoUsuario(env, 'solP');
    const lista = listaEmpleados(4, 2);
    const extras = extrasTE(lista, 2);
    const guardar = (motivos) => m.guardarBorrador({ id: 'BR-AAAAAAAAAA', existe: true, usuario: USUARIOS.solP, area: { id: 'produccion', nombre: 'Producción' }, fechaTE: '2099-12-01', comentario: 'Se requiere apoyo', empleados: lista, sucios: new Set(), eliminados: new Set(), extras: { ...extras, motivos } });
    await expect(guardar([{ ...extras.motivos[0], nombre: 'A'.repeat(61) }, extras.motivos[1]])).rejects.toThrow();
    await expect(guardar([{ ...extras.motivos[0], extra: 1 }, extras.motivos[1]])).rejects.toThrow();
    await expect(guardar(Array.from({ length: 6 }, () => extras.motivos[0]))).rejects.toThrow();
    await guardar(extras.motivos);
  });
  it('nadie ajeno sube el contador de folios por su cuenta', async () => {
    await ESCENARIOS[0].preparar(env);
    const { db } = await comoUsuario(env, 'solP');
    const { setDoc } = await import('firebase/firestore');
    await expect(setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: 'BR-AAAAAAAAAA' })).rejects.toThrow();
  });
});

// ── Enviar y reenviar solo cambian el estatus; el contenido solo se guarda validado ───────────────────────────────────────────────────────────────
describe('enviar y reenviar: la escritura solo puede tocar estatus, folio, firmas y fechas', () => {
  const hist = (accion) => ({ accion, nivel: 0, porUid: 'solP', porNomina: USUARIOS.solP.nomina, porNombre: USUARIOS.solP.nombre, comentario: '', fecha: serverTimestamp() });
  const empDe = (n) => ({ nombre: `OPERADOR ${n}`, puesto: 'OPERADOR', horaEntrada: '7:00', horaSalida: '16:00', horas: 9, requiereAlimentos: true, requiereTransporte: true, transporteLlegada: true, transporteSalida: true, rutaId: 'norte', comunidadId: 'c', puntoReunionId: 'p', motivoIndex: 0 });
  const ref = (db, ...ruta) => doc(db, ...ruta);

  /** Un envío (borrador) o reenvío (devuelta) como lo manda la app, más lo que se le quiera colar en el mismo lote */
  const lote = async ({ devuelta, cambios = {}, extra = () => {} }) => {
    const { db } = await comoUsuario(env, 'solP');
    const b = writeBatch(db);
    if (devuelta) {
      b.update(ref(db, 'tiempoExtra', 'TE-2026-0004'), { estatus: 'pendiente_aut1', aut1: deleteField(), aut2: deleteField(), fechaActualizacion: serverTimestamp(), ...cambios });
      b.set(doc(collection(db, 'tiempoExtra', 'TE-2026-0004', 'historial')), hist('reenviada'));
    } else {
      b.update(ref(db, 'tiempoExtra', 'BR-AAAAAAAAAA'), { estatus: 'pendiente_aut1', folio: `TE-${ANIO}-0013`, fechaActualizacion: serverTimestamp(), ...cambios });
      b.update(ref(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: 'BR-AAAAAAAAAA' });
      b.set(doc(collection(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'historial')), hist('enviada'));
    }
    extra(b, db, devuelta ? 'TE-2026-0004' : 'BR-AAAAAAAAAA');
    return b.commit();
  };
  const preparar = (devuelta) => (devuelta
    ? sembrarTE(env, { id: 'TE-2026-0004', estatus: 'devuelta', extra: { folio: 'TE-2026-0004', aut1: { nomina: '50610', nombre: 'x', fecha: new Date(), comentario: '', comoRH: false }, devolucion: { nivel: 2, nomina: '11', nombre: 'x', motivo: 'Faltan horas del turno', fecha: new Date() } } })
    : sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador' }));

  for (const devuelta of [false, true]) {
    const nombre = devuelta ? 'reenviar' : 'enviar';
    it(`${nombre}: el lote limpio pasa`, async () => {
      await preparar(devuelta);
      await lote({ devuelta });
    });
    it(`${nombre}: cualquier campo de contenido de la solicitud en el mismo lote se rechaza`, async () => {
      for (const cambios of [
        { fechaTE: '2099-12-31' }, { comentario: 'Cambiado al enviar' }, { motivo: 'Otro' }, { tipo: 'extension' }, { justificacionRutas: 'Una justificación nueva larga' },
        { motivos: [{ motivoId: 'x', nombre: 'x', numero: '', comentario: '', detalle: '', tipoNumero: '' }] }, { resumen: { totalEmpleados: 1, totalHoras: 1, totalTransporte: 0, totalAlimentos: 0, porBloque: {} } },
        { rutasDistintas: 1, desgloseRutas: [] }, { areaId: 'almacen' }, { creadoPor: 'otro' }, { areaNombre: 'Otra' }, { aut2: { nomina: '1' } }, { devolucion: { nivel: 1, nomina: '1', nombre: 'x', motivo: 'Falta algo importante', fecha: new Date() } },
      ]) {
        await sembrarBase(env); await preparar(devuelta);
        await expect(lote({ devuelta, cambios }), JSON.stringify(Object.keys(cambios))).rejects.toThrow();
      }
    });
    it(`${nombre}: agregar, cambiar o quitar empleados (horas, transporte, motivo) en el mismo lote se rechaza`, async () => {
      for (const extra of [
        (b, db, id) => b.set(ref(db, 'tiempoExtra', id, 'empleados', '710'), empDe('710')),
        (b, db, id) => b.set(ref(db, 'tiempoExtra', id, 'empleados', '700'), { ...empDe('700'), horas: 20, horaSalida: '5:00' }),
        (b, db, id) => b.set(ref(db, 'tiempoExtra', id, 'empleados', '700'), { ...empDe('700'), requiereTransporte: false, transporteLlegada: false, transporteSalida: false, rutaId: '', comunidadId: '', puntoReunionId: '' }),
        (b, db, id) => b.set(ref(db, 'tiempoExtra', id, 'empleados', '700'), { ...empDe('700'), motivoIndex: 1 }),
        (b, db, id) => b.delete(ref(db, 'tiempoExtra', id, 'empleados', '700')),
      ]) {
        await sembrarBase(env); await preparar(devuelta);
        await expect(lote({ devuelta, extra })).rejects.toThrow();
      }
    });
  }

  it('lo mismo para una Aut. 2 que captura y envía lo suyo (queda autorizada)', async () => {
    await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', creador: 'aut2s' });
    const { db } = await comoUsuario(env, 'aut2s');
    const armar = (extra) => {
      const b = writeBatch(db);
      b.update(ref(db, 'tiempoExtra', 'BR-AAAAAAAAAA'), {
        estatus: 'autorizada', folio: `TE-${ANIO}-0013`, fechaActualizacion: serverTimestamp(),
        aut2: { nomina: USUARIOS.aut2s.nomina, nombre: USUARIOS.aut2s.nombre, fecha: serverTimestamp(), comentario: 'Capturada y autorizada por Aut. 2', comoRH: false },
      });
      b.update(ref(db, 'contadores', `te-${ANIO}`), { ultimo: 13, solicitudId: 'BR-AAAAAAAAAA' });
      b.set(doc(collection(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'historial')), { ...hist('enviada_autorizada'), nivel: 2, porUid: 'aut2s', porNomina: USUARIOS.aut2s.nomina, porNombre: USUARIOS.aut2s.nombre });
      extra?.(b);
      return b.commit();
    };
    await expect(armar((b) => b.set(ref(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados', '700'), { ...empDe('700'), horas: 20 }))).rejects.toThrow();
    await armar();
  });
});

describe('el contenido del borrador solo se guarda validado', () => {
  const guardar = async (cambios, empleados = null) => {
    await sembrarBase(env);
    await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador' });
    const { db } = await comoUsuario(env, 'solP');
    const b = writeBatch(db);
    b.update(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA'), { fechaActualizacion: serverTimestamp(), ...cambios });
    for (const [n, e] of Object.entries(empleados ?? {})) b.set(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados', n), e);
    return b.commit();
  };
  const emp = { nombre: 'OPERADOR 700', puesto: 'OPERADOR', horaEntrada: '7:00', horaSalida: '16:00', horas: 9, requiereAlimentos: true, requiereTransporte: false, transporteLlegada: false, transporteSalida: false, rutaId: '', comunidadId: '', puntoReunionId: '', motivoIndex: 0 };

  it('un guardado válido pasa', async () => { await guardar({ comentario: 'Otro comentario válido', fechaTE: '2099-12-05' }, { 700: emp }); });
  it('rechaza fecha mal formada, textos enormes, resumen fuera de tope y más de 5 motivos', async () => {
    const motivo = { motivoId: 'x', nombre: 'x', numero: '', comentario: '', detalle: '', tipoNumero: '' };
    for (const cambios of [
      { fechaTE: '12/05/2099' }, { fechaTE: 'mañana' }, { comentario: 'x'.repeat(1001) }, { justificacionRutas: 'x'.repeat(1001) }, { motivo: 'x'.repeat(61) },
      { resumen: { totalEmpleados: 151, totalHoras: 1, totalTransporte: 0, totalAlimentos: 0, porBloque: {} } }, { resumen: { totalEmpleados: 1, totalHoras: 99999, totalTransporte: 0, totalAlimentos: 0, porBloque: {} } },
      { motivos: Array.from({ length: 6 }, () => motivo) }, { motivos: [{ ...motivo, extra: 1 }] }, { motivos: [{ ...motivo, nombre: 'x'.repeat(61) }] }, { tipo: 'turno_loco' },
      { estatus: 'autorizada' }, { folio: `TE-${ANIO}-0099` }, { creadoPor: 'otro' }, { areaId: 'almacen' },
    ]) await expect(guardar(cambios), JSON.stringify(Object.keys(cambios))).rejects.toThrow();
  });
  it('rechaza empleados mal formados: horas fuera de rango, campos de más, motivoIndex inválido o de otra área', async () => {
    for (const e of [{ ...emp, horas: 49 }, { ...emp, extra: 'x' }, { ...emp, motivoIndex: 5 }, { ...emp, nombre: 'x'.repeat(121) }, { ...emp, requiereAlimentos: 'si' }]) await expect(guardar({}, { 700: e })).rejects.toThrow();
    await expect((async () => {
      await sembrarBase(env);
      await sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador' });
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'empleados', '801'), { nombre: 'AJENO', nomina: '801', areaId: 'calidad' }); });
      const { db } = await comoUsuario(env, 'solP');
      await setDoc(doc(db, 'tiempoExtra', 'BR-AAAAAAAAAA', 'empleados', '801'), emp);
    })()).rejects.toThrow();
  });
});
