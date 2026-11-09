/**
 * limpiezaProduccion.js — Lógica pura de «Preparar para producción» (Herramientas, solo admin). Sin dependencias del navegador (se prueba en Node).
 *
 * Qué se borra (fase 2, solo tras escribir BORRAR): solicitudes de tiempo extra (con sus empleados e historial, borradores incluidos), solicitudes de
 * transporte (con sus pasajeros), ajustes de nómina, bitácora, contadores del folio y los usuarios de prueba que el admin marque.
 * Qué NO se toca nunca: empleados (padrón), teléfonos, áreas, puestos, turnos, motivos, rutas/comunidades/puntos, usuarios no marcados, asignaciones y accesos.
 */
import { correoDeAcceso, versionDe } from './accesos.js';

/** Lo que se pide al escribir para confirmar */
export const PALABRA_BORRAR = 'BORRAR';

/** Colecciones que la limpieza borra por completo */
export const COLECCIONES_A_BORRAR = ['tiempoExtra', 'solicitudes', 'ajustesNomina', 'bitacora', 'contadores'];
/** Colecciones que la limpieza no toca (se muestran como «se conservan») */
export const COLECCIONES_PROTEGIDAS = ['empleados', 'areas', 'puestos', 'turnosNomina', 'motivosTE', 'rutas', 'comunidades', 'puntosReunion', 'asignaciones', 'accesos'];

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

/** Un usuario no se puede marcar si es quien hace la limpieza */
export const puedeMarcarse = (u) => !u.esYo;

/**
 * Pasos de borrado en el orden en que deben ejecutarse: primero las subcolecciones (sus reglas leen al padre), luego los padres, luego el resto.
 * @returns {{ ruta: string[] }[]} cada `ruta` es el camino de un documento ([colección, id] o [colección, id, subcolección, id])
 */
export function rutasABorrar(colecciones, uidsUsuarios = []) {
  const rutas = [];
  for (const [col, subs] of [['tiempoExtra', ['empleados', 'historial']], ['solicitudes', ['pasajeros']]]) {
    for (const d of colecciones[col] ?? []) for (const s of subs) for (const x of d.sub?.[s] ?? []) rutas.push([col, d.id, s, x.id]);
  }
  for (const col of ['tiempoExtra', 'solicitudes', 'ajustesNomina', 'bitacora', 'contadores']) {
    for (const d of colecciones[col] ?? []) rutas.push([col, d.id]);
  }
  for (const uid of uidsUsuarios) rutas.push(['usuarios', uid]);
  return rutas;
}
