// Contenido del manual de RECURSOS HUMANOS. Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
export default {
  rol: 'Recursos Humanos',
  archivo: 'rh',
  quien: 'Para quien confirma el tiempo extra autorizado, pide el transporte al proveedor y administra los usuarios y sus accesos.',
  guia: {
    titulo: 'Guía rápida · Recursos Humanos',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Confirma', 'Toca <b>Por enviar al proveedor</b> y <b>Confirmar todas las de esta fecha</b>. Se crea el transporte.'],
      ['Rutas', 'Toca <b>Formato de rutas (proveedor)</b>, elige la fecha y <b>Descargar Excel</b>. Mándalo al proveedor.'],
      ['Usuario nuevo', 'En <b>Usuarios y accesos</b>, toca <b>Nuevo usuario</b>, elige a la persona y <b>Crear usuario</b>.'],
      ['Contraseña', 'Se muestra <b>una sola vez</b>. Cópiala o anótala y <b>entrégala en persona</b>.'],
      ['Roles', 'Con el lápiz ✎ dale su rol (Aut. 1 o solicitante) con su área y fechas.'],
      ['Olvidó', 'Con la llave 🔑 <b>Restablecer contraseña</b>. Mismo cuidado: en persona.'],
    ],
    recuerda: [
      'Antes de bajar el <b>Formato de rutas</b>, confirma el tiempo extra: sin eso el Excel sale vacío.',
      'Las contraseñas <b>solo se dan en persona</b>, con identificación. Nunca por teléfono, correo ni mensaje.',
      'Si una solicitud <b>ya venció</b> sin enviarse al proveedor, usa <b>Cerrar sin transporte</b>.',
      'Una semana <b>firmada</b> en Nóminas solo la reabres tú (Reportes de nómina).',
    ],
    contacto: 'Fallas del sistema: <b>Sistemas</b> · Dudas de permisos: <b>Autorización 2</b>',
  },
  secciones: [
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir tiempo extra y transporte. <b>Recursos Humanos</b> es el último paso de cada solicitud y quien cuida a los usuarios del portal.' },
        { p: 'Así camina una solicitud, y dónde entras tú:' },
        { lista: [
          '<b>Quien la pide</b> la captura y la envía.',
          '<b>El jefe de su área</b> (Autorización 1) la firma o la devuelve.',
          '<b>Autorización 2</b> da la segunda firma.',
          '<b>Tú</b> la confirmas en <b>Por enviar al proveedor</b>: se crea su solicitud de transporte.',
          'El <b>Formato de rutas</b> (Excel) se baja y se manda al proveedor.',
        ] },
        { nota: 'Además de lo del tiempo extra, tú administras <b>usuarios y accesos</b>: das de alta a las personas, les asignas sus roles y restableces contraseñas.' },
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
        { h: 'Tu pantalla de inicio' },
        { pasos: [
          'En <b>Accesos rápidos</b> y en el menú está <b>Por enviar al proveedor</b>, con su contador.',
          'En <b>Requieren atención</b> aparece lo que espera algo de ti (por ejemplo, solicitudes por confirmar o por vencer).',
          'Más abajo ves <b>Accesos rápidos</b> a las demás pantallas.',
        ], img: 'rh/01-inicio' },
        { nota: 'En el pie del menú están <b>Ayuda y manuales</b> (este manual y su guía rápida en PDF) y <b>Cerrar sesión</b>. En una computadora compartida, cierra tu sesión al terminar.' },
      ],
    },
    {
      id: 'confirmar', titulo: 'Confirmar el tiempo extra autorizado',
      bloques: [
        { p: 'En <b>Por enviar al proveedor</b> están las solicitudes que ya tienen las dos autorizaciones. Las de la fecha más próxima salen primero, agrupadas por día.' },
        { pasos: [
          '<b>Confirmar todas las fechas</b> confirma todo de una vez. Cada fecha también tiene su propio botón <b>Confirmar todas las de esta fecha</b>.',
          '<b>Revisar</b> abre la solicitud: ahí puedes <b>devolverla</b> (con un motivo de al menos 10 letras) o <b>cancelarla</b>.',
          '<b>Formato de rutas (proveedor)</b> baja el Excel (siguiente sección).',
        ], img: 'rh/02-recepcion' },
        { pasos: ['El portal te muestra el total de empleados, horas y transporte y te pide confirmar. Toca el botón para terminar.'], img: 'rh/03-confirmar-fecha', ancho: 'chico' },
        { pasos: ['Al terminar dice «Listo». Cada solicitud con transporte ya tiene su solicitud de transporte, que aparece en el Formato de rutas.'], img: 'rh/04-confirmada', ancho: 'chico' },
        { aviso: 'Si la fecha del tiempo extra ya pasó y no se mandó al proveedor, el portal ya no crea transporte: usa <b>Cerrar sin transporte</b>. Sus horas siguen contando para nómina.' },
      ],
    },
    {
      id: 'formato-rutas', titulo: 'Bajar el Formato de rutas',
      bloques: [
        { p: 'Es el Excel para el proveedor de transporte: solo lleva a los empleados que van en transporte, con su ruta, su punto de reunión y su horario.' },
        { pasos: [
          'Toca <b>Formato de rutas (proveedor)</b> (en Por enviar al proveedor o en el menú).',
          'Elige la <b>fecha de servicio</b>: hoy, mañana, o una fecha o rango. Arriba te dice cuál es.',
          'Toca <b>Descargar Excel</b>. El archivo se llama <b>Transporte_AAAA-MM-DD.xlsx</b>.',
        ], img: 'rh/05-formato-rutas' },
        { nota: 'Al terminar, el cuadro te dice qué archivo se descargó y cuántas solicitudes y pasajeros lleva. Ábrelo desde el ícono de descargas del navegador o en la carpeta Descargas de tu computadora.' },
        { aviso: 'Si dice «No hay tiempo extra confirmado para esa fecha», primero confirma en <b>Por enviar al proveedor</b> (el botón del propio mensaje te lleva). El Excel solo lleva lo ya confirmado.' },
      ],
    },
    {
      id: 'usuarios', titulo: 'Crear un usuario',
      bloques: [
        { p: 'Cada persona entra con su número de nómina. Antes de crear un usuario, la persona debe estar en el <b>padrón</b> de empleados.' },
        { pasos: [
          'Entra a <b>Personal › Usuarios y accesos</b>. La lista muestra el rol del sistema y las asignaciones de cada quien.',
          'Toca <b>Nuevo usuario</b> (o <b>Crear usuarios en lote</b> para varios a la vez).',
          'El lápiz ✎ edita a una persona; la llave 🔑 restablece su contraseña.',
        ], img: 'rh/06-usuarios' },
        { pasos: [
          'Busca a la persona por nómina o nombre y elígela. Solo salen empleados activos que aún no tienen usuario.',
          'Toca <b>Crear usuario</b>.',
        ], img: 'rh/07-nuevo-usuario' },
        { p: 'El usuario nuevo se crea con el rol <b>Usuario</b>. La <b>contraseña temporal</b> la genera el portal sola y se muestra <b>una sola vez</b>:' },
        { pasos: [
          'Es la contraseña temporal de esa persona.',
          'Toca <b>Copiar contraseña</b>, o anótala.',
          'Cuando ya la copiaste o la anotaste, toca <b>Ya la copié o la anoté, cerrar</b>.',
        ], img: 'rh/08-contrasena-temporal', ancho: 'chico' },
        { aviso: '<b>Entrégala en persona</b>. No la mandes por teléfono, correo ni mensaje. La persona deberá crear una contraseña propia al entrar por primera vez.' },
      ],
    },
    {
      id: 'roles', titulo: 'Dar roles y restablecer contraseñas',
      bloques: [
        { h: 'Dar un rol' },
        { p: 'El <b>rol del sistema</b> (Usuario, Recursos Humanos, Nóminas) abre pantallas de administración. Lo que cada quien puede <b>capturar y autorizar</b> sale de sus <b>asignaciones</b>: Autorizador 1 o solicitante de un área, con fechas si es temporal.' },
        { pasos: [
          'Con el lápiz ✎ de la persona, baja a <b>Rol y asignaciones</b>.',
          'Agrega la asignación (rol, área y fechas). Se guarda al instante; el botón de abajo solo guarda el nombre y el rol del sistema.',
        ], img: 'rh/09-editar-usuario' },
        { nota: 'Tú puedes dar <b>Autorizador 1</b> y <b>solicitante</b>, y el rol del sistema <b>Recursos Humanos</b> y <b>Nóminas</b>. Autorización 2 y Administrador solo los da el administrador. Nadie cambia su propio rol ni se da Nóminas a sí mismo.' },
        { h: 'Restablecer una contraseña' },
        { pasos: ['Con la llave 🔑 de la persona, confirma. El portal genera otra contraseña temporal; la ves una sola vez, igual que al crear un usuario.'], img: 'rh/10-restablecer', ancho: 'chico' },
        { aviso: 'Tú restableces contraseñas de usuarios y de Nóminas, nunca de otro RH ni de un administrador. Antes de restablecer, verifica a la persona <b>en persona y con su identificación</b>. Conserva su rol y sus asignaciones, pero los borradores y solicitudes que creó antes ya no le aparecerán en «Mis solicitudes».' },
        { p: 'Con el ojo puedes <b>desactivar</b> a alguien (ya no podrá entrar) o volver a activarlo.' },
      ],
    },
    {
      id: 'consultas', titulo: 'Consultar y descargar',
      bloques: [
        { pasos: ['<b>Tiempo extra</b> muestra todas las solicitudes de la planta con filtros por área, estatus, fechas, turno y motivo. Desde aquí puedes cancelar una (con un motivo) y descargar el resumen en Excel.'], img: 'rh/11-consulta' },
        { pasos: ['<b>Personal</b> es el padrón de empleados: ves a cada persona, su área, su puesto y su teléfono, y quién es elegible para tiempo extra.'], img: 'rh/12-personal' },
        { p: 'Además tienes <b>Solicitudes de transporte</b>, <b>Catálogos</b> (rutas, comunidades, puntos de reunión y motivos del tiempo extra) y <b>Estructura</b> (áreas, puestos y turnos).' },
        { nota: 'Si una semana ya la <b>firmó Nóminas</b> y hay que corregir algo, solo tú puedes <b>reabrirla</b> desde <b>Formato de tiempo extra</b> (Reportes de nómina).' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['La persona no sale al crear su usuario.', 'Solo salen empleados activos que aún no tienen usuario. Si falta, revisa el padrón (Personal) o usa «Capturar a mano».'],
          ['Se me olvidó copiar la contraseña temporal.', 'No se puede volver a ver. Restablece la contraseña de esa persona y entrega la nueva.'],
          ['El Formato de rutas sale vacío.', 'Aún no hay tiempo extra confirmado para esa fecha. Confirma en Por enviar al proveedor y vuelve a bajarlo.'],
          ['Confirmé algo por error.', 'Pide a Autorización 2 o cancela la solicitud con un motivo (si el transporte ya se envió al proveedor, el portal la marca para revisión).'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; no se pierde nada de lo ya hecho.'],
        ] },
      ],
    },
  ],
};
