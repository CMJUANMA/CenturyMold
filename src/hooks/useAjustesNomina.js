/**
 * useAjustesNomina.js — Los ajustes de nómina de un periodo (todas las áreas), en vivo. { ajustes: Map areaId → documento, cargando, error }
 * Solo Nóminas, RH y admin pueden leer ajustesNomina (firestore.rules): con otro rol no se consulta (`activo: false`).
 */
import { useEffect, useState } from 'react';
import { escucharAjustes } from '../utils/ajustesNominaDb';

const VACIO = new Map();

export function useAjustesNomina(periodo, activo = true) {
  const clave = activo && periodo ? periodo.clave : null;
  const [estado, setEstado] = useState({ clave: null, ajustes: VACIO, error: null });

  useEffect(() => {
    if (!clave) return undefined;
    return escucharAjustes(
      { clave },
      (ajustes) => setEstado({ clave, ajustes, error: null }),
      (error) => { console.error('Ajustes de nómina:', error); setEstado({ clave, ajustes: VACIO, error }); },
    );
  }, [clave]);

  const listo = estado.clave === clave;
  return { ajustes: listo ? estado.ajustes : VACIO, cargando: !!clave && !listo, error: listo ? estado.error : null };
}
