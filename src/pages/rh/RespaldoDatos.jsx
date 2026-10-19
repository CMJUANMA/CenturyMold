/**
 * RespaldoDatos.jsx — Herramientas (solo admin): "Respaldo completo". Lee las colecciones y descarga un JSON (utils/respaldoCompleto.js).
 * Es el respaldo manual mientras no haya respaldos programados. Deja un renglón en la bitácora (quién y cuándo, no el contenido).
 */
import { useState } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Tarjeta } from '../../components/ui/Tarjeta';
import { ACCIONES_DESCARGA, registrarDescarga } from '../../utils/bitacoraDb';
import { ESTATUS_TE_VISIBLES } from '../../utils/tiempoExtra';
import { COLECCIONES_RESPALDO, SUBCOLECCIONES_RESPALDO, construirRespaldo, nombreRespaldoCompleto } from '../../utils/respaldoCompleto';

const LOTE = 8; // subcolecciones leídas a la vez

export default function RespaldoDatos() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState('');
  if (usuario?.rol !== 'admin') return null;

  const respaldar = async () => {
    setError('');
    try {
      const colecciones = {};
      for (const nombre of COLECCIONES_RESPALDO) {
        setProgreso(`Leyendo ${nombre}…`);
        // Una consulta de tiempo extra debe excluir los borradores (solo los ve su creador): las reglas no dejan pedirlos todos
        const base = collection(db, nombre);
        const snap = await getDocs(nombre === 'tiempoExtra' ? query(base, where('estatus', 'in', ESTATUS_TE_VISIBLES)) : base);
        const docs = snap.docs.map(d => ({ id: d.id, data: d.data(), sub: null }));
        const subs = SUBCOLECCIONES_RESPALDO[nombre];
        if (subs) {
          for (let i = 0; i < docs.length; i += LOTE) {
            setProgreso(`Leyendo ${nombre} (${Math.min(i + LOTE, docs.length)} de ${docs.length})…`);
            await Promise.all(docs.slice(i, i + LOTE).map(async (d) => {
              d.sub = {};
              for (const s of subs) {
                const ss = await getDocs(collection(db, nombre, d.id, s));
                d.sub[s] = ss.docs.map(x => ({ id: x.id, data: x.data() }));
              }
            }));
          }
        }
        colecciones[nombre] = docs;
      }
      const respaldo = construirRespaldo({ colecciones, exportadoPor: usuario?.nombre ?? '' });
      const url = URL.createObjectURL(new Blob([JSON.stringify(respaldo)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: nombreRespaldoCompleto() });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      registrarDescarga(ACCIONES_DESCARGA.respaldoCompleto, { conteo: respaldo.conteo });
      toast.success('Respaldo descargado. Guárdalo en un lugar seguro.');
    } catch (err) {
      setError(`No se pudo generar el respaldo (${err.code ?? err.message}). Si dice «permission-denied», revisa que tu cuenta siga siendo administrador.`);
    } finally { setProgreso(''); }
  };

  return (
    <Tarjeta titulo="Respaldo completo (JSON)" accion={<DatabaseBackup className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />}>
      <p className="text-sm text-[var(--text-secondary)]">
        Descarga todos los datos (usuarios, asignaciones, padrón, estructura, catálogos, bitácora, tiempo extra con sus empleados e historial). Hazlo con frecuencia
        (por ejemplo cada semana) mientras no haya respaldos programados. Los borradores de otras personas no se incluyen.
      </p>
      <Aviso tono="aviso" className="mt-3">El archivo contiene datos personales de empleados. Guárdalo en una carpeta con acceso restringido y no lo mandes por correo ni por mensaje.</Aviso>
      {error && <Aviso tono="error" className="mt-3">{error}</Aviso>}
      <div className="mt-4 flex items-center gap-3">
        <Boton id="btn-respaldo-completo" variante="primario" icono={DatabaseBackup} estado={progreso ? 'cargando' : undefined} onClick={respaldar}>Descargar respaldo completo</Boton>
        {progreso && <span role="status" className="text-xs text-[var(--text-muted)]">{progreso}</span>}
      </div>
    </Tarjeta>
  );
}
