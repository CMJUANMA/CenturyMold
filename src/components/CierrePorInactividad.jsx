/**
 * CierrePorInactividad.jsx — Cierra la sesión tras 30 minutos sin actividad (utils/inactividad.js), con un aviso de 1 minuto para seguir.
 * No pinta nada mientras hay actividad. Se monta dentro de las rutas protegidas. Si el navegador estuvo cerrado más del límite, al volver
 * la sesión se cierra (la última actividad se guarda en localStorage: solo la hora).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import Modal from './Modal';
import Boton from './ui/Boton';
import { useAuth } from '../hooks/useAuth';
import { guardarBorradorAntesDeCerrar } from '../utils/guardadoAutomatico';
import { CLAVE_ULTIMA_ACTIVIDAD, crearMarca, estadoInactividad, leerMarca, ultimaActividad } from '../utils/inactividad';

const REVISION_MS = 5_000;
const GUARDAR_CADA_MS = 10_000;
const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'];

const leer = (uid) => { try { return leerMarca(localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD), uid); } catch { return 0; } };
const guardar = (uid, t) => { try { localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, crearMarca(uid, t)); } catch { /* sin almacenamiento: solo cuenta esta pestaña */ } };

export default function CierrePorInactividad() {
  const { cerrarPorInactividad, usuario } = useAuth();
  const uid = usuario?.uid;
  const propia = useRef(0); // se fija al montar (marcar)
  const guardada = useRef(0);
  const aviso = useRef(false);
  const cerrando = useRef(false);
  const [restante, setRestante] = useState(null); // segundos; solo durante el aviso
  const enAviso = restante != null;

  const marcar = useCallback(() => {
    const t = Date.now();
    propia.current = t;
    if (t - guardada.current > GUARDAR_CADA_MS) { guardada.current = t; guardar(uid, t); }
  }, [uid]);

  /** Antes de salir se guarda el borrador de tiempo extra con cambios sin guardar (si lo hay); el login avisa que se guardó */
  const cerrarGuardando = useCallback(async () => {
    if (cerrando.current) return;
    cerrando.current = true;
    const borradorGuardado = await guardarBorradorAntesDeCerrar();
    await cerrarPorInactividad({ borradorGuardado });
  }, [cerrarPorInactividad]);

  const revisar = useCallback(() => {
    const { estado, restanteMs } = estadoInactividad(Date.now(), ultimaActividad(propia.current, leer(uid)));
    if (estado === 'vencida') { aviso.current = false; setRestante(null); cerrarGuardando(); return; }
    aviso.current = estado === 'aviso';
    setRestante(estado === 'aviso' ? Math.ceil(restanteMs / 1000) : null);
  }, [cerrarGuardando, uid]);

  useEffect(() => {
    // Al abrir: si la última actividad guardada ya venció (navegador cerrado mucho tiempo) se cierra; si no, empieza el conteo
    if (!uid) return undefined; // sin sesión no corre ningún temporizador
    const previa = leer(uid);
    if (previa && estadoInactividad(Date.now(), previa).estado === 'vencida') { cerrarPorInactividad(); return undefined; }
    marcar();
    // Durante el aviso solo cuenta el botón "Seguir aquí": mover el mouse no renueva la sesión
    const alActividad = () => { if (!aviso.current) marcar(); };
    EVENTOS.forEach(e => window.addEventListener(e, alActividad, { passive: true, capture: true }));
    const t = setInterval(revisar, REVISION_MS);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      EVENTOS.forEach(e => window.removeEventListener(e, alActividad, { capture: true }));
      clearInterval(t);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [uid, marcar, revisar, cerrarPorInactividad]);

  // Cuenta regresiva del aviso
  useEffect(() => {
    if (!enAviso) return;
    const t = setInterval(revisar, 1000);
    return () => clearInterval(t);
  }, [enAviso, revisar]);

  if (!enAviso) return null;
  const seguir = () => { aviso.current = false; guardada.current = 0; marcar(); setRestante(null); };
  return (
    <Modal isOpen onClose={seguir} title="¿Sigues ahí?" maxWidth="max-w-sm" preventCloseOnBackdrop>
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning-text)]" aria-hidden="true" />
        <p className="text-sm text-[var(--text-secondary)]" role="alert">
          Por seguridad, tu sesión se cerrará en <b className="tabular-nums text-[var(--text-main)]">{restante} s</b> por inactividad.
        </p>
      </div>
      <div className="mt-5 flex justify-end">
        <Boton variante="primario" onClick={seguir}>Seguir aquí</Boton>
      </div>
    </Modal>
  );
}
