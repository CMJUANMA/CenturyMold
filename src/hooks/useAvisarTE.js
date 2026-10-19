/**
 * useAvisarTE.js — Muestra el recordatorio de "a quién avisar" después de enviar, autorizar o devolver una solicitud de tiempo extra.
 * Lee solo asignaciones vigentes (nunca usuarios). Si la lectura falla, el aviso sale igual, sin nombres.
 */
import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAreas } from './useAreas';
import { useRecordatorios } from './useRecordatorios';
import { leerAsignacionesParaAvisar } from '../utils/avisosDb';
import { avisoAutorizacion, avisoAutorizacionVarias, avisoDevolucion, avisoEnvio, destinatariosDe, nivelPendiente } from '../utils/avisos';
import { crearFormateadorNombres } from '../utils/nombresPersona';

export function useAvisarTE() {
  const { usuario } = useAuth();
  const { nombres } = useAreas();
  const { mostrar } = useRecordatorios();
  const excluirNomina = String(usuario?.nomina ?? '');

  /** Quién debe revisar a continuación en `nivel` (1 o 2) para solicitudes de `areaId` */
  const quien = useCallback(async (nivel, areaId) => {
    try {
      const { asignaciones, puestos } = await leerAsignacionesParaAvisar({ areaIds: nivel === 1 ? [areaId] : [], aut2: nivel === 2 });
      return destinatariosDe({ nivel, areaId, asignaciones, puestos, excluirNomina });
    } catch (err) { console.error('Recordatorio sin nombres:', err); return []; }
  }, [excluirNomina]);
  const opciones = useCallback(() => ({ nombreArea: (id) => nombres.get(id) ?? id }), [nombres]);

  return {
    /** Después de enviar o reenviar: a Aut. 1, o a Aut. 2 si salta el nivel 1 */
    envio: useCallback(async ({ folio, estatus, areaId, reenviada }) => {
      const destinatarios = estatus === 'autorizada' ? [] : await quien(nivelPendiente(estatus) ?? 1, areaId);
      mostrar(avisoEnvio({ folio, estatus, reenviada, destinatarios, opciones: opciones() }));
    }, [quien, mostrar, opciones]),
    /** Después de autorizar una solicitud */
    autorizacion: useCallback(async ({ nivel, folio }) => {
      mostrar(avisoAutorizacion({ nivel, folio, destinatarios: nivel === 1 ? await quien(2) : [], opciones: opciones() }));
    }, [quien, mostrar, opciones]),
    /** Después de autorizar varias (nivel 1 → avisar a Aut. 2) */
    autorizacionVarias: useCallback(async ({ nivel, cantidad }) => {
      mostrar(avisoAutorizacionVarias({ nivel, cantidad, destinatarios: nivel === 1 ? await quien(2) : [], opciones: opciones() }));
    }, [quien, mostrar, opciones]),
    /** Después de devolver: avisar a quien la solicitó */
    devolucion: useCallback(({ folio, creadoPorNombre }) => {
      const solicitante = creadoPorNombre ? crearFormateadorNombres([]).nombre(creadoPorNombre) : '';
      mostrar(avisoDevolucion({ folio, solicitante }));
    }, [mostrar]),
  };
}