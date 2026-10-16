# Sistema de diseño — Portal de procesos Century Mold Querétaro

Guía corta de cómo se ve y se arma la interfaz. Todo lo que aquí se describe vive en el código: los tokens en `src/index.css`, los componentes en `src/components/ui/` y una pantalla de muestra en `/herramientas/guia-de-estilo` (solo administrador).

**Idea de fondo:** una interfaz sobria, de herramienta de trabajo. El rojo de la marca es escaso a propósito: si todo es rojo, nada destaca. Cada pantalla tiene **un solo botón principal rojo**.

## 1. Reglas que no se rompen

1. **Un solo botón primario rojo por pantalla** (o por diálogo): la acción que más se espera. Todo lo demás es secundario (contorno) o discreto (fantasma).
2. **Las acciones destructivas van en contorno** con texto de error (`variante="peligro"`): Devolver, Cancelar, Eliminar, Revocar, Rechazar. Nunca en rojo sólido.
3. **Nada de rojo decorativo.** El rojo de la marca solo aparece en: el botón principal, el ítem activo del menú (barra y fondo suave), el subrayado de la pestaña activa, el foco del teclado y asteriscos de campo obligatorio.
4. **El error no es el rojo de la marca.** Los errores usan un ladrillo apagado (`--status-error-*`) sobre fondo suave.
5. **Un estado siempre lleva ícono y texto**, nunca solo color (personas con daltonismo, impresión en blanco y negro).
6. **Sin degradados, sombras fuertes, vidrio (blur), emojis ni íconos decorativos.** Los íconos (lucide-react) acompañan a un texto o sustituyen un botón con etiqueta accesible.
7. **Toda pantalla = título + una línea de descripción + (como máximo) una acción principal.** Se arma con `EncabezadoPagina`.
8. **Etiquetas siempre visibles.** Un `placeholder` es un ejemplo, no una etiqueta.
9. **Errores en lenguaje llano:** qué pasó y qué hacer (“No se pudo leer la lista. Revisa tu conexión y vuelve a abrir esta pantalla.”). Nunca códigos crudos como único mensaje.
10. **Estados vacíos útiles:** una frase y, si aplica, un botón. Sin ilustraciones.
11. **Cargas con esqueleto**, no con giro (`Esqueleto*`). El giro solo se permite para el avance de una escritura (botón en `estado="cargando"`).

## 2. Tokens

Todo el color sale de variables CSS en `src/index.css` (`:root` para claro y `.dark` para oscuro; el tema lo cambia `ThemeContext`, que pone la clase `dark`). **No se usan colores de Tailwind sueltos** (`bg-green-100`, `text-blue-600`…): siempre `var(--token)`.

### Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--accent` | `#d61110` | `#d61110` | Fondo del botón principal (texto blanco, 5.3:1) |
| `--accent-hover` | `#b80e0e` | `#e8312f` | Hover del botón principal |
| `--accent-soft` | `#FBEAEA` | rojo 16 % | Fondo suave del ítem activo del menú |
| `--accent-text` | `#d61110` | `#ff6a63` | Rojo para texto/íconos pequeños (AA sobre fondo) |
| `--focus` | `#d61110` | `#ff6a63` | Anillo de foco del teclado (visible en todo) |
| `--bg-app` | `#F5F6F7` | `#111214` | Fondo de la página |
| `--bg-surface` | `#FFFFFF` | `#1A1C1F` | Tarjetas, tablas, modales |
| `--bg-surface-secondary` | `#FAFAFB` | `#15171A` | Encabezado de tabla, bloques de apoyo |
| `--bg-surface-hover` | `#F0F1F2` | `#23262A` | Hover y opción seleccionada |
| `--border-color` / `--border-subtle` | `#D9DCDF` / `#E8EAEC` | `#2E3237` / `#23262A` | Bordes de controles / separadores |
| `--text-main` | `#111214` | `#F3F4F6` | Texto principal |
| `--text-secondary` | `#4B5058` | `#A5AAB1` | Texto de apoyo |
| `--text-muted` | `#6B7078` | `#8A9098` | Ayudas, metadatos (AA) |
| `--text-disabled` | `#9CA1A8` | `#5F656C` | Deshabilitado |
| `--status-success-*` | verde `#1F6B3A` | `#7FCB98` | Éxito (`text`, `bg`, `border`) |
| `--status-warning-*` | ámbar `#8A5A00` | `#E6B45A` | Atención / pendiente |
| `--status-error-*` | ladrillo `#A3281F` | `#F2A29B` | Error y acciones destructivas |
| `--status-info-*` | azul `#2A5A8C` | claro | Información / en proceso |
| `--org-*` | azul, amarillo, rosa | — | Solo el organigrama (colores de la hoja “Niveles de autorización”) |

