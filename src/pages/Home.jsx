/**
 * Home.jsx — Inicio ("/"): un solo Inicio por rol. RH y admin ven el panel de indicadores (InicioRH); todos los demás, su panel
 * según los roles que tienen hoy (InicioRol).
 */
import { useAccesos } from '../hooks/useAccesos';
import InicioRH from './InicioRH';
import InicioRol from './InicioRol';

export default function Home() {
  const { esRH } = useAccesos();
  return esRH ? <InicioRH /> : <InicioRol />;
}
