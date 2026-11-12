// Escenarios de tiempo extra "pesados" contra las reglas reales (emulador de Firestore): los usan firestore.rules.envio-completo.test.js (¿pasan?)
// y margen-expresiones.test.js (¿cuántas expresiones sobran?). Cada petición a Firestore tiene un tope de 1000 expresiones de reglas.
import { vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { datosTE, empleadoADoc, empleadoDesdePadron, resumenTE } from '../../src/utils/tiempoExtra.js';
import { MOTIVOS_INICIALES, motivoVacio } from '../../src/utils/motivosTE.js';

export const ANIO = new Date().getFullYear();
export const USUARIOS = {
  solP: { uid: 'solP', nomina: '50532', nombre: 'DOMINGUEZ LARA DIANA', rol: 'usuario' },
  aut1P: { uid: 'aut1P', nomina: '50610', nombre: 'RANGEL OROZCO FELIPE', rol: 'usuario' },
  aut2: { uid: 'aut2', nomina: '11', nombre: 'IBARRA SALAZAR ROBERTO', rol: 'usuario' },
  aut2s: { uid: 'aut2s', nomina: '12', nombre: 'ARANDA SOTO PATRICIA', rol: 'usuario' }, // Aut. 2 que además es solicitante de Producción (para capturar donde hay TE)
  rh: { uid: 'rh', nomina: '90001', nombre: 'NAVARRO PENA LUCIA', rol: 'rh' },
  adm: { uid: 'adm', nomina: '1', nombre: 'SISTEMAS DEMO', rol: 'admin' },
};
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 86400000));
const asig = (nomina, nombre, rol, areaId) => ({
  nomina, nombre, rol, areaId: rol === 'aut2' ? null : areaId, desde: ayer(), hasta: null, motivo: '', activo: true,
  asignadoPor: { uid: 'adm', nombre: 'Admin' }, fechaAsignacion: Timestamp.now(),
});

export const montar = (reglas, projectId = 'demo-solicitud-rutas-envio') => initializeTestEnvironment({ projectId, firestore: { rules: reglas } });

