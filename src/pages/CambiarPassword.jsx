/**
 * CambiarPassword.jsx
 * Cambio obligatorio de contraseña en el primer acceso (perfil.debeCambiarPassword === true).
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const MIN = 8;
const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)] focus:ring-1 focus:ring-[var(--cm-red)]';

const ERRORES = {
  'auth/wrong-password': 'La contraseña temporal es incorrecta.',
  'auth/invalid-credential': 'La contraseña temporal es incorrecta.',
  'auth/weak-password': `La contraseña debe tener al menos ${MIN} caracteres.`,
  'auth/requires-recent-login': 'Tu sesión expiró. Cierra sesión e ingresa de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión al servidor.',
  'app/password-igual': 'La nueva contraseña debe ser distinta a la temporal.',
};

export default function CambiarPassword() {
  const { usuario, cambiarPasswordInicial, requiereTemporal, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [temporal, setTemporal] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Si ya no se exige el cambio (p. ej. recién completado), fuera de aquí
  if (usuario && usuario.debeCambiarPassword !== true) return <Navigate to="/" replace />;

  // Tras recargar la página la contraseña temporal ya no está en memoria: hay que pedirla
  const pideTemporal = requiereTemporal();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pideTemporal && !temporal) return setError('Ingresa tu contraseña temporal.');
    if (nueva.length < MIN) return setError(`La contraseña debe tener al menos ${MIN} caracteres.`);
    if (nueva !== confirm) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    try {
      await cambiarPasswordInicial(nueva, pideTemporal ? temporal : '');
      navigate('/', { replace: true });
    } catch (err) {
      setError(ERRORES[err.code] ?? 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4 py-8 text-[var(--text-main)]">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="mb-4 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-[var(--cm-red)]" />
          <h1 className="mt-2 text-lg font-bold">Cambia tu contraseña</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Es tu primer acceso: define una contraseña nueva para continuar.
          </p>
        </div>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {pideTemporal && (
            <div>
              <label htmlFor="pw-temporal" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Contraseña temporal</label>
              <input id="pw-temporal" type="password" autoComplete="current-password" value={temporal} onChange={e => setTemporal(e.target.value)} className={inputCls} />
            </div>
          )}
          <div>
            <label htmlFor="pw-nueva" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Contraseña nueva (mínimo {MIN} caracteres)</label>
            <input id="pw-nueva" type="password" autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Confirmar contraseña nueva</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={enviando}
            className="w-full rounded-md bg-[var(--cm-red)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--cm-red-hover)] disabled:opacity-60">
            {enviando ? 'Guardando...' : 'Guardar y continuar'}
          </button>
          <button type="button" onClick={cerrarSesion} className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)]">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
