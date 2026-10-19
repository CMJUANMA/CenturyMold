/**
 * Recordatorios.jsx — Muestra los recordatorios pendientes arriba del contenido (en Layout). No se cierran solos: la persona los cierra.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useRecordatorios } from '../hooks/useRecordatorios';
import { AVISOS } from '../utils/ayudas';
import Aviso from './ui/Aviso';

export default function Recordatorios() {
  const { recordatorios, cerrar, alNavegar } = useRecordatorios();
  const { pathname } = useLocation();
  // Al cambiar de pantalla se quitan los recordatorios de la anterior
  useEffect(() => { alNavegar(pathname); }, [pathname, alNavegar]);
  if (!recordatorios.length) return null;
  return (
    <div className="mb-6 space-y-3" data-testid="recordatorios">
      {recordatorios.map(r => (
        <Aviso key={r.id} tono={r.tono} titulo={r.titulo}
          accion={(
            <button type="button" onClick={() => cerrar(r.id)} aria-label={AVISOS.cerrar}
              className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}>
          {r.texto}
        </Aviso>
      ))}
    </div>
  );
}