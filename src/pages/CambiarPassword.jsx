/**
 * CambiarPassword.jsx
 * Cambio obligatorio de contraseña en el primer acceso (perfil.debeCambiarPassword === true).
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Aviso from '../components/ui/Aviso';
import Boton from '../components/ui/Boton';
import { Campo, Entrada } from '../components/ui/Campo';
import { AYUDA_PASSWORD, errorPasswordNueva } from '../utils/passwordPolitica';

const ERRORES = {
  'auth/wrong-password': 'La contraseña temporal es incorrecta.',
  'auth/invalid-credential': 'La contraseña temporal es incorrecta.',
  'auth/weak-password': 'La contraseña es muy débil: usa al menos 8 caracteres, con letras y números.',
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
    const malaClave = errorPasswordNueva(nueva, { nomina: usuario?.nomina, anteriores: [temporal] });
    if (malaClave) return setError(malaClave);
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
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Cambia tu contraseña</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Es tu primer acceso: define una contraseña nueva para continuar.</p>
        </div>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <Aviso tono="error">{error}</Aviso>}
          {pideTemporal && (
            <Campo etiqueta="Contraseña temporal">
              <Entrada type="password" autoComplete="current-password" value={temporal} onChange={e => setTemporal(e.target.value)} />
            </Campo>
          )}
          <Campo etiqueta="Contraseña nueva" ayuda={AYUDA_PASSWORD}>
            <Entrada type="password" autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} />
          </Campo>
          <Campo etiqueta="Confirmar contraseña nueva">
            <Entrada type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </Campo>
          <Boton type="submit" variante="primario" className="w-full" estado={enviando ? 'cargando' : undefined}>{enviando ? 'Guardando…' : 'Guardar y continuar'}</Boton>
          <Boton variante="fantasma" className="w-full" onClick={cerrarSesion}>Cerrar sesión</Boton>
        </form>
      </div>
    </div>
  );
}
