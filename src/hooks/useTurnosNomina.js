/**
 * useTurnosNomina.js — Horario normal de los turnos de nómina A, B y C (se lee una vez por sesión).
 *   const { turnos, cargando, recargar } = useTurnosNomina();   // turnos: { A: { entrada, salida }, … }
 * Si la lectura falla o RH aún no los captura, todo queda vacío y la extensión de turno pide el fin de turno a mano.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { leerTurnosNomina } from '../utils/turnosNominaDb';

const VACIOS = { A: { entrada: '', salida: '' }, B: { entrada: '', salida: '' }, C: { entrada: '', salida: '' } };

export function useTurnosNomina() {
  const uid = useAuth().usuario?.uid ?? null;
  const [estado, setEstado] = useState({ uid: null, turnos: VACIOS });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let vigente = true;
    leerTurnosNomina()
      .then(turnos => { if (vigente) setEstado({ uid, turnos }); })
      .catch(err => { console.error('Turnos de nómina:', err); if (vigente) setEstado({ uid, turnos: VACIOS }); });
    return () => { vigente = false; };
  }, [uid, version]);

  const recargar = useCallback(() => setVersion(v => v + 1), []);
  const listo = estado.uid === uid;
  return { turnos: listo ? estado.turnos : VACIOS, cargando: !!uid && !listo, recargar };
}
