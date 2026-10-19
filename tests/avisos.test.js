// Recordatorios de "a quién avisar" en cada paso de una solicitud de tiempo extra. Datos ficticios.
import { describe, expect, it } from 'vitest';
import {
  avisoAutorizacion, avisoAutorizacionVarias, avisoDevolucion, avisoEnvio, destinatariosDe, lineaDestinatario, lineaPendiente, nivelPendiente,
} from '../src/utils/avisos.js';
import { AVISOS } from '../src/utils/ayudas.js';

const AHORA = new Date('2026-10-19T12:00:00');
const dia = 24 * 3600 * 1000;
const asig = (nomina, nombre, rol, areaId, extra = {}) => ({
  id: `${nomina}_${rol}_${rol === 'aut2' ? 'planta' : areaId}`, nomina, nombre, rol, areaId: rol === 'aut2' ? null : areaId, puesto: 'PUESTO',
  desde: new Date(AHORA.getTime() - 30 * dia), hasta: null, activo: true, ...extra,
});

const asignaciones = [
  asig('1', 'MENDOZA RAMIREZ JOSE ANSELMO', 'aut1', 'mantenimiento', { puestoId: 'p-jefe' }),
  asig('2', 'GOMEZ HERNANDEZ ISMAEL', 'aut1', 'mantenimiento', { puestoId: 'p-sup' }),
  asig('3', 'LOPEZ LUNA ANA MARIA', 'aut1', 'calidad'),
  asig('4', 'RUIZ SOTO PEDRO', 'aut1', 'mantenimiento', { activo: false }), // revocado
  asig('5', 'DIAZ CRUZ LUIS', 'aut1', 'mantenimiento', { hasta: new Date(AHORA.getTime() - dia) }), // vencido
  asig('6', 'VEGA PONCE RAUL', 'aut1', 'mantenimiento', { desde: new Date(AHORA.getTime() + dia) }), // programado
  asig('7', 'SOLIS RAMOS JORGE', 'solicitante', 'mantenimiento'),
  asig('20', 'CANO MEJIA CARLOS', 'aut2', null, { puesto: 'GERENTE DE PLANTA', puestoId: 'p-ger' }),
  asig('21', 'ROJAS PINA SERGIO', 'aut2', null, { puesto: 'DIRECTOR', puestoId: 'p-dir' }),
  asig('22', 'BRAVO TORRES MARIO', 'aut2', null, { puesto: 'COORDINADOR' }), // puesto sin nivel
  asig('23', 'NAVA LEAL OSCAR', 'aut2', null, { activo: false }),
];
const puestos = [
  { id: 'p-dir', nivelJerarquico: 1 }, { id: 'p-ger', nivelJerarquico: 2 }, { id: 'p-jefe', nivelJerarquico: 5 }, { id: 'p-sup', nivelJerarquico: 4 },
];
const nombreArea = (id) => ({ mantenimiento: 'Mantenimiento', calidad: 'Calidad' }[id] ?? id);
const nominas = (lista) => lista.map(a => a.nomina);

describe('destinatariosDe', () => {
  it('nivel 1: solo los Aut. 1 vigentes del área (no revocados, vencidos, programados, de otra área ni solicitantes)', () => {
    const d = destinatariosDe({ nivel: 1, areaId: 'mantenimiento', asignaciones, puestos, ahora: AHORA });
    expect(nominas(d).sort()).toEqual(['1', '2']);
    expect(nominas(destinatariosDe({ nivel: 1, areaId: 'calidad', asignaciones, puestos, ahora: AHORA }))).toEqual(['3']);
  });
  it('nivel 1: los ordena por nivel jerárquico del puesto (el número más bajo primero)', () => {
    expect(nominas(destinatariosDe({ nivel: 1, areaId: 'mantenimiento', asignaciones, puestos, ahora: AHORA }))).toEqual(['2', '1']);
  });
  it('nivel 2: solo los Aut. 2 vigentes, por nivel jerárquico; sin nivel, al final', () => {
    expect(nominas(destinatariosDe({ nivel: 2, asignaciones, puestos, ahora: AHORA }))).toEqual(['21', '20', '22']);
  });
  it('nivel 2 no incluye a los Aut. 1', () => {
    expect(destinatariosDe({ nivel: 2, asignaciones, puestos, ahora: AHORA }).every(a => a.rol === 'aut2')).toBe(true);
  });
  it('quien actúa no se avisa a sí mismo', () => {
    expect(nominas(destinatariosDe({ nivel: 2, asignaciones, puestos, excluirNomina: '21', ahora: AHORA }))).toEqual(['20', '22']);
    expect(nominas(destinatariosDe({ nivel: 1, areaId: 'mantenimiento', asignaciones, puestos, excluirNomina: 2, ahora: AHORA }))).toEqual(['1']);
  });
  it('una persona con dos asignaciones iguales sale una sola vez', () => {
    const dup = [...asignaciones, { ...asignaciones[0], id: 'otra' }];
    expect(destinatariosDe({ nivel: 1, areaId: 'mantenimiento', asignaciones: dup, puestos, ahora: AHORA })).toHaveLength(2);
  });
  it('sin asignaciones, la lista queda vacía', () => {
    expect(destinatariosDe({ nivel: 1, areaId: 'mantenimiento', asignaciones: [], ahora: AHORA })).toEqual([]);
    expect(destinatariosDe({ nivel: 2, asignaciones: undefined, ahora: AHORA })).toEqual([]);
  });
});

