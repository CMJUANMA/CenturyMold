/**
 * useAccesosTE.js — Accesos del usuario al módulo de tiempo extra, según la matriz de autorización.
 *
 *   const { areasSolicitante, areasAut1, esAut2, tieneAcceso, cargando, error, matriz } = useAccesosTE();
 *
 * La matriz (areasTE + config/tiempoExtra) se lee una vez por sesión y se comparte entre pantallas.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { accesosDe, cargarMatrizTE, matrizEnCache, suscribirMatrizTE } from '../utils/matrizTE';

const SIN_ACCESO = { areasSolicitante: [], areasAut1: [], esAut2: false };

export function useAccesosTE() {
  const { usuario } = useAuth();
  const uid = usuario?.uid ?? null;
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState({ uid: null, version: -1, matriz: null, error: null });

  // Cuando RH guarda la matriz se invalida la caché y se vuelve a leer
  useEffect(() => suscribirMatrizTE(() => setVersion(v => v + 1)), []);

  useEffect(() => {
    if (!uid) return;
    let vigente = true;
    cargarMatrizTE(uid)
      .then(matriz => { if (vigente) setEstado({ uid, version, matriz, error: null }); })
      .catch(error => { if (vigente) setEstado({ uid, version, matriz: null, error }); });
    return () => { vigente = false; };
  }, [uid, version]);

  const listo = estado.uid === uid && estado.version === version;
  const matriz = (listo ? estado.matriz : null) ?? matrizEnCache(uid);
  const error = listo ? estado.error : null;

  const accesos = useMemo(() => (matriz ? accesosDe(usuario, matriz) : SIN_ACCESO), [usuario, matriz]);
  const tieneAcceso = accesos.areasSolicitante.length > 0 || accesos.areasAut1.length > 0 || accesos.esAut2;
  return { ...accesos, tieneAcceso, matriz, error, cargando: !!uid && !matriz && !error };
}
