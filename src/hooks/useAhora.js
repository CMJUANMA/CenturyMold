/**
 * useAhora.js — La hora actual (Date), que se refresca cada minuto: lo que depende de la fecha (esVencida, «Vence hoy») se actualiza solo al pasar la medianoche.
 */
import { useEffect, useState } from 'react';

export function useAhora(cadaMs = 60_000) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs]);
  return ahora;
}
