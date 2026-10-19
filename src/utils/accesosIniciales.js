/**
 * accesosIniciales.js — "Crear usuarios en lote": candidatos, contraseñas temporales y el Excel de entrega.
 * Sin dependencias del navegador salvo crypto (disponible también en Node). Las contraseñas solo viven en memoria.
 */
import { ROL_OP_CORTOS, esVigente } from './asignaciones.js';
import { agregarHojaReporte, nuevoLibro } from './formatosImportacion.js';
import { ALFABETO_PASSWORD, generarPassword } from './passwordTemporal.js';
import { bufferSeguro } from './excelSeguro.js';

// La contraseña temporal vive en passwordTemporal.js (la comparte "Restablecer acceso"); se vuelve a exportar aquí
export { ALFABETO_PASSWORD, generarPassword };

/**
 * Personas con asignación vigente que todavía no tienen cuenta.
 * @returns {{ nomina, nombre, puesto, areaId, roles: string[] }[]} ordenadas por nombre
 */
export function candidatosSinCuenta({ asignaciones, usuarios, empleados, nombresArea = new Map(), ahora = new Date() }) {
  const conCuenta = new Set(usuarios.map(u => String(u.nomina)));
  const porNomina = new Map(empleados.map(e => [String(e.nomina), e]));
  const personas = new Map();
  for (const a of asignaciones) {
    const nomina = String(a.nomina);
    if (!esVigente(a, ahora) || conCuenta.has(nomina)) continue;
    const e = personas.get(nomina) ?? {
      nomina, nombre: porNomina.get(nomina)?.nombre ?? a.nombre ?? nomina, puesto: porNomina.get(nomina)?.puesto ?? '',
      areaId: porNomina.get(nomina)?.areaId ?? '', roles: [],
    };
    e.roles.push(a.rol === 'aut2' ? ROL_OP_CORTOS.aut2 : `${ROL_OP_CORTOS[a.rol]} · ${nombresArea.get(a.areaId) ?? a.areaId}`);
    personas.set(nomina, e);
  }
  return [...personas.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
}

export function nombreArchivoAccesos(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Accesos_Iniciales_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
}

export const ENCABEZADOS_ACCESOS = ['Nómina', 'Nombre', 'Área', 'Roles', 'Usuario', 'Contraseña temporal'];

export const PASOS_PRIMER_ACCESO = [
  ['1', 'Abre la aplicación de Century Mold en el navegador (la liga te la da Recursos Humanos).'],
  ['2', 'En "Usuario" escribe tu número de nómina, tal como aparece en este archivo (solo números).'],
  ['3', 'En "Contraseña" escribe la contraseña temporal respetando mayúsculas y guiones, por ejemplo CM-7K4P-Q9TX.'],
  ['4', 'La primera vez el sistema te pedirá crear una contraseña nueva. Debe ser distinta de la temporal, de al menos 8 caracteres y con letras y números.'],
  ['5', 'Después de cambiarla entrarás al Portal de procesos. La contraseña temporal deja de servir.'],
  ['6', 'Si no puedes entrar, avisa a Recursos Humanos; no compartas tu contraseña con nadie.'],
  ['', 'ESTE ARCHIVO CONTIENE CONTRASEÑAS: entrégalo en persona o en sobre cerrado y bórralo después. No se puede volver a generar.'],
];

/** Libro "Accesos" + "Instrucciones" con las cuentas creadas. filas: [{ nomina, nombre, area, roles, password }] */
export function construirLibroAccesos(filas) {
  const wb = nuevoLibro();
  agregarHojaReporte(wb, 'Accesos', ENCABEZADOS_ACCESOS,
    filas.map(f => [String(f.nomina), f.nombre, f.area ?? '', f.roles ?? '', String(f.nomina), f.password]), { anchoMax: 60 });
  agregarHojaReporte(wb, 'Instrucciones', ['Paso', 'Cómo entrar la primera vez'], PASOS_PRIMER_ACCESO, { anchoMax: 110, columnasAjuste: [1] });
  return wb;
}

/** Descarga el libro como .xlsx en el navegador */
export async function descargarLibroAccesos(filas, fecha = new Date()) {
  const buffer = await bufferSeguro(construirLibroAccesos(filas));
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivoAccesos(fecha) });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
