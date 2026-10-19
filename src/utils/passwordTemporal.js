/**
 * passwordTemporal.js — Contraseña temporal CM-XXXX-XXXX. La usan "Crear usuarios en lote" y "Restablecer acceso".
 * Sin dependencias del navegador salvo crypto (disponible también en Node). No guarda nada: la contraseña solo vive en memoria.
 */

/** Sin caracteres ambiguos: ni 0/O, ni 1/I/l, ni L */
export const ALFABETO_PASSWORD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Formato CM-7K4P-Q9TX (8 caracteres al azar, ~40 bits). `azar(n)` devuelve n bytes aleatorios (por defecto crypto) */
export function generarPassword(azar = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const letras = [];
  while (letras.length < 8) {
    // Se descartan bytes que sesgarían el reparto (256 no es múltiplo del largo del alfabeto)
    for (const b of azar(16)) {
      if (b < 256 - (256 % ALFABETO_PASSWORD.length) && letras.length < 8) letras.push(ALFABETO_PASSWORD[b % ALFABETO_PASSWORD.length]);
    }
  }
  return `CM-${letras.slice(0, 4).join('')}-${letras.slice(4).join('')}`;
}
