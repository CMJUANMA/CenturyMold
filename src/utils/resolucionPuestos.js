/**
 * resolucionPuestos.js — Resolución de los puestos de un archivo de padrón contra el catálogo.
 * Sin dependencias del navegador. La comparación en sí vive en puestos.js (resolverPuesto, 3 niveles).
 *
 * Decisiones de RH por puesto del archivo (clave = clavePuesto del texto limpio):
 *   { tipo: 'usar' }                  nivel b: acepta la corrección propuesta (se guarda como alias)
 *   { tipo: 'otro' }                  nivel b: "es otro puesto" (pasa a nivel c)
 *   { tipo: 'alias', puestoId }       nivel c: "es igual a…" (se guarda como alias)
 *   { tipo: 'nuevo', areaId }         nivel c: se agrega como puesto nuevo en esa área
 *   { tipo: 'omitir' }                se omiten las filas con ese puesto
 */
import { clavePuesto, resolverPuesto } from './puestos.js';
import { aliasNuevo, idPuestoLibre } from './estructura.js';

/** Grupos de puestos distintos del archivo (las filas con error no cuentan) */
export function agruparPuestos(filas, catalogo) {
  const grupos = new Map();
  for (const f of filas) {
    if (f.estado === 'error') continue;
    const texto = f.datos.PUESTO;
    const clave = clavePuesto(texto);
    if (!clave) continue;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave, texto, crudos: new Set(), empleados: [], resultado: resolverPuesto(texto, catalogo),
      });
    }
    const g = grupos.get(clave);
    if (f.puestoCrudo !== undefined) g.crudos.add(String(f.puestoCrudo).trim());
    g.empleados.push({ nomina: f.datos.NOMINA, nombre: f.datos.NOMBRE, filaExcel: f.filaExcel });
  }
  return [...grupos.values()].sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
}

/**
 * Aplica las decisiones y devuelve cómo queda cada puesto del archivo.
 * porClave: clave → { estado: 'auto'|'corregido'|'alias'|'nuevo'|'omitir'|'pendiente', puestoId, nombre, areaId }
 * 'corregido' = limpieza automática (nivel a) con texto distinto al del catálogo.
 */
export function construirResolucion(filas, catalogo, decisiones = new Map()) {
  const grupos = agruparPuestos(filas, catalogo);
  const porId = new Map(catalogo.map(p => [p.id, p]));
  const ocupados = new Set(catalogo.map(p => p.id));
  const porClave = new Map();
  const puestosNuevos = [];
  const aliasNuevos = [];

  const poner = (g, estado, puesto) => {
    porClave.set(g.clave, { estado, puestoId: puesto?.id ?? '', nombre: puesto?.nombre ?? '', areaId: puesto?.areaId ?? '' });
  };
  const anotarAlias = (g, puesto) => {
    const alias = aliasNuevo(puesto, g.texto);
    if (alias && !aliasNuevos.some(a => a.puestoId === puesto.id && a.alias === alias)) aliasNuevos.push({ puestoId: puesto.id, alias });
  };

  for (const g of grupos) {
    const r = g.resultado;
    const d = decisiones.get(g.clave);
    if (r.nivel === 'a') {
      const corregido = g.crudos.size > 0 && [...g.crudos].some(c => c !== r.puesto.nombre);
      poner(g, corregido ? 'corregido' : 'auto', r.puesto);
      continue;
    }
    if (d?.tipo === 'omitir') { poner(g, 'omitir'); continue; }
    if (r.nivel === 'b' && d?.tipo === 'usar') {
      poner(g, 'alias', r.puesto); anotarAlias(g, r.puesto); continue;
    }
    if (d?.tipo === 'alias' && porId.has(d.puestoId)) {
      const p = porId.get(d.puestoId);
      poner(g, 'alias', p); anotarAlias(g, p); continue;
    }
    if (d?.tipo === 'nuevo' && d.areaId) {
      const id = idPuestoLibre(g.texto, ocupados);
      ocupados.add(id);
      const nuevo = { id, nombre: g.texto, areaId: d.areaId, activo: true, alias: [] };
      puestosNuevos.push(nuevo);
      poner(g, 'nuevo', nuevo); continue;
    }
    poner(g, 'pendiente');
  }
  const pendientes = grupos.filter(g => porClave.get(g.clave).estado === 'pendiente');
  const omitidas = grupos.filter(g => porClave.get(g.clave).estado === 'omitir')
    .reduce((n, g) => n + g.empleados.length, 0);
  return { grupos, porClave, puestosNuevos, aliasNuevos, pendientes, omitidas };
}
