/**
 * RecordatoriosContext.jsx — Avisos de "a quién avisar" que NO se cierran solos: se quedan en la pantalla donde ocurrió la acción hasta que
 * la persona los cierra, y desaparecen al ir a otra pantalla (se dibujan en components/Recordatorios.jsx). Si la acción navega justo después
 * (enviar → Mis solicitudes), el aviso acompaña ese primer cambio. Al cerrar sesión o cambiar de cuenta se vacían (App.jsx remonta el proveedor).
 * Son recordatorios, no notificaciones: no envían nada.
 */
import { useCallback, useMemo, useState } from 'react';
import { RecordatoriosContext } from './recordatoriosStore';
import { alNavegar as alNavegarPantalla } from '../utils/recordatoriosPantalla';

let siguiente = 0;
export function RecordatoriosProvider({ children }) {
  const [recordatorios, setRecordatorios] = useState([]);
  /** @param {{ tono: string, titulo?: string, texto: string }} r */
  const mostrar = useCallback((r) => setRecordatorios(prev => [...prev, { id: ++siguiente, creado: Date.now(), ruta: null, ...r }]), []);
  /** Al cambiar de pantalla: se quedan los que siguen a la acción (una vez) y se quitan los demás */
  const alNavegar = useCallback((pathname) => setRecordatorios(prev => alNavegarPantalla(prev, pathname)), []);
  const cerrar = useCallback((id) => setRecordatorios(prev => prev.filter(r => r.id !== id)), []);
  const valor = useMemo(() => ({ recordatorios, mostrar, cerrar, alNavegar }), [recordatorios, mostrar, cerrar, alNavegar]);
  return <RecordatoriosContext.Provider value={valor}>{children}</RecordatoriosContext.Provider>;
}