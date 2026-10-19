/**
 * accesos.js — Qué cuenta de Firebase Auth usa cada nómina. Parte pura (se prueba en Node); la que lee Firestore está en accesosDb.js.
 *
 * Sin Cloud Functions no se puede cambiar la contraseña de otra persona, así que «Restablecer contraseña» crea una cuenta NUEVA de la siguiente
 * versión y mueve el perfil a su uid. El documento accesos/{nomina} = { version, uid } dice cuál es la vigente:
 *   versión 1 = {nomina}@rutas.app (las cuentas de siempre; también si el documento no existe)
 *   versión N = {nomina}.v{N}@rutas.app
 * Con Blaze esto se reemplaza por una función que cambia la contraseña de la misma cuenta (docs/blaze.md).
 */
export const VERSION_INICIAL = 1;

/** Versión de un documento de accesos (cualquier cosa rara o ausente vale 1) */
export function versionDe(datos) {
  const v = Number(datos?.version);
  return Number.isInteger(v) && v >= 1 ? v : VERSION_INICIAL;
}

/** Correo interno (ficticio: no recibe correo) de la cuenta de una nómina en una versión */
export function correoDeAcceso(nomina, version = VERSION_INICIAL) {
  const n = String(nomina).trim();
  return version <= VERSION_INICIAL ? `${n}@rutas.app` : `${n}.v${version}@rutas.app`;
}

/** ¿Sirve como id de documento? (el login no debe fallar ni pedir rutas raras con lo que escribió la persona) */
export const nominaValidaParaAcceso = (nomina) => /^[^/\s]{1,40}$/.test(String(nomina ?? '').trim());
