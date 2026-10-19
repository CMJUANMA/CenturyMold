import { useContext } from 'react';
import { RecordatoriosContext } from '../context/recordatoriosStore';

/** const { mostrar, cerrar, recordatorios } = useRecordatorios(); mostrar({ tono: 'info', titulo, texto }) */
export function useRecordatorios() {
  const ctx = useContext(RecordatoriosContext);
  if (!ctx) throw new Error('useRecordatorios debe usarse dentro de <RecordatoriosProvider>.');
  return ctx;
}