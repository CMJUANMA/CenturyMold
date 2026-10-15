/**
 * fechas.js — Lectura uniforme de fechas guardadas en Firestore.
 * Las solicitudes nuevas guardan Timestamp (serverTimestamp); las viejas, string ISO.
 */

/** Convierte Timestamp, Date, string ISO o número (ms) a Date. Devuelve null si no es válido. */
export function toDate(valor) {
  if (valor == null || valor === '') return null;
  let d;
  if (typeof valor.toDate === 'function') d = valor.toDate();      // Timestamp de Firestore
  else if (valor instanceof Date) d = valor;
  else if (typeof valor === 'object' && typeof valor.seconds === 'number') d = new Date(valor.seconds * 1000);
  else d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha corta "12 oct 2026"; '—' si no hay fecha válida */
export function fmtFecha(valor) {
  const d = toDate(valor);
  return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

/** Fecha y hora local; '—' si no hay fecha válida */
export function fmtFechaHora(valor) {
  const d = toDate(valor);
  return d ? d.toLocaleString() : '—';
}

/** true si ambas fechas caen en el mismo mes y año */
export function mismoMes(a, b = new Date()) {
  const da = toDate(a), db = toDate(b);
  return !!da && !!db && da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}

/** "YYYY-MM-DD" → Date a medianoche LOCAL (new Date('YYYY-MM-DD') lo interpreta en UTC y desfasa un día) */
export function fechaLocal(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : toDate(ymd);
}

/** Date → "YYYY-MM-DD" en hora local */
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" + n días → "YYYY-MM-DD" (aritmética local, sin desfase de zona horaria) */
export function sumarDias(fechaYmd, n) {
  const d = fechaLocal(fechaYmd);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Lunes y domingo de la semana de `fechaYmd`, desplazada `offsetSemanas` semanas */
export function rangoSemana(fechaYmd = ymd(), offsetSemanas = 0) {
  const d = fechaLocal(fechaYmd);
  const diasDesdeLunes = (d.getDay() + 6) % 7;
  const lunes = sumarDias(fechaYmd, -diasDesdeLunes + 7 * offsetSemanas);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Primer y último día del mes de `fechaYmd` */
export function rangoMes(fechaYmd = ymd()) {
  const d = fechaLocal(fechaYmd);
  return { desde: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

/** "lunes 12 de octubre" (con " de 2026" si `conAnio`) */
export function fechaConDia(fechaYmd, conAnio = false) {
  const d = fechaLocal(fechaYmd);
  if (!d) return '';
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${conAnio ? ` de ${d.getFullYear()}` : ''}`;
}

/**
 * El rango en palabras: "Del lunes 12 al domingo 18 de octubre", "Del lunes 26 de octubre al domingo 1 de noviembre", "El lunes 12 de octubre".
 * El año solo se dice si el rango no cae en el año de `hoy` (o si cruza de un año a otro).
 */
export function textoRango(desde, hasta, hoy = ymd()) {
  const a = fechaLocal(desde), b = fechaLocal(hasta);
  if (!a || !b) return '';
  const anioHoy = fechaLocal(hoy)?.getFullYear();
  const cruzaAnio = a.getFullYear() !== b.getFullYear();
  const sufijo = cruzaAnio || b.getFullYear() !== anioHoy ? ` de ${b.getFullYear()}` : '';
  if (desde === hasta) return `El ${fechaConDia(desde)}${sufijo}`;
  if (cruzaAnio) return `Del ${fechaConDia(desde, true)} al ${fechaConDia(hasta, true)}`;
  if (a.getMonth() === b.getMonth()) return `Del ${DIAS_SEMANA[a.getDay()]} ${a.getDate()} al ${DIAS_SEMANA[b.getDay()]} ${b.getDate()} de ${MESES[b.getMonth()]}${sufijo}`;
  return `Del ${fechaConDia(desde)} al ${fechaConDia(hasta)}${sufijo}`;
}
