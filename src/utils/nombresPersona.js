/**
 * nombresPersona.js — Nombre para mostrar a partir del padrón, donde los apellidos van primero ("GOMEZ HERNANDEZ ISMAEL").
 * Solo se reordena cuando se puede separar con seguridad; si no, se deja el nombre completo como está (en formato título).
 * Sin dependencias del navegador.
 */

const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA']);
/** Nombres de pila frecuentes: dan certeza al separar apellidos de nombres aunque nadie más del padrón se llame igual */
const NOMBRES_COMUNES = `JOSE JUAN LUIS CARLOS JORGE MIGUEL ANGEL PEDRO FRANCISCO ANTONIO MANUEL JESUS ALEJANDRO RICARDO ROBERTO FERNANDO DANIEL EDUARDO
RAFAEL JAVIER RAUL SERGIO OSCAR ARTURO HECTOR VICTOR ENRIQUE GERARDO MARIO ALBERTO ALFREDO ADRIAN ARMANDO GUSTAVO RAMON ROBERTO IGNACIO ISMAEL SALVADOR MARCO
MARCOS NOE JOEL ANSELMO FILOMENO RODOLFO REMEDIOS LEZLI NORA ABEL ABRAHAM ALAN ANDRES ANGELICA ANA MARIA MARTHA PATRICIA LETICIA GUADALUPE ROSA ELIZABETH
LAURA CLAUDIA SANDRA VERONICA GABRIELA ALEJANDRA ADRIANA MONICA CRISTINA SILVIA ARACELI LUCIA TERESA JULIA IRMA ELENA BLANCA LILIANA ERIKA KARINA YESENIA
DIEGO EMILIO ERNESTO EFRAIN FELIPE GILBERTO GUILLERMO HUGO IVAN JAIME JULIO LEONARDO LORENZO MAURICIO NESTOR OMAR PABLO RENE SAUL SANTIAGO TOMAS URIEL
VICENTE XAVIER SAMUEL ISAAC ISRAEL MOISES ELIAS ABIGAIL ALMA AMALIA BERTHA CARMEN CONCEPCION DIANA DOLORES ESTHER EVA FABIOLA GLORIA IRENE JUANA LORENA
LUZ MARGARITA MARISOL MIRIAM NANCY OLGA PAULA RAQUEL ROCIO SOFIA SUSANA VIRGINIA YOLANDA`.split(/\s+/);
const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const limpiar = (t) => String(t ?? '').trim().replace(/\s+/g, ' ');
const titulo = (palabras) => palabras.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');

/**
 * Crea el formateador con los nombres del padrón. Los nombres de pila conocidos salen de la última palabra de cada registro
 * (el nombre de pila va al final). Dos palabras: "APELLIDO NOMBRE". Tres: solo si exactamente una partición (1 o 2 apellidos)
 * deja al final únicamente nombres conocidos. Cuatro: dos apellidos y dos nombres, salvo que también sea posible 1 + 3 (ambiguo).
 * Con cinco o más palabras, o si hay duda, se deja el nombre completo.
 * @param {string[]} nombresPadron
 */
export function crearFormateadorNombres(nombresPadron = []) {
  const conocidos = new Map(NOMBRES_COMUNES.map(n => [n, 1000])); // nombre de pila → cuántos registros terminan con él
  for (const n of nombresPadron) {
    const p = sinAcentos(limpiar(n)).split(' ');
    if (p.length >= 2) conocidos.set(p[p.length - 1], (conocidos.get(p[p.length - 1]) ?? 0) + 1);
  }

  /** @returns {{ nombre: string, apellidos: string, completo: string, separado: boolean }} */
  function partir(nombrePadron) {
    const palabras = limpiar(nombrePadron).toUpperCase().split(' ').filter(Boolean);
    const sinSeparar = { nombre: '', apellidos: '', completo: titulo(palabras), separado: false };
    if (palabras.length < 2 || palabras.length > 4) return sinSeparar;
    let k = null; // cuántas palabras iniciales son apellidos
    if (palabras.length === 2) k = 1;
    else {
      // El propio registro no cuenta como evidencia de su último nombre (sería circular)
      const ultima = palabras[palabras.length - 1];
      const conocido = (p) => (conocidos.get(p) ?? 0) - (p === ultima ? 1 : 0) > 0;
      const valida = (apellidos) => palabras.slice(apellidos).every(p => conocido(p) || PARTICULAS.has(p))
        && !PARTICULAS.has(palabras[apellidos]) && palabras.length - apellidos >= 1;
      const opciones = [1, 2].filter(a => a < palabras.length && valida(a));
      if (opciones.length === 1) k = opciones[0];
      else if (opciones.length === 0 && palabras.length === 4) k = 2;
    }
    if (k === null) return sinSeparar;
    const nombre = titulo(palabras.slice(k));
    const apellidos = titulo(palabras.slice(0, k));
    return { nombre, apellidos, completo: `${nombre} ${apellidos}`, separado: true };
  }

  /** ¿Es un nombre de pila conocido? (lista común + últimas palabras del padrón; sin acentos ni mayúsculas) */
  const esNombreDePila = (palabra) => (conocidos.get(sinAcentos(palabra)) ?? 0) > 0;

  return {
    partir,
    esNombreDePila,
    /** "Ismael Gómez Hernández" (sin acentos: el padrón no los trae) */
    nombre: (nombrePadron) => partir(nombrePadron).completo,
    /** Iniciales de nombre de pila y primer apellido; si no se pudo separar, las dos primeras palabras */
    iniciales: (nombrePadron) => {
      const p = partir(nombrePadron);
      const base = p.separado ? [p.nombre.split(' ')[0], p.apellidos.split(' ')[0]] : p.completo.split(' ').slice(0, 2);
      return base.filter(Boolean).map(x => x.charAt(0)).join('').toUpperCase() || '?';
    },
  };
}
