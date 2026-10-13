/**
 * CatalogosContext.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Catálogos compartidos, cargados UNA vez por sesión y solo cuando una pantalla los pide:
 *   - catálogo: rutas, comunidades y puntosReunion
 *   - empleados
 * Se guardan completos (incluye inactivos, que EditarSolicitud necesita para mostrar valores
 * ya guardados) y se exponen también los activos ya filtrados.
 *
 * El padrón se lee según el rol (lo exigen las reglas): admin, RH y Aut. 2 lo leen completo; el solicitante y el Aut. 1,
 * solo los empleados de sus áreas vigentes (where('areaId', 'in', susÁreas), en trozos de 10). Si cambian sus áreas, se relee.
 *
 * Se consume con el hook useCatalogos() de hooks/useCatalogos.js.
 *
 * recargar(): invalida la caché. Si hay pantallas usando el grupo lo relee de inmediato; si no,
 * se relee la próxima vez que alguien lo pida (así guardar en RH no cuesta lecturas de más).
 * parchearEmpleados(): actualiza empleados en memoria sin releer (p. ej. tras confirmar su ruta).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import { CatalogosContext } from './catalogosStore';
import { esActivo } from '../utils/activo';



const VACIO = { uid: null, rutas: [], comunidades: [], puntos: [], empleados: [] };
const leer = (nombre) => getDocs(collection(db, nombre))
  .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })));

/** Padrón según lo que el rol puede leer: todo, o solo las áreas dadas (nunca una consulta abierta para estos roles) */
async function leerPadron({ completo, areas }) {
  if (completo) return leer('empleados');
  const ids = [...new Set(areas)];
  if (ids.length === 0) return [];
  const trozos = [];
  for (let i = 0; i < ids.length; i += 10) trozos.push(ids.slice(i, i + 10));
  const grupos = await Promise.all(trozos.map(t => getDocs(query(collection(db, 'empleados'), where('areaId', 'in', t)))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))));
  return grupos.flat();
}

export function CatalogosProvider({ children }) {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? null;
  const accesos = useAccesos();
  // Qué parte del padrón le toca a este usuario; cambia si le dan o quitan un rol
  const completo = accesos.esRH || accesos.esAut2;
  const areasPadron = useMemo(() => [...new Set([...accesos.areasSolicitante, ...accesos.areasAut1])].sort(), [accesos.areasSolicitante, accesos.areasAut1]);
  const clavePadron = `${completo ? '*' : areasPadron.join(',')}`;
  const accesoListo = !accesos.cargando;
  const alcance = useRef({ completo, areas: areasPadron });
  const listoAcceso = useRef(false);
  useEffect(() => { alcance.current = { completo, areas: areasPadron }; listoAcceso.current = accesoListo; });

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
        : await leerPadron(alcance.current);
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
    if (grupo === 'emp' && !listoAcceso.current) return; // sin saber qué roles tiene no se puede pedir el padrón
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
  // Si el alcance del padrón cambia (le dieron o quitaron un rol), lo leído deja de valer: se vuelve a leer si alguien lo usa
  const claveCargada = useRef(null);
  useEffect(() => {
    if (!uid || !accesoListo) return;
    const clave = `${uid}|${clavePadron}`;
    if (claveCargada.current === clave) return;
    claveCargada.current = clave;
    cargadoPara.current.emp = null;
    setListoG(l => ({ ...l, emp: null }));
    if (consumidores.current.emp > 0) cargar('emp', uid);
    else version.current.emp++;
  }, [uid, accesoListo, clavePadron, cargar]);

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
