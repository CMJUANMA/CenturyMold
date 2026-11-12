// Variantes de firestore.rules para MEDIR el tope de 1000 expresiones por petición (solo pruebas; nunca se despliegan).
//  - cortocircuito(): una regla `allow` pasa a `if true || …` (no se evalúa nada más): sirve para aislar qué escritura gasta las expresiones.
//  - conRelleno(): a una regla `allow` le agrega, al final, `&& relleno()` con k comparaciones triviales: la k más grande que aún pasa mide el margen.
//  - calibrar(): cuántas expresiones cuesta una unidad de relleno (se mide solo, con una regla de prueba que no hace otra cosa).
const BLOQUE = /(match \/databases\/\{database\}\/documents \{\r?\n)/;

// `nth`: la n-ésima línea (desde 0) que coincide, para reglas que se escriben igual en dos lugares
const lineaDe = (lineas, regex, nth = 0) => {
  const todas = lineas.map((l, n) => (regex.test(l) ? n : -1)).filter(n => n >= 0);
  if (todas.length <= nth) throw new Error(`No encontré la regla ${regex} (#${nth})`);
  return todas[nth];
};

export function cortocircuito(reglas, regex) {
  const lineas = reglas.split('\n');
  const i = lineaDe(lineas, regex);
  lineas[i] = lineas[i].replace(/(allow [a-z, ]+: if )/, '$1true || ');
  return lineas.join('\n');
}

// (El compilador de reglas rechaza cadenas muy largas de `&&`: el relleno se arma con bloques g() de 40 comparaciones)
const cadena = (n, pieza) => (n > 0 ? Array.from({ length: n }, () => pieza).join(' && ') : 'true');
const definirRelleno = (reglas, k) => reglas.replace(BLOQUE,
  `$1    function g() { return ${cadena(40, '1 == 1')}; }\n    function relleno() { return ${cadena(Math.floor(k / 40), 'g()')} && ${cadena(k % 40, '1 == 1')}; }\n`);

export function conRelleno(reglas, regex, k, nth = 0) {
  const conFuncion = definirRelleno(reglas, k);
  const lineas = conFuncion.split('\n');
  let i = lineaDe(lineas, regex, nth);
  while (!/;\s*$/.test(lineas[i])) i++;
  lineas[i] = lineas[i].replace(/;(\s*)$/, ' && relleno();$1');
  return lineas.join('\n');
}

/** Una regla de lectura que solo hace el relleno: sirve para calibrar cuántas expresiones cuesta cada unidad */
export const reglasDeCalibracion = (reglas, k) => definirRelleno(reglas, k).replace(BLOQUE, '$1    match /calibracion/{id} { allow read: if relleno(); }\n');

/** Anula una regla `allow` (`if false && …`): no gasta casi nada y nunca deja pasar. Sirve para medir lo que cuestan las demás */
export function anular(reglas, regex) {
  const lineas = reglas.split('\n');
  const i = lineaDe(lineas, regex);
  lineas[i] = lineas[i].replace(/(allow [a-z, ]+: if )/, '$1false && ');
  return lineas.join('\n');
}

/** Anula todas las reglas `allow update` de tiempoExtra (entre `match /tiempoExtra/{teId}` y su subcolección `empleados`) salvo la que coincide con `conservar` */
export function anularOtrasDeTE(reglas, conservar) {
  const lineas = reglas.split('\n');
  const ini = lineas.findIndex(l => /match \/tiempoExtra\/\{teId\}/.test(l));
  const fin = lineas.findIndex((l, i) => i > ini && /match \/empleados\/\{nomina\}/.test(l));
  let n = 0;
  for (let i = ini; i < fin; i++) {
    if (/^\s*allow update: if /.test(lineas[i]) && !conservar.test(lineas[i])) { lineas[i] = lineas[i].replace(/(allow update: if )/, '$1false && '); n++; }
  }
  return { reglas: lineas.join('\n'), anuladas: n };
}
