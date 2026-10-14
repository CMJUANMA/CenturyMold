/**
 * Ayuda.jsx — Texto corto de ayuda debajo de un campo. Solo se ve si la persona tiene las ayudas activas (Configuración);
 * con las ayudas apagadas no deja nada en pantalla. Los textos viven en utils/ayudas.js.
 *   <Ayuda clave="solicitar.fecha" />   ó   <Ayuda>texto propio</Ayuda>
 */
import { usePreferencias } from '../hooks/usePreferencias';
import { textoAyuda } from '../utils/ayudas';

export default function Ayuda({ clave, children, className = '' }) {
  const { preferencias } = usePreferencias();
  if (!preferencias.ayudas) return null;
  const texto = children ?? textoAyuda(clave);
  if (!texto) return null;
  return <p className={`mt-1 text-[11px] leading-snug text-[var(--text-secondary)] ${className}`} data-ayuda={clave}>{texto}</p>;
}
