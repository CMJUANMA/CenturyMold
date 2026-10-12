/**
 * useConfirmar.js — Confirmaciones y entradas de texto con el Modal de la app (en lugar de confirm/prompt).
 *
 *   const confirmar = useConfirmar();
 *   if (await confirmar({ titulo: 'Desactivar', mensaje: '¿Seguro?', peligroso: true })) { ... }
 *   const nota = await confirmar({ titulo: 'Aviso a RH', campo: { etiqueta: 'Mensaje', minLength: 5, multilinea: true } });
 *   if (nota) { ... }   // string escrito, o null si se canceló
 *
 * Opciones: titulo, mensaje, textoConfirmar, textoCancelar, peligroso, campo { etiqueta, placeholder, minLength, multilinea, valorInicial }.
 */
import { useContext } from 'react';
import { ConfirmarContext } from '../context/confirmarStore';

export function useConfirmar() {
  const confirmar = useContext(ConfirmarContext);
  if (!confirmar) throw new Error('useConfirmar debe usarse dentro de <ConfirmarProvider>.');
  return confirmar;
}
