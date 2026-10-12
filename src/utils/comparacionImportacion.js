/**
 * comparacionImportacion.js
 * Compara las filas leídas de un archivo de importación contra lo que ya existe
 * en la base y arma un "plan" (qué se crea, actualiza, reactiva o se propone dar de baja).
 * Sin dependencias de Firebase: el guardado lo hace quien consume el plan.
 *
 * Claves: empleados por nómina (= ID del documento); puntos por CLAVE (= ID);
 * rutas por slug del nombre; comunidades por `${rutaId}__${slug}`.
 */
import { esActivo } from './activo.js';
import { clavePuesto } from './puestos.js';

export const MODOS = { AGREGAR: 'agregar', SINCRONIZAR: 'sincronizar' };
/** Si las bajas propuestas superan esta fracción de los activos, se exige confirmación escrita */
export const UMBRAL_BAJAS = 0.2;

export const slugify = (text) =>
  String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '');

export const idRuta = (nombre) => slugify(nombre);
export const idComunidad = (rutaId, nombre) => `${rutaId}__${slugify(nombre)}`;

const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const normLower = (v) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VACIO = '(vacio)';

/** Acción según existencia, estado y cambios */
function accionPara(existente, cambios) {
  if (!existente) return 'crear';
  if (!esActivo(existente)) return 'reactivar';
  return cambios.length ? 'actualizar' : 'sinCambios';
}

/** Conteos, umbral de seguridad y lista de problemas (errores y advertencias por fila) */
function resumirPlan(items, bajas, filas, activosPorEntidad) {
  const porEntidad = {};
  for (const b of bajas) porEntidad[b.entidad] = (porEntidad[b.entidad] ?? 0) + 1;
  const umbral = Object.entries(porEntidad).map(([entidad, n]) => {
    const activos = activosPorEntidad[entidad] ?? 0;
    return { entidad, bajas: n, activos, fraccion: activos ? n / activos : 1 };
  });
  const problemas = filas.filter(f => f.estado === 'error' || f.estado === 'advertencia');
  return {
    items,
    bajas,
    problemas,
    umbral,
    excedeUmbral: umbral.some(u => u.fraccion > UMBRAL_BAJAS),
    conteos: {
      nuevos:      items.filter(i => i.accion === 'crear').length,
      sinCambios:  items.filter(i => i.accion === 'sinCambios').length,
      conCambios:  items.filter(i => i.accion === 'actualizar').length,
      reactivados: items.filter(i => i.accion === 'reactivar').length,
      bajas:       bajas.length,
      errores:     filas.filter(f => f.estado === 'error').length,
      advertencias: filas.filter(f => f.estado === 'advertencia').length,
    },
  };
}

// ── Empleados ─────────────────────────────────────────────────────────────
/**
 * @param filas       resultado de leerEmpleados
 * @param empleados   documentos existentes [{ id, ...data }]
 * @param opciones    { modo }
 */