Los nombres antiguos `--cm-red*` siguen existiendo como alias de los nuevos, pero en código nuevo se usan los tokens de arriba.

### Tipografía

- **IBM Plex Sans** para todo el texto; **IBM Plex Mono** solo para folios, nóminas y horas dentro de tablas. Ambas locales (`@fontsource`, subconjunto latino, pesos 400/500/600, `font-display: swap`): no se pide nada a servidores externos.
- Escala (en `rem`, así “Letra grande” de Mi cuenta escala todo):

| Clase | Tamaño | Uso |
|---|---|---|
| `text-xs` | 13 px | Etiquetas, datos de tabla, ayudas. **Mínimo en toda la app** (no hay 10–11 px) |
| `text-sm` | 15 px | Cuerpo |
| `text-base` | 16 px | Texto destacado |
| `text-lg` | 18 px | Subtítulos de sección |
| `text-xl` | 20 px | Subtítulos grandes |
| `text-2xl` | 30 px | Título de página |
| `text-3xl` | 36 px | Cifras de indicadores |

- Pesos: 400 normal, 500 énfasis (botones, etiquetas, cifras), 600 solo títulos. Cifras con `tabular-nums` para que alineen.

### Espaciado, radios, sombras y movimiento

- Ritmo de 4 px. Entre secciones de una página: `space-y-8`; dentro de una sección: `space-y-4`.
- Radios: `rounded-md` (6 px) en controles y botones, `rounded-lg` (8 px) en tarjetas y tablas. Nada mayor.
- Sombras casi nulas: solo menús flotantes y modales (`shadow-md`). Las tarjetas se separan con borde, no con sombra.
- Microinteracciones de 150–200 ms con `ease-out` (`.anim-pagina`, `.anim-modal`, transiciones de color). Con `prefers-reduced-motion` todo queda quieto, incluido el esqueleto.
- Área táctil mínima de **44 px** en celular (`min-h-11`), 40 px en escritorio; botones pequeños 36 px en escritorio.

## 3. Componentes (`src/components/ui/`)

| Componente | Para qué | Notas |
|---|---|---|
| `Boton` | Todo botón y enlace con aspecto de botón | `variante`: `primario` (rojo, uno por pantalla) · `secundario` · `contorno` (por defecto) · `fantasma` · `peligro`. `tamano`: `md` · `sm` · `icono`. `icono`, `to` (enlace), `estado="cargando"`. `claseBoton()` para dar aspecto de botón a otro elemento |
| `Campo` + `Entrada` / `AreaTexto` / `Selector` | Formularios | `Campo` une etiqueta, ayuda y error con el control (id, `aria-describedby`, `aria-invalid`). Etiqueta siempre visible; `obligatorio` agrega el asterisco |
| `Casilla` / `OpcionRadio` | Casillas y opciones | Objetivo táctil de 44 px |
| `Tabla`, `Th`, `Td`, `Fila` | Tablas | Encabezado fijo, hover suave, `derecha` para cifras, `mono` para folios/nóminas/horas. En celular se usa lista de tarjetas cuando la tabla no cabe |
| `Tarjeta` | Bloque con borde y título | |
| `Indicador` / `IndicadorCompacto` / `FilaIndicadores` | Cifras de resumen | Alto fijo (etiqueta, cifra y descripción) para que las tarjetas alineen. `atencion` = ámbar, solo si hay algo que atender; lo que está en 0 va en la versión compacta |
| `Insignia` | Etiqueta de estado o dato | `tono`: `exito` · `aviso` · `error` · `info` · `neutro`. Lleva ícono + texto |
| `Aviso` | Mensaje dentro de la pantalla | Mismos tonos; `titulo` y `accion` opcionales. Los errores se anuncian (`role="alert"`) |
| `EstadoVacio` | Cuando no hay nada | Texto corto + un botón (`accion`) |
| `Esqueleto`, `EsqueletoPagina`, `EsqueletoTabla`, `EsqueletoIndicadores` | Cargas | Tienen la forma del contenido; evitan saltos de diseño (CLS 0) |
| `Pestanas` | Secciones de una pantalla | Subrayado rojo en la activa, teclado con flechas |
| `EncabezadoPagina` | Título de toda pantalla | `antetitulo` (ubica), `titulo`, `descripcion` (una línea), `ayuda` (el “?”), `accion` (el botón principal) |

