import { useState, useEffect } from 'react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useRecargarCatalogos } from '../../hooks/useCatalogos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { Database, AlertTriangle, Loader2, ArrowRightLeft } from 'lucide-react';

const COLECCIONES = ['areas', 'rutas', 'comunidades', 'puntosReunion', 'PuntosReunion', 'empleados', 'solicitudes', 'usuarios'];

/** Cuenta los documentos de cada colección y busca puntos cuya comunidad ya no existe */
async function consultar() {
  const resultados = {};
  for (const col of COLECCIONES) {
    try {
      const snap = await getDocs(collection(db, col));
      resultados[col] = snap.size;
    } catch {
      resultados[col] = 'Error/No existe';
    }
  }

  let huerfanos = [];
  try {
    const comSnap = await getDocs(collection(db, 'comunidades'));
    const puntosSnap = await getDocs(collection(db, 'puntosReunion'));
    const validComIds = new Set(comSnap.docs.map(d => d.id));
    huerfanos = puntosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !validComIds.has(p.comunidadId));
  } catch (e) {
    console.error('Error checking orphans', e);
  }
  return { resultados, huerfanos };
}

export default function RevisarColecciones() {
  const recargarCompartidos = useRecargarCatalogos();
  const confirmar = useConfirmar();
  const [cargando, setCargando] = useState(true);
  const [migrando, setMigrando] = useState(false);
  const [conteos, setConteos] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [huerfanos, setHuerfanos] = useState([]);

  const revisar = async () => {
    setCargando(true);
    setError('');
    try {
      const r = await consultar();
      setConteos(r.resultados);
      setHuerfanos(r.huerfanos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // Carga inicial: solo actualiza el estado cuando llega la respuesta (y si la pantalla sigue montada)
  useEffect(() => {
    let vigente = true;
    consultar()
      .then(r => { if (vigente) { setConteos(r.resultados); setHuerfanos(r.huerfanos); } })
      .catch(err => { if (vigente) setError(err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  const migrarPuntos = async () => {
    if (!await confirmar({ titulo: 'Migrar puntos de reunión', mensaje: '¿Seguro que deseas migrar los documentos de "PuntosReunion" a "puntosReunion"?', textoConfirmar: 'Migrar' })) return;
    
    setMigrando(true);
    setError('');
    setExito(false);
    try {
      const snap = await getDocs(collection(db, 'PuntosReunion'));
      if (snap.empty) {
        throw new Error('La colección PuntosReunion está vacía.');
      }

      let count = 0;
      let batch = writeBatch(db);
      
      for (const documento of snap.docs) {
        batch.set(doc(db, 'puntosReunion', documento.id), documento.data(), { merge: true });
        count++;
        
        if (count % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      
      if (count % 400 !== 0) {
        await batch.commit();
      }

      setExito(true);
      recargarCompartidos();
      await revisar();
    } catch (err) {
      setError(err.message);
    } finally {
      setMigrando(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-main)]">Diagnóstico de Colecciones</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">
            Herramienta para diagnosticar colecciones, identificar registros huérfanos y migrar documentos antiguos.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={revisar}
          disabled={cargando || migrando}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--bg-surface-secondary)] border border-[var(--border-color)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--border-subtle)] transition-colors disabled:opacity-50"
        >
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Contar documentos
        </button>
        
        {(conteos?.PuntosReunion > 0) && (
          <button
            onClick={migrarPuntos}
            disabled={cargando || migrando}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] transition-colors disabled:opacity-50"
          >
            {migrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Migrar "PuntosReunion" a "puntosReunion"
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]  ">
          <strong>Error: </strong> {error}
        </div>
      )}

      {exito && (
        <div className="rounded-md border border-amber-300 bg-[var(--status-warning-bg)] p-4 text-xs text-amber-800   ">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4" />
            ¡Migración completada con éxito!
          </div>
          <p>
            Los documentos han sido copiados a la colección correcta (<strong>puntosReunion</strong>). 
            <br/><br/>
            <strong>IMPORTANTE:</strong> Por seguridad, esta aplicación NO borra colecciones automáticamente. 
            Debes ir a la consola web de Firebase, buscar la colección <strong>PuntosReunion</strong> (la que tiene P mayúscula) y borrarla manualmente para evitar confusiones futuras.
          </p>
        </div>
      )}

      {conteos && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--border-subtle)]">
          {Object.entries(conteos).map(([colName, count]) => (
            <div key={colName} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1 truncate">
                {colName}
              </div>
              <div className="text-xl font-semibold text-[var(--text-main)]">
                {count}
              </div>
            </div>
          ))}
        </div>
      )}

      {huerfanos.length > 0 && (
        <div className="rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-4 text-xs text-[var(--status-error-text)]  ">
          <div className="flex items-center gap-2 font-semibold mb-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            ¡Alerta! Hay {huerfanos.length} puntos de reunión huérfanos
          </div>
          <p className="mb-3">
            Estos puntos están apuntando a un <strong>comunidadId</strong> que no existe actualmente en la base de datos. Esto causará que no aparezcan en el formulario de solicitud.
          </p>
          <div className="max-h-64 overflow-y-auto bg-[var(--bg-surface)] dark:bg-black/20 border border-[var(--status-error-border)]  rounded p-2 font-mono text-xs">
            {huerfanos.map(h => (
              <div key={h.id} className="py-1 border-b border-red-100  last:border-0">
                <strong>Clave:</strong> {h.id} | <strong>Nombre:</strong> {h.nombre} | <strong>comunidadId huérfano:</strong> {h.comunidadId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
