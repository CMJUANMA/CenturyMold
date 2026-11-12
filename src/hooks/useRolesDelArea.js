import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { esVigente } from '../utils/asignaciones';
import { nominasConRolOperativo } from '../utils/empleadosCaptura';

const SIN_ROLES = { conRol: new Set(), aut1: [], aut2: [] };

/**
 * Quién tiene un rol vigente en esta área: Aut. 2 de la planta y Aut. 1 y solicitante del área.
 *   conRol: Set de nóminas con algún rol (no se les ofrece tiempo extra al capturar).
 *   aut1, aut2: { nomina, nombre, puesto }[] vigentes (para decir en el diálogo de enviar a quién le toca autorizar).
 * Tres consultas con filtros que las reglas aceptan (rol y área). Si alguna se niega (p. ej. un solicitante que no puede ver a otros solicitantes)
 * se ignora solo esa parte: la pantalla nunca se rompe por esto. Mientras carga, devuelve todo vacío.
 */
export function useRolesDelArea(areaId) {
  const [estado, setEstado] = useState({ areaId: null, roles: SIN_ROLES });

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
    ]).then(([aut2, aut1, solicitantes]) => {
      if (!vigente) return;
      const vigentes = (lista) => lista.filter(a => esVigente(a)).map(a => ({ nomina: String(a.nomina), nombre: a.nombre ?? '', puesto: a.puesto ?? '' }));
      setEstado({ areaId, roles: { conRol: nominasConRolOperativo([...aut2, ...aut1, ...solicitantes], areaId, (a) => esVigente(a)), aut1: vigentes(aut1), aut2: vigentes(aut2) } });
    });
    return () => { vigente = false; };
  }, [areaId]);

  return estado.areaId === areaId ? estado.roles : SIN_ROLES;
}
