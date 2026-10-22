/**
 * FormatoRutasPagina.jsx — /transporte/formato-rutas (RH, admin y Nóminas): el Excel «Formato de rutas (proveedor)» en su propia pantalla,
 * para bajarlo sin pasar por «Por enviar al proveedor». Es el mismo botón y panel de siempre (components/FormatoRutas.jsx): elige la fecha o el
 * rango, ve cuántas solicitudes de transporte encontró y descarga. Cada descarga queda en la bitácora con el nombre de quien la hizo.
 */
import AyudaPantalla from '../../components/AyudaPantalla';
import BotonFormatoRutas from '../../components/FormatoRutas';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';

export default function FormatoRutasPagina() {
  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Transporte"
        titulo="Formato de rutas"
        descripcion="El Excel para el proveedor de transporte, con los empleados que llevan transporte en las fechas que elijas."
        ayuda={<AyudaPantalla id="formatoRutas" />}
      />
      <section aria-label="Descargar el formato" className="max-w-md space-y-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <p className="text-sm text-[var(--text-main)]">
          Elige hoy, mañana, una fecha o un rango. Antes de bajar el archivo ves cuántas solicitudes de transporte encontró; si no hay ninguna, no se baja un Excel vacío.
        </p>
        <BotonFormatoRutas id="btn-formato-rutas-pagina" />
      </section>
    </div>
  );
}
