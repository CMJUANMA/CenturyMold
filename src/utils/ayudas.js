/**
 * ayudas.js — TODOS los textos de ayuda de la aplicación, en un solo lugar para corregirlos fácil.
 * Lenguaje sencillo, sin tecnicismos. Se muestran solo si la persona tiene las ayudas activas (Mi cuenta).
 *
 *   campos:     texto corto debajo de un campo (clave "pantalla.campo")
 *   pantallas:  explicación de 3 o 4 pasos que abre el "?" junto al título de cada pantalla
 *   recorridos: globos del recorrido guiado (primera vez en "Solicitar tiempo extra", en "Por autorizar" y en el Inicio de Nóminas).
 *               selector: lo que se señala en pantalla (atributo data-tour); si no está en pantalla, el globo sale al centro.
 */

export const AYUDAS = {
  campos: {
    // Solicitar tiempo extra
    'solicitar.area': 'El área de la que son los empleados. Solo puedes elegir empleados de esta área.',
    'solicitar.fecha': 'El día en que se hará el tiempo extra. Puede ser hoy o un día que viene.',
    'solicitar.tipo': 'Elige "Turno extra" si el empleado viene a la planta solo para el tiempo extra. Elige "Extensión de turno" si ya está trabajando en la planta y se queda más tiempo.',
    'solicitar.tipo.turno_extra': 'Turno extra / día extra: el empleado viene a la planta para el tiempo extra.',
    'solicitar.tipo.extension': 'Extensión de turno: el empleado ya está en la planta y se queda más tiempo.',
    'solicitar.motivo': 'Elige el motivo; si hay más de uno, toca "Agregar otro motivo" (hasta 5) y cada empleado lleva el suyo. Cargo a P.O. o TB pide su número; Otro pide describirlo.',
    'solicitar.comentario': 'Cuéntales a quienes autorizan por qué se necesita. Escribe al menos 10 letras.',
    'solicitar.agregar': 'Abre la lista de empleados de tu área. Puedes marcar a varios y agregarlos de una vez.',
    'solicitar.aplicar': 'Cambia el horario, los alimentos o el transporte de varios empleados a la vez. Marca las casillas de los que quieras; si no marcas ninguno, se aplica a todos.',
    'solicitar.entrada': 'Hora a la que el empleado empieza el tiempo extra. 12:00 a. m. es el inicio del día elegido (su madrugada).',
    'solicitar.salida': 'Hora a la que termina. Si es anterior a la entrada, termina al día siguiente. No puede ser la misma hora que la entrada.',
    'solicitar.finTurno': 'Hora en que termina su turno normal. El tiempo extra empieza justo ahí.',
    'solicitar.hasta': 'Hasta qué hora se queda el empleado en la planta. Si es de madrugada, termina al día siguiente.',
    'solicitar.horas': 'Las horas de tiempo extra de este empleado. Se calculan solas.',
    'solicitar.alimentos': 'Marca si el empleado necesita comida durante el tiempo extra.',
    'solicitar.transporte': 'Marca si necesita que la empresa lo lleve (llegada) o lo regrese a su casa (salida).',
    'solicitar.llegada': 'Transporte para venir a la planta.',
    'solicitar.salida.transporte': 'Transporte para regresar a su casa.',
    'solicitar.ruta': 'Elige la ruta, la comunidad y el punto donde lo recogen. Si ya tiene ruta guardada, solo confírmala.',
    'solicitar.justificacionRutas': 'Cada ruta extra tiene un costo. Explica con claridad por qué no basta una sola ruta.',
    'solicitar.resumen': 'Aquí ves cuántos empleados, horas, rutas y alimentos lleva tu solicitud antes de enviarla.',
    'solicitar.guardar': 'Guarda lo que llevas para seguir después. Todavía no se envía a nadie.',
    'solicitar.enviar': 'Manda la solicitud a quien la autoriza. Antes revisa que todo esté completo.',
    // Selector de empleados
    'selector.buscar': 'Escribe el nombre o la nómina del empleado.',
    'selector.ruta': 'Muestra solo a los empleados que viajan en esa ruta. Sirve para juntar gente de la misma ruta y evitar rutas de más.',
    // Por autorizar
    'autorizar.filtros': 'Filtra la lista por área o por fecha del tiempo extra.',
    'autorizar.lista': 'Las solicitudes más antiguas salen primero. Las que tú mismo hiciste no las puedes autorizar.',
    'autorizar.revisar': 'Abre la solicitud para ver los empleados, los horarios y las rutas antes de decidir.',
    'autorizar.comentario': 'Al autorizar es opcional. Al devolver es obligatorio: explica qué debe corregir quien la pidió (mínimo 10 letras).',
    'autorizar.autorizar': 'Aprueba la solicitud completa. Pasa al siguiente nivel o queda autorizada.',
    'autorizar.devolver': 'La regresa a quien la pidió para que la corrija. Debes escribir el motivo.',
    'autorizar.varias': 'Marca varias solicitudes y autorízalas juntas. Antes te muestra el total de empleados y horas.',
    'autorizar.rutas': 'Cada ruta adicional representa un costo extra. Revisa la justificación antes de autorizar.',
    // Por enviar al proveedor (RH; antes "Recepción")
    'recepcion.recibir': 'Confirma la solicitud ya autorizada y crea la solicitud de transporte de los empleados que lo pidieron, para que salga en el Formato de rutas. Después baja el formato aquí mismo.',
    'recepcion.fecha': 'Puedes confirmar de una vez todas las solicitudes de la misma fecha.',
    'recepcion.devolver': 'Si algo está mal, devuélvela al solicitante con el motivo. Aquí no se cambian empleados.',
    'recepcion.descargar': 'Baja un Excel de TODOS los empleados con tiempo extra, lleven transporte o no. Es para nómina y comedor.',
    'recepcion.formatoRutas': 'El archivo para el proveedor de transporte se baja aquí mismo, con "Formato de rutas" (solo los empleados que llevan transporte).',
    // Descargas
    'descarga.tiempoExtra': 'Para nómina y comedor: todos los empleados con tiempo extra autorizado o confirmado por RH, lleven transporte o no. Antes de bajar el archivo ves cuántas solicitudes, horas y alimentos trae.',
    'descarga.formatoRutas': 'Para el proveedor de transporte: solo los empleados que llevan transporte.',
    'descarga.periodo': 'Elige de qué días quieres el reporte. La semana va de lunes a domingo.',
  },

  pantallas: {
    inicio: {
      titulo: 'Cómo leer tu Inicio',
      pasos: [
        'Arriba están las cosas que necesitan tu atención hoy. Si una tarjeta se pone amarilla, hay algo por atender.',
        'Toca una tarjeta para ir directo a la pantalla donde se atiende.',
        'En "Esta semana" ves las horas autorizadas, los empleados con tiempo extra y quiénes llevan transporte los próximos 7 días.',
        'Abajo están los accesos rápidos y los tiempos extra que vienen en la semana.',
      ],
    },
    inicioNomina: {
      titulo: 'Cómo leer tu Inicio de Nóminas',
      pasos: [
        'Arriba está lo que falta por enviar al proveedor: tiempo extra ya autorizado que todavía nadie confirma. Toca la tarjeta para ir a "Por enviar al proveedor".',
        'La tarjeta de la semana te dice qué áreas ya revisaste o firmaste del formato de autorización de tiempo extra. Ábrela para trabajarlo.',
        '"Autorizado hoy" y "Autorizado esta semana" suman las solicitudes, los empleados y las horas del tiempo extra autorizado, por área (la semana va de lunes a domingo).',
        'Para ver cada solicitud con su detalle, entra a "Tiempo extra" en el menú y usa los filtros de fecha, área, estatus y turno.',
      ],
    },
    reportesNomina: {
      titulo: 'Cómo sacar el formato de autorización de tiempo extra',
      pasos: [
        'Elige la semana (de lunes a domingo) con las flechas; por defecto es la última completa, o usa un rango de hasta 7 días. Solo cuenta lo que Aut. 2 ya autorizó; si hay solicitudes sin autorizar o devueltas, un aviso te dice cuántas y de qué áreas, y otro avisa cuáles vencieron sin autorizarse (no cuentan; puedes agregar a alguien a mano en "Revisar").',
        'En cada área toca "Revisar": se abre una hoja a pantalla completa. Escribe las horas directo en el día (acepta medios, como 0.5; Tab, Enter y las flechas te mueven como en Excel); con el menú ⋯ de cada renglón reemplazas, quitas o restauras a alguien o cambias su motivo y P.O./TB, y "Agregar empleado" suma a quien no venía en las solicitudes. Los cambios se guardan juntos con "Guardar cambios", que pide un solo motivo, y no modifican la solicitud original.',
        'Con "Descargar" bajas el formato listo para imprimir en hoja carta; "Descargar todas las áreas" trae además una hoja Resumen para capturar la nómina.',
        'Cuando ya tengas las firmas, "Marcar como firmada" bloquea esa área. Solo Recursos Humanos puede reabrirla.',
      ],
    },
    formatoRutas: {
      titulo: 'Cómo bajar el Formato de rutas',
      pasos: [
        'Es el Excel que se manda al proveedor de transporte, solo con los empleados que llevan transporte.',
        'Toca "Formato de rutas (proveedor)" y elige hoy, mañana, una fecha o un rango.',
        'Antes de bajar el archivo te dice cuántas solicitudes de transporte encontró. Si no hay ninguna, no se baja un Excel vacío.',
        'El teléfono de cada empleado aparece en el archivo; si falta alguno, avisa a Recursos Humanos.',
      ],
    },
    inicioRol: {
      titulo: 'Cómo leer tu Inicio',
      pasos: [
        'Aquí ves un resumen de lo tuyo: lo que pediste y, si autorizas, lo que espera tu firma.',
        'El botón rojo "Solicitar tiempo extra" abre una solicitud nueva.',
        'Toca una tarjeta para abrir tus solicitudes en esa pestaña: borradores, en autorización, devueltas o autorizadas.',
        'Las devueltas se resaltan: son las que debes corregir y reenviar.',
      ],
    },
    padron: {
      titulo: 'Cómo usar el padrón de empleados',
      pasos: [
        'Aquí está la lista de todos los empleados. Busca por número de nómina o por nombre.',
        '"Nuevo empleado" da de alta a una persona; el lápiz cambia sus datos, su puesto y su ruta. Nóminas solo consulta: ve también el teléfono, pero no cambia nada.',
        '"Importar empleados" carga un Excel con muchas personas y, antes de guardar, te muestra qué cambiaría (solo Recursos Humanos).',
        '"Exportar padrón (respaldo)" baja una copia de todos, activos e inactivos.',
      ],
    },
    organigrama: {
      titulo: 'Cómo leer el organigrama',
      pasos: [
        'Este árbol muestra quién autoriza qué: arriba el nivel 2 de la planta; abajo, el nivel 1 de cada área y sus solicitantes.',
        'Las personas de un nivel más alto que el tuyo se ven, pero no se pueden abrir.',
        'Toca a una persona para ver su detalle. Quien puede asignar ve los botones "+" para agregar a alguien.',
        'El orden dentro de cada nivel sale del nivel de su puesto (en Estructura, Puestos).',
      ],
    },
    asignaciones: {
      titulo: 'Cómo dar y quitar roles',
      pasos: [
        'Aquí se dan y se quitan los permisos: Autorización 1, Autorización 2 o Solicitante, por área.',
        'Toca "Asignar rol", elige a la persona, el rol y el área. Si es temporal, pon la fecha final y el motivo.',
        'Con los íconos de cada renglón puedes extender la fecha, revocar el rol o ver su historial.',
        'Si alguien cambia de nombre o de puesto en el padrón, usa "Actualizar nombres y puestos de las asignaciones".',
      ],
    },
    solicitar: {
      titulo: 'Cómo solicitar tiempo extra',
      pasos: [
        'Elige el día del tiempo extra, uno o más motivos (si es cargo a P.O. o TB, escribe el número) y el tipo: turno extra (el empleado viene a la planta) o extensión de turno (ya está en la planta).',
        'Toca "Agregar empleados", marca a quienes harán tiempo extra y agrégalos.',
        'Revisa a cada empleado: su horario, si necesita comida y si necesita transporte (llegada y salida). Si lleva transporte, elige su ruta.',
        'Revisa el resumen de abajo. Si usas más de una ruta, explica por qué. Después toca "Enviar a autorización".',
      ],
    },
    misSolicitudes: {
      titulo: 'Tus solicitudes de tiempo extra',
      pasos: [
        'Las solicitudes están separadas por pestañas según en qué paso van.',
        'En "Borradores" puedes seguir una solicitud que no has enviado.',
        'En "Devueltas" están las que alguien te regresó para corregir. Léelas, corrígelas y reenvíalas.',
        'Si pasa el día de la fecha del tiempo extra y no se terminó de autorizar, pasa a "Vencidas": ya no se puede autorizar. Toca "Duplicar con otra fecha" para copiar sus empleados, motivos y transporte en un borrador nuevo. Toca "Ver" para revisar el detalle de cualquier solicitud.',
      ],
    },
    autorizar: {
      titulo: 'Cómo autorizar solicitudes',
      pasos: [
        'Aquí están las solicitudes que esperan tu decisión. Las que "Vencen hoy" salen primero; luego, las más antiguas. Las que ya pasaron de fecha están en la pestaña "Vencidas": solo se consultan, salvo que seas Aut. 2, que puede tocar "Autorizar fuera de tiempo" y escribir el motivo (mínimo 10 letras). Las borradores y devueltas vencidas no se autorizan: se duplican con otra fecha.',
        'Toca "Revisar" para ver los empleados, los horarios, las rutas y los comentarios.',
        'Si todo está bien, toca "Autorizar". Si algo no cuadra, escribe el motivo y toca "Devolver".',
        'Para varias solicitudes a la vez, marca sus casillas y toca "Autorizar seleccionadas".',
      ],
    },
    recepcion: {
      titulo: 'Cómo confirmar lo que va al proveedor',
      pasos: [
        'Aquí están las solicitudes que ya tienen las dos autorizaciones y que RH todavía no confirma, agrupadas por fecha.',
        'Toca "Revisar" para ver el detalle. Aquí no se cambian empleados: si algo está mal, Recursos Humanos puede usar "Devolver" con el motivo (Nóminas solo confirma).',
        'Toca "Confirmar y generar transporte": se crea la solicitud de transporte de quienes lo pidieron. Si nadie lleva transporte, el botón dice "Confirmar (sin transporte)". Para varias del mismo día, usa "Confirmar todas las de esta fecha".',
        'Cuando termines de confirmar, toca "Formato de rutas (proveedor)", arriba en esta misma pantalla, elige la fecha y baja el Excel para el proveedor. Si una solicitud ya pasó de fecha sin enviarse, sale en "Fecha pasada – transporte no enviado": ciérrala con "Cerrar sin transporte" (sus horas siguen contando para nómina).',
      ],
    },
    consulta: {
      titulo: 'Todas las solicitudes',
      pasos: [
        'Aquí ves todas las solicitudes de tiempo extra enviadas, sin importar su estatus.',
        'Usa los filtros de área, estatus (incluido "Vencida": su fecha pasó sin autorizarse), "Fuera de tiempo" (las que Aut. 2 autorizó ya vencidas), fechas, turno y solicitante para encontrar lo que buscas.',
        'Toca "Ver" para abrir el detalle de una solicitud, con su historial.',
        'Usa "Descargar resumen de horas extra" para nómina y comedor, o "Exportar consulta" para la lista que ves en pantalla.',
      ],
    },
    turnos: {
      titulo: 'Turnos de nómina',
      pasos: [
        'Captura el horario normal de los turnos A, B y C: a qué hora entran y a qué hora salen.',
        'Es solo de referencia: ya no se asigna un turno fijo a cada persona.',
        'En una extensión de turno, quien captura elige a mano la hora en que termina el turno de cada empleado.',
      ],
    },
  },

  recorridos: {
    solicitar: [
      { selector: '[data-tour="solicitar-datos"]', titulo: 'Datos de la solicitud', texto: 'Aquí eliges el día, el motivo y el tipo de tiempo extra, y explicas para qué se necesita.' },
      { selector: '[data-tour="solicitar-motivos"]', titulo: 'Motivos', texto: 'Elige el motivo. Si hay más de uno, toca "Agregar otro motivo". Con cargo a P.O. o TB escribe su número; con "Otro", descríbelo.' },
      { selector: '[data-tour="solicitar-agregar"]', titulo: 'Agregar empleados', texto: 'Toca aquí para elegir a los empleados de tu área. Puedes marcar a varios de una vez.' },
      // Solo uno de estos dos pasos existe a la vez: con empleados en la lista se señala el primero; sin empleados, el espacio donde aparecerán
      { selector: '[data-tour="solicitar-empleado-fila"]', titulo: 'Horario, comida y transporte', texto: 'Cada empleado tiene su horario, si necesita comida y si necesita transporte. Si lleva transporte, elige su ruta. Las casillas de la izquierda sirven para cambiar a varios a la vez.' },
      { selector: '[data-tour="solicitar-empleados-vacio"]', titulo: 'Aquí aparecerán tus empleados', texto: 'Cuando agregues empleados, cada uno tendrá su horario, si necesita comida y si necesita transporte. Si lleva transporte, elige su ruta.' },
      { selector: '[data-tour="solicitar-resumen"]', titulo: 'Resumen', texto: 'Aquí ves el total de empleados, horas y rutas. Si usas más de una ruta, tendrás que explicar por qué.' },
      { selector: '[data-tour="solicitar-enviar"]', titulo: 'Enviar', texto: 'Cuando todo esté listo, envía la solicitud. También puedes guardarla como borrador y seguir después.' },
    ],
    inicioNomina: [
      { selector: '[data-tour="inicioNomina-pendiente"]', titulo: 'Por enviar al proveedor', texto: 'Aquí ves cuánto tiempo extra ya autorizado falta por confirmar. Toca una tarjeta para ir a confirmarlo y generar la solicitud de transporte.' },
      { selector: '[data-tour="inicioNomina-formato"]', titulo: 'Formato de la semana', texto: 'El estado del formato de tiempo extra de la última semana completa, por área: sin revisar, ajustada o firmada. Toca el botón para revisarlo y descargarlo.' },
      { selector: '[data-tour="inicioNomina-hoy"]', titulo: 'Autorizado hoy', texto: 'Solicitudes, empleados y horas totales del tiempo extra de hoy, por área.' },
      { selector: '[data-tour="inicioNomina-semana"]', titulo: 'Autorizado de la semana', texto: 'Lo mismo de lunes a domingo. Para ver cada solicitud con su detalle, entra a Tiempo extra en el menú.' },
    ],
    autorizar: [
      { selector: '[data-tour="autorizar-filtros"]', titulo: 'Filtros', texto: 'Filtra la lista por área o por fechas si tienes muchas solicitudes.' },
      { selector: '[data-tour="autorizar-lista"]', titulo: 'Tus solicitudes por autorizar', texto: 'Las más antiguas salen primero. Marca las casillas para autorizar varias a la vez.' },
      { selector: '[data-tour="autorizar-revisar"]', titulo: 'Revisar', texto: 'Toca aquí para ver el detalle completo y decidir: autorizar o devolver con un motivo.' },
    ],
  },
};

