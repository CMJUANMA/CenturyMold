/**
 * Ayuda.jsx — /ayuda: el manual de cada rol que tiene la persona y su guía rápida de una hoja, con «Descargar PDF».
 * Los PDF se generan con `npm run manuales` y se publican en /manuales/ (public/manuales). Quien no tiene ningún rol todavía ve cómo pedirlo.
 */
import { BookOpen, ExternalLink, FileDown } from 'lucide-react';
import { useAccesos } from '../hooks/useAccesos';
import Aviso from '../components/ui/Aviso';
import { claseBoton } from '../components/ui/Boton';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import { EsqueletoPagina } from '../components/ui/Esqueleto';
import { Tarjeta } from '../components/ui/Tarjeta';
import { manualesDeUsuario } from '../utils/manuales';

export default function Ayuda() {
  const accesos = useAccesos();
  if (accesos.cargando) return <EsqueletoPagina />;
  const manuales = manualesDeUsuario(accesos);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Ayuda"
        titulo="Manuales y guías"
        descripcion={manuales.length > 1 ? 'Aquí está el manual de cada rol que tienes, y una guía rápida de una hoja para imprimir y pegar junto a la computadora.' : 'Aquí está tu manual y su guía rápida de una hoja para imprimir y pegar junto a la computadora.'}
      />

      {manuales.length === 0 && (
        <Aviso tono="info" titulo="Todavía no tienes un manual">
          Los manuales se muestran según tus roles (solicitante, autorizador, Recursos Humanos o Nóminas). Pide al área de Sistemas o, en su caso, a Recursos Humanos que te den el tuyo.
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {manuales.map(m => (
          <Tarjeta key={m.archivo} titulo={<span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />Manual de {m.rol}</span>} cuerpoClassName="p-5">
            <section aria-label={`Manual de ${m.rol}`} className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">{m.para}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a id={`descargar-manual-${m.archivo}`} href={m.manual} download className={claseBoton('primario', 'md')}>
                  <FileDown className="h-4 w-4" aria-hidden="true" />Descargar PDF
                </a>
                <a id={`ver-manual-${m.archivo}`} href={m.manual} target="_blank" rel="noopener noreferrer" className={claseBoton('contorno', 'md')}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir en otra pestaña
                </a>
                <a id={`descargar-guia-${m.archivo}`} href={m.guia} download className={claseBoton('contorno', 'md')}>
                  <FileDown className="h-4 w-4" aria-hidden="true" />Guía rápida (una hoja)
                </a>
              </div>
            </section>
          </Tarjeta>
        ))}
      </div>

      <p className="text-xs text-[var(--text-muted)]">¿No encuentras lo que buscas? Pregunta en el área de Sistemas o, en su caso, en Recursos Humanos.</p>
    </div>
  );
}
