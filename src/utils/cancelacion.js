/**
 * cancelacion.js — Quién puede CANCELAR una solicitud de tiempo extra y en qué estatus (refleja firestore.rules; las pruebas de reglas
 * firestore.rules.cancelar.test.js comprueban la misma matriz). Sin dependencias del navegador.
 *
 *   Solicitante (creador): en autorización (nivel 1 o 2) o devuelta. Un borrador no se cancela: se elimina. Ya autorizada: avisa a RH.
 *   Aut. 1: lo de su área en nivel 1 (pendiente_aut1).
 *   Aut. 2: nivel 2 (pendiente_aut2) y autorizada que RH aún no confirma.
 *   RH y admin: cualquier solicitud ya enviada hasta «procesada» (si ya hay transporte, con el flujo de RH que lo cancela o avisa).
 * Siempre con motivo de 10 o más caracteres. «Devolver» regresa la solicitud para corregirla; «Cancelar» la saca: ya no va.
 */
import { MIN_MOTIVO_CANCELACION_RH } from './tiempoExtra.js';

export const MIN_MOTIVO_CANCELACION = MIN_MOTIVO_CANCELACION_RH;
export const TEXTO_YA_AUTORIZADA = 'Ya está autorizada. Para cancelarla, avisa a Recursos Humanos.';

export const ESTATUS_CANCELABLES = {
  creador: ['pendiente_aut1', 'pendiente_aut2', 'devuelta'],
  aut1: ['pendiente_aut1'],
  aut2: ['pendiente_aut2', 'autorizada'],
  rh: ['pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada'],
};

/**
 * @param {{ t: { estatus, creadoPor, areaId }, uid: string, esRH?: boolean, esAut2?: boolean, areasAut1?: string[] }} p
 * @returns {{ puede: boolean, flujoRH: boolean, mensaje: string|null }}
 *   flujoRH: RH sobre algo autorizado o ya confirmado usa el flujo que además cancela el transporte (o avisa si ya se envió al proveedor)
 *   mensaje: lo que se muestra EN LUGAR del botón cuando no puede (solo al solicitante, ya autorizada)
 */
export function quienPuedeCancelar({ t, uid, esRH = false, esAut2 = false, areasAut1 = [] }) {
  const e = t?.estatus;
  const creador = !!uid && t?.creadoPor === uid && ESTATUS_CANCELABLES.creador.includes(e);
  const aut1 = ESTATUS_CANCELABLES.aut1.includes(e) && areasAut1.includes(t?.areaId);
  const aut2 = !!esAut2 && ESTATUS_CANCELABLES.aut2.includes(e);
  const rh = !!esRH && ESTATUS_CANCELABLES.rh.includes(e);
  const puede = creador || aut1 || aut2 || rh;
  const flujoRH = rh && ['autorizada', 'procesada'].includes(e);
  const esCreador = !!uid && t?.creadoPor === uid;
  const mensaje = !puede && esCreador && ['autorizada', 'procesada'].includes(e) ? TEXTO_YA_AUTORIZADA : null;
  return { puede, flujoRH, mensaje };
}

/** "Cancelada por Oscar Acosta (RH) el 19/10/2026" a partir de la solicitud (null si no es una cancelada o no dice quién) */
export function quienCancelo(t, nombre = (x) => x) {
  if (t?.estatus !== 'cancelada' || !t.canceladaPor?.nombre) return null;
  const f = t.canceladaPor.fecha?.toDate?.() ?? (t.canceladaPor.fecha ? new Date(t.canceladaPor.fecha) : null);
  const fecha = f && !Number.isNaN(f.getTime()) ? ` el ${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}` : '';
  return `Cancelada por ${nombre(t.canceladaPor.nombre)}${t.canceladaPor.comoRH ? ' (RH)' : ''}${fecha}`;
}
