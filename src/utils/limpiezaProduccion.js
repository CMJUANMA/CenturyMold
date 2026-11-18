/**
 * limpiezaProduccion.js — Lógica pura de «Preparar para producción» (Herramientas, solo admin). Sin dependencias del navegador (se prueba en Node).
 *
 * Qué se borra (fase 2, solo tras escribir BORRAR): solicitudes de tiempo extra (con sus empleados e historial, borradores incluidos), solicitudes de
 * transporte (con sus pasajeros), ajustes de nómina, bitácora, contadores del folio y los usuarios de prueba que el admin marque.
 * Opcional: «todos los usuarios excepto los administradores» (su perfil y su accesos/{nómina}; las asignaciones NO, van por nómina y son la
 * configuración real) y los catálogos de transporte de prueba (rutas, comunidades y puntos, y la ruta/comunidad/punto de cada empleado).
 * Qué NO se toca nunca: nómina, nombre, puesto, área, teléfono y elegible TE del padrón, áreas, puestos, turnos, motivos, asignaciones y administradores.
 */
import { correoDeAcceso, versionDe } from './accesos.js';

/** Lo que se pide al escribir para confirmar */
export const PALABRA_BORRAR = 'BORRAR';

/** Colecciones que la limpieza borra por completo */
export const COLECCIONES_A_BORRAR = ['tiempoExtra', 'solicitudes', 'ajustesNomina', 'bitacora', 'contadores'];
/** Colecciones que la limpieza no toca (se muestran como «se conservan») */
export const COLECCIONES_PROTEGIDAS = ['empleados', 'areas', 'puestos', 'turnosNomina', 'motivosTE', 'rutas', 'comunidades', 'puntosReunion', 'asignaciones', 'accesos'];
/** Catálogos de transporte que se borran solo si se marca «Borrar también los catálogos de transporte de prueba» */
export const COLECCIONES_TRANSPORTE = ['rutas', 'comunidades', 'puntosReunion'];
/** Campos del padrón que se vacían junto con los catálogos de transporte (nada más del empleado se toca) */
export const CAMPOS_TRANSPORTE_EMPLEADO = ['rutaId', 'comunidadId', 'puntoReunionId'];

/**
 * Inventario de lo que se borraría, a partir de lo que ya se leyó para el respaldo.
 * @param {Record<string, { id: string, data: object, sub?: Record<string, { id: string, data: object }[]> | null }[]>} colecciones
 * @param {{ uid?: string, nomina?: string }} yo  quien hace la limpieza (nunca se ofrece para borrar)
 */
export function armarInventario(colecciones, yo = {}) {
  const lista = (n) => colecciones[n] ?? [];
  const sub = (d, s) => d.sub?.[s]?.length ?? 0;
  const te = lista('tiempoExtra');
  const tr = lista('solicitudes');
  const padron = new Set(lista('empleados').map(e => String(e.data?.nomina ?? e.id)));
  const asignacionesDe = new Map();
  for (const a of lista('asignaciones')) asignacionesDe.set(String(a.data?.nomina), (asignacionesDe.get(String(a.data?.nomina)) ?? 0) + 1);

  const usuarios = lista('usuarios').map(u => {
    const nomina = String(u.data?.nomina ?? '');
    return {
      uid: u.id, nomina, nombre: u.data?.nombre ?? '', rol: u.data?.rol ?? '', activo: u.data?.activo !== false,
      enPadron: padron.has(nomina), esYo: u.id === yo.uid || (!!yo.nomina && nomina === String(yo.nomina)), asignaciones: asignacionesDe.get(nomina) ?? 0,
      // Parece de prueba: su nómina no está en el padrón (nunca lo es quien eres tú)
      parecePrueba: !padron.has(nomina) && !(u.id === yo.uid || (!!yo.nomina && nomina === String(yo.nomina))),
    };
  }).sort((a, b) => Number(b.parecePrueba) - Number(a.parecePrueba) || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    conteo: {
      tiempoExtra: te.length,
      tiempoExtraEmpleados: te.reduce((n, d) => n + sub(d, 'empleados'), 0),
      tiempoExtraHistorial: te.reduce((n, d) => n + sub(d, 'historial'), 0),
      borradores: te.filter(d => d.data?.estatus === 'borrador').length,
      solicitudes: tr.length,
      pasajeros: tr.reduce((n, d) => n + sub(d, 'pasajeros'), 0),
      ajustesNomina: lista('ajustesNomina').length,
      bitacora: lista('bitacora').length,
      contadores: lista('contadores').length,
    },
    // Lo que borra la opción de catálogos de transporte (no entra en «se borraría» a menos que se marque)
    transporte: {
      rutas: lista('rutas').length, comunidades: lista('comunidades').length, puntosReunion: lista('puntosReunion').length,
      empleadosConRuta: empleadosConTransporte(colecciones).length,
    },
    protegidos: Object.fromEntries(COLECCIONES_PROTEGIDAS.map(n => [n, lista(n).length])),
    folios: {
      tiempoExtra: te.map(d => ({ id: d.id, folio: d.data?.folio ?? '(borrador)', estatus: d.data?.estatus ?? '', area: d.data?.areaNombre ?? '', fecha: d.data?.fechaTE ?? '' }))
        .sort((a, b) => a.folio.localeCompare(b.folio)),
      solicitudes: tr.map(d => ({ id: d.id, folio: d.data?.folio ?? d.id, estatus: d.data?.estatus ?? '', origen: d.data?.origen ?? '' }))
        .sort((a, b) => String(a.folio).localeCompare(String(b.folio))),
    },
    usuarios,
  };
}

