import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { esVigente } from '../utils/asignaciones';
import { nominasConRolOperativo } from '../utils/empleadosCaptura';

const SIN_ROLES = new Set();

/**
 * Nóminas con un rol operativo vigente (Aut. 2 de la planta; Aut. 1 y solicitante de esa área): no se les ofrece tiempo extra al capturar.
 * Tres consultas con filtros que las reglas aceptan (rol y área). Si alguna se niega (p. ej. un solicitante que aún no puede ver a otros solicitantes)
 * se ignora solo esa parte: la lista nunca se rompe por esto. Mientras carga, devuelve vacío.
 * @returns {Set<string>}
 */
export function useNominasConRol(areaId) {
  const [estado, setEstado] = useState({ areaId: null, nominas: SIN_ROLES });

  useEffect(() => {
    if (!areaId) return undefined;
    let vigente = true;
    const col = collection(db, 'asignaciones');
    const leer = async (consulta) => {
      try { return (await getDocs(consulta)).docs.map(d => d.data()); }
      catch (err) { console.warn('Roles del área:', err.code ?? err); return []; }
    };
    Promise.all([
      leer(query(col, where('rol', '==', 'aut2'))),
      leer(query(col, where('areaId', '==', areaId), where('rol', '==', 'aut1'))),
      leer(query(col, where('areaId', '==', areaId), where('rol', '==', 'solicitante'))),
    ]).then(listas => { if (vigente) setEstado({ areaId, nominas: nominasConRolOperativo(listas.flat(), areaId, (a) => esVigente(a)) }); });
    return () => { vigente = false; };
  }, [areaId]);

  return estado.areaId === areaId ? estado.nominas : SIN_ROLES;
}