export function compararEmpleados(filas, empleados, { modo = MODOS.AGREGAR } = {}) {
  // Se identifica por el campo nómina (o el ID si falta); se escribe sobre el documento real
  const nominaDe = (e) => String(e.nomina ?? e.id).trim();
  const existentes = new Map(empleados.map(e => [nominaDe(e), e]));
  // Nóminas presentes en el archivo, incluso en filas con error: nunca se proponen como baja
  const presentes = new Set(filas.map(f => f.datos.NOMINA).filter(n => /^\d+$/.test(n)));
  const items = [];

  for (const fila of filas) {
    if (fila.estado === 'error') continue;
    const { NOMINA: nomina, NOMBRE: nombre, PUESTO: puesto } = fila.datos;
    const ex = existentes.get(nomina);
    const id = ex ? String(ex.id) : nomina;
    const cambios = [];
    const datos = {};

    if (!ex || norm(ex.nombre) !== norm(nombre)) {
      if (ex) cambios.push({ campo: 'NOMBRE', antes: ex.nombre || VACIO, despues: nombre });
      Object.assign(datos, { nombre, nombreLower: normLower(nombre) });
    }
    if (!ex || clavePuesto(ex.puesto) !== clavePuesto(puesto)) {
      if (ex) cambios.push({ campo: 'PUESTO', antes: ex.puesto || VACIO, despues: puesto });
      datos.puesto = puesto;
    }
    // Ruta: solo se toca si el archivo trae una CLAVE PARADA válida; vacía = conservar lo actual
    if (fila.paradaInfo) {
      const nueva = { rutaId: fila.paradaInfo.rutaId ?? '', comunidadId: fila.paradaInfo.comunidadId ?? '', puntoReunionId: fila.paradaInfo.clave };
      if (!ex || ex.rutaId !== nueva.rutaId || ex.comunidadId !== nueva.comunidadId || ex.puntoReunionId !== nueva.puntoReunionId) {
        if (ex) cambios.push({ campo: 'CLAVE PARADA', antes: ex.puntoReunionId || VACIO, despues: nueva.puntoReunionId });
        Object.assign(datos, nueva);
      }
    } else if (!ex) {
      Object.assign(datos, { rutaId: '', comunidadId: '', puntoReunionId: '' });
    }

    const accion = accionPara(ex, cambios);
    if (accion === 'crear') Object.assign(datos, { nomina, activo: true });
    items.push({
      key: `empleados/${id}`, coleccion: 'empleados', id, clave: nomina, entidad: 'Empleado',
      nombre, detalle: puesto, filaExcel: fila.filaExcel, accion, cambios, datos,
      puestoNuevo: !!fila.puestoNuevo, puestoSimilar: fila.puestoSimilar ?? null,
      mensaje: fila.estado === 'advertencia' ? fila.mensaje : '',
    });
  }

  const activos = empleados.filter(esActivo);
  const bajas = modo === MODOS.SINCRONIZAR
    ? activos.filter(e => !presentes.has(nominaDe(e))).map(e => ({
      key: `empleados/${e.id}`, coleccion: 'empleados', id: String(e.id), clave: nominaDe(e), entidad: 'Empleado',
      nombre: e.nombre || '', detalle: e.puesto || '',
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    : [];

  return resumirPlan(items, bajas, filas, { Empleado: activos.length });
}

// ── Directorio ────────────────────────────────────────────────────────────
/**
 * @param filas     resultado de leerDirectorio
 * @param base      { rutas, comunidades, puntos, empleados } existentes [{ id, ...data }]
 * @param opciones  { modo }
 */
export function compararDirectorio(filas, { rutas = [], comunidades = [], puntos = [], empleados = [] }, { modo = MODOS.AGREGAR } = {}) {
  const exRutas = new Map(rutas.map(d => [d.id, d]));
  const exComs = new Map(comunidades.map(d => [d.id, d]));
  const exPuntos = new Map(puntos.map(d => [d.id, d]));

  // Lo que trae el archivo (la primera aparición de cada ruta/comunidad define su nombre)
  const fRutas = new Map(), fComs = new Map(), fPuntos = new Map();
  const presentes = { Ruta: new Set(), Comunidad: new Set(), Punto: new Set() };
  for (const fila of filas) {
    const { RUTA, COMUNIDAD, CLAVE } = fila.datos;
    const rutaId = RUTA ? idRuta(RUTA) : '';
    const comunidadId = rutaId && COMUNIDAD ? idComunidad(rutaId, COMUNIDAD) : '';
    if (rutaId) presentes.Ruta.add(rutaId);
    if (comunidadId) presentes.Comunidad.add(comunidadId);
    if (CLAVE) presentes.Punto.add(CLAVE);
    if (fila.estado === 'error') continue;
    if (!fRutas.has(rutaId)) fRutas.set(rutaId, { nombre: RUTA, filaExcel: fila.filaExcel });
    if (!fComs.has(comunidadId)) fComs.set(comunidadId, { nombre: COMUNIDAD, rutaId, filaExcel: fila.filaExcel });
    fPuntos.set(CLAVE, { nombre: fila.datos['PUNTO DE REUNION'], clave: CLAVE, comunidadId, rutaId, filaExcel: fila.filaExcel });
  }

  // Nombres legibles para mostrar cambios de pertenencia
  const nombreRuta = (id) => fRutas.get(id)?.nombre ?? exRutas.get(id)?.nombre ?? id ?? VACIO;
  const nombreCom = (id) => fComs.get(id)?.nombre ?? exComs.get(id)?.nombre ?? id ?? VACIO;

  const items = [];
  const agregar = (coleccion, entidad, id, f, ex, campos) => {
    const cambios = [];
    const datos = {};
    for (const [campo, etiqueta, mostrar] of campos) {
      const nuevo = f[campo];
      const anterior = ex?.[campo];
      const distinto = campo === 'nombre' ? norm(anterior) !== norm(nuevo) : (anterior ?? '') !== nuevo;
      if (!ex || distinto) {
        datos[campo] = nuevo;
        if (ex) cambios.push({ campo: etiqueta, antes: anterior ? mostrar(anterior) : VACIO, despues: mostrar(nuevo) });
      }
    }
    const accion = accionPara(ex, cambios);
    if (accion === 'crear') datos.activo = true;
    items.push({
      key: `${coleccion}/${id}`, coleccion, id, clave: id, entidad, nombre: f.nombre,
      detalle: entidad === 'Ruta' ? '' : entidad === 'Comunidad' ? nombreRuta(f.rutaId) : `${nombreCom(f.comunidadId)} · ${nombreRuta(f.rutaId)}`,
      filaExcel: f.filaExcel, accion, cambios, datos, mensaje: '',
    });
  };
  const tal = (v) => v;
  for (const [id, f] of fRutas) agregar('rutas', 'Ruta', id, f, exRutas.get(id), [['nombre', 'NOMBRE', tal]]);
  for (const [id, f] of fComs) agregar('comunidades', 'Comunidad', id, f, exComs.get(id), [['nombre', 'NOMBRE', tal], ['rutaId', 'RUTA', nombreRuta]]);
  for (const [id, f] of fPuntos) agregar('puntosReunion', 'Punto', id, f, exPuntos.get(id), [
    ['nombre', 'NOMBRE', tal], ['clave', 'CLAVE', tal], ['comunidadId', 'COMUNIDAD', nombreCom], ['rutaId', 'RUTA', nombreRuta],
  ]);

  // Bajas propuestas (solo sincronización), con empleados activos asignados
  const empActivos = empleados.filter(esActivo);
  const asignados = (campo, id) => empActivos.filter(e => e[campo] === id).length;
  const activos = {
    Ruta: rutas.filter(esActivo), Comunidad: comunidades.filter(esActivo), Punto: puntos.filter(esActivo),
  };
  const bajas = [];
  if (modo === MODOS.SINCRONIZAR) {
    const proponer = (entidad, coleccion, campoEmp, detalle) => {
      for (const d of activos[entidad]) {
        if (presentes[entidad].has(d.id)) continue;
        bajas.push({
          key: `${coleccion}/${d.id}`, coleccion, id: d.id, clave: d.id, entidad,
          nombre: d.nombre || d.id, detalle: detalle(d), asignados: asignados(campoEmp, d.id),
        });
      }
    };
    proponer('Ruta', 'rutas', 'rutaId', () => '');
    proponer('Comunidad', 'comunidades', 'comunidadId', d => exRutas.get(d.rutaId)?.nombre ?? '');
    proponer('Punto', 'puntosReunion', 'puntoReunionId', d => `${d.id} · ${exComs.get(d.comunidadId)?.nombre ?? ''}`);
  }

  return resumirPlan(items, bajas, filas, {
    Ruta: activos.Ruta.length, Comunidad: activos.Comunidad.length, Punto: activos.Punto.length,
  });
}

/** Fecha local DD/MM/AAAA */
export function fechaCorta(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export const motivoBaja = (d = new Date()) => `No aparece en la importación del ${fechaCorta(d)}`;
