import { useState, useEffect } from 'react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useRecargarCatalogos } from '../../hooks/useCatalogos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { Database, ArrowRightLeft } from 'lucide-react';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';

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
    <section className="space-y-5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5" aria-label="Diagnóstico de colecciones">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Diagnóstico de colecciones</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
          Cuenta los documentos de cada colección, identifica registros huérfanos y migra documentos antiguos.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton icono={Database} estado={cargando ? 'cargando' : undefined} onClick={revisar} disabled={cargando || migrando}>Contar documentos</Boton>
        {(conteos?.PuntosReunion > 0) && (
          <Boton icono={ArrowRightLeft} estado={migrando ? 'cargando' : undefined} onClick={migrarPuntos} disabled={cargando || migrando}>
            Migrar «PuntosReunion» a «puntosReunion»
          </Boton>
        )}
      </div>

      {error && <Aviso tono="error" titulo="Error">{error}</Aviso>}

      {exito && (
        <Aviso tono="aviso" titulo="Migración completada">
          Los documentos se copiaron a la colección correcta (<b className="font-medium">puntosReunion</b>).
          <b className="mt-2 block font-medium">Importante:</b> por seguridad, esta aplicación no borra colecciones automáticamente.
          Entra a la consola web de Firebase, busca la colección <b className="font-medium">PuntosReunion</b> (la que tiene P mayúscula) y bórrala a mano para evitar confusiones.
        </Aviso>
      )}

      {conteos && (
        <dl className="grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3 md:grid-cols-4">
          {Object.entries(conteos).map(([colName, count]) => (
            <div key={colName} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
              <dt className="mb-1 truncate text-xs text-[var(--text-muted)]">{colName}</dt>
              <dd className="text-xl font-medium tabular-nums text-[var(--text-main)]">{count}</dd>
            </div>
          ))}
        </dl>
      )}

      {huerfanos.length > 0 && (
        <Aviso tono="error" titulo={`Hay ${huerfanos.length} puntos de reunión huérfanos`}>
          <p className="mb-3">
            Estos puntos apuntan a una <b className="font-medium">comunidadId</b> que ya no existe en la base de datos, así que no aparecerán en el formulario de solicitud.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 font-mono text-xs text-[var(--text-main)]">
            {huerfanos.map(h => (
              <div key={h.id} className="border-b border-[var(--border-subtle)] py-1 last:border-0">
                <b className="font-medium">Clave:</b> {h.id} | <b className="font-medium">Nombre:</b> {h.nombre} | <b className="font-medium">comunidadId huérfano:</b> {h.comunidadId}
              </div>
            ))}
          </div>
        </Aviso>
      )}
    </section>
  );
}
