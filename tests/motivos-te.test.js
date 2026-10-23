// Motivos del tiempo extra: catálogo inicial, validación (P.O., TB, Otro, repetidos, máximo), lectura de solicitudes nuevas y anteriores. Datos ficticios, sin Firebase.
import { describe, expect, it } from 'vitest';
import {
  MAX_MOTIVOS_TE, MOTIVOS_INICIALES, etiquetaMotivo, limpiarNumero, motivoDeEmpleado, motivoDesdeGuardado, motivoTexto, motivoTextoEmpleado, motivoVacio,
  motivosDeTE, motivosParaGuardar, numeroValido, numerosDeTE, ordenarMotivos, problemasDeMotivos, reajustarIndice, textoNumero, tieneMotivo,
} from '../src/utils/motivosTE.js';

const CAT = MOTIVOS_INICIALES;
const mot = (motivoId, extra = {}) => ({ ...motivoVacio(motivoId), ...extra });
const mensajes = (items) => problemasDeMotivos(items, CAT).map(p => p.mensaje);

describe('carga inicial del catálogo', () => {
  it('son nueve motivos, en este orden, con ids únicos', () => {
    expect(MOTIVOS_INICIALES.map(m => m.nombre)).toEqual([
      'Cubrir vacante / falta de personal', 'Embarques fin de semana', 'Inventario físico', 'Cubrir vacaciones / cumpleaños / incapacidad',
      'Adecuación de contenedores', 'Cubrir tiempo de la brigada', 'Cargo a P.O.', 'Cargo a TB', 'Otro',
    ]);
    expect(MOTIVOS_INICIALES.map(m => m.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(MOTIVOS_INICIALES.map(m => m.id)).size).toBe(9);
    expect(MOTIVOS_INICIALES.every(m => m.activo === true)).toBe(true);
  });
  it('solo P.O., TB y Otro piden algo más', () => {
    const pide = MOTIVOS_INICIALES.filter(m => m.requiereNumero || m.requiereComentario).map(m => [m.nombre, m.requiereNumero, m.requiereComentario]);
    expect(pide).toEqual([['Cargo a P.O.', 'po', false], ['Cargo a TB', 'tb', false], ['Otro', null, true]]);
  });
  it('ordena por orden y luego por nombre', () => {
    expect(ordenarMotivos([{ nombre: 'B', orden: 2 }, { nombre: 'C', orden: 1 }, { nombre: 'A', orden: 2 }]).map(m => m.nombre)).toEqual(['C', 'A', 'B']);
  });
});

describe('validar los motivos de una solicitud', () => {
  it('el primer motivo es obligatorio', () => {
    expect(mensajes([])).toEqual(['Elige el motivo.']);
    expect(mensajes([mot('')])).toEqual(['Elige el motivo.']);
    expect(mensajes([mot('inventario-fisico')])).toEqual([]);
  });
  it('P.O.: solo dígitos, de 6 a 15', () => {
    expect(mensajes([mot('cargo-po')])).toHaveLength(1);
    expect(mensajes([mot('cargo-po', { numero: '12345' })])).toHaveLength(1);
    expect(mensajes([mot('cargo-po', { numero: '123456' })])).toEqual([]);
    expect(mensajes([mot('cargo-po', { numero: '4551099797' })])).toEqual([]);
    expect(mensajes([mot('cargo-po', { numero: '1'.repeat(15) })])).toEqual([]);
    expect(mensajes([mot('cargo-po', { numero: '1'.repeat(16) })])).toHaveLength(1);
    expect(mensajes([mot('cargo-po', { numero: '45510A9797' })])).toHaveLength(1);
  });
  it('TB: obligatorio, letras y números, hasta 20 caracteres', () => {
    expect(mensajes([mot('cargo-tb')])).toHaveLength(1);
    expect(mensajes([mot('cargo-tb', { numero: 'TB 20' })])).toHaveLength(1);
    expect(mensajes([mot('cargo-tb', { numero: 'TB2045' })])).toEqual([]);
    expect(mensajes([mot('cargo-tb', { numero: 'A'.repeat(20) })])).toEqual([]);
    expect(mensajes([mot('cargo-tb', { numero: 'A'.repeat(21) })])).toHaveLength(1);
  });
  it('Otro: describe el motivo con al menos 10 caracteres', () => {
    expect(mensajes([mot('otro')])).toHaveLength(1);
    expect(mensajes([mot('otro', { comentario: ' corto ' })])).toHaveLength(1);
    expect(mensajes([mot('otro', { comentario: 'Visita de cliente' })])).toEqual([]);
  });
  it('el detalle es opcional pero tiene tope', () => {
    expect(mensajes([mot('inventario-fisico', { detalle: 'apoyo a inventario' })])).toEqual([]);
    expect(mensajes([mot('inventario-fisico', { detalle: 'x'.repeat(121) })])).toHaveLength(1);
  });
  it('no se repite el mismo motivo con el mismo número, pero sí con otro número', () => {
    expect(mensajes([mot('cargo-po', { numero: '4551099797' }), mot('cargo-po', { numero: '4551099797' })]).join()).toMatch(/repetido/);
    expect(mensajes([mot('cargo-po', { numero: '4551099797' }), mot('cargo-po', { numero: '4551099798' })])).toEqual([]);
    expect(mensajes([mot('cargo-tb', { numero: 'ab1' }), mot('cargo-tb', { numero: 'AB1' })]).join()).toMatch(/repetido/);
    expect(mensajes([mot('inventario-fisico'), mot('inventario-fisico', { detalle: 'otro detalle' })]).join()).toMatch(/repetido/);
    expect(mensajes([mot('otro', { comentario: 'Visita de cliente' }), mot('otro', { comentario: 'Pruebas de molde' })])).toEqual([]);
  });
  it('máximo cinco motivos', () => {
    const cinco = [mot('cubrir-vacante'), mot('embarques-fin-de-semana'), mot('inventario-fisico'), mot('cubrir-vacaciones'), mot('adecuacion-contenedores')];
    expect(MAX_MOTIVOS_TE).toBe(5);
    expect(mensajes(cinco)).toEqual([]);
    expect(mensajes([...cinco, mot('cubrir-brigada')])).toContain('Máximo 5 motivos por solicitud.');
  });
  it('con varios motivos, el mensaje dice cuál', () => {
    expect(mensajes([mot('inventario-fisico'), mot('cargo-po')])).toEqual(['Motivo 2: El número de P.O. debe tener solo dígitos (de 6 a 15).']);
  });
  it('un motivo dado de baja o fuera del catálogo se valida con lo que se guardó', () => {
    const baja = [{ id: 'viejo', nombre: 'Viejo', activo: false, requiereNumero: 'po', requiereComentario: false }];
    expect(problemasDeMotivos([mot('viejo', { numero: '4551099797' })], baja)).toEqual([]);
    expect(problemasDeMotivos([mot('desconocido', { nombre: 'Algo', tipoNumero: 'po', numero: '12' })], [])).toHaveLength(1);
  });
});

describe('número de P.O. y TB al escribir', () => {
  it('P.O. deja solo dígitos y TB, letras y números en mayúsculas', () => {
    expect(limpiarNumero('45-51 09x97', 'po')).toBe('45510997');
    expect(limpiarNumero('tb-20 45', 'tb')).toBe('TB2045');
    expect(numeroValido('123456', 'po')).toBe(true);
    expect(numeroValido('', 'tb')).toBe(false);
    expect(numeroValido('lo que sea', null)).toBe(true);
  });
});

describe('lo que se guarda en la solicitud', () => {
  it('copia el nombre del catálogo y limpia lo que no aplica al motivo', () => {
    const g = motivosParaGuardar([
      mot('cargo-po', { numero: ' 4551099797 ', comentario: 'sobra', detalle: ' movimiento de máquina Krauss Maffei 750 ' }),
      mot('inventario-fisico', { numero: '999999', detalle: 'apoyo a inventario' }),
      mot('otro', { comentario: ' Visita de cliente ' }),
    ], CAT);
    expect(g).toEqual([
      { motivoId: 'cargo-po', nombre: 'Cargo a P.O.', numero: '4551099797', comentario: '', detalle: 'movimiento de máquina Krauss Maffei 750', tipoNumero: 'po' },
      { motivoId: 'inventario-fisico', nombre: 'Inventario físico', numero: '', comentario: '', detalle: 'apoyo a inventario', tipoNumero: '' },
      { motivoId: 'otro', nombre: 'Otro', numero: '', comentario: 'Visita de cliente', detalle: '', tipoNumero: '' },
    ]);
  });
  it('si el catálogo cambia después, lo guardado conserva su nombre al reabrirlo', () => {
    const [g] = motivosParaGuardar([mot('inventario-fisico')], CAT);
    const reabierto = motivoDesdeGuardado(g);
    expect(motivosParaGuardar([reabierto], [])[0].nombre).toBe('Inventario físico');
    expect(motivosParaGuardar([reabierto], [{ id: 'inventario-fisico', nombre: 'Inventario (nuevo nombre)', activo: false }])[0].nombre).toBe('Inventario (nuevo nombre)');
  });
  it('conserva las posiciones: un motivo sin elegir queda vacío, no se recorre', () => {
    const g = motivosParaGuardar([mot('inventario-fisico'), mot(''), mot('cargo-tb', { numero: 'TB1' })], CAT);
    expect(g.map(m => m.nombre)).toEqual(['Inventario físico', '', 'Cargo a TB']);
  });
});

describe('leer una solicitud (nueva o anterior)', () => {
  const nueva = {
    motivo: 'Inventario físico',
    motivos: [
      { motivoId: 'inventario-fisico', nombre: 'Inventario físico', numero: '', comentario: '', detalle: 'apoyo a inventario', tipoNumero: '' },
      { motivoId: 'cargo-po', nombre: 'Cargo a P.O.', numero: '4551099797', comentario: '', detalle: '', tipoNumero: 'po' },
      { motivoId: 'cargo-tb', nombre: 'Cargo a TB', numero: 'TB2045', comentario: '', detalle: '', tipoNumero: 'tb' },
    ],
  };
  it('etiquetas: con número, con detalle y con descripción', () => {
    expect(motivosDeTE(nueva).map(m => etiquetaMotivo(m))).toEqual(['Inventario físico · apoyo a inventario', 'Cargo a P.O. 4551099797', 'Cargo a TB TB2045']);
    expect(etiquetaMotivo({ nombre: 'Cargo a P.O.', numero: '4551099797' }, { conNumero: false })).toBe('Cargo a P.O.');
    expect(etiquetaMotivo({ nombre: 'Otro', comentario: 'Visita de cliente', detalle: 'x' })).toBe('Otro: Visita de cliente · x');
  });
  it('el motivo de cada empleado sale de su motivoIndex (el primero por defecto o si ya no existe)', () => {
    expect(motivoDeEmpleado(nueva, { motivoIndex: 1 }).numero).toBe('4551099797');
    expect(motivoDeEmpleado(nueva, {}).nombre).toBe('Inventario físico');
    expect(motivoDeEmpleado(nueva, { motivoIndex: 9 }).nombre).toBe('Inventario físico');
    expect(motivoTextoEmpleado(nueva, { motivoIndex: 2 })).toBe('Cargo a TB TB2045');
    expect(motivoDeEmpleado({}, { motivoIndex: 1 })).toBeNull();
  });
  it('todos los motivos en una línea, para los Excel', () => {
    expect(motivoTexto(nueva)).toBe('Inventario físico · apoyo a inventario / Cargo a P.O. 4551099797 / Cargo a TB TB2045');
  });
  it('las solicitudes anteriores se leen tal cual y no se migra nada', () => {
    const vieja = { motivo: 'Otro', motivoOtro: 'Visita de cliente' };
    expect(motivosDeTE(vieja)).toEqual([{ motivoId: '', nombre: 'Otro', numero: '', comentario: 'Visita de cliente', detalle: '', tipoNumero: '' }]);
    expect(motivoTexto(vieja)).toBe('Otro: Visita de cliente');
    expect(motivoTexto({ motivo: 'Producción' })).toBe('Producción');
    expect(motivosDeTE({})).toEqual([]);
    expect(motivoTextoEmpleado({ motivo: 'Producción' }, { motivoIndex: 3 })).toBe('Producción');
  });
  it('P.O. o TB: lista de números', () => {
    expect(numerosDeTE(nueva)).toEqual([{ tipo: 'po', numero: '4551099797' }, { tipo: 'tb', numero: 'TB2045' }]);
    expect(numerosDeTE(nueva).map(textoNumero)).toEqual(['P.O. 4551099797', 'TB TB2045']);
    expect(numerosDeTE({ motivo: 'Producción' })).toEqual([]);
  });
  it('filtro por motivo: por id; las anteriores por el nombre del catálogo', () => {
    expect(tieneMotivo(nueva, 'cargo-po', CAT)).toBe(true);
    expect(tieneMotivo(nueva, 'otro', CAT)).toBe(false);
    expect(tieneMotivo({ motivo: 'Otro' }, 'otro', CAT)).toBe(true);
    expect(tieneMotivo({ motivo: 'Producción' }, 'otro', CAT)).toBe(false);
    expect(tieneMotivo(nueva, '', CAT)).toBe(true);
  });
});

describe('quitar un motivo reajusta a los empleados', () => {
  it('los que lo tenían pasan al primero y los siguientes se recorren', () => {
    expect([0, 1, 2, 3].map(i => reajustarIndice(i, 1))).toEqual([0, 0, 1, 2]);
    expect(reajustarIndice(undefined, 2)).toBe(0);
  });
});
