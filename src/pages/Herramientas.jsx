/**
 * Herramientas.jsx — /herramientas (solo admin): diagnóstico y limpieza de una sola vez. Antes eran la pestaña "Diagnóstico" de Catálogos.
 *   Revisar colecciones (cuenta documentos y busca puntos huérfanos) · Limpiar estructura vieja (con respaldo JSON y confirmación).
 */
import RevisarColecciones from './rh/RevisarColecciones';
import LimpiezaEstructura from './rh/LimpiezaEstructura';
import Aviso from '../components/ui/Aviso';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';

export default function Herramientas() {
  return (
    <div className="space-y-8">
      <EncabezadoPagina antetitulo="Administrador" titulo="Diagnóstico y limpieza" descripcion="Herramientas que se usan pocas veces." />
      <Aviso tono="aviso">Léelas con calma antes de ejecutar algo: algunas escriben en la base de datos.</Aviso>
      <RevisarColecciones />
      <LimpiezaEstructura />
    </div>
  );
}
