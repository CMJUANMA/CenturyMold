/**
 * horas.js — Cómo se muestran las horas. Los datos se guardan igual que siempre ("7:00", "16:00", "4:00PM"); aquí solo cambia lo que se ve.
 *   En la app: 12 horas con a. m. / p. m. ("7:00 a. m.", "4:00 p. m.", "12:00 a. m.").
 *   En el Excel del proveedor: 24 horas con dos dígitos ("07:00", "16:00"). Si el proveedor pide otro formato, se cambia FORMATO_HORA_PROVEEDOR.
 * Sin dependencias del navegador (se prueba en Node).
 */

/** Formato de las horas en el Excel del proveedor: '24h' → "07:00", "16:00" · '12h' → "7:00AM", "4:00PM" (como en el formulario de rutas) */
export const FORMATO_HORA_PROVEEDOR = '24h';

/** Minutos desde las 00:00 de "7:00", "07:00", "16:00", "4:00PM", "4:00 p. m.", "12:00AM"; null si no es una hora */
export function minutosDeHoraTexto(hora) {
  const m = /^(\d{1,2}):(\d{2})\s*(?:(a|p)\.?\s*m\.?)?$/i.exec(String(hora ?? '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const mm = Number(m[2]);
  const sufijo = m[3]?.toLowerCase();
  if (mm > 59 || h > 23 || (sufijo && (h < 1 || h > 12))) return null;
  if (sufijo === 'a' && h === 12) h = 0;
  else if (sufijo === 'p' && h < 12) h += 12;
  return h * 60 + mm;
}

const dosDigitos = (n) => String(n).padStart(2, '0');

/** "16:00" → "4:00 p. m.", "0:00" → "12:00 a. m."; lo que no es una hora ("YA EN PLANTA", "") se devuelve igual */
export function formatoHora12(hora) {
  const min = minutosDeHoraTexto(hora);
  if (min === null) return String(hora ?? '');
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${dosDigitos(min % 60)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "7:00AM" → "07:00", "4:00PM" → "16:00", "12:00AM" → "00:00"; lo que no es una hora se devuelve igual */
export function formatoHora24(hora) {
  const min = minutosDeHoraTexto(hora);
  return min === null ? String(hora ?? '') : `${dosDigitos(Math.floor(min / 60))}:${dosDigitos(min % 60)}`;
}

/** Hora para el Excel del proveedor, según FORMATO_HORA_PROVEEDOR */
export function horaParaProveedor(hora, formato = FORMATO_HORA_PROVEEDOR) {
  if (formato !== '12h') return formatoHora24(hora);
  const min = minutosDeHoraTexto(hora);
  if (min === null) return String(hora ?? '');
  const h = Math.floor(min / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${dosDigitos(min % 60)}${h < 12 ? 'AM' : 'PM'}`;
}

/** Cambia cada hora que aparezca dentro de un texto ("7:00 → 16:00" → "7:00 a. m. → 4:00 p. m."); el resto del texto queda igual */
export const horasEnTexto12 = (texto) => String(texto ?? '').replace(/\b\d{1,2}:\d{2}(?:\s*[AP]M)?(?!\w)/gi, (h) => formatoHora12(h));

/** "7:00 a. m. → 4:00 p. m." (o "Sin horario") de un empleado con horaEntrada y horaSalida */
export const etiquetaBloque12 = (e) => (e?.horaEntrada && e?.horaSalida ? `${formatoHora12(e.horaEntrada)} → ${formatoHora12(e.horaSalida)}` : 'Sin horario');
