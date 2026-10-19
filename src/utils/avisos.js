/**
 * avisos.js — A quién hay que avisarle en cada paso de una solicitud de tiempo extra (recordatorios en pantalla). Sin dependencias del navegador.
 *
 * Los nombres salen SOLO de las asignaciones vigentes (nombre y puesto copiados del padrón al asignar); nunca de usuarios.
 *   pendiente_aut1 → los Aut. 1 vigentes del área · pendiente_aut2 → los Aut. 2 vigentes (por nivel jerárquico del puesto)
 *   devuelta → quien la solicitó
 */
import { ROL_OP, esVigente, nivelJerarquicoValido } from './asignaciones';
import { crearFormateadorNombres } from './nombresPersona';
import { AVISOS } from './ayudas';
import { esperaDesde, haceTiempo } from './tiempoExtra';

/** Nivel que debe revisar la solicitud según su estatus (null si no está pendiente) */
export const nivelPendiente = (estatus) => (estatus === 'pendiente_aut1' ? 1 : estatus === 'pendiente_aut2' ? 2 : null);

/**
 * Asignaciones vigentes que deben recibir el aviso del nivel dado, sin la persona que actúa (nadie se avisa a sí misma).
 * Nivel 1: Aut. 1 del área. Nivel 2: Aut. 2, del puesto más alto al más bajo (menor nivel jerárquico primero; sin nivel, al final) y por nombre.
 * @param {object} p
 * @param {1|2} p.nivel
 * @param {string} [p.areaId]            solo para el nivel 1
 * @param {object[]} p.asignaciones
 * @param {object[]} [p.puestos]         catálogo [{ id, nivelJerarquico }]
 * @param {string} [p.excluirNomina]
 */
export function destinatariosDe({ nivel, areaId, asignaciones, puestos = [], excluirNomina = '', ahora = new Date() }) {
  const nivelPorPuesto = new Map((puestos ?? []).map(p => [p.id, nivelJerarquicoValido(p.nivelJerarquico)]));
  const rol = nivel === 1 ? ROL_OP.AUT1 : ROL_OP.AUT2;
  const lista = (asignaciones ?? []).filter(a => a.rol === rol
    && esVigente(a, ahora)
    && (nivel !== 1 || a.areaId === areaId)
    && String(a.nomina) !== String(excluirNomina ?? ''));
  // Una misma persona no se repite
  const unicas = [...new Map(lista.map(a => [String(a.nomina), a])).values()];
  const rango = (a) => nivelPorPuesto.get(a.puestoId) ?? Infinity;
  return unicas.sort((x, y) => rango(x) - rango(y) || String(x.nombre ?? '').localeCompare(String(y.nombre ?? ''), 'es'));
}

/** "Jose Anselmo Mendoza (Aut. 1 de Mantenimiento)" · "Ana Lopez (Aut. 2 · Gerente de planta)" */
export function lineaDestinatario(a, { formato, nombreArea = (id) => id, soloNombre = false } = {}) {
  const nombre = (formato ?? crearFormateadorNombres([])).nombre(a.nombre ?? a.nomina);
  if (soloNombre) return nombre;
  const detalle = a.rol === ROL_OP.AUT1
    ? `Aut. 1 de ${nombreArea(a.areaId)}`
    : `Aut. 2${a.puesto ? ` · ${a.puesto}` : ''}`;
  return `${nombre} (${detalle})`;
}

/** Formateador de nombres armado con los nombres de las propias asignaciones (el padrón no se lee) */
export const formatoDeAsignaciones = (asignaciones) => crearFormateadorNombres((asignaciones ?? []).map(a => a.nombre).filter(Boolean));

/** Arma el aviso a partir de los destinatarios. Devuelve { tono, titulo, texto } */
const aviso = (tono, titulo, texto) => ({ tono, titulo, texto });
const nombresDe = (dest, opciones) => dest.map(a => lineaDestinatario(a, { formato: formatoDeAsignaciones(dest), ...opciones }));

/** Después de ENVIAR (o reenviar) una solicitud: va a Aut. 1 o, si salta el nivel 1, a Aut. 2; si la envió un Aut. 2 ya queda autorizada y RH la tiene */
export function avisoEnvio({ folio, estatus, reenviada = false, destinatarios, opciones }) {
  if (estatus === 'autorizada') return aviso('exito', AVISOS.titulos.autorizada, AVISOS.listaEnRH());
  const nivel = nivelPendiente(estatus) ?? 1;
  return aviso('info', reenviada ? AVISOS.titulos.reenviada : AVISOS.titulos.enviada, AVISOS.paraAvisar({
    folio, destino: AVISOS.destinoNivel[nivel], lista: AVISOS.unir(nombresDe(destinatarios, opciones)), accion: reenviada ? 'reenvió' : 'envió',
  }));
}

/** Después de que alguien AUTORIZA: el nivel 1 avisa a los Aut. 2; el nivel 2 solo confirma que RH ya la tiene */
export function avisoAutorizacion({ nivel, folio, destinatarios = [], opciones }) {
  if (nivel === 1) return aviso('exito', AVISOS.titulos.autorizada, AVISOS.autorizadaPasa({ folio, lista: AVISOS.unir(nombresDe(destinatarios, opciones)) }));
  return aviso('exito', AVISOS.titulos.autorizada, AVISOS.listaEnRH());
}

/** Después de autorizar varias a la vez */
export function avisoAutorizacionVarias({ nivel, cantidad, destinatarios = [], opciones }) {
  if (nivel === 1) return aviso('exito', AVISOS.titulos.autorizada, AVISOS.autorizadasPasan({ cantidad, lista: AVISOS.unir(nombresDe(destinatarios, opciones)) }));
  return aviso('exito', AVISOS.titulos.autorizada, AVISOS.listasEnRH({ cantidad }));
}

/** Después de DEVOLVER: hay que avisarle a quien la solicitó. `solicitante` ya viene en formato de nombre de pila */
export const avisoDevolucion = ({ folio, solicitante }) => aviso('aviso', AVISOS.titulos.devuelta, AVISOS.devuelta({ folio, solicitante }));

/**
 * Línea de "Mis solicitudes" para una solicitud pendiente: "Pendiente con: A, B · en espera desde hace 2 días". null si no está pendiente.
 * @param {object} t   solicitud (estatus, areaId, fechaActualizacion/fechaCreacion)
 * @param {object} p   { asignaciones, puestos, excluirNomina, nombreArea, ahora }
 */
export function lineaPendiente(t, { asignaciones, puestos = [], excluirNomina = '', nombreArea, ahora = Date.now() } = {}) {
  const nivel = nivelPendiente(t.estatus);
  if (!nivel) return null;
  const destinatarios = destinatariosDe({ nivel, areaId: t.areaId, asignaciones, puestos, excluirNomina, ahora: new Date(ahora) });
  const formato = formatoDeAsignaciones(asignaciones);
  return AVISOS.pendienteCon({ lista: AVISOS.unir(nombresDe(destinatarios, { formato, nombreArea, soloNombre: true })), desde: haceTiempo(esperaDesde(t), ahora) });
}
