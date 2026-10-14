/**
 * PreferenciasContext.jsx — Configuración personal (usuarios/{uid}.preferencias): ayudas sí/no, tamaño de letra y tema.
 * Se aplica en cuanto carga el perfil (el tema y la letra siguen a la persona entre equipos) y se guarda al cambiarla.
 * Las reglas solo dejan a cada quien cambiar ese campo de su propio documento.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from './ThemeContext';
import { PreferenciasContext, TAMANOS_LETRA, normalizarPreferencias } from './preferenciasStore';

export function PreferenciasProvider({ children }) {
  const { usuario } = useAuth();
  const { setModo } = useTheme();
  const uid = usuario?.uid ?? null;
  const guardadas = usuario?.preferencias;
  const preferencias = useMemo(() => normalizarPreferencias(guardadas), [guardadas]);
  const tieneTema = !!guardadas?.tema;

  // El tema guardado en la cuenta manda sobre el recordado en este equipo
  useEffect(() => { if (tieneTema) setModo(preferencias.tema); }, [tieneTema, preferencias.tema, setModo]);

  useEffect(() => {
    document.documentElement.style.fontSize = TAMANOS_LETRA[preferencias.tamanoLetra];
    return () => { document.documentElement.style.fontSize = ''; };
  }, [preferencias.tamanoLetra]);

  /** Cambia una o varias preferencias; si ya no hay sesión no hace nada */
  const guardar = useCallback(async (parche) => {
    if (!uid) return;
    await updateDoc(doc(db, 'usuarios', uid), { preferencias: { ...preferencias, ...parche } });
  }, [uid, preferencias]);

  const marcarRecorridoVisto = useCallback(async (id) => {
    if (preferencias.recorridosVistos.includes(id)) return;
    try { await guardar({ recorridosVistos: [...preferencias.recorridosVistos, id] }); } catch (err) { console.error('Recorrido visto:', err); }
  }, [guardar, preferencias.recorridosVistos]);

  const valor = useMemo(() => ({ preferencias, guardar, marcarRecorridoVisto }), [preferencias, guardar, marcarRecorridoVisto]);
  return <PreferenciasContext.Provider value={valor}>{children}</PreferenciasContext.Provider>;
}
