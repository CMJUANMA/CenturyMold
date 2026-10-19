/**
 * AyudaPantalla.jsx — Ícono "?" junto al título de una pantalla: abre una explicación de 3 o 4 pasos de qué se hace ahí y, si la
 * pantalla tiene recorrido guiado, deja volver a verlo. El recorrido arranca solo LA PRIMERA VEZ (si las ayudas están activas).
 * Con las ayudas apagadas no se ve nada. Textos en utils/ayudas.js.
 */
import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import Modal from './Modal';
import Recorrido from './Recorrido';
import Boton from './ui/Boton';
import { usePreferencias } from '../hooks/usePreferencias';
import { ayudaDePantalla, recorridoDe } from '../utils/ayudas';

export default function AyudaPantalla({ id, listo = true }) {
  const { preferencias, marcarRecorridoVisto } = usePreferencias();
  const [abierta, setAbierta] = useState(false);
  const [recorrido, setRecorrido] = useState(false);
  const ayuda = ayudaDePantalla(id);
  const pasos = recorridoDe(id);
  const primeraVez = preferencias.ayudas && pasos.length > 0 && !preferencias.recorridosVistos.includes(id);

  // Primera vez: arranca cuando la pantalla ya tiene sus partes (listo)
  useEffect(() => {
    if (!primeraVez || !listo) return;
    const t = setTimeout(() => setRecorrido(true), 700);
    return () => clearTimeout(t);
  }, [primeraVez, listo]);

  if (!preferencias.ayudas || !ayuda) return null;
  // Si no había nada que señalar (vacio), no se marca como visto: la próxima vez se intenta otra vez
  const terminar = (info) => { setRecorrido(false); if (!info?.vacio) marcarRecorridoVisto(id); };

  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} aria-label="Ayuda de esta pantalla" title="¿Cómo funciona esta pantalla?"
        className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] md:h-9 md:w-9">
        <CircleHelp className="h-4 w-4" />
      </button>
      <Modal isOpen={abierta} onClose={() => setAbierta(false)} title={ayuda.titulo} maxWidth="max-w-md">
        <ol className="space-y-3">
          {ayuda.pasos.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm text-[var(--text-main)]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-xs font-medium text-[var(--text-secondary)]">{i + 1}</span>
              <span className="pt-0.5">{p}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {pasos.length > 0 && <Boton onClick={() => { setAbierta(false); setRecorrido(true); }}>Ver el recorrido</Boton>}
          <Boton variante="primario" onClick={() => setAbierta(false)}>Entendido</Boton>
        </div>
      </Modal>
      {recorrido && <Recorrido pasos={pasos} onTerminar={terminar} />}
    </>
  );
}
