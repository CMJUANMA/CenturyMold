// Cancelar solicitudes de tiempo extra: quién puede y en qué estatus (la misma matriz que firestore.rules; ahí la prueba el emulador), textos y avisos.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESTATUS_CANCELABLES, MIN_MOTIVO_CANCELACION, TEXTO_YA_AUTORIZADA, quienCancelo, quienPuedeCancelar } from '../src/utils/cancelacion.js';
import { AVISOS } from '../src/utils/ayudas.js';
import { avisoCancelacion } from '../src/utils/avisos.js';

const ESTATUS = ['borrador', 'pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada', 'cancelada'];
const t = (estatus, extra = {}) => ({ estatus, creadoPor: 'u-sol', areaId: 'produccion', ...extra });
const PERSONAS = {
  creador: { uid: 'u-sol' },
  otroSolicitante: { uid: 'u-otro' },
  aut1DeLaArea: { uid: 'u-a1', areasAut1: ['produccion'] },
  aut1DeOtraArea: { uid: 'u-a1b', areasAut1: ['almacen'] },
  aut2: { uid: 'u-a2', esAut2: true },
  rh: { uid: 'u-rh', esRH: true },
  admin: { uid: 'u-admin', esRH: true },
};
const PUEDE = {
  creador: ['pendiente_aut1', 'pendiente_aut2', 'devuelta'],
  otroSolicitante: [],
  aut1DeLaArea: ['pendiente_aut1'],
  aut1DeOtraArea: [],
  aut2: ['pendiente_aut2', 'autorizada'],
  rh: ['pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada'],
  admin: ['pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada'],
};

describe('quién puede cancelar (misma matriz que las reglas)', () => {
  for (const [quien, p] of Object.entries(PERSONAS)) {
    for (const e of ESTATUS) {
      it(`${quien} ${PUEDE[quien].includes(e) ? 'PUEDE' : 'NO puede'} cancelar «${e}»`, () => {
        expect(quienPuedeCancelar({ t: t(e), ...p }).puede).toBe(PUEDE[quien].includes(e));
      });
    }
  }
  it('un borrador nunca se cancela (se elimina) y una cancelada no se vuelve a cancelar', () => {
    for (const p of Object.values(PERSONAS)) {
      expect(quienPuedeCancelar({ t: t('borrador'), ...p }).puede).toBe(false);
      expect(quienPuedeCancelar({ t: t('cancelada'), ...p }).puede).toBe(false);
    }
  });
  it('el solicitante, ya autorizada, ve el texto de avisar a RH en lugar del botón; nadie más lo ve', () => {
    expect(TEXTO_YA_AUTORIZADA).toBe('Ya está autorizada. Para cancelarla, avisa a Recursos Humanos.');
    expect(quienPuedeCancelar({ t: t('autorizada'), ...PERSONAS.creador })).toEqual({ puede: false, flujoRH: false, mensaje: TEXTO_YA_AUTORIZADA });
    expect(quienPuedeCancelar({ t: t('procesada'), ...PERSONAS.creador }).mensaje).toBe(TEXTO_YA_AUTORIZADA);
    expect(quienPuedeCancelar({ t: t('autorizada'), ...PERSONAS.otroSolicitante }).mensaje).toBeNull();
    expect(quienPuedeCancelar({ t: t('pendiente_aut1'), ...PERSONAS.creador }).mensaje).toBeNull();
  });
  it('RH sobre lo autorizado o confirmado usa el flujo que atiende el transporte; en lo demás, el general', () => {
    expect(quienPuedeCancelar({ t: t('autorizada'), ...PERSONAS.rh }).flujoRH).toBe(true);
    expect(quienPuedeCancelar({ t: t('procesada'), ...PERSONAS.rh }).flujoRH).toBe(true);
    expect(quienPuedeCancelar({ t: t('pendiente_aut2'), ...PERSONAS.rh }).flujoRH).toBe(false);
    expect(quienPuedeCancelar({ t: t('autorizada'), ...PERSONAS.aut2 }).flujoRH).toBe(false);
  });
  it('RH que además es la persona que la solicitó sigue pudiendo cancelar lo autorizado', () => {
    expect(quienPuedeCancelar({ t: t('autorizada', { creadoPor: 'u-rh' }), uid: 'u-rh', esRH: true })).toMatchObject({ puede: true, flujoRH: true, mensaje: null });
  });
  it('el motivo mínimo es de 10 caracteres', () => { expect(MIN_MOTIVO_CANCELACION).toBe(10); });
  it('la tabla de estatus cancelables es la acordada', () => {
    expect(ESTATUS_CANCELABLES).toEqual({
      creador: ['pendiente_aut1', 'pendiente_aut2', 'devuelta'], aut1: ['pendiente_aut1'], aut2: ['pendiente_aut2', 'autorizada'],
      rh: ['pendiente_aut1', 'pendiente_aut2', 'devuelta', 'autorizada', 'procesada'],
    });
  });
});

