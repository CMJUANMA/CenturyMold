/**
 * passwordPolitica.js — Política de contraseñas de la app (la comparten el primer acceso y "Mi cuenta"). Sin dependencias del navegador.
 * Firebase Authentication solo exige 6 caracteres; esto es lo que pide la app. (Las contraseñas temporales CM-XXXX-XXXX las genera el sistema.)
 */

export const PASSWORD_MIN = 8;
export const AYUDA_PASSWORD = `Mínimo ${PASSWORD_MIN} caracteres, con al menos una letra y un número. No uses tu nómina.`;

/** Contraseñas que se adivinan primero: se rechazan aunque cumplan el largo */
const OBVIAS = ['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'password', 'password1', 'contrasena', 'contrasena1', 'qwerty123', 'centurymold', 'centurymold1', 'abcd1234', 'abc12345'];
const sinAcentos = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Por qué no sirve una contraseña nueva (null si sirve).
 * @param {string} password
 * @param {{ nomina?: string|number, anteriores?: string[] }} [opciones]  anteriores: la actual o la temporal (debe ser distinta)
 */
export function errorPasswordNueva(password, { nomina = '', anteriores = [] } = {}) {
  const p = String(password ?? '');
  if (p.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(p) || !/[0-9]/.test(p)) return 'La contraseña debe tener al menos una letra y un número.';
  const n = String(nomina ?? '').trim();
  if (n && sinAcentos(p).includes(sinAcentos(n))) return 'La contraseña no debe contener tu número de nómina.';
  if (OBVIAS.includes(sinAcentos(p))) return 'Esa contraseña es muy fácil de adivinar. Elige otra.';
  if (anteriores.some(a => a && a === p)) return 'La contraseña nueva debe ser distinta a la anterior.';
  return null;
}
