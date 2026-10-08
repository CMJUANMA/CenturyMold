import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'cm_theme';

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado === 'dark' || guardado === 'light') {
      return guardado;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const aplicarTema = (nuevoTema) => {
    const root = document.documentElement;
    if (nuevoTema === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  };

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  // Escuchar cambios de preferencia del sistema si el usuario no ha guardado uno explícito
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (!guardado) {
        setTemaState(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const setTema = (nuevoTema) => {
    setTemaState(nuevoTema);
    localStorage.setItem(STORAGE_KEY, nuevoTema);
  };

  const alternarTema = () => {
    const siguiente = tema === 'dark' ? 'light' : 'dark';
    setTema(siguiente);
  };

  const esOscuro = tema === 'dark';

  return (
    <ThemeContext.Provider value={{ tema, setTema, alternarTema, esOscuro }}>
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