describe('quién canceló, cuándo y por qué', () => {
  const fecha = { toDate: () => new Date(2026, 9, 19, 12) };
  it('dice quién y cuándo; con RH lo aclara; sin datos (cancelaciones anteriores) no inventa nada', () => {
    expect(quienCancelo({ estatus: 'cancelada', canceladaPor: { nombre: 'ACOSTA OSCAR', fecha, comoRH: false } })).toBe('Cancelada por ACOSTA OSCAR el 19/10/2026');
    expect(quienCancelo({ estatus: 'cancelada', canceladaPor: { nombre: 'LUNA PATRICIA', fecha, comoRH: true } })).toBe('Cancelada por LUNA PATRICIA (RH) el 19/10/2026');
    expect(quienCancelo({ estatus: 'cancelada', canceladaPor: { nombre: 'X' } })).toBe('Cancelada por X');
    expect(quienCancelo({ estatus: 'cancelada' })).toBeNull();
    expect(quienCancelo({ estatus: 'autorizada', canceladaPor: { nombre: 'X' } })).toBeNull();
    expect(quienCancelo({ estatus: 'cancelada', canceladaPor: { nombre: 'ana pérez' } }, (n) => n.toUpperCase())).toBe('Cancelada por ANA PÉREZ');
  });
  it('el recordatorio dice a quién avisar', () => {
    expect(avisoCancelacion({ folio: 'TE-2026-0012', solicitante: 'Oscar' })).toMatchObject({ tono: 'aviso', titulo: 'Solicitud cancelada', texto: 'Cancelaste TE-2026-0012. Recuerda avisarle a Oscar que ya no va.' });
    expect(AVISOS.cancelada({ folio: 'TE-1', solicitante: '' })).toContain('quien la solicitó');
  });
});

describe('las pantallas usan un solo componente de cancelar', () => {
  const leer = (f) => readFileSync(f, 'utf8');
  it('Mis solicitudes, Por autorizar y Todas las solicitudes lo usan; el botón es de contorno de peligro y pide motivo de 10+ caracteres', () => {
    for (const f of ['src/pages/te/MisSolicitudesTE.jsx', 'src/pages/te/BandejaTE.jsx', 'src/pages/te/ConsultaTE.jsx']) expect(leer(f), f).toContain('AccionCancelarTE');
    const c = leer('src/pages/te/AccionCancelarTE.jsx');
    expect(c).toContain('variante="peligro"');
    expect(c).toContain('MIN_MOTIVO_CANCELACION');
    expect(c).toContain('confirmar(');
    expect(c).toContain('avisar.cancelacion');
  });
  it('Mis solicitudes ya no esconde las acciones en una columna cortada: sin la columna «Nivel»', () => {
    expect(leer('src/pages/te/MisSolicitudesTE.jsx')).not.toContain('<Th>Nivel</Th>');
  });
});
