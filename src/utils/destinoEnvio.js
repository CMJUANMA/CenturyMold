/**
 * destinoEnvio.js — El texto corto del diálogo de «Enviar a autorización»: a quién le toca autorizar, con nombre, y el resumen. Sin términos internos
 * («Autorización 1», «RH»). Sin dependencias del navegador; se prueba en Node.
 */

const SEPARADOR = (lista) => (lista.length <= 1 ? '' : lista.length === 2 ? ' o ' : ', ');

/** «Felipe Rangel Orozco, jefe de producción» (el puesto en minúsculas; sin puesto, solo el nombre) */
export function personaConPuesto(p, nombre = (x) => x) {
  const n = nombre(p.nombre ?? '');
  const puesto = String(p.puesto ?? '').trim().toLowerCase();
  return puesto ? `${n}, ${puesto}` : n;
}

/**
 * @param {object} d
 * @param {'pendiente_aut1'|'pendiente_aut2'|'autorizada'} d.estatus  a dónde va al enviarse
 * @param {{ nombre: string, puesto?: string }[]} d.aut1  quienes autorizan en el área (vigentes)
 * @param {{ nombre: string, puesto?: string }[]} d.aut2  quienes autorizan al final (vigentes)
 * @param {(n: string) => string} [d.nombre]  formateador de nombres del padrón
 * @param {boolean} [d.reenvio]  una devuelta que se reenvía
 * @param {number} d.empleados  @param {number} d.horas
 */
export function textoConfirmarEnvio({ estatus, aut1 = [], aut2 = [], nombre = (x) => x, reenvio = false, empleados, horas }) {
  const verbo = reenvio ? 'Se reenviará' : 'Se enviará';
  const quienes = estatus === 'pendiente_aut1' ? aut1 : estatus === 'pendiente_aut2' ? aut2 : [];
  const nombres = quienes.slice(0, 3).map(p => personaConPuesto(p, nombre));
  const lista = nombres.map((n, i) => (i === 0 ? n : `a ${n}`)).join(SEPARADOR(nombres));
  let destino;
  if (estatus === 'autorizada') destino = 'Quedará autorizada y pasará a Recursos Humanos para enviarse al proveedor.';
  else if (nombres.length) destino = `${verbo} a ${lista}, para ${estatus === 'pendiente_aut2' ? 'su autorización final' : 'autorizar'}.`;
  else destino = `${verbo} a quien autoriza ${estatus === 'pendiente_aut2' ? 'al final' : 'tu área'}.`;
  const horasTexto = Number.isInteger(horas) ? horas : Math.round(horas * 100) / 100;
  return `${destino} ${empleados} ${empleados === 1 ? 'empleado' : 'empleados'}, ${horasTexto} h.${reenvio ? ' Vuelve a empezar su autorización.' : ''}`;
}