/**
 * Cuentas de Firebase Authentication que habrá que borrar a mano en la consola (sin Cloud Functions no se puede desde la app): una por cada
 * versión de acceso de cada usuario marcado ({nomina}@rutas.app, {nomina}.v2@rutas.app…). `accesos`: nómina → documento accesos/{nomina} (o undefined).
 * @returns {{ nomina: string, nombre: string, correos: string[] }[]}
 */
export function cuentasAuthABorrar(usuariosMarcados, accesos = new Map()) {
  return usuariosMarcados.map(u => {
    const version = versionDe(accesos.get(String(u.nomina)));
    return { nomina: u.nomina, nombre: u.nombre, correos: Array.from({ length: version }, (_, i) => correoDeAcceso(u.nomina, i + 1)) };
  });
}

/** Usuarios que borra «todos excepto los administradores» (nunca quien hace la limpieza) */
export const usuariosNoAdmin = (usuarios) => usuarios.filter(u => u.rol !== 'admin' && !u.esYo);

/**
 * Cuentas de Authentication de los administradores. `vigentes`: las que se conservan (una por admin, la versión de su accesos).
 * `viejas`: versiones anteriores que dejó «Restablecer contraseña» (ya no sirven; se pueden borrar con el resto).
 */
export function cuentasAuthDeAdmins(admins, accesos = new Map()) {
  const vigentes = []; const viejas = [];
  for (const u of admins) {
    const version = versionDe(accesos.get(String(u.nomina)));
    vigentes.push({ nomina: u.nomina, nombre: u.nombre, correo: correoDeAcceso(u.nomina, version) });
    for (let v = 1; v < version; v++) viejas.push({ nomina: u.nomina, nombre: u.nombre, correo: correoDeAcceso(u.nomina, v) });
  }
  return { vigentes, viejas };
}

/** Empleados del padrón con ruta, comunidad o punto guardados (los que la limpieza de catálogos deja en blanco) */
export const empleadosConTransporte = (colecciones) =>
  (colecciones.empleados ?? []).filter(e => CAMPOS_TRANSPORTE_EMPLEADO.some(c => String(e.data?.[c] ?? '') !== ''));

/** Un usuario no se puede marcar si es quien hace la limpieza */
export const puedeMarcarse = (u) => !u.esYo;

/**
 * Pasos de borrado en el orden en que deben ejecutarse: primero las subcolecciones (sus reglas leen al padre), luego los padres, luego el resto.
 * @returns {{ ruta: string[] }[]} cada `ruta` es el camino de un documento ([colección, id] o [colección, id, subcolección, id])
 */
export function rutasABorrar(colecciones, uidsUsuarios = [], { nominasAccesos = [], catalogosTransporte = false } = {}) {
  const rutas = [];
  for (const [col, subs] of [['tiempoExtra', ['empleados', 'historial']], ['solicitudes', ['pasajeros']]]) {
    for (const d of colecciones[col] ?? []) for (const s of subs) for (const x of d.sub?.[s] ?? []) rutas.push([col, d.id, s, x.id]);
  }
  for (const col of ['tiempoExtra', 'solicitudes', 'ajustesNomina', 'bitacora', 'contadores']) {
    for (const d of colecciones[col] ?? []) rutas.push([col, d.id]);
  }
  if (catalogosTransporte) for (const col of ['puntosReunion', 'comunidades', 'rutas']) for (const d of colecciones[col] ?? []) rutas.push([col, d.id]);
  for (const uid of uidsUsuarios) rutas.push(['usuarios', uid]);
  for (const n of nominasAccesos) rutas.push(['accesos', String(n)]);
  return rutas;
}
