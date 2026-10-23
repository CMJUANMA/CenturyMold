/**
 * motivosTE.js — Motivos del tiempo extra (sin dependencias del navegador; se prueba en Node).
 *
 * El catálogo (colección motivosTE) lo editan RH y admin: { nombre, orden, activo, requiereNumero: 'po'|'tb'|null, requiereComentario }.
 * Una solicitud guarda `motivos`: [{ motivoId, nombre, numero, comentario, detalle, tipoNumero }] (el nombre se COPIA para conservar el
 * historial aunque el catálogo cambie; tipoNumero = 'po' | 'tb' | '' copia lo que pedía el motivo) y cada empleado, `motivoIndex`.
 * Las solicitudes anteriores traen solo `motivo` (+ `motivoOtro`): se siguen mostrando tal como están (motivosDeTE las normaliza; nada se migra).
 */

export const MAX_MOTIVOS_TE = 5;
export const NUMERO_PO = { min: 6, max: 15 };
export const MAX_NUMERO_TB = 20;
export const MIN_COMENTARIO_MOTIVO = 10;
export const MAX_COMENTARIO_MOTIVO = 200;
export const MAX_DETALLE_MOTIVO = 120;
export const MAX_NOMBRE_MOTIVO = 60;
export const AVISO_PROGRAM_MANAGER = 'Requiere firma del Program Manager';
export const TIPOS_NUMERO = { po: 'P.O.', tb: 'TB' };

/** Carga inicial del catálogo, en este orden. El id del documento es fijo para que sembrarlo dos veces no duplique nada */
export const MOTIVOS_INICIALES = [
  { id: 'cubrir-vacante', nombre: 'Cubrir vacante / falta de personal' },
  { id: 'embarques-fin-de-semana', nombre: 'Embarques fin de semana' },
  { id: 'inventario-fisico', nombre: 'Inventario físico' },
  { id: 'cubrir-vacaciones', nombre: 'Cubrir vacaciones / cumpleaños / incapacidad' },
  { id: 'adecuacion-contenedores', nombre: 'Adecuación de contenedores' },
  { id: 'cubrir-brigada', nombre: 'Cubrir tiempo de la brigada' },
  { id: 'cargo-po', nombre: 'Cargo a P.O.', requiereNumero: 'po' },
  { id: 'cargo-tb', nombre: 'Cargo a TB', requiereNumero: 'tb' },
  { id: 'otro', nombre: 'Otro', requiereComentario: true },
].map((m, i) => ({ requiereNumero: null, requiereComentario: false, activo: true, ...m, orden: i + 1 }));

const texto = (v) => String(v ?? '').trim();

/** Catálogo ordenado: por `orden` y luego por nombre */
export const ordenarMotivos = (lista) => [...lista].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || texto(a.nombre).localeCompare(texto(b.nombre), 'es'));

/** Un motivo vacío del editor (`clave` solo sirve para la lista de React) */
let contador = 0;
export const motivoVacio = (motivoId = '') => ({ clave: `m${++contador}`, motivoId, numero: '', comentario: '', detalle: '' });

/** Lo que pide el motivo elegido: { nombre, requiereNumero: 'po'|'tb'|null, requiereComentario }. Si ya no está en el catálogo, se usa lo guardado */
export function reglasDeMotivo(item, catalogo = []) {
  const c = catalogo.find(x => x.id === item?.motivoId);
  if (c) return { nombre: c.nombre ?? '', requiereNumero: c.requiereNumero === 'po' || c.requiereNumero === 'tb' ? c.requiereNumero : null, requiereComentario: c.requiereComentario === true, activo: c.activo !== false, enCatalogo: true };
  const tipo = item?.tipoNumero === 'po' || item?.tipoNumero === 'tb' ? item.tipoNumero : null;
  return { nombre: texto(item?.nombre), requiereNumero: tipo, requiereComentario: !!texto(item?.comentario), activo: false, enCatalogo: false };
}

