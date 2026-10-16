/**
 * Logo.jsx — Logotipo de Century Mold. Tema claro: el logo original (negro y rojo). Tema oscuro: la versión para fondo oscuro
 * (letras en blanco suave y el mismo rojo), sin recuadro ni fondo. Las dos imágenes están siempre en la página y el tema, que
 * es una clase del documento, decide cuál se ve: cambia al instante, también con el tema "Automático".
 * La versión oscura se genera con scripts/generar-logo-oscuro.mjs. Props: className — ancho (ej. "w-72").
 * Las dos llevan el texto alternativo "Century Mold" (la oculta no se anuncia a lectores de pantalla).
 */
import logoClaro from '../assets/marca/century-mold.png';
import logoOscuro from '../assets/marca/century-mold-oscuro.png';

export default function Logo({ className = 'w-40' }) {
  return (
    <span className="inline-block max-w-full">
      <img src={logoClaro} alt="Century Mold" className={`block h-auto max-w-full dark:hidden ${className}`} draggable={false} />
      <img src={logoOscuro} alt="Century Mold" aria-hidden="true" className={`hidden h-auto max-w-full dark:block ${className}`} draggable={false} />
    </span>
  );
}
