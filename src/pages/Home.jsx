/**
 * Home.jsx — Inicio ("/"): un solo Inicio por rol. RH y admin ven el panel de indicadores (InicioRH); Nóminas, el suyo (InicioNomina);
 * todos los demás, su panel según los roles que tienen hoy (InicioRol).
 */
import { useAccesos } from '../hooks/useAccesos';
import InicioNomina from './InicioNomina';
import InicioRH from './InicioRH';
import InicioRol from './InicioRol';

export default function Home() {
  const { esRH, esNomina } = useAccesos();
  if (esRH) return <InicioRH />;
  return esNomina ? <InicioNomina /> : <InicioRol />;
}