describe('lineaDestinatario', () => {
  it('Aut. 1: nombre de pila primero y "Aut. 1 de [área]"', () => {
    expect(lineaDestinatario(asignaciones[0], { nombreArea })).toBe('Jose Anselmo Mendoza Ramirez (Aut. 1 de Mantenimiento)');
  });
  it('Aut. 2: el puesto guardado en la asignación', () => {
    expect(lineaDestinatario(asignaciones[7])).toBe('Carlos Cano Mejia (Aut. 2 · GERENTE DE PLANTA)');
  });
});

describe('1. Al enviar', () => {
  const dest = destinatariosDe({ nivel: 1, areaId: 'mantenimiento', asignaciones, puestos, ahora: AHORA });
  it('a Aut. 1: avisa a todos los Aut. 1 vigentes del área', () => {
    const a = avisoEnvio({ folio: 'TE-2026-0012', estatus: 'pendiente_aut1', destinatarios: dest, opciones: { nombreArea } });
    expect(a.texto).toBe('Tu solicitud TE-2026-0012 se envió a Autorización 1. Para que se revise a la brevedad, recuerda avisarle a: '
      + 'Ismael Gomez Hernandez (Aut. 1 de Mantenimiento) y Jose Anselmo Mendoza Ramirez (Aut. 1 de Mantenimiento).');
    expect(a.texto).not.toMatch(/Ana|Pedro|Luis|Raul|Jorge|Carlos/);
  });
  it('un solo Aut. 1: el texto del ejemplo', () => {
    const a = avisoEnvio({ folio: 'TE-2026-0012', estatus: 'pendiente_aut1', destinatarios: [asignaciones[0]], opciones: { nombreArea } });
    expect(a.texto).toBe('Tu solicitud TE-2026-0012 se envió a Autorización 1. Para que se revise a la brevedad, recuerda avisarle a: Jose Anselmo Mendoza Ramirez (Aut. 1 de Mantenimiento).');
  });
  it('directo a nivel 2: avisa a los Aut. 2 vigentes, del nivel jerárquico más alto al más bajo', () => {
    const aut2 = destinatariosDe({ nivel: 2, asignaciones, puestos, ahora: AHORA });
    const a = avisoEnvio({ folio: 'TE-2026-0013', estatus: 'pendiente_aut2', destinatarios: aut2 });
    expect(a.texto).toMatch(/^Tu solicitud TE-2026-0013 se envió a Autorización 2\./);
    expect(a.texto.indexOf('Rojas')).toBeLessThan(a.texto.indexOf('Cano'));
    expect(a.texto.indexOf('Cano')).toBeLessThan(a.texto.indexOf('Bravo'));
    expect(a.texto).not.toMatch(/Nava|Mendoza/);
  });
  it('un reenvío dice "reenvió"', () => {
    expect(avisoEnvio({ folio: 'TE-1', estatus: 'pendiente_aut1', reenviada: true, destinatarios: dest }).texto).toMatch(/se reenvió a Autorización 1/);
  });
  it('sin nadie vigente, manda a avisar a RH en vez de dejar la lista vacía', () => {
    const a = avisoEnvio({ folio: 'TE-1', estatus: 'pendiente_aut1', destinatarios: [] });
    expect(a.texto).toMatch(/avisa al área de Sistemas o, en su caso, a Recursos Humanos/);
    expect(a.texto).not.toMatch(/recuerda avisarle a:/);
  });
});

