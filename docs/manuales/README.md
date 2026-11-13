# Manuales de usuario

PDF por rol, con capturas anotadas (recuadros rojos y números que coinciden con los pasos). Todo se genera con **`npm run manuales`** (necesita Java para los emuladores y Chrome para Playwright):

1. Levanta los emuladores (si no están) y carga **datos de ejemplo inventados** (`scripts/manuales/datos-demo.mjs`; nunca toca producción).
2. Compila la app en modo emulador y toma las capturas anotadas con Playwright (`scripts/manuales/capturas.mjs`, un archivo por rol en `scripts/manuales/roles/`).
3. Genera los PDF (`scripts/manuales/generar.mjs`) desde el contenido de `scripts/manuales/contenido/<rol>.mjs`.

Con `npm run manuales -- --sin-capturas` solo se regeneran los PDF.

- `manual-<rol>.pdf` · el manual (portada, índice, cuerpo) · `guia-rapida-<rol>.pdf` · una hoja para pegar junto a la computadora.
- `capturas/<rol>/` · las capturas anotadas · `fuentes/` · el HTML de cada manual.
- Roles hechos: **Solicitante**, **Autorizador 1**, **Autorizador 2**, **Recursos Humanos** y **Nóminas** (manual + guía rápida de una hoja cada uno). Los PDF se copian a `public/manuales/` y la pantalla Ayuda los ofrece según los roles de cada persona. Para regenerar: `npm run capturas:build`, emuladores + `node scripts/manuales/datos-demo.mjs`, `node scripts/manuales/capturas.mjs <rol>` y `npm run manuales -- <rol>`.
- `node scripts/manuales/vista-previa.mjs docs/manuales/manual-<rol>.pdf` guarda una imagen de cada página en `.tmp/manuales-vista/` para revisarlas.
