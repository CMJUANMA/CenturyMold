/**
 * Estructura.jsx — ÁREAS → PUESTOS → EMPLEADOS (solo admin y RH). Pestañas: Áreas, Puestos, Excepciones y pendientes y Turnos
 * (horario normal de los turnos de nómina A, B y C). Cada colección se lee por separado y, si falla, se dice cuál y con qué código.
 */
import { useCallback, useEffect, useState } from 'react';
import Aviso from '../../components/ui/Aviso';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import { EsqueletoTabla } from '../../components/ui/Esqueleto';
import Pestanas from '../../components/ui/Pestanas';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ejecutarEnLotes, leerColeccion } from '../../utils/estructuraDb';
import TabAreas from './estructura/TabAreas';
import TabPuestos from './estructura/TabPuestos';
import TabPendientes from './estructura/TabPendientes';
import TabTurnos from './estructura/TabTurnos';

const PESTANAS = [
  { id: 'areas', etiqueta: 'Áreas' },
  { id: 'puestos', etiqueta: 'Puestos' },
  { id: 'pendientes', etiqueta: 'Excepciones y pendientes' },
  { id: 'turnos', etiqueta: 'Turnos' },
];

export default function Estructura() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [pestana, setPestana] = useState('areas');
  const [datos, setDatos] = useState({ areas: [], puestos: [], empleados: [] });
  const [fallos, setFallos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const nombres = ['areas', 'puestos', 'empleados'];
    const res = await Promise.all(nombres.map(n => leerColeccion(n, toast)));
    setDatos({ areas: res[0].datos, puestos: res[1].datos, empleados: res[2].datos });
    setFallos(res.map((r, i) => (r.error ? `${nombres[i]} (${r.error})` : null)).filter(Boolean));
    setCargando(false);
  }, [toast]);

  useEffect(() => { recargar(); }, [recargar]);

  /** Ejecuta las operaciones y recarga; devuelve true si todo se guardó (los errores se muestran, nunca se ocultan) */
  const guardar = useCallback(async (ops, mensajeOk) => {
    try {
      await ejecutarEnLotes(ops);
      toast.success(mensajeOk);
      await recargar();
      return true;
    } catch (e) {
      toast.error(`No se pudo guardar: ${e.message}`, 9000);
      return false;
    }
  }, [toast, recargar]);

  const props = { ...datos, usuario, toast, guardar, recargar };

  return (
    <div className="space-y-8">
      <EncabezadoPagina antetitulo="Recursos Humanos" titulo="Estructura" descripcion="Áreas → puestos → empleados: el área de cada empleado sale de su puesto." />

      {fallos.length > 0 && (
        <Aviso tono="error" titulo="No se pudo leer parte de la estructura">
          No se pudo leer: {fallos.join(', ')}. Esos datos aparecen vacíos; no guardes cambios hasta resolverlo (¿están desplegadas las reglas?).
        </Aviso>
      )}

      <Pestanas etiqueta="Estructura" items={PESTANAS} activa={pestana} onCambio={setPestana} />

      {cargando ? (
        <EsqueletoTabla filas={4} columnas={5} />
      ) : (
        <>
          {pestana === 'areas' && <TabAreas {...props} />}
          {pestana === 'puestos' && <TabPuestos {...props} />}
          {pestana === 'pendientes' && <TabPendientes {...props} />}
          {pestana === 'turnos' && <TabTurnos />}
        </>
      )}
    </div>
  );
}