/** Número limpio para guardarlo: P.O. solo dígitos; TB en mayúsculas y sin espacios */
export const limpiarNumero = (valor, tipo) => (tipo === 'po' ? String(valor ?? '').replace(/\D/g, '').slice(0, NUMERO_PO.max) : String(valor ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, MAX_NUMERO_TB));

export const numeroValido = (numero, tipo) => (tipo === 'po'
  ? new RegExp(`^\\d{${NUMERO_PO.min},${NUMERO_PO.max}}$`).test(numero)
  : tipo === 'tb' ? new RegExp(`^[A-Za-z0-9]{1,${MAX_NUMERO_TB}}$`).test(numero) : true);

const claveRepetido = (item, r) => `${item.motivoId}|${r.requiereNumero ? texto(item.numero).toUpperCase() : ''}|${r.requiereComentario ? texto(item.comentario).toLowerCase() : ''}`;

/**
 * Problemas de los motivos de una solicitud, para enviarla. Cada uno: { mensaje, indice }.
 * @param {{ motivoId, numero, comentario, detalle }[]} items  los del editor
 * @param {object[]} catalogo
 */
export function problemasDeMotivos(items = [], catalogo = []) {
  const p = [];
  if (items.length === 0) return [{ mensaje: 'Elige el motivo.', indice: 0 }];
  if (items.length > MAX_MOTIVOS_TE) p.push({ mensaje: `Máximo ${MAX_MOTIVOS_TE} motivos por solicitud.`, indice: MAX_MOTIVOS_TE });
  const vistos = new Set();
  items.forEach((item, i) => {
    const cuando = items.length > 1 ? `Motivo ${i + 1}: ` : '';
    const error = (m) => p.push({ mensaje: `${cuando}${m}`, indice: i });
    if (!item.motivoId) return error('Elige el motivo.');
    const r = reglasDeMotivo(item, catalogo);
    if (r.requiereNumero === 'po' && !numeroValido(texto(item.numero), 'po')) error(`El número de P.O. debe tener solo dígitos (de ${NUMERO_PO.min} a ${NUMERO_PO.max}).`);
    if (r.requiereNumero === 'tb' && !numeroValido(texto(item.numero), 'tb')) error(`El número de TB es obligatorio: letras y números, hasta ${MAX_NUMERO_TB} caracteres.`);
    if (r.requiereComentario) {
      const n = texto(item.comentario).length;
      if (n < MIN_COMENTARIO_MOTIVO) error(`Describe el motivo (al menos ${MIN_COMENTARIO_MOTIVO} caracteres).`);
      else if (n > MAX_COMENTARIO_MOTIVO) error(`La descripción admite máximo ${MAX_COMENTARIO_MOTIVO} caracteres.`);
    }
    if (texto(item.detalle).length > MAX_DETALLE_MOTIVO) error(`El detalle admite máximo ${MAX_DETALLE_MOTIVO} caracteres.`);
    const k = claveRepetido(item, r);
    if (vistos.has(k)) error(`${r.nombre}${texto(item.numero) ? ` ${texto(item.numero)}` : ''} está repetido.`);
    vistos.add(k);
  });
  return p;
}

/**
 * Lo que se guarda en la solicitud: [{ motivoId, nombre, numero, comentario, detalle, tipoNumero }] (textos recortados; sin campos que no aplican).
 * Conserva las posiciones (el motivoIndex de cada empleado apunta a ellas): un motivo aún sin elegir de un borrador se guarda vacío.
 */
export function motivosParaGuardar(items = [], catalogo = []) {
  return items.slice(0, MAX_MOTIVOS_TE).map(item => {
    const r = reglasDeMotivo(item, catalogo);
    return {
      motivoId: item.motivoId, nombre: r.nombre || texto(item.nombre),
      numero: r.requiereNumero ? texto(item.numero) : '', comentario: r.requiereComentario ? texto(item.comentario) : '', detalle: texto(item.detalle),
      tipoNumero: r.requiereNumero ?? '',
    };
  });
}

