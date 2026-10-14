/**
 * ayudas.js — TODOS los textos de ayuda de la aplicación, en un solo lugar para corregirlos fácil.
 * Lenguaje sencillo, sin tecnicismos. Se muestran solo si la persona tiene las ayudas activas (Configuración).
 *
 *   campos:     texto corto debajo de un campo (clave "pantalla.campo")
 *   pantallas:  explicación de 3 o 4 pasos que abre el "?" junto al título de cada pantalla
 *   recorridos: globos del recorrido guiado (primera vez en "Solicitar tiempo extra" y en "Por autorizar").
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
    'solicitar.motivo': 'La razón principal por la que se necesita el tiempo extra.',
    'solicitar.comentario': 'Cuéntales a quienes autorizan por qué se necesita. Escribe al menos 10 letras.',
    'solicitar.agregar': 'Abre la lista de empleados de tu área. Puedes marcar a varios y agregarlos de una vez.',
    'solicitar.aplicar': 'Cambia el horario, los alimentos o el transporte de varios empleados a la vez. Marca las casillas de los que quieras; si no marcas ninguno, se aplica a todos.',
    'solicitar.entrada': 'Hora a la que el empleado empieza el tiempo extra.',
    'solicitar.salida': 'Hora a la que el empleado termina el tiempo extra.',
    'solicitar.finTurno': 'Hora en que termina su turno normal. El tiempo extra empieza justo ahí.',
    'solicitar.hasta': 'Hasta qué hora se queda el empleado en la planta.',
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
    'selector.turno': 'El turno normal de trabajo del empleado (A, B o C).',
    // Por autorizar
    'autorizar.filtros': 'Filtra la lista por área o por fecha del tiempo extra.',
    'autorizar.lista': 'Las solicitudes más antiguas salen primero. Las que tú mismo hiciste no las puedes autorizar.',
    'autorizar.revisar': 'Abre la solicitud para ver los empleados, los horarios y las rutas antes de decidir.',
    'autorizar.comentario': 'Al autorizar es opcional. Al devolver es obligatorio: explica qué debe corregir quien la pidió (mínimo 10 letras).',
    'autorizar.autorizar': 'Aprueba la solicitud completa. Pasa al siguiente nivel o queda autorizada.',
    'autorizar.devolver': 'La regresa a quien la pidió para que la corrija. Debes escribir el motivo.',
    'autorizar.varias': 'Marca varias solicitudes y autorízalas juntas. Antes te muestra el total de empleados y horas.',
    'autorizar.rutas': 'Cada ruta adicional representa un costo extra. Revisa la justificación antes de autorizar.',
    // Recepción de RH
    'recepcion.recibir': 'Recibe la solicitud ya autorizada y crea la solicitud de transporte de los empleados que lo pidieron.',
    'recepcion.fecha': 'Puedes recibir de una vez todas las solicitudes de la misma fecha.',
    'recepcion.devolver': 'Si algo está mal, devuélvela con el motivo. En la recepción no se cambian empleados.',
    'recepcion.descargar': 'Baja un Excel de TODOS los empleados con tiempo extra autorizado, lleven transporte o no. Es para nómina y comedor.',
    'recepcion.formatoRutas': 'El archivo para el proveedor de transporte está en "Todas las solicitudes" (solo los empleados que llevan transporte).',
    // Descargas
    'descarga.tiempoExtra': 'Para nómina y RH: todos los empleados con tiempo extra autorizado o recibido, lleven transporte o no.',
    'descarga.formatoRutas': 'Para el proveedor de transporte: solo los empleados que llevan transporte.',
    'descarga.periodo': 'Elige de qué días quieres el reporte.',
  },

  pantallas: {
    solicitar: {
      titulo: 'Cómo solicitar tiempo extra',
      pasos: [
        'Elige el día del tiempo extra, el motivo y el tipo: turno extra (el empleado viene a la planta) o extensión de turno (ya está en la planta).',
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
        'Toca "Ver" para revisar el detalle y el historial de cualquier solicitud.',
      ],
    },
    autorizar: {
      titulo: 'Cómo autorizar solicitudes',
      pasos: [
        'Aquí están las solicitudes que esperan tu decisión. Las más antiguas salen primero.',
        'Toca "Revisar" para ver los empleados, los horarios, las rutas y los comentarios.',
        'Si todo está bien, toca "Autorizar". Si algo no cuadra, escribe el motivo y toca "Devolver".',
        'Para varias solicitudes a la vez, marca sus casillas y toca "Autorizar seleccionadas".',
      ],
    },
    recepcion: {
      titulo: 'Cómo recibir el tiempo extra autorizado',
      pasos: [
        'Aquí están las solicitudes ya autorizadas que RH todavía no recibe, agrupadas por fecha.',
        'Toca "Revisar" para ver el detalle. Aquí no se cambian empleados.',
        'Toca "Recibir y generar transporte": se crea la solicitud de transporte de quienes lo pidieron.',
        'Si algo está mal, usa "Devolver" con el motivo. Para varias del mismo día, usa "Recibir todas de esta fecha".',
      ],
    },
    consulta: {
      titulo: 'Consulta de solicitudes',
      pasos: [
        'Aquí ves todas las solicitudes de tiempo extra enviadas, sin importar su estatus.',
        'Usa los filtros de área, estatus, fechas y solicitante para encontrar lo que buscas.',
        'Toca "Ver" para abrir el detalle de una solicitud.',
        'Usa "Descargar tiempo extra" para nómina y comedor, o "Exportar consulta" para la lista que ves en pantalla.',
      ],
    },
    turnos: {
      titulo: 'Turnos de nómina',
      pasos: [
        'Captura el horario normal de los turnos A, B y C: a qué hora entran y a qué hora salen.',
        'Esto sirve para las extensiones de turno: el tiempo extra empieza cuando termina el turno normal del empleado.',
        'Mientras un turno esté vacío, quien captura una extensión tendrá que escribir la hora de fin de turno a mano.',
      ],
    },
  },

  recorridos: {
    solicitar: [
      { selector: '[data-tour="solicitar-datos"]', titulo: 'Datos de la solicitud', texto: 'Aquí eliges el día, el motivo y el tipo de tiempo extra, y explicas para qué se necesita.' },
      { selector: '[data-tour="solicitar-agregar"]', titulo: 'Agregar empleados', texto: 'Toca aquí para elegir a los empleados de tu área. Puedes marcar a varios de una vez.' },
      { selector: '[data-tour="solicitar-empleados"]', titulo: 'Horario, comida y transporte', texto: 'Cada empleado tiene su horario, si necesita comida y si necesita transporte. Si lleva transporte, elige su ruta.' },
      { selector: '[data-tour="solicitar-resumen"]', titulo: 'Resumen', texto: 'Aquí ves el total de empleados, horas y rutas. Si usas más de una ruta, tendrás que explicar por qué.' },
      { selector: '[data-tour="solicitar-enviar"]', titulo: 'Enviar', texto: 'Cuando todo esté listo, envía la solicitud. También puedes guardarla como borrador y seguir después.' },
    ],
    autorizar: [
      { selector: '[data-tour="autorizar-filtros"]', titulo: 'Filtros', texto: 'Filtra la lista por área o por fechas si tienes muchas solicitudes.' },
      { selector: '[data-tour="autorizar-lista"]', titulo: 'Tus solicitudes por autorizar', texto: 'Las más antiguas salen primero. Marca las casillas para autorizar varias a la vez.' },
      { selector: '[data-tour="autorizar-revisar"]', titulo: 'Revisar', texto: 'Toca aquí para ver el detalle completo y decidir: autorizar o devolver con un motivo.' },
    ],
  },
};

/** Texto de ayuda de un campo ('' si no existe) */
export const textoAyuda = (clave) => AYUDAS.campos[clave] ?? '';
/** Explicación en pasos de una pantalla, o null */
export const ayudaDePantalla = (id) => AYUDAS.pantallas[id] ?? null;
/** Globos del recorrido guiado de una pantalla ([] si no tiene) */
export const recorridoDe = (id) => AYUDAS.recorridos[id] ?? [];
