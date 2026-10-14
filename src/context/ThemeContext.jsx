import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'cm_theme';

/** Modos que elige la persona en Configuración: 'claro' | 'oscuro' | 'auto' (sigue al dispositivo). Se recuerda en este equipo */
const leerModo = () => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return guardado === 'dark' ? 'oscuro' : guardado === 'light' ? 'claro' : 'auto';
  } catch { return 'auto'; }
};
const sistemaEsOscuro = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [modo, setModoState] = useState(leerModo);
  const [sistemaOscuro, setSistemaOscuro] = useState(sistemaEsOscuro);

  const tema = modo === 'oscuro' || (modo === 'auto' && sistemaOscuro) ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', tema === 'dark');
    root.style.colorScheme = tema;
  }, [tema]);

  // El modo automático sigue los cambios del dispositivo
  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setSistemaOscuro(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const setModo = (nuevo) => {
    const m = ['claro', 'oscuro', 'auto'].includes(nuevo) ? nuevo : 'auto';
    setModoState(m);
    try {
      if (m === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, m === 'oscuro' ? 'dark' : 'light');
    } catch { /* sin almacenamiento local: el modo vale solo para esta sesión */ }
  };

  const setTema = (nuevoTema) => setModo(nuevoTema === 'dark' ? 'oscuro' : 'claro');
  const alternarTema = () => setTema(tema === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ tema, modo, setModo, setTema, alternarTema, esOscuro: tema === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
}