Modales, avisos flotantes y confirmaciones usan `Modal`, `Toast` y `useConfirmar` (que ya aplican las reglas: acciones peligrosas en contorno de error).

## 4. Patrones de pantalla

- **Lista con filtros:** `EncabezadoPagina` → bloque de filtros (campos con etiqueta; “Limpiar filtros” fantasma) → `Tabla` (escritorio) o tarjetas (celular) → `EstadoVacio` si no hay resultados.
- **Formulario largo (Solicitar tiempo extra):** secciones en `Tarjeta`; barra inferior fija con el resumen y las acciones; en celular los botones se apilan a todo el ancho y el principal queda al alcance del pulgar.
- **Pestañas (Estructura, Usuarios y accesos, Rutas y puntos):** `Pestanas` debajo del encabezado; el botón principal vive dentro de cada pestaña (“Nueva ruta”, “Nuevo punto”…), no en el encabezado.
- **Detalle en modal:** título claro, contenido, y al pie `Cancelar/Cerrar` + una sola acción principal (o una acción de contorno `peligro` si lo único que hay es destructivo).
- **Inicio por rol:** saludo con nombre de pila, “Requieren atención” solo con lo que tiene algo, indicadores compactos para lo que está en 0, y un solo botón principal (“Solicitar tiempo extra” o “Por enviar al proveedor (N)” si hay algo por enviar).

## 5. Cómo agregar algo nuevo

1. Construye la pantalla con `EncabezadoPagina` y los componentes de arriba. **No escribas clases de color a mano.**
2. Pon un solo `Boton variante="primario"`. Si tienes dos candidatos, uno es secundario.
3. Para estados nuevos usa `Insignia`/`Aviso` con el tono que corresponda y un texto; si necesitas un tono nuevo, se agrega a `TONOS` en `estilos.js`, no en la pantalla.
4. Revisa en claro y oscuro, a 1366 px y a 390 px (celular), y con el teclado (el foco debe verse).
5. Si agregas o quitas un `<AyudaPantalla id="…">`, actualiza `tests/ajustes-uso.test.js` (cada ayuda lleva 3 o 4 pasos).

## 6. Accesibilidad y rendimiento (medido)

- Contraste AA en todos los pares de texto/fondo; foco visible; enlace “Saltar al contenido”; `prefers-reduced-motion` respetado; formularios con etiqueta, ayuda y error asociados.
- Lighthouse (versión local con emuladores, Chrome headless): accesibilidad **100** en login, Inicio y Solicitar (escritorio y celular); rendimiento 94–100; mejores prácticas 100. Detalle de la última medición en el resumen de la Fase 2.
- Cómo repetirlo: `npm run capturas:build`, emuladores sembrados (`node scripts/sembrar-emulador.mjs`), `npx vite preview --outDir .tmp/dist-emulador --port 4174` y luego `node scripts/lighthouse.mjs <archivo.json>`; las capturas con `node scripts/capturas.mjs <carpeta>`.