/**
 * Recordatorios en pantalla de "a quién avisar" (mientras no haya avisos por correo). Se muestran siempre, aunque las ayudas estén apagadas,
 * y no se cierran solos. `lista` es el texto ya armado con los nombres ("Jose Anselmo Mendoza (Aut. 1 de Mantenimiento)").
 */
export const AVISOS = {
  /** Después de enviar (o reenviar) una solicitud, o de que el Aut. 1 la autoriza y pasa a Aut. 2 */
  paraAvisar: ({ folio, destino, lista, accion = 'envió' }) => `Tu solicitud ${folio} se ${accion} a ${destino}. `
    + (lista ? `Para que se revise a la brevedad, recuerda avisarle a: ${lista}.` : 'Por ahora no hay una persona vigente con ese rol: avisa al área de Sistemas o, en su caso, a Recursos Humanos para que lo resuelvan.'),
  /** Autorizaste tú: la solicitud sigue su camino con otra persona (Aut. 1 → Aut. 2) */
  autorizadaPasa: ({ folio, lista }) => `Autorizaste ${folio} y pasó a Autorización 2. `
    + (lista ? `Para que se revise a la brevedad, recuerda avisarle a: ${lista}.` : 'Por ahora no hay un Aut. 2 vigente: avisa al área de Sistemas o, en su caso, a Recursos Humanos para que lo resuelvan.'),
  autorizadasPasan: ({ cantidad, lista }) => `Autorizaste ${cantidad} solicitudes y pasaron a Autorización 2. `
    + (lista ? `Para que se revisen a la brevedad, recuerda avisarle a: ${lista}.` : 'Por ahora no hay un Aut. 2 vigente: avisa al área de Sistemas o, en su caso, a Recursos Humanos para que lo resuelvan.'),
  /** El Aut. 2 autoriza: ya está con RH */
  listaEnRH: () => 'Listo. Recursos Humanos ya la tiene en \'Por enviar al proveedor\'.',
  listasEnRH: ({ cantidad }) => `Listo. Recursos Humanos ya tiene ${cantidad} solicitudes en 'Por enviar al proveedor'.`,
  /** Alguien devuelve: hay que avisarle a quien la capturó */
  devuelta: ({ folio, solicitante }) => `Devolviste ${folio}. Recuerda avisarle a ${solicitante || 'quien la solicitó'} para que la corrija.`,
  /** Cancelaste una solicitud que no era tuya: hay que avisarle a quien la capturó */
  cancelada: ({ folio, solicitante }) => `Cancelaste ${folio}. Recuerda avisarle a ${solicitante || 'quien la solicitó'} que ya no va.`,
  /** Línea de "Mis solicitudes" en cada solicitud pendiente */
  pendienteCon: ({ lista, desde }) => (lista ? `Pendiente con: ${lista} · en espera desde ${desde}` : `Pendiente de autorización · en espera desde ${desde}`),
  titulos: { enviada: 'Solicitud enviada', reenviada: 'Solicitud reenviada', autorizada: 'Solicitud autorizada', devuelta: 'Solicitud devuelta', cancelada: 'Solicitud cancelada' },
  /** "A, B y C" */
  unir: (nombres) => (nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`),
  destinoNivel: { 1: 'Autorización 1', 2: 'Autorización 2' },
  cerrar: 'Cerrar aviso',
};

/** Texto de ayuda de un campo ('' si no existe) */
export const textoAyuda = (clave) => AYUDAS.campos[clave] ?? '';
/** Explicación en pasos de una pantalla, o null */
export const ayudaDePantalla = (id) => AYUDAS.pantallas[id] ?? null;
/** Globos del recorrido guiado de una pantalla ([] si no tiene) */
export const recorridoDe = (id) => AYUDAS.recorridos[id] ?? [];