export async function sembrarBase(env, { padron = 160 } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of Object.values(USUARIOS)) await setDoc(doc(db, 'usuarios', u.uid), { nombre: u.nombre, rol: u.rol, nomina: u.nomina, activo: true });
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'asignaciones', `${USUARIOS.solP.nomina}_solicitante_produccion`), asig(USUARIOS.solP.nomina, USUARIOS.solP.nombre, 'solicitante', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${USUARIOS.aut2s.nomina}_solicitante_produccion`), asig(USUARIOS.aut2s.nomina, USUARIOS.aut2s.nombre, 'solicitante', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${USUARIOS.aut1P.nomina}_aut1_produccion`), asig(USUARIOS.aut1P.nomina, USUARIOS.aut1P.nombre, 'aut1', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${USUARIOS.aut2.nomina}_aut2_planta`), asig(USUARIOS.aut2.nomina, USUARIOS.aut2.nombre, 'aut2', null));
    await setDoc(doc(db, 'asignaciones', `${USUARIOS.aut2s.nomina}_aut2_planta`), asig(USUARIOS.aut2s.nomina, USUARIOS.aut2s.nombre, 'aut2', null));
    await setDoc(doc(db, 'contadores', `te-${ANIO}`), { ultimo: 12 });
    for (let i = 0; i < padron; i++) {
      await setDoc(doc(db, 'empleados', String(700 + i)), { nombre: `OPERADOR ${700 + i}`, nomina: String(700 + i), areaId: 'produccion', puesto: 'OPERADOR', turnoNomina: 'A', rutaId: i % 2 ? 'sur' : 'norte', comunidadId: 'c', puntoReunionId: 'p', activo: true });
    }
  });
}

/** Carga tiempoExtraDb con `db` = el Firestore autenticado de ese usuario (las reglas se aplican de verdad) */
export async function comoUsuario(env, uid) {
  vi.resetModules();
  const db = env.authenticatedContext(uid).firestore();
  vi.doMock('../../src/firebase.js', () => ({ db }));
  return { db, m: await import('../../src/utils/tiempoExtraDb.js') };
}

const turnos = [['7:00', '16:00'], ['16:00', '0:00'], ['19:00', '7:00']];
/** n empleados de Producción con transporte, en dos rutas (como salen del padrón de Diana), repartidos entre los motivos */
export const listaEmpleados = (n, nMotivos = 2) => Array.from({ length: n }, (_, i) => ({
  ...empleadoDesdePadron({ nomina: String(700 + i), nombre: `OPERADOR ${700 + i}`, puesto: 'OPERADOR', turnoNomina: 'A' }, {}),
  horaEntrada: turnos[0][0], horaSalida: turnos[0][1], rutaId: i % 2 ? 'sur' : 'norte', comunidadId: 'c', puntoReunionId: 'p',
  transporte: true, transporteLlegada: true, transporteSalida: true, alimentos: true, motivoIndex: i % nMotivos,
}));

const IDS_MOTIVOS = ['embarques-fin-de-semana', 'cargo-po', 'inventario-fisico', 'cubrir-vacante', 'cargo-tb'];
/** Lo que guarda la app con el motivo 2 "Cargo a P.O." (y, con 5, también "Cargo a TB"); justificación de rutas distintas incluida */
export function extrasTE(empleados, nMotivos = 2) {
  const motivos = IDS_MOTIVOS.slice(0, nMotivos).map(id => ({ ...motivoVacio(id), numero: id === 'cargo-po' ? '4551099797' : id === 'cargo-tb' ? 'TB12345' : '', detalle: 'pedido de exportación' }));
  return datosTE({ tipo: 'turno_extra', empleados, justificacionRutas: 'El personal vive en zonas distintas, norte y sur', nombreRuta: (id) => id, motivos, catalogoMotivos: MOTIVOS_INICIALES });
}

/** Siembra (sin reglas) una solicitud con sus empleados, tal como la deja la app */
export async function sembrarTE(env, { id, estatus, creador = 'solP', n = 4, nMotivos = 2, fechaTE = '2099-12-01', extra = {} }) {
  const lista = listaEmpleados(n, nMotivos);
  const u = USUARIOS[creador];
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'tiempoExtra', id), {
      areaId: 'produccion', areaNombre: 'Producción', creadoPor: u.uid, creadoPorNomina: u.nomina, creadoPorNombre: u.nombre,
      fechaTE, comentario: 'Se requiere apoyo para embarques y pedido urgente', estatus, resumen: resumenTE(lista), ...extrasTE(lista, nMotivos),
      fechaCreacion: Timestamp.now(), fechaActualizacion: Timestamp.now(), ...extra,
    });
    for (let i = 0; i < lista.length; i += 400) await Promise.all(lista.slice(i, i + 400).map(e => setDoc(doc(db, 'tiempoExtra', id, 'empleados', e.nomina), empleadoADoc(e))));
  });
  return lista;
}

const firma = (u, comentario = '') => ({ nomina: u.nomina, nombre: u.nombre, fecha: Timestamp.now(), comentario, comoRH: false });
const datosEnvio = (id, usuario, estatus, lista, nMotivos, devuelta = false) => ({
  id, devuelta, usuario, estatus, fechaTE: '2099-12-01', motivo: 'Embarques fin de semana', comentario: 'Se requiere apoyo para embarques y pedido urgente', empleados: lista, extras: extrasTE(lista, nMotivos),
});

/**
 * Los caminos de la captura y la autorización. `regla`: la línea `allow` de tiempoExtra que se evalúa (sirve para medir su margen de expresiones).
 * preparar() deja el estado de antes; ejecutar() hace la operación real de la app (src/utils/tiempoExtraDb.js) y lanza si las reglas la niegan.
 */
export const ESCENARIOS = [
  {
    id: 'crear-borrador', nombre: 'Crear el borrador (primer lote: 10 empleados, 5 motivos)', regla: /allow create: if activo\(\)\s*$/,
    preparar: async () => {},
    ejecutar: async (env) => {
      const { m } = await comoUsuario(env, 'solP');
      const lista = listaEmpleados(10, 5);
      await m.guardarBorrador({
        id: 'BR-AAAAAAAAAA', existe: false, usuario: USUARIOS.solP, area: { id: 'produccion', nombre: 'Producción' }, fechaTE: '2099-12-01', comentario: 'Se requiere apoyo para embarques y pedido urgente',
        empleados: lista, sucios: new Set(lista.map(e => e.nomina)), eliminados: new Set(), extras: extrasTE(lista, 5),
      });
    },
  },
  {
    id: 'guardar-borrador', nombre: 'Guardar el borrador de nuevo (150 empleados, 5 motivos; solo cambia la cabecera)', regla: /allow update: if antes\(\)\.estatus in \['devuelta', 'borrador'\] && despues\(\)\.estatus == antes\(\)\.estatus/,
    preparar: (env) => sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', n: 150, nMotivos: 5 }),
    ejecutar: async (env) => {
      const { m } = await comoUsuario(env, 'solP');
      const lista = listaEmpleados(150, 5);
      await m.guardarBorrador({
        id: 'BR-AAAAAAAAAA', existe: true, usuario: USUARIOS.solP, area: { id: 'produccion', nombre: 'Producción' }, fechaTE: '2099-12-02', comentario: 'Se requiere apoyo para embarques y pedido urgente',
        empleados: lista, sucios: new Set(), eliminados: new Set(), extras: extrasTE(lista, 5),
      });
    },
  },
  {
    id: 'enviar', nombre: 'Enviar (Diana: 4 empleados, 2 motivos, 2 rutas)', regla: /allow update: if antes\(\)\.estatus == 'borrador' && despues\(\)\.estatus in \['pendiente_aut1', 'pendiente_aut2'\]/,
    preparar: (env) => sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador' }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'solP'); await m.enviarSolicitud(datosEnvio('BR-AAAAAAAAAA', USUARIOS.solP, 'pendiente_aut1', listaEmpleados(4, 2), 2)); },
  },
  {
    id: 'enviar-150', nombre: 'Enviar (150 empleados, 5 motivos)', regla: /allow update: if antes\(\)\.estatus == 'borrador' && despues\(\)\.estatus in \['pendiente_aut1', 'pendiente_aut2'\]/,
    preparar: (env) => sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', n: 150, nMotivos: 5 }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'solP'); await m.enviarSolicitud(datosEnvio('BR-AAAAAAAAAA', USUARIOS.solP, 'pendiente_aut1', listaEmpleados(150, 5), 5)); },
  },
  {
    id: 'enviar-aut1', nombre: 'Enviar (el Aut. 1 del área: va directo a Aut. 2)', regla: /allow update: if antes\(\)\.estatus == 'borrador' && despues\(\)\.estatus in \['pendiente_aut1', 'pendiente_aut2'\]/,
    preparar: (env) => sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', creador: 'aut1P' }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'aut1P'); await m.enviarSolicitud(datosEnvio('BR-AAAAAAAAAA', USUARIOS.aut1P, 'pendiente_aut2', listaEmpleados(4, 2), 2)); },
  },
  {
    id: 'enviar-aut2', nombre: 'Enviar (Aut. 2 captura su propia solicitud: queda autorizada)', regla: /allow update: if antes\(\)\.estatus == 'borrador' && despues\(\)\.estatus == 'autorizada'/,
    preparar: (env) => sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', creador: 'aut2s' }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'aut2s'); await m.enviarSolicitud(datosEnvio('BR-AAAAAAAAAA', USUARIOS.aut2s, 'autorizada', listaEmpleados(4, 2), 2)); },
  },
  {
    id: 'enviar-admin', nombre: 'Enviar (admin captura su propia solicitud)', regla: /allow update: if antes\(\)\.estatus == 'borrador' && despues\(\)\.estatus == 'autorizada'/,
    preparar: (env) => sembrarTE(env, { id: 'BR-AAAAAAAAAA', estatus: 'borrador', creador: 'adm' }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'adm'); await m.enviarSolicitud(datosEnvio('BR-AAAAAAAAAA', USUARIOS.adm, 'autorizada', listaEmpleados(4, 2), 2)); },
  },
  {
    id: 'reenviar', nombre: 'Reenviar tras devolución', regla: /allow update: if antes\(\)\.estatus == 'devuelta' && despues\(\)\.estatus in \['pendiente_aut1', 'pendiente_aut2'\]/,
    preparar: (env) => sembrarTE(env, { id: 'TE-2026-0004', estatus: 'devuelta', extra: { folio: 'TE-2026-0004', aut1: firma(USUARIOS.aut1P), devolucion: { nivel: 2, nomina: '11', nombre: 'x', motivo: 'Faltan horas del turno', fecha: Timestamp.now() } } }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'solP'); await m.enviarSolicitud(datosEnvio('TE-2026-0004', USUARIOS.solP, 'pendiente_aut1', listaEmpleados(4, 2), 2, true)); },
  },
  {
    id: 'autorizar-1', nombre: 'Autorizar nivel 1 (Aut. 1)', regla: /allow update: if antes\(\)\.estatus == 'pendiente_aut1' && despues\(\)\.estatus == 'pendiente_aut2'/,
    preparar: (env) => sembrarTE(env, { id: 'TE-2026-0013', estatus: 'pendiente_aut1', extra: { folio: 'TE-2026-0013' } }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'aut1P'); await m.autorizarSolicitud({ id: 'TE-2026-0013', usuario: USUARIOS.aut1P, nivel: 1, comentario: 'Va bien' }); },
  },
  {
    id: 'autorizar-2', nombre: 'Autorizar nivel 2 (Aut. 2)', regla: /allow update: if antes\(\)\.estatus == 'pendiente_aut2' && despues\(\)\.estatus == 'autorizada'/,
    preparar: (env) => sembrarTE(env, { id: 'TE-2026-0013', estatus: 'pendiente_aut2', extra: { folio: 'TE-2026-0013', aut1: firma(USUARIOS.aut1P) } }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'aut2'); await m.autorizarSolicitud({ id: 'TE-2026-0013', usuario: USUARIOS.aut2, nivel: 2 }); },
  },
  {
    id: 'autorizar-varias', nombre: 'Autorización múltiple (3 solicitudes, cada una en su transacción)', regla: /allow update: if antes\(\)\.estatus == 'pendiente_aut2' && despues\(\)\.estatus == 'autorizada'/,
    preparar: async (env) => { for (const n of ['13', '14', '15']) await sembrarTE(env, { id: `TE-2026-00${n}`, estatus: 'pendiente_aut2', n: 150, nMotivos: 5, extra: { folio: `TE-2026-00${n}`, aut1: firma(USUARIOS.aut1P) } }); },
    ejecutar: async (env) => {
      const { m } = await comoUsuario(env, 'aut2');
      const r = await m.autorizarVarias({ tareas: ['TE-2026-0013', 'TE-2026-0014', 'TE-2026-0015'].map(id => ({ id, nivel: 2 })), usuario: USUARIOS.aut2, comoRH: false });
      if (r.fallidas.length) throw new Error(`Fallaron: ${JSON.stringify(r.fallidas)}`);
    },
  },
  {
    id: 'fuera-de-tiempo', nombre: 'Autorizar fuera de tiempo (vencida en nivel 1, sin Aut. 1)', regla: /allow update: if antes\(\)\.estatus in \['pendiente_aut1', 'pendiente_aut2'\] && despues\(\)\.estatus == 'autorizada'/,
    preparar: (env) => sembrarTE(env, { id: 'TE-2026-0013', estatus: 'pendiente_aut1', fechaTE: '2020-01-01', extra: { folio: 'TE-2026-0013' } }),
    ejecutar: async (env) => { const { m } = await comoUsuario(env, 'aut2'); await m.autorizarFueraDeTiempo({ id: 'TE-2026-0013', usuario: USUARIOS.aut2, motivo: 'No se autorizó a tiempo por ausencia del jefe' }); },
  },
];
