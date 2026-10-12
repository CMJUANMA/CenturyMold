/**
 * CatalogosContext.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Catálogos compartidos, cargados UNA vez por sesión y solo cuando una pantalla los pide:
 *   - catálogo: rutas, comunidades y puntosReunion
 *   - empleados
 * Se guardan completos (incluye inactivos, que EditarSolicitud necesita para mostrar valores
 * ya guardados) y se exponen también los activos ya filtrados.
 *
 * Uso: const { rutasActivas, empleadosActivos, cargando, recargar } = useCatalogos();
 *      useCatalogos({ empleados: false }) si la pantalla no necesita empleados.
 *
 * recargar(): invalida la caché. Si hay pantallas usando el grupo lo relee de inmediato; si no,
 * se relee la próxima vez que alguien lo pida (así guardar en RH no cuesta lecturas de más).
 * parchearEmpleados(): actualiza empleados en memoria sin releer (p. ej. tras confirmar su ruta).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { esActivo } from '../utils/activo';

const CatalogosContext = createContext(null);

const VACIO = { uid: null, rutas: [], comunidades: [], puntos: [], empleados: [] };
const leer = (nombre) => getDocs(collection(db, nombre))
  .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })));

export function CatalogosProvider({ children }) {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? null;

  const [datos, setDatos] = useState(VACIO);
  const [cargandoG, setCargandoG] = useState({ cat: false, emp: false });
  const [errorG, setErrorG] = useState({ cat: null, emp: null });
  // uid para el que cada grupo ya está cargado (null = pendiente o invalidado)
  const [listoG, setListoG] = useState({ cat: null, emp: null });

  // uid para el que está cargado cada grupo (null = sin cargar / invalidado)
  const cargadoPara = useRef({ cat: null, emp: null });
  const enCurso = useRef({ cat: false, emp: false });
  const version = useRef({ cat: 0, emp: 0 });
  const consumidores = useRef({ cat: 0, emp: 0 });

  const cargar = useCallback(async (grupo, uidActual) => {
    if (!uidActual) return;
    const v = ++version.current[grupo];
    enCurso.current[grupo] = true;
    setCargandoG(c => ({ ...c, [grupo]: true }));
    setErrorG(e => ({ ...e, [grupo]: null }));
    try {
      const resultado = grupo === 'cat'
        ? await Promise.all([leer('rutas'), leer('comunidades'), leer('puntosReunion')])
        : await leer('empleados');
      if (v !== version.current[grupo]) return; // llegó una carga más nueva: se ignora esta
      setDatos(d => {
        const base = d.uid === uidActual ? d : { ...VACIO, uid: uidActual };
        return grupo === 'cat'
          ? { ...base, rutas: resultado[0], comunidades: resultado[1], puntos: resultado[2] }
          : { ...base, empleados: resultado };
      });
      cargadoPara.current[grupo] = uidActual;
      setListoG(l => ({ ...l, [grupo]: uidActual }));
    } catch (err) {
      if (v !== version.current[grupo]) return;
      console.error(`Error cargando ${grupo === 'cat' ? 'catálogos' : 'empleados'}:`, err);
      setErrorG(e => ({ ...e, [grupo]: err }));
    } finally {
      if (v === version.current[grupo]) {
        enCurso.current[grupo] = false;
        setCargandoG(c => ({ ...c, [grupo]: false }));
      }
    }
  }, []);

  const asegurar = useCallback((grupo) => {
    if (!uid) return;
    if (cargadoPara.current[grupo] === uid || enCurso.current[grupo]) return;
    cargar(grupo, uid);
  }, [uid, cargar]);

  const recargar = useCallback(() => {
    for (const grupo of ['cat', 'emp']) {
      cargadoPara.current[grupo] = null;
      setListoG(l => ({ ...l, [grupo]: null }));
      if (consumidores.current[grupo] > 0) cargar(grupo, uid);
      else version.current[grupo]++; // descarta cualquier carga en vuelo; la próxima pantalla relee
    }
  }, [uid, cargar]);

  // Una pantalla se registra como consumidora de un grupo: lo pide si falta y, mientras esté montada,
  // recargar() lo relee de inmediato. Devuelve la función de baja.
  const registrar = useCallback((grupo) => {
    consumidores.current[grupo]++;
    asegurar(grupo);
    return () => { consumidores.current[grupo]--; };
  }, [asegurar]);

  const parchearEmpleados = useCallback((cambiosPorId) => {
    setDatos(d => ({
      ...d,
      empleados: d.empleados.map(e => (cambiosPorId[e.id] ? { ...e, ...cambiosPorId[e.id] } : e)),
    }));
  }, []);

  // Los datos de otra sesión nunca se exponen
  const vigentes = datos.uid === uid ? datos : VACIO;

  const valor = useMemo(() => ({
    rutas: vigentes.rutas,
    comunidades: vigentes.comunidades,
    puntos: vigentes.puntos,
    empleados: vigentes.empleados,
    rutasActivas: vigentes.rutas.filter(esActivo),
    comunidadesActivas: vigentes.comunidades.filter(esActivo),
    puntosActivos: vigentes.puntos.filter(esActivo),
    empleadosActivos: vigentes.empleados.filter(esActivo),
    uid, listoG, cargandoG, errorG, registrar, recargar, parchearEmpleados,
  }), [vigentes, uid, listoG, cargandoG, errorG, registrar, recargar, parchearEmpleados]);

  return <CatalogosContext.Provider value={valor}>{children}</CatalogosContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCatalogos({ empleados = true } = {}) {
  const ctx = useContext(CatalogosContext);
  const { registrar } = ctx;

  useEffect(() => registrar('cat'), [registrar]);
  useEffect(() => (empleados ? registrar('emp') : undefined), [empleados, registrar]);

  // Cargando también antes de que arranque la primera carga (evita un destello de listas vacías)
  const pendiente = (g) => !!ctx.uid && ctx.listoG[g] !== ctx.uid && !ctx.errorG[g];
  const cargando = pendiente('cat') || ctx.cargandoG.cat || (empleados && (pendiente('emp') || ctx.cargandoG.emp));
  const error = ctx.errorG.cat || (empleados ? ctx.errorG.emp : null);
  return { ...ctx, cargando, error };
}

/** Solo la función recargar(), sin registrar la pantalla como consumidora (no dispara cargas). */
// eslint-disable-next-line react-refresh/only-export-components
export function useRecargarCatalogos() {
  return useContext(CatalogosContext).recargar;
}
