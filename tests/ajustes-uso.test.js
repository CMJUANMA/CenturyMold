// Ajustes de uso: etiquetas de estatus, periodos de descarga, rutas distintas, extensión de turno, preferencias y textos de ayuda.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ESTATUS_TE, ESTATUS_TE_MAP, etiquetaEstatusTE } from '../src/utils/constantes.js';
import {
  INCLUIR_DESCARGA, MIN_JUSTIFICACION_RUTAS, PERIODOS_DESCARGA, estatusDeIncluir, SIN_SALIDA, TIPOS_TE, YA_EN_PLANTA, aplicarA, calcularHoras, datosTE, docAEmpleado, empleadoADoc, empleadoDesdePadron,
  llevaTransporte, pasajerosDeTE, problemasDeEnvio, rangoDePeriodo, resumenRutas, resumenTE, salidasPosteriores, sentidoDe, textoRuta, textoRutas,
  turnoPorFin,
} from '../src/utils/tiempoExtra.js';
import { MOTIVOS_INICIALES, motivoVacio } from '../src/utils/motivosTE.js';
import { construirLibroProveedor } from '../src/utils/libroProveedor.js';
import { textoRango } from '../src/utils/fechas.js';
import { AYUDAS, ayudaDePantalla, recorridoDe, textoAyuda } from '../src/utils/ayudas.js';
import { PREFERENCIAS_BASE, TAMANOS_LETRA, normalizarPreferencias } from '../src/context/preferenciasStore.js';

const emp = (nomina, extra = {}) => ({
  nomina, nombre: `Empleado ${nomina}`, puesto: 'X', turnoNomina: 'A', horaEntrada: '16:00', horaSalida: '0:00', alimentos: false,
  transporteLlegada: true, transporteSalida: true, transporte: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', necesitaConfirmar: false, confirmada: false, ...extra,
});

// ── 1. Etiquetas de estatus ───────────────────────────────────────────────

describe('etiquetas de estatus de tiempo extra', () => {
  const ESPERADAS = {
    borrador: 'Borrador',
    pendiente_aut1: 'En autorización (nivel 1)',
    pendiente_aut2: 'En autorización (nivel 2)',
    devuelta: 'Devuelta',
    autorizada: 'Autorizada',
    procesada: 'Confirmada por RH',
    cancelada: 'Cancelada',
    vencida: 'Vencida',
  };
  it('recorre TODOS los estatus y cada uno tiene su etiqueta', () => {
    expect(Object.values(ESTATUS_TE).sort()).toEqual(Object.keys(ESPERADAS).sort());
    for (const [estatus, etiqueta] of Object.entries(ESPERADAS)) {
      expect(ESTATUS_TE_MAP[estatus].label, estatus).toBe(etiqueta);
      expect(etiquetaEstatusTE(estatus), estatus).toBe(etiqueta);
      expect(ESTATUS_TE_MAP[estatus].cls, estatus).toBeTruthy();
      expect(ESTATUS_TE_MAP[estatus].dot, estatus).toBeTruthy();
    }
  });
  it('un borrador NO se muestra como Cancelada (y no se ve igual que una cancelada)', () => {
    expect(etiquetaEstatusTE('borrador')).not.toBe(etiquetaEstatusTE('cancelada'));
    expect(ESTATUS_TE_MAP.borrador.cls).not.toBe(ESTATUS_TE_MAP.cancelada.cls);
  });
  it('las etiquetas no se repiten entre estatus', () => {
    const etiquetas = Object.values(ESTATUS_TE_MAP).map(e => e.label);
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });
  it('un estatus desconocido se muestra tal cual, sin romper', () => {
    expect(etiquetaEstatusTE('raro')).toBe('raro');
    expect(etiquetaEstatusTE(undefined)).toBe('');
  });
  it('ninguna pantalla conserva las etiquetas anteriores ("Pendiente de Aut.")', () => {
    const encontrados = [];
    const recorrer = (dir) => {
      for (const f of readdirSync(dir)) {
        const ruta = join(dir, f);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(jsx?|mjs)$/.test(f) && /Pendiente de Aut\./.test(readFileSync(ruta, 'utf8'))) encontrados.push(ruta);
      }
    };
    recorrer('src');
    expect(encontrados).toEqual([]);
  });
});