describe('2. Al autorizar', () => {
  it('el Aut. 1 autoriza: avisa a los Aut. 2 vigentes', () => {
    const aut2 = destinatariosDe({ nivel: 2, asignaciones, puestos, ahora: AHORA });
    const a = avisoAutorizacion({ nivel: 1, folio: 'TE-2026-0012', destinatarios: aut2 });
    expect(a.texto).toMatch(/^Autorizaste TE-2026-0012 y pasó a Autorización 2\. Para que se revise a la brevedad, recuerda avisarle a: Sergio Rojas Pina/);
    expect(a.texto).toContain('Carlos Cano Mejia');
  });
  it('un Aut. 2 envía lo suyo: queda autorizada y el recordatorio dice que RH ya la tiene', () => {
    const a = avisoEnvio({ folio: 'TE-2026-0020', estatus: 'autorizada', destinatarios: [] });
    expect(a).toMatchObject({ tono: 'exito', titulo: 'Solicitud autorizada', texto: "Listo. Recursos Humanos ya la tiene en 'Por enviar al proveedor'." });
    expect(avisoEnvio({ folio: 'TE-2026-0020', estatus: 'autorizada', reenviada: true, destinatarios: [] }).texto).toBe(AVISOS.listaEnRH());
  });
  it('el Aut. 2 autoriza: ya está con Recursos Humanos, sin nombres', () => {
    expect(avisoAutorizacion({ nivel: 2, folio: 'TE-2026-0012', destinatarios: [] }).texto).toBe(AVISOS.listaEnRH());
    expect(AVISOS.listaEnRH()).toBe('Listo. Recursos Humanos ya la tiene en \'Por enviar al proveedor\'.');
  });
  it('varias a la vez: el nivel 1 avisa a Aut. 2 y el nivel 2 confirma con RH', () => {
    const aut2 = destinatariosDe({ nivel: 2, asignaciones, puestos, ahora: AHORA });
    expect(avisoAutorizacionVarias({ nivel: 1, cantidad: 3, destinatarios: aut2 }).texto).toMatch(/^Autorizaste 3 solicitudes y pasaron a Autorización 2\..*Sergio Rojas Pina/);
    expect(avisoAutorizacionVarias({ nivel: 2, cantidad: 3 }).texto).toBe('Listo. Recursos Humanos ya tiene 3 solicitudes en \'Por enviar al proveedor\'.');
  });
});

describe('2. Al devolver', () => {
  it('avisa a quien la solicitó, por su nombre', () => {
    const a = avisoDevolucion({ folio: 'TE-2026-0012', solicitante: 'Jorge Solis Ramos' });
    expect(a.texto).toContain('Recuerda avisarle a Jorge Solis Ramos para que la corrija.');
    expect(a.tono).toBe('aviso');
  });
  it('sin nombre, dice "quien la solicitó"', () => {
    expect(avisoDevolucion({ folio: 'TE-1', solicitante: '' }).texto).toContain('avisarle a quien la solicitó');
  });
});

describe('3. "Mis solicitudes": pendiente con', () => {
  const t = (estatus, areaId, hace) => ({ estatus, areaId, fechaActualizacion: AHORA.getTime() - hace });
  const opts = { asignaciones, puestos, nombreArea, ahora: AHORA.getTime() };
  it('en nivel 1: los Aut. 1 del área (solo nombres) y cuánto lleva esperando', () => {
    expect(lineaPendiente(t('pendiente_aut1', 'mantenimiento', 2 * dia), opts))
      .toBe('Pendiente con: Ismael Gomez Hernandez y Jose Anselmo Mendoza Ramirez · en espera desde hace 2 días');
    expect(lineaPendiente(t('pendiente_aut1', 'calidad', 3 * 3600 * 1000), opts)).toBe('Pendiente con: Ana Maria Lopez Luna · en espera desde hace 3 h');
  });
  it('en nivel 2: los Aut. 2 vigentes', () => {
    const l = lineaPendiente(t('pendiente_aut2', 'mantenimiento', dia), opts);
    expect(l).toMatch(/^Pendiente con: Sergio Rojas Pina, Carlos Cano Mejia y Mario Bravo Torres · en espera desde hace 1 día$/);
  });
  it('si el solicitante es de los Aut. 2, no aparece él mismo', () => {
    expect(lineaPendiente(t('pendiente_aut2', 'mantenimiento', dia), { ...opts, excluirNomina: '21' })).not.toContain('Rojas');
  });
  it('sin nadie vigente, queda "Pendiente de autorización"', () => {
    expect(lineaPendiente(t('pendiente_aut1', 'sin-area', dia), opts)).toBe('Pendiente de autorización · en espera desde hace 1 día');
  });
  it('lo que no está pendiente no lleva línea', () => {
    for (const e of ['borrador', 'devuelta', 'autorizada', 'procesada', 'cancelada']) expect(lineaPendiente(t(e, 'calidad', dia), opts)).toBeNull();
  });
});

describe('nivelPendiente', () => {
  it('relaciona el estatus con el nivel', () => {
    expect(nivelPendiente('pendiente_aut1')).toBe(1);
    expect(nivelPendiente('pendiente_aut2')).toBe(2);
    expect(nivelPendiente('autorizada')).toBeNull();
  });
});
