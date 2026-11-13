/**
 * manuales.js — Los manuales de usuario (PDF) y a quién le toca cada uno. La sección «Ayuda» de la aplicación muestra a cada persona el manual de CADA rol
 * que tiene (y su guía rápida de una hoja), con «Descargar PDF». Los PDF se generan con \`npm run manuales\` y se publican en /manuales/. Sin dependencias del navegador.
 */

/** Orden en el que se muestran. `archivo` es el nombre base de los PDF: manual-<archivo>.pdf y guia-rapida-<archivo>.pdf */
export const MANUALES = [
  { archivo: 'solicitante', rol: 'Solicitante', para: 'Para quien captura tiempo extra: cómo se arma y se envía una solicitud.', tiene: (a) => (a.areasSolicitante?.length ?? 0) > 0 || (a.areasAut1?.length ?? 0) > 0 || !!a.esAut2 || !!a.esRH },
  { archivo: 'autorizador-1', rol: 'Autorizador 1', para: 'Para el jefe de un área: revisa y autoriza (o devuelve) lo que pide su gente.', tiene: (a) => (a.areasAut1?.length ?? 0) > 0 },
  { archivo: 'autorizador-2', rol: 'Autorizador 2', para: 'Para quien da la segunda firma de toda la planta y autoriza lo que ya venció.', tiene: (a) => !!a.esAut2 },
  { archivo: 'rh', rol: 'Recursos Humanos', para: 'Para quien confirma el tiempo extra, pide el transporte y administra usuarios y accesos.', tiene: (a) => !!a.esRH },
  { archivo: 'nominas', rol: 'Nóminas', para: 'Para quien prepara, ajusta y firma el formato de tiempo extra de cada semana.', tiene: (a) => !!a.esNomina },
];

export const rutaManual = (archivo) => `/manuales/manual-${archivo}.pdf`;
export const rutaGuiaRapida = (archivo) => `/manuales/guia-rapida-${archivo}.pdf`;

/**
 * Los manuales de una persona: uno por cada rol que tiene. El administrador tiene todos los permisos, así que ve todos.
 * @param {{ esAdmin?: boolean, esRH?: boolean, esNomina?: boolean, esAut2?: boolean, areasAut1?: string[], areasSolicitante?: string[] }} accesos
 */
export function manualesDeUsuario(accesos = {}) {
  return MANUALES.filter(m => accesos?.esAdmin || m.tiene(accesos ?? {}))
    .map(({ archivo, rol, para }) => ({ archivo, rol, para, manual: rutaManual(archivo), guia: rutaGuiaRapida(archivo) }));
}
