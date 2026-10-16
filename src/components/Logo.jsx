/**
 * Logo.jsx — Logotipo de Century Mold (versión optimizada en src/assets/marca/). El logo es negro sobre transparente y no tiene versión
 * blanca, así que en el tema oscuro va sobre un recuadro claro de esquinas redondeadas para que se lea.
 * Props: className — ancho/alto del logo (ej. "w-72"); la imagen siempre lleva el texto alternativo "Century Mold".
 */
import logo from '../assets/marca/century-mold.png';

export default function Logo({ className = 'w-40' }) {
  return (
    <span className="inline-block rounded-lg dark:bg-white dark:px-2.5 dark:py-1.5">
      <img src={logo} alt="Century Mold" className={`block h-auto max-w-full ${className}`} draggable={false} />
    </span>
  );
}
