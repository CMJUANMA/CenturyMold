// Genera la versión del logo para fondo oscuro a partir del logo normal (negro/gris + rojo, sobre transparente).
//   Negros y grises (poca saturación) → blanco suave #F3F4F6; los rojos se quedan rojos (mismo tono) con un poco más de brillo.
//   La transparencia y el suavizado de los bordes se conservan (cada píxel mezcla los dos colores según su saturación).
// Uso: node scripts/generar-logo-oscuro.mjs [entrada.png] [salida.png]
//   Por defecto: src/assets/marca/century-mold.png → src/assets/marca/century-mold-oscuro.png
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const entrada = process.argv[2] ?? 'src/assets/marca/century-mold.png';
const salida = process.argv[3] ?? 'src/assets/marca/century-mold-oscuro.png';
const CLARO = [0xF3, 0xF4, 0xF6];
const BRILLO_ROJO = 1.08;   // sube un poco el brillo del rojo (218 → 235) sin cambiar su tono
const V_MINIMO_ROJO = 0.0;  // (mínimo opcional de brillo; 0 = sin mínimo)

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rgbAHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}
function hsvARgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const png = PNG.sync.read(readFileSync(entrada));
for (let i = 0; i < png.data.length; i += 4) {
  const a = png.data[i + 3];
  if (a === 0) continue;
  const [h, s, v] = rgbAHsv(png.data[i], png.data[i + 1], png.data[i + 2]);
  const peso = suave(0.25, 0.6, s); // 0 = neutro (negro/gris), 1 = rojo
  const rojo = hsvARgb(h, Math.max(s, 0.85), Math.min(1, Math.max(v * BRILLO_ROJO, V_MINIMO_ROJO)));
  for (let k = 0; k < 3; k++) png.data[i + k] = Math.round(CLARO[k] * (1 - peso) + rojo[k] * peso);
}
writeFileSync(salida, PNG.sync.write(png, { colorType: 6 }));
console.log(`Logo para fondo oscuro: ${salida}`);
