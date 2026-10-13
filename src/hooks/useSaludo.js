/**
 * useSaludo.js — Saludo del Inicio: "Buenas tardes, Oscar" (nombre de pila con el formateador del organigrama, no el apellido)
 * y el subtítulo según el rol ("Solicitante · Mantenimiento"). La hora se fija al abrir la pantalla.
 *
 *   const { saludo, nombre, descripcion } = useSaludo(nombresDelPadron);
 */
import { useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useAccesos } from './useAccesos';
import { useAreas } from './useAreas';
import { crearFormateadorNombres } from '../utils/nombresPersona';
import { descripcionRoles, nombreDePila, saludoDeHora } from '../utils/navegacion';

export function useSaludo(nombresPadron = []) {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { nombres } = useAreas();
  const [hora] = useState(() => new Date().getHours());
  const formato = useMemo(() => crearFormateadorNombres(nombresPadron), [nombresPadron]);
  return {
    saludo: saludoDeHora(hora),
    nombre: nombreDePila(usuario?.nombre ?? '', formato),
    descripcion: descripcionRoles(accesos, nombres),
    formato,
  };
}
