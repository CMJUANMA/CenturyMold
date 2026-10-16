/**
 * useSaludo.js — Saludo del Inicio: "Buenas tardes, Oscar" (nombre de pila con el formateador del organigrama, no el apellido)
 * y el subtítulo según el rol ("Solicitante · Mantenimiento"). La hora se fija al abrir la pantalla.
 *
 *   const { saludo, nombre, descripcion } = useSaludo(empleadosDelPadron);   // [{ nomina, nombre }]; el nombre sale del padrón si ahí está
 */
import { useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useAccesos } from './useAccesos';
import { useAreas } from './useAreas';
import { crearFormateadorNombres } from '../utils/nombresPersona';
import { descripcionRoles, nombreParaSaludo, saludoDeHora } from '../utils/navegacion';

export function useSaludo(padron = []) {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { nombres } = useAreas();
  const [hora] = useState(() => new Date().getHours());
  const formato = useMemo(() => crearFormateadorNombres(padron.map(e => (typeof e === 'string' ? e : e.nombre))), [padron]);
  return {
    saludo: saludoDeHora(hora),
    nombre: nombreParaSaludo(usuario, padron.filter(e => typeof e !== 'string'), formato),
    descripcion: descripcionRoles(accesos, nombres),
    formato,
  };
}
