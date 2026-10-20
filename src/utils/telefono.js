/**
 * telefono.js — Teléfono del empleado (10 dígitos, opcional) para que el transporte pueda llamar.
 * Sin dependencias del navegador (se prueba en Node). Se guarda en empleadosContacto/{nómina}.telefono (ver docs/seguridad.md).
 */

export const LARGO_TELEFONO = 10;
export const TELEFONO_RE = /^\d{10}$/;

/**
 * Deja solo los dígitos de lo que escribió la persona o trae el Excel ("(442) 123-4567", "442 123 4567", +52 442 123 4567…).
 * Quita la lada de país de México (52 o 521) cuando sobra. Lo que no llega a 10 dígitos se devuelve tal cual, para avisar que está incompleto.
 */
export function soloDigitosTelefono(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d;
}

/** ¿Es un teléfono completo? */
export const telefonoValido = (valor) => TELEFONO_RE.test(String(valor ?? ''));

/** Estado de lo capturado: 'vacio' | 'incompleto' | 'valido' */
export function estadoTelefono(valor) {
  const d = soloDigitosTelefono(valor);
  return d === '' ? 'vacio' : telefonoValido(d) ? 'valido' : 'incompleto';
}

/** "4421234567" → "442 123 4567" (lo incompleto se muestra tal cual) */
export const formatoTelefono = (valor) => {
  const t = String(valor ?? '');
  return telefonoValido(t) ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : t;
};
