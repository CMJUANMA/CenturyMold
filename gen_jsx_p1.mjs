import { writeFileSync } from "fs";

const q = "'";
const bt = "`";
const ds = "$";

const jsx = [
  `import { useState, useRef } from ${q}react${q};`,
  `import {`,
  `  Database, MapPin, Building, Navigation, Upload, Loader2,`,
  `  Users, CheckCircle2, AlertTriangle, X, Download, FileSpreadsheet, Info,`,
  `} from ${q}lucide-react${q};`,
  `import * as XLSX from ${q}xlsx${q};`,
  `import { collection, doc, writeBatch, getDocs } from ${q}firebase/firestore${q};`,
  `import { db } from ${q}../../firebase${q};`,
  `import RevisarColecciones from ${q}./RevisarColecciones${q};`,
  ``,
  `const TABS = [`,
  `  { id: ${q}areas${q},        label: ${q}Areas operativas${q},    icon: Building },`,
  `  { id: ${q}rutas${q},        label: ${q}Rutas de transporte${q}, icon: Navigation },`,
  `  { id: ${q}comunidades${q},  label: ${q}Comunidades${q},          icon: MapPin },`,
  `  { id: ${q}puntos${q},       label: ${q}Puntos de reunion${q},    icon: MapPin },`,
  `  { id: ${q}herramientas${q}, label: ${q}Diagnostico${q},          icon: Database },`,
  `];`,
  ``,
  `const DIR_HEADERS = [${q}RUTA${q}, ${q}COMUNIDAD${q}, ${q}PUNTO DE REUNION${q}, ${q}CLAVE${q}];`,
  `const EMP_HEADERS = [${q}NOMINA${q}, ${q}NOMBRE${q}, ${q}PUESTO${q}, ${q}CLAVE PARADA${q}, ${q}AREA${q}];`,
  ``,
  `const DIR_COLS_INFO = [`,
  `  { letra: ${q}A${q}, nombre: ${q}RUTA${q},             obligatorio: true,  ejemplo: ${q}RUTA NORTE${q} },`,
  `  { letra: ${q}B${q}, nombre: ${q}COMUNIDAD${q},         obligatorio: true,  ejemplo: ${q}COLONIA SAN PEDRO${q} },`,
  `  { letra: ${q}C${q}, nombre: ${q}PUNTO DE REUNION${q},  obligatorio: true,  ejemplo: ${q}PARQUE CENTRAL${q} },`,
  `  { letra: ${q}D${q}, nombre: ${q}CLAVE${q},             obligatorio: true,  ejemplo: ${q}SN01${q} },`,
  `];`,
  `const EMP_COLS_INFO = [`,
  `  { letra: ${q}A${q}, nombre: ${q}NOMINA${q},       obligatorio: true,  ejemplo: ${q}12345${q} },`,
  `  { letra: ${q}B${q}, nombre: ${q}NOMBRE${q},       obligatorio: true,  ejemplo: ${q}GARCIA LOPEZ JUAN${q} },`,
  `  { letra: ${q}C${q}, nombre: ${q}PUESTO${q},       obligatorio: false, ejemplo: ${q}OPERADOR DE PRODUCCION${q} },`,
  `  { letra: ${q}D${q}, nombre: ${q}CLAVE PARADA${q}, obligatorio: false, ejemplo: ${q}SN01${q} },`,
  `  { letra: ${q}E${q}, nombre: ${q}AREA${q},         obligatorio: false, ejemplo: ${q}PRODUCCION${q} },`,
  `];`,
].join("\n");

writeFileSync("src/pages/rh/RhCatalogos.jsx", jsx, "utf8");
console.log("Written", jsx.length, "chars");