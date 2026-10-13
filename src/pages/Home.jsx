/**
 * Home.jsx — Inicio ("/"): RH y admin entran al portal de módulos; todos los demás, directamente a su panel según su rol.
 */
import { useAccesos } from '../hooks/useAccesos';
import Portal from './Portal';
import InicioRol from './InicioRol';

export default function Home() {
  const { esRH } = useAccesos();
  return esRH ? <Portal /> : <InicioRol />;
}
