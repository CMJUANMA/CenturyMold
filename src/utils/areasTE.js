/**
 * areasTE.js — Áreas de tiempo extra: reglas departamento + puesto → área, y configuración inicial.
 * Sin dependencias del navegador (se prueba en Node).
 *
 * config/areasTE guarda { reglas: [{ depto, puestos?, area }] }. Se evalúan EN ORDEN y gana la primera
 * que coincida: depto igual y, si la regla trae `puestos`, puesto igual a alguno de ellos.
 * `area` es el id de una área de areasTE ('' = sin área: no participa en TE).
 */
import { clavePuesto } from './puestos.js';

/** Áreas iniciales (id = slug del nombre) */
export const AREAS_TE_INICIALES = [
  { id: 'produccion', nombre: 'Producción' },
  { id: 'almacen', nombre: 'Almacén' },
  { id: 'calidad', nombre: 'Calidad' },
  { id: 'mantenimiento', nombre: 'Mantenimiento' },
  { id: 'moldes', nombre: 'Moldes' },
];

export const REGLAS_AREA_TE_INICIALES = [
  { depto: '316', puestos: ['QUALITY INSPECTOR'], area: 'calidad' },
  { depto: '316', area: 'produccion' },
  { depto: '317', area: 'calidad' },
  { depto: '319', area: 'produccion' },
  { depto: '324', area: 'produccion' },
  { depto: '323', puestos: ['RESINER', 'SCRAP MILLER'], area: 'produccion' },
  { depto: '323', area: 'almacen' },
  { depto: '322', area: 'almacen' },
  { depto: '328', area: 'almacen' },
  { depto: '329', area: 'almacen' },
  { depto: '320', area: 'mantenimiento' },
  { depto: '321', area: 'moldes' },
  ...['318', '331', '461', '472', '474'].map(depto => ({ depto, area: '' })),
];

/** Configuración inicial de la matriz de autorización (por nómina), para pruebas */
export const MATRIZ_TE_INICIAL = {
  autorizador2Nomina: '11',        // Salvador Maldonado
  suplente2Nomina: '50296',        // Marco Espinosa
  areas: {
    produccion: { autorizador1Nomina: '50610', solicitantesNominas: ['50532', '50009', '50628', '50947'] },
    almacen: { autorizador1Nomina: '50988', solicitantesNominas: ['50901'] },
    calidad: { autorizador1Nomina: '50712', solicitantesNominas: ['50941'] },
    mantenimiento: { autorizador1Nomina: '50440', solicitantesNominas: ['50875'] },
    moldes: { autorizador1Nomina: '50874', solicitantesNominas: ['50272', '51070'] },
  },
};

const claveDepto = (d) => String(d ?? '').trim();

/**
 * Área de TE de un empleado según las reglas.
 * @returns {{ areaId: string, regla: object|null }} areaId '' = sin área; regla null = ninguna regla aplica
 */
export function calcularAreaTE(depto, puesto, reglas = REGLAS_AREA_TE_INICIALES) {
  const d = claveDepto(depto);
  const p = clavePuesto(puesto);
  for (const regla of reglas) {
    if (claveDepto(regla.depto) !== d) continue;
    if (regla.puestos?.length && !regla.puestos.some(x => clavePuesto(x) === p)) continue;
    return { areaId: regla.area ?? '', regla };
  }
  return { areaId: '', regla: null };
}
