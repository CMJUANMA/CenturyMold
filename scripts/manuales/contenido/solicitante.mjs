// Contenido del manual del SOLICITANTE. Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
// Bloques: { p } párrafo · { pasos: [...], img } pasos numerados (los números coinciden con los círculos de la captura `img`) · { nota } recuadro de consejo · { aviso } recuadro de cuidado
//          · { tabla: 'estatus' } tabla de estatus · { lista: [...] } viñetas · { preguntas: [[pregunta, respuesta]] } · { img } captura sola
// `basico: false` marca lo avanzado (va al final de su bloque).
export default {
  rol: 'Solicitante',
  archivo: 'solicitante',
  quien: 'Para quien pide el tiempo extra de su área (por ejemplo, la persona de Moldes que captura las solicitudes).',
  // Guía rápida: UNA hoja para pegar junto a la computadora del área
  guia: {
    titulo: 'Guía rápida · Pedir tiempo extra',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Empieza', 'Toca <b>Solicitar tiempo extra</b>.'],
      ['Datos', 'Elige la <b>fecha</b> (hoy o después) y el <b>motivo</b>. Escribe un <b>comentario</b> (mínimo 10 letras).'],
      ['Empleados', 'Toca <b>Agregar empleados</b>, marca a quienes van y toca <b>Agregar</b>.'],
      ['Horario', 'Elige <b>entrada</b> y <b>salida</b>, y toca <b>Aplicar horario</b>. Marca <b>alimentos</b> y <b>transporte</b>.'],
      ['Revisa', 'Mira el resumen de abajo: empleados, horas, transporte y rutas.'],
      ['Envía', 'Toca <b>Enviar a autorización</b> y confirma. Si no terminas, toca <b>Guardar borrador</b>.'],
      ['Sigue', 'En <b>Mis solicitudes</b> ves en qué paso va. Si está <b>Devuelta</b>, toca <b>Corregir y reenviar</b>.'],
    ],
    recuerda: [
      'Envía tu solicitud <b>con tiempo</b>: si pasa la fecha sin firmas, queda <b>Vencida</b> (usa <b>Duplicar con otra fecha</b>).',
      'Cada <b>ruta adicional</b> cuesta: junta a los empleados de una misma ruta.',
      '<b>Extensión de turno</b>: el empleado ya está en la planta y se queda más tiempo.',
      'Si pasas <b>30 minutos sin usar</b> el portal, se cierra tu sesión: guarda tu borrador.',
    ],
    contacto: 'Dudas de solicitudes: <b>Recursos Humanos</b> · Contraseña o fallas: <b>Sistemas</b> (en persona, con tu identificación)',
  },
  secciones: [
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir tiempo extra y transporte. Tú lo usas para <b>pedir tiempo extra de tu área</b> y ver cómo va cada solicitud.' },
        { p: 'Así camina una solicitud:' },
        { lista: [
          '<b>Tú</b> la capturas y la envías.',
          '<b>El jefe de tu área</b> (Autorización 1) la revisa y la autoriza o te la devuelve.',
          '<b>Autorización 2</b> da la segunda firma.',
          '<b>Recursos Humanos</b> la confirma y pide el transporte al proveedor.',
        ] },
        { nota: 'Si la fecha del tiempo extra pasa y la solicitud no terminó de autorizarse, queda <b>Vencida</b>. Por eso conviene enviarla con tiempo.' },
      ],
    },
    {
      id: 'primeros-pasos', titulo: 'Primeros pasos',
      bloques: [
        { h: 'Entrar al portal' },
        { p: 'Abre <b>https://centurymold-qro.web.app</b> en tu navegador (Chrome, Edge o el de tu celular).' },
        { pasos: [
          'Escribe tu <b>número de nómina</b>.',
          'Escribe tu <b>contraseña</b>. El ojito sirve para ver lo que escribes.',
          'Toca <b>Iniciar sesión</b>.',
          'Si no la recuerdas, toca <b>¿Olvidaste tu contraseña?</b>.',
        ], img: 'solicitante/01-entrar' },
        { h: 'La primera vez: cambia tu contraseña' },
        { p: 'Con la contraseña que te dieron, el portal te pide crear una <b>contraseña nueva</b>. No podrás usarlo hasta hacerlo.' },
        { pasos: [
          'Escribe la contraseña nueva. Usa <b>mínimo 8 caracteres, con letras y números</b>.',
          'Escríbela otra vez para confirmar.',
          'Toca <b>Guardar y continuar</b>.',
        ], img: 'solicitante/03-cambiar-contrasena' },
        { aviso: 'La contraseña nueva debe ser distinta a la que te dieron. No se la prestes a nadie.' },
        { h: 'Si olvidaste tu contraseña' },
        { p: 'Por seguridad, las contraseñas <b>solo se restablecen en persona</b>. Acude al área de <b>Sistemas</b> o a <b>Recursos Humanos</b> con tu identificación. Nunca te pediremos tu contraseña por teléfono, correo ni mensaje.' },
        { img: 'solicitante/02-olvide-contrasena', ancho: 'chico' },
      ],
    },
    {
      id: 'mi-cuenta', titulo: 'Mi cuenta: letra grande y tema',
      bloques: [
        { p: 'En <b>Mi cuenta</b> puedes dejar el portal como te quede mejor. Los cambios se guardan solos.' },
        { pasos: [
          'Elige el tamaño de letra: <b>Grande</b> si te cuesta leer.',
          'Elige el tema: <b>Claro</b>, <b>Oscuro</b> o <b>Automático</b> (igual que tu equipo).',
          'Para salir, toca el botón de <b>cerrar sesión</b>, abajo a la izquierda (junto a tu nombre).',
        ], img: 'solicitante/05-mi-cuenta' },
        { p: 'En esta pantalla también puedes <b>cambiar tu contraseña</b> cuando quieras.' },
        { nota: '<b>Cierre por inactividad.</b> Si pasas <b>30 minutos sin tocar el teclado, el mouse o la pantalla</b>, el portal cierra tu sesión para cuidar la información. Un minuto antes te avisa: toca <b>Seguir aquí</b> para continuar. Lo que no hayas guardado puede perderse: guarda tu borrador seguido.' },
      ],
    },
    {
      id: 'inicio', titulo: 'Tu pantalla de Inicio',
      bloques: [
        { p: 'Al entrar ves tu <b>Inicio</b>: un resumen de tu área.' },
        { pasos: [
          'Botón <b>Solicitar tiempo extra</b>: para empezar una solicitud nueva.',
          'Tarjetas con números: <b>Empleados de mi área</b>, <b>En borrador</b>, <b>En autorización</b>, <b>Devueltas</b> y <b>Autorizadas este mes</b>. Si hay <b>Devueltas</b>, la tarjeta se pone amarilla: alguien pide que la corrijas.',
          '<b>Próximos tiempos extra autorizados</b>: los que ya tienen las dos firmas y están por hacerse.',
          'Cerrar sesión.',
        ], img: 'solicitante/04-inicio' },
        { p: 'El menú de la izquierda tiene tres opciones: <b>Inicio</b>, <b>Solicitar tiempo extra</b> y <b>Mis solicitudes</b>.' },
      ],
    },
    {
      id: 'solicitar', titulo: 'Pedir tiempo extra',
      bloques: [
        { p: 'Toca <b>Solicitar tiempo extra</b>. La pantalla tiene tres partes: los <b>datos generales</b>, los <b>empleados</b> y una <b>barra de abajo</b> con el resumen y los botones. Llénalas en este orden.' },
        { h: 'Paso 1 · Datos generales' },
        { pasos: [
          '<b>Área</b>: ya viene la tuya. No se cambia.',
          '<b>Fecha del tiempo extra</b>: el día en que se hará. Puede ser hoy o un día que viene.',
          '<b>Motivo</b>: elige el motivo de la lista.',
          '<b>Detalle</b> (opcional): una frase que explique, por ejemplo «apoyo a inventario».',
        ], img: 'solicitante/06-formulario-datos' },
        { h: 'Tipo de tiempo extra' },
        { pasos: [
          '<b>Turno extra / día extra</b>: el empleado <b>viene a la planta</b> para el tiempo extra.',
          '<b>Extensión de turno</b>: el empleado <b>ya está en la planta</b> y se queda más tiempo. En este tipo no se pide transporte de llegada.',
        ], img: 'solicitante/08-tipo-extension' },
        { h: 'Comentario' },
        { p: 'Escribe <b>por qué se necesita</b> el tiempo extra. Pide <b>mínimo 10 letras</b>. Es lo primero que leen quienes autorizan.' },
        { h: 'Paso 2 · Empleados' },
        { p: 'Toca <b>Agregar empleados</b>. Se abre la lista de empleados <b>de tu área</b>.' },
        { pasos: [
          'Busca por <b>nombre o nómina</b>, o filtra por puesto o por ruta.',
          'Marca la casilla de cada empleado. Puedes marcar varios.',
          'O toca <b>Seleccionar los visibles</b> para marcar todos los de la lista.',
          'Toca <b>Agregar</b>.',
        ], img: 'solicitante/09-agregar-empleados' },
        { h: 'Paso 3 · Horario, alimentos y transporte' },
        { p: 'Primero usa <b>Aplicar a todos</b> para no capturar uno por uno.' },
        { pasos: [
          'Elige la <b>hora de entrada</b>.',
          'Elige la <b>hora de salida</b>.',
          'Toca <b>Aplicar horario</b>.',
          'Toca <b>Con alimentos</b> o <b>Sin alimentos</b>.',
          'Toca <b>Con transporte</b> o <b>Sin transporte</b>. (Y confirma las rutas con el botón <b>Confirmar las rutas del padrón</b>.)',
        ], img: 'solicitante/10-horario-para-todos' },
        { nota: 'Marca las casillas de algunos empleados antes de tocar un botón y el cambio se aplica <b>solo a ellos</b>. Si no marcas ninguno, se aplica a todos.' },
        { p: 'Después revisa a cada empleado. Si alguien tiene un horario distinto o no necesita transporte, cámbialo en su renglón.' },
        { pasos: [
          'El nombre y la nómina del empleado.',
          'Su <b>horario</b>, sus <b>alimentos</b> y su <b>transporte</b> (llegada y salida).',
          'Su <b>ruta de transporte</b>: ruta, comunidad y punto de reunión. Si ya tiene una guardada, solo confírmala. Puedes escribir su <b>teléfono</b> para que el transporte pueda llamarle.',
        ], img: 'solicitante/11-fila-empleado' },
        { aviso: 'El horario de entrada y el de salida <b>no pueden ser la misma hora</b>. Una salida «menor» que la entrada (por ejemplo, de 4:00 p. m. a 12:00 a. m.) significa que termina al día siguiente.' },
        { h: 'Varios motivos, P.O. y TB', basico: false },
        { p: 'Si no todos los empleados van por el mismo motivo, toca <b>Agregar otro motivo</b> (hasta 5). Después, en el renglón de cada empleado, elige el que le toca.', },
        { pasos: [
          'Toca <b>Agregar otro motivo</b>.',
          'Elige el segundo motivo. Con <b>Cargo a P.O.</b> o <b>Cargo a TB</b>, el portal pide el <b>número</b>. Con <b>Otro</b>, pide que lo describas.',
        ], img: 'solicitante/07-varios-motivos' },
        { h: 'Más de una ruta', basico: false },
        { p: 'Cada ruta adicional <b>cuesta dinero</b>. Si tu solicitud usa más de una ruta, el portal te avisa y te pide explicar <b>por qué no basta una sola</b> (mínimo 15 letras).' },
        { pasos: [
          'El aviso dice cuántas rutas usa tu solicitud.',
          'Explica el motivo con claridad. Sin esto no se puede enviar.',
        ], img: 'solicitante/12-mas-de-una-ruta' },
        { nota: 'Para ahorrar rutas, usa el filtro <b>Todas las rutas</b> al agregar empleados: así juntas a la gente de una misma ruta.' },
        { h: 'Paso 4 · Guardar o enviar' },
        { p: 'La barra de abajo siempre te acompaña.' },
        { pasos: [
          'El resumen: empleados, horas, con transporte, con alimentos y rutas. Revísalo antes de enviar.',
          '<b>Guardar borrador</b>: guarda lo que llevas para seguir después. No lo ve nadie más.',
          '<b>Enviar a autorización</b>: manda la solicitud al jefe de tu área.',
        ], img: 'solicitante/13-guardar-o-enviar' },
        { p: 'Al tocar <b>Enviar a autorización</b>, el portal te muestra un resumen y te pregunta si estás seguro. Toca <b>Enviar</b>. La solicitud recibe su <b>folio</b> (por ejemplo, TE-2026-0012).' },
        { img: 'solicitante/14-confirmar-envio', ancho: 'chico' },
        { aviso: 'Si falta algo, el portal te dice <b>cuántas cosas faltan</b> y las marca. Corrígelas y vuelve a enviar.' },
      ],
    },
    {
      id: 'seguimiento', titulo: 'Ver cómo va tu solicitud',
      bloques: [
        { p: 'En <b>Mis solicitudes</b> están todas las tuyas, separadas por pestañas según su estatus.' },
        { pasos: [
          'Pestaña <b>En autorización</b>: las que esperan una firma.',
          'Pestaña <b>Devueltas</b>: las que debes corregir. El número rojo avisa que hay pendientes.',
          'La columna <b>Estatus</b> dice en qué paso va y con quién está.',
          'En <b>Acciones</b> están los botones de cada solicitud: <b>Ver</b>, <b>Cancelar</b>, <b>Continuar</b>, <b>Corregir y reenviar</b>.',
        ], img: 'solicitante/15-mis-solicitudes' },
        { p: 'Toca <b>Ver</b> para abrir el detalle: estatus, fecha, motivos, empleados con su horario y las firmas.' },
        { pasos: [
          'Arriba, el <b>estatus</b> y los datos de la solicitud.',
          'Más abajo, los <b>empleados por horario</b> y la lista de empleados.',
        ], img: 'solicitante/16-detalle' },
        { p: 'Al final del detalle está el <b>Historial</b>: quién hizo qué y cuándo. Ahí ves, por ejemplo, quién la autorizó o por qué la devolvieron.' },
      ],
    },
    {
      id: 'devuelta', titulo: 'Corregir una solicitud devuelta',
      bloques: [
        { p: 'Si el jefe de área o Autorización 2 <b>devuelve</b> tu solicitud, te dice el motivo. Corrígela y reenvíala: <b>vuelve a empezar</b> desde la primera firma.' },
        { pasos: ['En <b>Mis solicitudes</b>, abre la pestaña <b>Devueltas</b> y toca <b>Corregir y reenviar</b>.'], img: 'solicitante/20-devuelta' },
        { pasos: [
          'Lee el <b>motivo de la devolución</b>. Dice quién la devolvió y qué falta.',
          'Cambia lo que haga falta y toca <b>Reenviar a autorización</b>.',
          'Si ya no se necesita, toca <b>Cancelar solicitud</b>.',
        ], img: 'solicitante/21-corregir-devuelta' },
        { nota: 'También puedes tocar <b>Guardar cambios</b> para seguir después, sin reenviar todavía.' },
      ],
    },
    {
      id: 'cancelar', titulo: 'Cancelar una solicitud', basico: false,
      bloques: [
        { p: 'Puedes cancelar una solicitud que <b>todavía no está autorizada</b>. Si ya está autorizada, pide a Recursos Humanos que la cancele.' },
        { pasos: ['En la pestaña <b>En autorización</b>, toca <b>Cancelar</b> en la solicitud que quieras.'], img: 'solicitante/18-cancelar' },
        { pasos: [
          'Escribe el <b>motivo</b> de la cancelación (mínimo 10 letras).',
          'Confirma. La solicitud pasa a <b>Canceladas</b> y ya no se puede reenviar.',
        ], img: 'solicitante/19-cancelar-motivo' },
        { aviso: 'Un <b>borrador</b> no se cancela: se <b>elimina</b> con el botón <b>Eliminar</b>.' },
      ],
    },
    {
      id: 'vencidas', titulo: 'Solicitudes vencidas y «Duplicar con otra fecha»', basico: false,
      bloques: [
        { p: 'Una solicitud queda <b>Vencida</b> cuando <b>pasó el día del tiempo extra</b> y todavía no tenía todas las firmas. Ya no se puede autorizar de la forma normal. Aparece en la pestaña <b>Vencidas</b>.' },
        { p: 'No la pierdes: puedes <b>copiarla</b> con otra fecha.' },
        { pasos: ['En la pestaña <b>Vencidas</b>, toca <b>Duplicar con otra fecha</b>.'], img: 'solicitante/22-vencidas' },
        { pasos: [
          'Elige la <b>nueva fecha</b> (de hoy en adelante).',
          'Toca <b>Crear borrador</b>. Se copian los empleados, sus horarios y su transporte, y los motivos.',
        ], img: 'solicitante/23-duplicar' },
        { p: 'El borrador nuevo queda en <b>Borradores</b>. Revísalo y envíalo como cualquier solicitud.' },
        { nota: 'Si de verdad se trabajó ese día, pídele a <b>Autorización 2</b> que la autorice <b>fuera de tiempo</b>. Eso lo decide ella o él, con un motivo.' },
      ],
    },
    {
      id: 'celular', titulo: 'Desde el celular', basico: false,
      bloques: [
        { p: 'El portal también funciona en el celular. El menú se abre con el botón de las tres rayas.' },
        { pasos: ['Botón del <b>menú</b> (tres rayas): ahí están <b>Inicio</b>, <b>Solicitar tiempo extra</b> y <b>Mis solicitudes</b>.', 'Botón <b>Solicitar tiempo extra</b>.'], img: 'solicitante/24-celular-inicio', ancho: 'celular' },
        { pasos: ['La <b>fecha</b>. Más abajo están el motivo, los empleados y todo lo demás, igual que en la computadora.', 'Los botones de abajo, para <b>guardar</b> o <b>enviar</b>.'], img: 'solicitante/26-celular-solicitar', ancho: 'celular' },
      ],
    },
    { id: 'estatus', titulo: 'Qué significa cada estatus', bloques: [{ tabla: 'estatus' }] },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [{ preguntas: [
        ['No me deja enviar. ¿Qué hago?', 'Revisa el aviso rojo: dice cuántas cosas faltan y las marca. Casi siempre falta un horario, un motivo o el comentario (mínimo 10 letras).'],
        ['No encuentro a un empleado.', 'Solo salen los empleados <b>de tu área</b>. Si alguien debería estar y no sale, avisa a Recursos Humanos.'],
        ['Me equivoqué después de enviar.', 'Si todavía no se autoriza, cancela la solicitud y captura otra. Si ya se autorizó, pide a Recursos Humanos que la cancele.'],
        ['¿Puedo pedir tiempo extra para ayer?', 'No. La fecha puede ser hoy o un día que viene.'],
        ['Mi solicitud dice «Vencida».', 'Pasó la fecha sin terminar de autorizarse. Usa <b>Duplicar con otra fecha</b>.'],
        ['¿Por qué me pide explicar las rutas?', 'Porque cada ruta adicional cuesta. Explica por qué no basta una sola.'],
        ['¿Se pierde mi captura si se cierra la sesión?', 'Lo que guardaste como borrador, no. Lo demás sí. Guarda seguido.'],
      ] }],
    },
    {
      id: 'contacto', titulo: '¿A quién le pregunto?',
      bloques: [
        { lista: [
          '<b>Dudas de una solicitud, empleados o permisos:</b> Recursos Humanos.',
          '<b>No puedes entrar, olvidaste tu contraseña o algo no funciona:</b> Sistemas (en persona, con tu identificación).',
          '<b>Quién debe autorizar tu solicitud:</b> el jefe de tu área.',
        ] },
      ],
    },
  ],
};
