import { useContext } from 'react';
import { AuthContext } from '../context/authStore';

/** Sesión y perfil del usuario: { usuario, fireUser, cargando, login, cerrarSesion, ... } */
export function useAuth() {
  return useContext(AuthContext);
}
