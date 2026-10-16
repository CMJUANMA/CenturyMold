/**
 * AyudaPantalla.jsx — Ícono "?" junto al título de una pantalla: abre una explicación de 3 o 4 pasos de qué se hace ahí y, si la
 * pantalla tiene recorrido guiado, deja volver a verlo. El recorrido arranca solo LA PRIMERA VEZ (si las ayudas están activas).
 * Con las ayudas apagadas no se ve nada. Textos en utils/ayudas.js.
 */
import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import Modal from './Modal';
import Recorrido from './Recorrido';
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
  const terminar = () => { setRecorrido(false); marcarRecorridoVisto(id); };

  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} aria-label="Ayuda de esta pantalla" title="¿Cómo funciona esta pantalla?"
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--cm-red)] hover:text-[var(--accent-text)]">
        <CircleHelp className="h-4 w-4" />
      </button>
      <Modal isOpen={abierta} onClose={() => setAbierta(false)} title={ayuda.titulo} maxWidth="max-w-md">
        <ol className="space-y-3">
          {ayuda.pasos.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm text-[var(--text-main)]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--cm-red)] text-xs font-semibold text-white">{i + 1}</span>
              <span className="pt-0.5">{p}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {pasos.length > 0 && (
            <button type="button" onClick={() => { setAbierta(false); setRecorrido(true); }}
              className="cursor-pointer rounded-md border border-[var(--border-color)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">Ver el recorrido</button>
          )}
          <button type="button" onClick={() => setAbierta(false)} className="cursor-pointer rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)]">Entendido</button>
        </div>
      </Modal>
      {recorrido && <Recorrido pasos={pasos} onTerminar={terminar} />}
    </>
  );
}