/** Motivo para el editor a partir de uno guardado (conserva el nombre por si el catálogo ya no lo trae) */
export const motivoDesdeGuardado = (m) => ({ ...motivoVacio(m?.motivoId ?? ''), numero: m?.numero ?? '', comentario: m?.comentario ?? '', detalle: m?.detalle ?? '', nombre: m?.nombre ?? '', tipoNumero: m?.tipoNumero ?? '' });

// ── Lectura de una solicitud (nueva o anterior) ──────────────────────────────────────────────────

/**
 * Los motivos de una solicitud, normalizados. Las anteriores (solo `motivo` y `motivoOtro`) salen como un motivo sin id:
 * "Otro" con su ¿Cuál? como comentario, igual que se mostraban.
 */
export function motivosDeTE(t) {
  if (Array.isArray(t?.motivos) && t.motivos.length) {
    return t.motivos.map(m => ({
      motivoId: m.motivoId ?? '', nombre: texto(m.nombre), numero: texto(m.numero), comentario: texto(m.comentario), detalle: texto(m.detalle),
      tipoNumero: m.tipoNumero === 'po' || m.tipoNumero === 'tb' ? m.tipoNumero : '',
    }));
  }
  const motivo = texto(t?.motivo);
  if (!motivo) return [];
  return [{ motivoId: '', nombre: motivo, numero: '', comentario: motivo === 'Otro' ? texto(t?.motivoOtro) : '', detalle: '', tipoNumero: '' }];
}

/** "Cargo a P.O. 4551099797" · "Inventario físico · apoyo a inventario" · "Otro: Visita de cliente". `conNumero: false` lo omite (P.O./TB va en su columna) */
export function etiquetaMotivo(m, { conNumero = true } = {}) {
  if (!m) return '';
  let s = m.nombre;
  if (conNumero && m.numero) s += ` ${m.numero}`;
  if (m.comentario) s += `: ${m.comentario}`;
  if (m.detalle) s += ` · ${m.detalle}`;
  return s;
}

/** Todos los motivos de la solicitud en una línea (el "Motivo" de los Excel y del detalle); '' si no hay */
export const motivoTexto = (t) => motivosDeTE(t).map(m => etiquetaMotivo(m)).filter(Boolean).join(' / ');

/** El motivo de un empleado: el de su `motivoIndex` (por defecto el primero) */
export function motivoDeEmpleado(t, e) {
  const lista = motivosDeTE(t);
  return lista[Number.isInteger(e?.motivoIndex) ? e.motivoIndex : 0] ?? lista[0] ?? null;
}

/** El motivo de un empleado en texto; '' si la solicitud no tiene */
export const motivoTextoEmpleado = (t, e, opciones) => etiquetaMotivo(motivoDeEmpleado(t, e), opciones);

/** P.O. o TB de la solicitud: [{ tipo: 'po'|'tb', numero }] sin repetir */
export function numerosDeTE(t) {
  const vistos = new Set();
  return motivosDeTE(t).filter(m => m.numero).map(m => ({ tipo: m.tipoNumero || 'po', numero: m.numero }))
    .filter(n => { const k = `${n.tipo}|${n.numero}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

/** ¿Lleva P.O. o TB? Entonces necesita la firma del Program Manager */
export const requiereProgramManager = (t) => numerosDeTE(t).length > 0;

/** "P.O. 4551099797" · "TB AB12" */
export const textoNumero = (n) => `${TIPOS_NUMERO[n.tipo] ?? ''} ${n.numero}`.trim();

/** ¿La solicitud tiene ese motivo? Por id; las anteriores (sin id) por nombre, contra el catálogo */
export function tieneMotivo(t, motivoId, catalogo = []) {
  if (!motivoId) return true;
  const nombre = catalogo.find(c => c.id === motivoId)?.nombre;
  return motivosDeTE(t).some(m => (m.motivoId ? m.motivoId === motivoId : !!nombre && m.nombre === nombre));
}

/** Después de quitar el motivo `indice`: a dónde apunta ahora el motivoIndex de un empleado */
export function reajustarIndice(motivoIndex, quitado) {
  const i = Number.isInteger(motivoIndex) ? motivoIndex : 0;
  return i === quitado ? 0 : i > quitado ? i - 1 : i;
}
