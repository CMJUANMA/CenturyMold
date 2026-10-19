/**
 * RecordatoriosContext.jsx — Avisos de "a quién avisar" que NO se cierran solos: se quedan, aunque la persona cambie de pantalla,
 * hasta que los cierra (se dibujan en components/Recordatorios.jsx). Son recordatorios, no notificaciones: no envían nada.
 */
import { useCallback, useMemo, useState } from 'react';
import { RecordatoriosContext } from './recordatoriosStore';

let siguiente = 0;

export function RecordatoriosProvider({ children }) {
  const [recordatorios, setRecordatorios] = useState([]);
  /** @param {{ tono: string, titulo?: string, texto: string }} r */
  const mostrar = useCallback((r) => setRecordatorios(prev => [...prev, { id: ++siguiente, ...r }]), []);
  const cerrar = useCallback((id) => setRecordatorios(prev => prev.filter(r => r.id !== id)), []);
  const valor = useMemo(() => ({ recordatorios, mostrar, cerrar }), [recordatorios, mostrar, cerrar]);
  return <RecordatoriosContext.Provider value={valor}>{children}</RecordatoriosContext.Provider>;
}