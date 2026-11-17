# Manuales de usuario

PDF por rol, con capturas anotadas (recuadros rojos y números que coinciden con los pasos). Todo se genera con **`npm run manuales`** (necesita Java para los emuladores y Chrome para Playwright):

1. Levanta los emuladores (si no están) y carga **datos de ejemplo inventados** (`scripts/manuales/datos-demo.mjs`; nunca toca producción).
2. Compila la app en modo emulador y toma las capturas anotadas con Playwright (`scripts/manuales/capturas.mjs`, un archivo por rol en `scripts/manuales/roles/`).
3. Genera los PDF (`scripts/manuales/generar.mjs`) desde el contenido de `scripts/manuales/contenido/<rol>.mjs`.

Con `npm run manuales -- --sin-capturas` solo se regeneran los PDF.

- `manual-<rol>.pdf` · el manual (portada, índice, cuerpo) · `guia-rapida-<rol>.pdf` · una hoja para pegar junto a la computadora.
- `capturas/<rol>/` · las capturas anotadas · `fuentes/` · el HTML de cada manual.
- Manuales hechos (cada uno con su guía rápida de una hoja): **Solicitante**, **Autorizador 1**, **Autorizador 2**, **Recursos Humanos**, **Nóminas** y **Administrador** (este último solo lo ve el administrador en Ayuda).
- Cada manual lleva índice con número de página, pasos numerados con capturas anotadas (los números de los pasos coinciden con los de las flechas), un recuadro «Lo que NO puedes hacer», casos especiales, preguntas frecuentes y la tabla «Qué significa cada estatus» (`scripts/manuales/estatus-roles.mjs`).
- Los PDF se copian a `public/manuales/` y la pantalla Ayuda (`src/utils/manuales.js`) muestra a cada persona el manual de cada rol que tiene; quien puede capturar tiempo extra (Aut. 1, Aut. 2, RH) ve también el del Solicitante. Los scripts de captura por rol están en `scripts/manuales/roles/` y el texto en `scripts/manuales/contenido/`.
- Para regenerar: `npm run capturas:build`, emuladores + `node scripts/manuales/datos-demo.mjs`, `node scripts/manuales/capturas.mjs <rol>` y `npm run manuales -- <rol>` (o `node scripts/manuales/generar.mjs <rol>` si solo cambió el texto).
- **El manual del Administrador incluye «Preparar para producción» ejecutado de verdad, pero SOLO en el emulador con datos inventados**: su script de captura se niega a correr si la dirección no es `localhost`. Nunca se captura contra producción.
- `node scripts/manuales/vista-previa.mjs docs/manuales/manual-<rol>.pdf` guarda una imagen de cada página en `.tmp/manuales-vista/` para revisarlas.