// ── 2. Periodos de la descarga ────────────────────────────────────────────

describe('periodos de la descarga de tiempo extra', () => {
  const HOY = '2026-10-14'; // miércoles
  it('los seis atajos, en orden', () => {
    expect(PERIODOS_DESCARGA.map(p => p.label)).toEqual(['Hoy', 'Ayer', 'Esta semana', 'Semana anterior', 'Este mes', 'Personalizado']);
  });
  it('hoy, ayer, esta semana, la semana anterior (lunes a domingo) y este mes', () => {
    expect(rangoDePeriodo('hoy', HOY)).toEqual({ desde: HOY, hasta: HOY });
    expect(rangoDePeriodo('ayer', HOY)).toEqual({ desde: '2026-10-13', hasta: '2026-10-13' });
    expect(rangoDePeriodo('ayer', '2026-11-01')).toEqual({ desde: '2026-10-31', hasta: '2026-10-31' });
    expect(rangoDePeriodo('mes', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoDePeriodo('mes', '2026-02-10')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoDePeriodo('semana', HOY)).toEqual({ desde: '2026-10-12', hasta: '2026-10-18' });
    expect(rangoDePeriodo('anterior', HOY)).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' });
  });
  it('un lunes y un domingo caen en la semana correcta; la anterior cruza el mes', () => {
    expect(rangoDePeriodo('semana', '2026-10-12')).toEqual({ desde: '2026-10-12', hasta: '2026-10-18' });
    expect(rangoDePeriodo('semana', '2026-10-18')).toEqual({ desde: '2026-10-12', hasta: '2026-10-18' });
    expect(rangoDePeriodo('anterior', '2026-11-03')).toEqual({ desde: '2026-10-26', hasta: '2026-11-01' });
  });
  it('el personalizado no tiene rango propio (se captura a mano)', () => {
    expect(rangoDePeriodo('rango', HOY)).toBeNull();
  });
  it('el rango en palabras', () => {
    expect(textoRango('2026-10-12', '2026-10-18', HOY)).toBe('Del lunes 12 al domingo 18 de octubre');
    expect(textoRango('2026-10-26', '2026-11-01', HOY)).toBe('Del lunes 26 de octubre al domingo 1 de noviembre');
    expect(textoRango('2026-10-14', '2026-10-14', HOY)).toBe('El miércoles 14 de octubre');
    expect(textoRango('2026-12-28', '2027-01-03', HOY)).toBe('Del lunes 28 de diciembre de 2026 al domingo 3 de enero de 2027');
    expect(textoRango('2025-10-13', '2025-10-19', HOY)).toBe('Del lunes 13 al domingo 19 de octubre de 2025');
  });
  it('"incluir": por defecto todas las autorizadas; la otra opción, solo las confirmadas por RH', () => {
    expect(INCLUIR_DESCARGA[0]).toMatchObject({ id: 'autorizadas', estatus: ['autorizada', 'procesada'] });
    expect(estatusDeIncluir('confirmadas')).toEqual(['procesada']);
    expect(estatusDeIncluir('cualquier-cosa')).toEqual(['autorizada', 'procesada']);
  });
});

// ── 3. Rutas distintas ────────────────────────────────────────────────────

describe('rutas distintas (control de costo)', () => {
  const nombre = (id) => ({ lira: 'LA LIRA', heroes: 'LOS HÉROES', clemente: 'SAN CLEMENTE' }[id] ?? id);
  const grupo = [emp('1', { rutaId: 'lira' }), emp('2', { rutaId: 'lira' }), emp('3', { rutaId: 'heroes' }), emp('4', { rutaId: 'clemente' })];

  it('cuenta las rutas y las muestra como en el ejemplo', () => {
    const r = resumenRutas(grupo, nombre);
    expect(r.rutasDistintas).toBe(3);
    expect(textoRutas(r.desglose)).toBe('Esta solicitud usa 3 rutas: LA LIRA (2), LOS HÉROES (1), SAN CLEMENTE (1)');
  });
  it('una sola ruta, y los que no llevan transporte no cuentan', () => {
    expect(textoRutas(resumenRutas([emp('1', { rutaId: 'lira' })], nombre).desglose)).toBe('Esta solicitud usa 1 ruta: LA LIRA (1)');
    const sin = emp('9', { rutaId: 'heroes', transporteLlegada: false, transporteSalida: false, transporte: false });
    expect(resumenRutas([...grupo.slice(0, 2), sin], nombre).rutasDistintas).toBe(1);
    expect(resumenRutas([sin], nombre).rutasDistintas).toBe(0);
    expect(textoRutas([])).toBe('');
  });
  it('el desglose separa llegada y salida por ruta', () => {
    const r = resumenRutas([emp('1', { rutaId: 'lira' }), emp('2', { rutaId: 'lira', transporteLlegada: false })], nombre);
    expect(r.desglose).toEqual([{ rutaId: 'lira', nombre: 'LA LIRA', empleados: 2, llegada: 1, salida: 2 }]);
  });
  it('lo que se guarda en la solicitud: rutasDistintas, desgloseRutas y la justificación (solo con más de una ruta)', () => {
    const d = datosTE({ tipo: TIPOS_TE.TURNO_EXTRA, empleados: grupo, justificacionRutas: '  Hay dos plantas lejanas  ', nombreRuta: nombre });
    expect(d).toMatchObject({ tipo: 'turno_extra', rutasDistintas: 3, justificacionRutas: 'Hay dos plantas lejanas' });
    expect(d.desgloseRutas.map(g => g.nombre)).toEqual(['LA LIRA', 'LOS HÉROES', 'SAN CLEMENTE']);
    expect(datosTE({ empleados: [emp('1')], justificacionRutas: 'sobra este texto aunque sea largo' })).toMatchObject({ rutasDistintas: 1, justificacionRutas: '' });
  });
  describe('sin justificación no se puede enviar', () => {
    const base = { areaId: 'mantenimiento', fechaTE: '2026-10-20', motivos: [motivoVacio('inventario-fisico')], catalogoMotivos: MOTIVOS_INICIALES, comentario: 'Pedido urgente del cliente', hoy: '2026-10-14' };
    const errores = (p) => problemasDeEnvio({ ...base, ...p }).filter(x => x.nivel === 'error').map(x => x.mensaje);
    it('más de una ruta pide la justificación de 15 caracteres', () => {
      expect(MIN_JUSTIFICACION_RUTAS).toBe(15);
      expect(errores({ empleados: grupo }).join()).toMatch(/más de una ruta/);
      expect(errores({ empleados: grupo, justificacionRutas: 'corto' }).join()).toMatch(/más de una ruta/);
      expect(errores({ empleados: grupo, justificacionRutas: '               ' }).join()).toMatch(/más de una ruta/);
      expect(errores({ empleados: grupo, justificacionRutas: 'Viven en zonas muy distintas' })).toEqual([]);
    });
    it('con una sola ruta no se pide', () => {
      expect(errores({ empleados: [emp('1'), emp('2')] })).toEqual([]);
    });
  });
});

// ── 4. Extensión de turno ─────────────────────────────────────────────────

describe('extensión de turno', () => {
  it('los bloques de salida posteriores al fin de su turno', () => {
    expect(salidasPosteriores('16:00')).toEqual(['19:00', '0:00', '7:00']);
    expect(salidasPosteriores('19:00')).toEqual(['0:00', '7:00']);
    expect(salidasPosteriores('0:00')).toEqual(['7:00']);
    expect(salidasPosteriores('7:00')).toEqual(['16:00', '19:00', '0:00']);
    expect(salidasPosteriores('7:00', 16)).toEqual(['16:00', '19:00']); // con un máximo puesto en funciones.js, no ofrece lo que lo pase
    expect(salidasPosteriores('')).toEqual([]);
    expect(salidasPosteriores('12:00')).toEqual([]);
  });
  it('las horas se cuentan desde el fin de su turno: 16:00 → 19:00 = 3 h', () => {
    expect(calcularHoras('16:00', '19:00')).toBe(3);
    expect(calcularHoras('16:00', '0:00')).toBe(8);
    expect(calcularHoras('0:00', '7:00')).toBe(7);
  });
  it('al agregar: la extensión pide a mano la hora de fin de turno y solo lleva transporte de salida; turno extra, llegada y salida', () => {
    const ext = empleadoDesdePadron({ nomina: 1, nombre: 'ANA', turnoNomina: 'A' }, {}, { tipo: TIPOS_TE.EXTENSION });
    expect(ext).toMatchObject({ horaEntrada: '', horaSalida: '', transporteLlegada: false, transporteSalida: true, transporte: true });
    expect(ext.turnoNomina).toBeUndefined(); // el turno de nómina por persona ya no se captura
    const normal = empleadoDesdePadron({ nomina: 3, nombre: 'PEDRO', turnoNomina: 'A' }, {});
    expect(normal).toMatchObject({ horaEntrada: '', transporteLlegada: true, transporteSalida: true, transporte: true });
  });
  describe('validación', () => {
    const base = { areaId: 'm', fechaTE: '2026-10-14', motivos: [motivoVacio('inventario-fisico')], catalogoMotivos: MOTIVOS_INICIALES, comentario: 'Pedido urgente del cliente', hoy: '2026-10-14', tipo: TIPOS_TE.EXTENSION };
    const errores = (empleados) => problemasDeEnvio({ ...base, empleados }).filter(x => x.nivel === 'error').map(x => x.mensaje);
    const ext = (extra = {}) => emp('1', { horaEntrada: '16:00', horaSalida: '19:00', transporteLlegada: false, ...extra });
    it('se permite capturarla para el mismo día', () => {
      expect(errores([ext()])).toEqual([]);
    });
    it('pide el fin de turno y hasta cuándo se queda, y que sea posterior', () => {
      expect(errores([ext({ horaEntrada: '' })]).join()).toMatch(/hora en que termina su turno/);
      expect(errores([ext({ horaSalida: '' })]).join()).toMatch(/hasta qué hora se queda/);
      expect(errores([ext({ horaSalida: '16:00' })]).join()).toMatch(/posterior al fin de su turno/);
      expect(errores([ext({ horaEntrada: '0:00', horaSalida: '19:00' })]).join()).toMatch(/posterior/);
    });
  });
  describe('transporte de llegada y de salida', () => {
    it('el documento guarda los dos sentidos y requiereTransporte es "alguno"', () => {
      expect(empleadoADoc(emp('1', { transporteLlegada: false }))).toMatchObject({ requiereTransporte: true, transporteLlegada: false, transporteSalida: true, rutaId: 'r1' });
      expect(empleadoADoc(emp('1', { transporteLlegada: false, transporteSalida: false, transporte: false }))).toMatchObject({ requiereTransporte: false, transporteLlegada: false, transporteSalida: false, rutaId: '' });
    });
    it('los documentos anteriores (solo requiereTransporte) valen para llegada y salida', () => {
      expect(docAEmpleado('1', { nombre: 'X', requiereTransporte: true })).toMatchObject({ transporteLlegada: true, transporteSalida: true, transporte: true });
      expect(docAEmpleado('1', { nombre: 'X', requiereTransporte: false })).toMatchObject({ transporte: false });
      expect(docAEmpleado('1', empleadoADoc(emp('1', { transporteLlegada: false })))).toMatchObject({ transporteLlegada: false, transporteSalida: true, transporte: true });
    });
    it('llevaTransporte y sentidoDe', () => {
      expect(llevaTransporte({ transporteLlegada: false, transporteSalida: true })).toBe(true);
      expect(llevaTransporte({})).toBe(false);
      expect(['ambos', 'llegada', 'salida', ''].map((s) => sentidoDe({ transporteLlegada: s === 'ambos' || s === 'llegada', transporteSalida: s === 'ambos' || s === 'salida' }))).toEqual(['ambos', 'llegada', 'salida', '']);
    });
    it('aplicar a varios actualiza el derivado y limpia la confirmación si ya no hay transporte', () => {
      const [a] = aplicarA([emp('1', { necesitaConfirmar: true })], null, { transporteLlegada: false, transporteSalida: false });
      expect(a).toMatchObject({ transporte: false, necesitaConfirmar: false, confirmada: false });
      const [b] = aplicarA([emp('1', { transporteSalida: false })], null, { transporteSalida: true });
      expect(b.transporte).toBe(true);
    });
    it('el resumen cuenta a quien lleva transporte en cualquier sentido', () => {
      expect(resumenTE([emp('1'), emp('2', { transporteLlegada: false }), emp('3', { transporteLlegada: false, transporteSalida: false, transporte: false })]).totalTransporte).toBe(2);
    });
    it('el texto de ruta aclara cuando es de un solo sentido', () => {
      const cat = { rutas: [{ id: 'r1', nombre: 'Norte' }], comunidades: [{ id: 'c1', nombre: 'Pueblito' }], puntos: [{ id: 'p1', nombre: 'Plaza' }] };
      expect(textoRuta(emp('1'), cat)).toBe('Norte · Pueblito · Plaza');
      expect(textoRuta(emp('1', { transporteLlegada: false }), cat)).toBe('Norte · Pueblito · Plaza (solo salida)');
    });
  });
  describe('turno del pasajero y Excel del proveedor', () => {
    it('fin de turno → turno normal', () => {
      expect(['16:00', '0:00', '19:00', '7:00', '', 'raro'].map(turnoPorFin)).toEqual(['1', '2', '2', '3', '', '']);
    });
    it('solo salida en una extensión: hoja de su turno normal, ENTRADA "YA EN PLANTA" y SALIDA la hora extendida', () => {
      const te = { id: 't', areaId: 'moldes', areaNombre: 'Moldes', tipo: TIPOS_TE.EXTENSION };
      const [p] = pasajerosDeTE([emp('1', { horaEntrada: '16:00', horaSalida: '19:00', transporteLlegada: false })], te);
      expect(p).toMatchObject({ turno: '1', horaEntrada: YA_EN_PLANTA, horaSalida: '7:00PM', sentido: 'salida', areaId: 'moldes' });
      expect(YA_EN_PLANTA).toBe('YA EN PLANTA');
    });
    it('turno extra con solo llegada: SALIDA "NO REQUIERE"; con los dos sentidos, horas normales', () => {
      const te = { id: 't', areaId: 'moldes' };
      const [sl, ambos] = pasajerosDeTE([emp('1', { horaEntrada: '7:00', horaSalida: '16:00', transporteSalida: false }), emp('2', { horaEntrada: '7:00', horaSalida: '16:00' })], te);
      expect(sl).toMatchObject({ turno: '1', horaEntrada: '7:00AM', horaSalida: SIN_SALIDA, sentido: 'llegada' });
      expect(ambos).toMatchObject({ horaEntrada: '7:00AM', horaSalida: '4:00PM', sentido: 'ambos' });
    });
    it('en el libro: el de extensión sale en la hoja de su turno normal con "YA EN PLANTA"', () => {
      const te = { id: 't', folio: 'TE-2026-0007', areaId: 'moldes', areaNombre: 'Moldes', tipo: TIPOS_TE.EXTENSION, fechaTE: '2026-10-20', creadoPorNombre: 'OSCAR', creadoPorNomina: '5' };
      const pasajeros = pasajerosDeTE([emp('1', { horaEntrada: '16:00', horaSalida: '19:00', transporteLlegada: false }), emp('2', { horaEntrada: '7:00', horaSalida: '16:00', transporteLlegada: false })], te);
      const sol = { id: 's', fechaServicio: '2026-10-20', fechaSolicitud: '2026-10-14T10:00:00.000Z', solicitanteNombre: 'OSCAR', origen: 'tiempo_extra', folioTE: te.folio, areaId: 'moldes', pasajeros };
      const catalogos = { rutas: [{ id: 'r1', nombre: 'Norte' }], comunidades: [{ id: 'c1', nombre: 'Pueblito' }], puntos: [{ id: 'p1', nombre: 'Plaza' }], areas: [{ id: 'moldes', nombre: 'Moldes' }] };
      const wb = construirLibroProveedor({ ExcelJS, solicitudes: [sol], catalogos });
      expect(wb.worksheets.map(w => w.name).sort()).toEqual(['Turno 1', 'Turno 3']);
      const fila = (hoja, nomina) => { let f; wb.getWorksheet(hoja).eachRow(r => { if (String(r.getCell(3).value) === nomina) f = r.values.slice(1); }); return f; };
      expect(fila('Turno 1', '1')).toEqual(['Moldes', 'X', '1', 'Empleado 1', 'YA EN PLANTA', '19:00', 'NO', 'Norte', 'Pueblito', 'Plaza', '']);
      expect(fila('Turno 3', '2').slice(4, 6)).toEqual(['YA EN PLANTA', '16:00']);
    });
  });
});

// ── 5. Preferencias y ayudas ──────────────────────────────────────────────

describe('preferencias de la persona', () => {
  it('valores por omisión: ayudas activas, letra normal y tema automático', () => {
    expect(normalizarPreferencias(undefined)).toEqual(PREFERENCIAS_BASE);
    expect(PREFERENCIAS_BASE).toMatchObject({ ayudas: true, tamanoLetra: 'normal', tema: 'auto' });
  });
  it('conserva lo válido y descarta lo inválido', () => {
    expect(normalizarPreferencias({ ayudas: false, tamanoLetra: 'grande', tema: 'oscuro', recorridosVistos: ['solicitar'] }))
      .toEqual({ ayudas: false, tamanoLetra: 'grande', tema: 'oscuro', recorridosVistos: ['solicitar'] });
    expect(normalizarPreferencias({ ayudas: 'sí', tamanoLetra: 'enorme', tema: 'rosa', recorridosVistos: [1, 'a', null] }))
      .toEqual({ ayudas: true, tamanoLetra: 'normal', tema: 'auto', recorridosVistos: ['a'] });
  });
  it('tamaños de letra', () => {
    expect(TAMANOS_LETRA).toEqual({ normal: '100%', grande: '120%' });
  });
});

describe('textos de ayuda', () => {
  const fuentes = [];
  const recorrer = (dir) => {
    for (const f of readdirSync(dir)) {
      const ruta = join(dir, f);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.jsx$/.test(f)) fuentes.push(readFileSync(ruta, 'utf8'));
    }
  };
  recorrer('src');
  const codigo = fuentes.join('\n');

  it('cada ayuda que usa la aplicación existe y tiene texto', () => {
    const claves = [...codigo.matchAll(/<Ayuda\s+clave="([^"]+)"/g)].map(m => m[1]);
    const dinamicas = [...codigo.matchAll(/clave=\{extension \? '([^']+)' : '([^']+)'\}/g)].flatMap(m => [m[1], m[2]]);
    const usadas = new Set([...claves, ...dinamicas]);
    expect(usadas.size).toBeGreaterThan(20);
    for (const k of usadas) expect(textoAyuda(k), `ayuda "${k}"`).not.toBe('');
  });
  it('los textos son cortos y sin tecnicismos', () => {
    for (const [k, t] of Object.entries(AYUDAS.campos)) {
      expect(t.length, k).toBeGreaterThan(10);
      expect(t.length, k).toBeLessThanOrEqual(260);
      expect(t, k).not.toMatch(/\b(firestore|transacci[oó]n|getAfter|API|JSON|query|snapshot)\b/i);
    }
  });
  it('cada pantalla con "?" tiene 3 o 4 pasos y existe en el código', () => {
    const ids = [...codigo.matchAll(/<AyudaPantalla\s+id="([^"]+)"/g)].map(m => m[1]);
    // 'organigrama' sale dos veces en el código (Usuarios y accesos y "Mi área"): es la misma pantalla
    expect([...new Set(ids)].sort()).toEqual(['asignaciones', 'autorizar', 'consulta', 'formatoRutas', 'inicio', 'inicioNomina', 'inicioRol', 'misSolicitudes', 'organigrama', 'padron', 'recepcion', 'reportesNomina', 'solicitar', 'turnos']);
    for (const id of new Set(ids)) {
      const a = ayudaDePantalla(id);
      expect(a, id).toBeTruthy();
      expect(a.pasos.length, id).toBeGreaterThanOrEqual(3);
      expect(a.pasos.length, id).toBeLessThanOrEqual(4);
    }
  });
  it('los recorridos (solicitar y autorizar) señalan partes que existen en la pantalla', () => {
    for (const id of ['solicitar', 'autorizar']) {
      const pasos = recorridoDe(id);
      expect(pasos.length, id).toBeGreaterThanOrEqual(3);
      for (const p of pasos) {
        const marca = /\[data-tour="([^"]+)"\]/.exec(p.selector)?.[1];
        expect(codigo, `${id}: ${p.selector}`).toMatch(new RegExp(`(?:data-tour|tour)=({[^}]*)?["']${marca}["']`));
        expect(p.titulo && p.texto).toBeTruthy();
      }
    }
    expect(recorridoDe('consulta')).toEqual([]);
  });
});
