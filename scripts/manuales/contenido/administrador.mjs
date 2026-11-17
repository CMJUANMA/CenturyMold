// Contenido del manual del ADMINISTRADOR (para el administrador del sistema). Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
// Los números de los pasos coinciden con los números de las flechas de cada captura (ver scripts/manuales/roles/administrador.mjs).
// Todas las capturas de este manual se tomaron en el EMULADOR con datos inventados, incluso las de «Preparar para producción».
export default {
  rol: 'Administrador',
  archivo: 'administrador',
  quien: 'Para el administrador del sistema: lo que solo él hace (respaldos, herramientas, roles de más nivel y preparar el arranque en producción) y qué revisar si algo falla.',
  guia: {
    titulo: 'Guía rápida · Administrador',
    pasos: [
      ['Tienes todo', 'El administrador tiene <b>todos los permisos de todos los roles</b>: para lo de cada rol, lee su manual.'],
      ['Respaldo', 'Cada semana: menú › <b>Diagnóstico y limpieza</b> › <b>Descargar respaldo completo</b>. Guárdalo en carpeta restringida.'],
      ['Vista previa', 'Para saber qué ve alguien: <b>Vista previa por rol</b>. Es un dibujo; no cambia tu sesión.'],
      ['Roles tuyos', '<b>Administrador</b> y <b>Autorización 2</b> solo los das tú (lápiz ✎ y Asignar rol). También restableces la contraseña de cualquiera, menos la tuya.'],
      ['Elegibles', 'Padrón › <b>Cargar elegibles TE</b>: revisa la vista previa y pulsa <b>Aplicar</b> solo si es correcta.'],
      ['Arranque', '<b>Preparar para producción</b>: <b>una sola vez, el día anterior al arranque</b>, con el respaldo descargado antes.'],
      ['Si algo falla', 'Revisa rol del sistema, asignaciones y su vigencia, organigrama y <b>Contar documentos</b>. Copia el error con «Ver detalle».'],
    ],
    recuerda: [
      '<b>Preparar para producción borra datos de verdad.</b> Hazlo solo una vez, el día anterior al arranque, y descarga el respaldo antes.',
      'Las contraseñas temporales se ven <b>una sola vez</b> y se entregan <b>en persona</b>.',
      'Tú <b>no te restableces</b> la contraseña (usa Mi cuenta), ni cambias tu propio rol, ni te das Nóminas.',
      'Al terminar la limpieza, borra a mano en la consola de Firebase las cuentas de Authentication que el portal lista.',
    ],
    contacto: 'Fallas de la plataforma: consola de Firebase del proyecto · Dudas de uso: este manual y el del rol correspondiente',
  },
  secciones: [
    // ───────────────────────── ANTES DE EMPEZAR ─────────────────────────
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir y autorizar tiempo extra y transporte. Como <b>administrador</b> tienes, <b>siempre</b>, todos los permisos de todos los roles: Autorización 2, Autorización 1 y solicitante de <b>todas</b> las áreas, además de Recursos Humanos y Nóminas.' },
        { p: 'Eso quiere decir que capturas, autorizas y devuelves en cualquier nivel (también lo que tú mismo capturaste), autorizas fuera de tiempo, cancelas, confirmas el envío al proveedor, ajustas, firmas y reabres la nómina, y administras usuarios, roles, catálogos y estructura. <b>Todo queda en el historial y en la bitácora con tu nombre.</b>' },
        { nota: 'Este manual solo explica lo que <b>únicamente tú</b> haces. Para lo demás, usa el manual del rol: <b>Solicitante</b>, <b>Autorizador 1</b>, <b>Autorizador 2</b>, <b>Recursos Humanos</b> y <b>Nóminas</b>. Todos están en <b>Ayuda y manuales</b>, porque tú ves los seis.' },
        { h: 'Lo que solo tú haces' },
        { lista: [
          'Descargar el <b>respaldo completo</b> de todos los datos.',
          'Ver la <b>vista previa por rol</b>: qué menú y qué pantallas tendría cualquier combinación de roles.',
          'Dar y quitar el rol <b>Administrador</b> y el rol <b>Autorización 2</b>; restablecer la contraseña de <b>cualquiera</b> (incluidos Recursos Humanos).',
          '<b>Cargar asignaciones iniciales</b>, <b>actualizar nombres y puestos</b> de las asignaciones y <b>crear la estructura inicial</b>.',
          '<b>Preparar para producción</b>: borrar los datos de prueba antes de arrancar.',
          'El diagnóstico de colecciones y <b>limpiar estructura vieja</b>.',
        ] },
        { no: [
          'Restablecer <b>tu propia</b> contraseña desde Usuarios: usa <b>Mi cuenta › Cambiar mi contraseña</b>.',
          'Cambiar <b>tu propio</b> rol ni darte a ti mismo el rol de Nóminas.',
          'Borrar solicitudes de tiempo extra: no existe ese botón en la pantalla.',
          'Marcarte a ti mismo para borrar en «Preparar para producción».',
          'Borrar cuentas de Authentication desde el portal: se borran a mano en la consola de Firebase.',
        ] },
      ],
    },
    // ───────────────────────── PRIMEROS PASOS ─────────────────────────
    {
      id: 'primeros-pasos', titulo: 'Primeros pasos',
      bloques: [
        { h: 'Entrar al portal' },
        { p: 'Abre <b>https://centurymold-qro.web.app</b> en tu navegador (Chrome, Edge o el de tu celular).' },
        { pasos: [
          'Escribe tu <b>número de nómina</b>.',
          'Escribe tu <b>contraseña</b>. El ojito sirve para ver lo que escribes.',
          'Toca <b>Iniciar sesión</b>.',
          'Si no la recuerdas, toca <b>¿Olvidaste tu contraseña?</b>. Solo se restablece <b>en persona</b>, con otro administrador o con Recursos Humanos y tu identificación.',
        ], img: 'solicitante/01-entrar' },
        { h: 'Tu pantalla de inicio' },
        { p: 'Tu Inicio es el de Recursos Humanos (indicadores de toda la planta). Si no has descargado un respaldo reciente, arriba te lo recuerda.' },
        { pasos: [
          '<b>Descarga el respaldo semanal</b>: aviso en «Requieren atención».',
          '<b>Ir a Herramientas</b>: te lleva a la pantalla de respaldos.',
          'En el menú, bajo <b>Herramientas</b>, está <b>Diagnóstico y limpieza</b>.',
        ], img: 'administrador/01-inicio' },
        { h: 'El menú' },
        { pasos: [
          '<b>Diagnóstico y limpieza</b>: tus herramientas (respaldo, vista previa por rol, preparar para producción).',
          '<b>Guía de estilo</b>: la muestra de componentes de la pantalla. Es para quien diseña; no cambia nada.',
          '<b>Usuarios y accesos</b>: usuarios, asignaciones y organigrama.',
          '<b>Catálogos</b>: rutas, comunidades, puntos de reunión y motivos.',
        ], img: 'administrador/02-menu', ancho: 'chico' },
        { nota: 'Abajo, tu nombre dice todos tus roles. En <b>Mi cuenta</b> cambias tu contraseña, el tamaño de letra, el tema y las ayudas. Por seguridad la sesión se cierra a los <b>30 minutos sin usar</b>.' },
      ],
    },
    // ───────────────────────── LO DE TODOS LOS DÍAS / SEMANAL ─────────────────────────
    {
      id: 'herramientas', titulo: 'Diagnóstico y limpieza: la pantalla de Herramientas',
      bloques: [
        { p: '<b>Para qué sirve.</b> Reúne lo que se usa pocas veces y que puede <b>escribir o borrar</b> en la base de datos. Se entra por <b>Diagnóstico y limpieza</b> en el menú. Arriba dice «Lee con calma las herramientas de abajo antes de ejecutar algo: algunas escriben en la base de datos».' },
        { pasos: [
          'El encabezado: «Diagnóstico y limpieza», marcado <b>Administrador</b>.',
          '<b>Vista previa por rol</b>: lo primero de la pantalla (siguiente sección).',
        ], img: 'administrador/03a-herramientas-arriba', ancho: 'chico' },
        { pasos: [
          '<b>Respaldo completo (JSON)</b>: descarga todos los datos.',
          '<b>Preparar para producción</b>: borra los datos de prueba antes de arrancar (con respaldo previo).',
          '<b>Diagnóstico de colecciones</b>: cuenta documentos y busca registros huérfanos.',
          '<b>Limpiar estructura vieja</b>: quita campos que ya nada usa.',
        ], img: 'administrador/03-herramientas' },
      ],
    },
    {
      id: 'respaldo', titulo: 'Respaldo completo (cada semana)',
      bloques: [
        { p: '<b>Para qué sirve.</b> Es la copia de todo lo que hay en el portal, para recuperar datos si algo sale mal. <b>Cuándo se usa:</b> <b>cada semana</b>, mientras no haya respaldos programados, y <b>siempre antes</b> de importar, cargar elegibles o preparar para producción.' },
        { pasos: [
          '<b>Descargar respaldo completo</b>: baja un archivo JSON con todo.',
          'Lee el aviso: el archivo contiene <b>datos personales de empleados</b>. Guárdalo en una carpeta con acceso restringido y <b>no lo mandes por correo ni por mensaje</b>.',
        ], img: 'administrador/05-respaldo' },
        { p: 'El respaldo incluye usuarios, asignaciones, padrón, estructura, catálogos, bitácora y el tiempo extra con sus empleados e historial. <b>Los borradores de otras personas no se incluyen</b> (el respaldo de «Preparar para producción» sí los incluye). Cada descarga queda en la bitácora con tu nombre.' },
        { aviso: 'El portal <b>no puede restaurar</b> un respaldo por sí solo: el archivo sirve para recuperar datos con ayuda de quien administra la plataforma. Por eso conviene guardar varios, con fecha en el nombre.' },
      ],
    },
    {
      id: 'vista-previa', titulo: 'Vista previa por rol',
      bloques: [
        { p: '<b>Para qué sirve.</b> Saber qué menú, qué Inicio y qué pantallas tendría una persona con cierta combinación de roles, <b>sin cambiar tu sesión</b>. Es un dibujo: no lee datos reales y no cambia tus permisos. <b>Cuándo se usa:</b> cuando alguien dice «no veo tal pantalla» o antes de darle un rol.' },
        { pasos: [
          '<b>Combinaciones frecuentes</b>: atajos (por ejemplo «Aut. 2 + Solicitante»).',
          '<b>Rol del sistema</b>: Usuario, Recursos Humanos, Nóminas o Administrador.',
          '<b>Restablecer vista</b> la deja como al inicio.',
          '<b>Pantallas</b>: la lista de todo lo que tendría, con «Accede» o «No accede».',
        ], img: 'administrador/04-vista-previa' },
        { nota: 'Abajo de las casillas ves el <b>menú</b> y el <b>Inicio</b> que tendría esa persona. Si algo no coincide con lo que reporta, revisa su rol del sistema y sus asignaciones (con su vigencia) en <b>Usuarios y accesos</b>.' },
      ],
    },
    // ───────────────────────── LO DE VEZ EN CUANDO ─────────────────────────
    {
      id: 'roles', titulo: 'Roles que solo tú das, y contraseñas de cualquiera',
      bloques: [
        { h: 'Dar o quitar el rol Administrador' },
        { p: 'En <b>Usuarios y accesos › Usuarios</b>, con el lápiz ✎ de la persona, <b>Rol del sistema</b> incluye <b>Administrador del sistema</b> (Recursos Humanos y Aut. 2 no lo ven). Elígelo y toca <b>Guardar nombre y rol</b>; el portal pide confirmación y queda en la bitácora.' },
        { pasos: [
          '<b>Rol del sistema</b>: ahí aparece Administrador.',
          '<b>Guardar nombre y rol</b>.',
        ], img: 'administrador/08-rol-administrador', ancho: 'chico' },
        { aviso: 'El administrador tiene <b>todos los permisos de todo el sistema</b>. Dalo solo a quien lo necesita, y quítalo cuando deje de necesitarlo. Nadie cambia su propio rol, y a quien ya es administrador solo se le cambia el rol, no el nombre ni el estado.' },
        { h: 'Dar Autorización 2' },
        { p: 'Autorización 2 es la segunda firma de toda la planta. Solo tú la das, en <b>Asignar roles › Asignar rol</b>.' },
        { pasos: [
          '<b>Rol</b>: elige <b>Autorización 2</b> (Recursos Humanos y Aut. 2 solo ven Autorización 1 y Solicitante).',
          'Elige al empleado, las fechas (<b>Hasta</b> vacío = permanente) y, si quieres, un motivo; toca <b>Asignar</b>.',
        ], img: 'administrador/11-asignar-aut2', ancho: 'chico' },
        { p: 'Quien tiene la asignación de Aut. 2 pero su rol del sistema es «Usuario» <b>no ve nada de Recursos Humanos</b>. Si también es de RH, cámbiale el rol del sistema. Para lo demás de las asignaciones (extender, revocar, suplencias), lee el manual del Autorizador 2 o de Recursos Humanos.' },
        { h: 'Restablecer la contraseña de cualquiera' },
        { p: 'Tú puedes restablecer la contraseña de <b>cualquier</b> usuario, incluidos Recursos Humanos y otros administradores (Recursos Humanos y Aut. 2 no pueden con los de RH ni con los administradores). <b>La tuya no</b>: usa Mi cuenta.' },
        { pasos: [
          'Antes de restablecer, <b>verifica a la persona en persona, con su identificación</b>.',
          'La llave 🔑 de su fila abre el aviso; <b>Restablecer contraseña</b> genera la temporal, que se ve <b>una sola vez</b>. Entrégala en persona.',
        ], img: 'administrador/09-restablecer-rh', ancho: 'chico' },
      ],
    },
    {
      id: 'asignaciones-iniciales', titulo: 'Asignaciones iniciales, nombres y estructura inicial',
      bloques: [
        { p: 'Tres herramientas de arranque que solo tú ves. Las tres <b>simulan primero</b> y no guardan nada sin que lo confirmes; lo que ya existe no se toca.' },
        { pasos: [
          '<b>Asignar rol</b>: la asignación de uno en uno.',
          '<b>Actualizar nombres y puestos de las asignaciones</b>.',
          '<b>Cargar asignaciones iniciales</b>.',
        ], img: 'administrador/10-asignaciones' },
        { h: 'Cargar asignaciones iniciales' },
        { p: 'Carga de una vez los Autorizadores 1, los Autorizadores 2 y los solicitantes que vienen de la hoja «Niveles de autorización». Es una lista de revisión: cada fila trae su casilla, su estado («No está en el padrón», ya existe, etc.) y solo se crean las que marques. Es <b>idempotente</b>: repetirla no duplica nada.' },
        { pasos: ['Revisa la lista. Si alguien <b>no está en el padrón</b>, no se puede asignar: primero dalo de alta. Abajo dice cuántas llevas marcadas; el botón crea solo esas.'], img: 'administrador/12-carga-inicial' },
        { h: 'Actualizar nombres y puestos de las asignaciones' },
        { p: 'Copia el nombre y el puesto <b>del padrón</b> a cada asignación (y vincula el puesto con el catálogo). Sirve para que el organigrama muestre a las personas con su nombre actual.' },
        { pasos: ['Es una <b>simulación</b>: la lista dice cuántas se actualizarían y cuántas ya están al día. Confirma con el botón (por ejemplo, «Actualizar 8»).'], img: 'administrador/13-actualizar-nombres' },
        { h: 'Crear estructura inicial' },
        { p: 'Aparece en <b>Estructura › Áreas</b>. Propone las áreas y los puestos que faltan a partir de los datos que ya existen. <b>Nunca sobrescribe</b> lo que ya hay.' },
        { pasos: ['El botón <b>Crear estructura inicial</b>.'], img: 'administrador/14-estructura-inicial-boton', ancho: 'chico' },
        { pasos: ['La vista previa dice qué áreas y puestos se crearían y qué ya existe. Solo al confirmar con <b>Confirmar y crear</b> se guarda.'], img: 'administrador/15-estructura-inicial' },
        { nota: 'Estas tres herramientas se usan al arrancar o cuando cambia mucho el padrón. Con el sistema en marcha, lo normal es dar roles uno por uno (lee el manual de Recursos Humanos).' },
      ],
    },
    {
      id: 'elegibles', titulo: 'Cargar elegibles TE',
      bloques: [
        { p: '<b>Para qué sirve.</b> Actualiza de una vez quién puede tener tiempo extra («elegible») a partir de un archivo de Excel. Está en <b>Padrón de empleados › Cargar elegibles TE</b>, y la usan Recursos Humanos y tú. <b>No se guarda nada hasta que pulses Aplicar.</b> Los pasos con todos los detalles están en el manual de Recursos Humanos; aquí lo esencial.' },
        { pasos: ['Toca <b>Elegir archivo (.xlsx)</b>. Columnas: NOMINA, NOMBRE, PUESTO, DEPTO NOMINA, AREA TE y ELEGIBLE TE.'], img: 'rh/39-elegibles', ancho: 'chico' },
        { pasos: [
          '<b>Nuevos en el padrón</b>: las nóminas del archivo que no están; se darán de alta (con puesto y área editables).',
          '<b>Del padrón y no vienen en el archivo</b>: <b>Dar de baja</b> desactiva a quien marques; el resto queda no elegible.',
          '<b>Aplicar (n cambios, a altas, b bajas)</b>: escribe todo, con un resumen en la bitácora.',
        ], img: 'rh/40-elegibles-vista-previa' },
        { aviso: '<b>Antes de aplicar</b>, descarga el respaldo (sección anterior) y revisa con calma la lista de bajas: marcar de más desactiva a personas que sí trabajan. Una vez aplicado, no hay botón de deshacer.' },
      ],
    },
    {
      id: 'produccion', titulo: 'Preparar para producción',
      bloques: [
        { p: '<b>Para qué sirve.</b> Antes de arrancar con datos reales, borra los datos de prueba: solicitudes de tiempo extra y de transporte, ajustes de nómina, bitácora y el contador del folio. El próximo folio será <b>TE-AAAA-0001</b>. <b>No toca</b> el padrón, las áreas, los puestos, los turnos, los motivos, los catálogos, las asignaciones, los accesos ni los usuarios que no marques.' },
        { aviso: '<b>Hazlo solo una vez, el día anterior al arranque, y descarga el respaldo antes.</b> Esta herramienta <b>borra datos de verdad y no se puede deshacer</b> (salvo con el respaldo). No la uses con el sistema ya en marcha.' },
        { nota: 'Las capturas de esta sección se tomaron en un <b>emulador con datos inventados</b>, no en producción. Así lo puedes practicar antes de hacerlo de verdad.' },
        { h: 'Antes de empezar' },
        { lista: [
          'Avisa a todos que el portal <b>no se debe usar</b> mientras dura la limpieza.',
          'Ten a la mano la <b>consola de Firebase › Authentication</b>: al final tendrás que borrar ahí, a mano, las cuentas de los usuarios que borres.',
          'Confirma que el <b>padrón</b>, las <b>asignaciones</b> y los <b>catálogos</b> ya están como los quieres: eso se conserva.',
        ] },
        { h: 'Paso 1: respaldar y ver qué se borraría (no borra nada)' },
        { pasos: [
          'La tarjeta explica los dos pasos.',
          'Toca <b>Paso 1: respaldar y ver qué se borraría</b>. Descarga el <b>respaldo completo</b> (con los borradores incluidos) y abre una ventana de limpieza que <b>caduca sola</b> (máximo 2 horas) si no la usas.',
        ], img: 'administrador/16-preparar-inicio' },
        { pasos: [
          'El aviso verde confirma el respaldo y cuántos documentos trae. <b>Guárdalo en una carpeta segura</b>: es lo único que permite recuperar lo que se borre.',
          '<b>Se borraría</b>: la tabla de documentos por tipo (solicitudes de tiempo extra con sus empleados e historial, solicitudes de transporte con sus pasajeros, ajustes de nómina, bitácora y contadores del folio), y la lista de folios.',
          '<b>Se conserva (no se toca)</b>: padrón, áreas, puestos, turnos, motivos, rutas, comunidades, puntos, asignaciones y accesos, con su cantidad.',
        ], img: 'administrador/17-fase1-inventario' },
        { pasos: [
          '<b>Usuarios</b>: marca los usuarios de prueba que se borrarán. Salen primero los que parecen de prueba (su nómina no está en el padrón). Solo se borra su perfil; sus asignaciones no se tocan. <b>Tú no puedes marcarte.</b>',
          '<b>Cuentas de Authentication</b>: la lista exacta de cuentas que tendrás que borrar después en la consola de Firebase, con un botón para copiar los correos.',
        ], img: 'administrador/18-fase1-usuarios' },
        { h: 'Paso 2: borrar' },
        { p: 'Solo después de revisar el inventario. El paso 2 está apagado hasta que escribas la palabra de confirmación.' },
        { pasos: [
          'El texto dice qué se borra y que el próximo folio será TE-AAAA-0001.',
          'Escribe <b>BORRAR</b> en el campo.',
          'Toca <b>Borrar y reiniciar el folio</b>. Se borra por lotes, con una barra de avance; <b>no cierres la pantalla</b> mientras trabaja.',
        ], img: 'administrador/19-fase2-confirmar' },
        { pasos: [
          'Al terminar dice «Limpieza terminada» y queda <b>un solo renglón</b> en la bitácora: «Limpieza para producción».',
          'La <b>lista de verificación</b> confirma: solicitudes restantes (deben ser 0), elegibles por área, usuarios sin asignación (con un enlace para asignarlos), turnos con horario cargado y motivos cargados.',
          '<b>Pendiente en la consola</b>: las cuentas de Authentication que debes borrar a mano.',
        ], img: 'administrador/20-fase2-listo' },
        { h: 'Después' },
        { lista: [
          'En la <b>consola de Firebase › Authentication</b>, busca y borra cada correo de la lista (si una ya no existe, sáltala).',
          'Revisa la lista de verificación: cualquier renglón con «Revisar» (por ejemplo, un usuario sin asignación) se corrige en Usuarios y accesos.',
          'Descarga otro <b>respaldo completo</b> y guárdalo: es el punto de partida limpio.',
          'Haz una prueba corta con una solicitud real y confirma que el folio empieza en 0001.',
        ] },
      ],
    },
    {
      id: 'diagnostico', titulo: 'Diagnóstico de colecciones y limpiar estructura vieja',
      bloques: [
        { h: 'Diagnóstico de colecciones' },
        { p: 'Cuenta los documentos de cada colección de la base de datos y busca <b>registros huérfanos</b> (por ejemplo, puntos de reunión cuya comunidad ya no existe, que por eso no aparecen al capturar). También puede migrar documentos antiguos.' },
        { pasos: [
          '<b>Contar documentos</b> actualiza los números.',
          'Cada cuadro dice una colección (áreas, rutas, comunidades, puntos de reunión, empleados, solicitudes, usuarios…) y cuántos documentos tiene.',
        ], img: 'administrador/06-diagnostico' },
        { nota: 'Si aparece «PuntosReunion» (con P mayúscula) con documentos, es una colección antigua: el botón <b>Migrar</b> los copia a la correcta, pero la colección vieja se borra a mano en la consola de Firebase. Si hay <b>huérfanos</b>, corrígelos en <b>Catálogos › Puntos de reunión</b>.' },
        { h: 'Limpiar estructura vieja' },
        { p: 'Quita del padrón dos campos que ya nada usa (<b>areaTE</b> y <b>areaTEManual</b>). Descarga un respaldo antes. Primero <b>Revisar el padrón</b> dice cuántos empleados los tienen; si hay, te pide escribir <b>LIMPIAR</b> para confirmar.' },
        { pasos: ['<b>Revisar el padrón</b>. Si dice «Ningún empleado tiene campos viejos», no hay nada que limpiar.'], img: 'administrador/07-limpiar-estructura' },
      ],
    },
    // ───────────────────────── CASOS ESPECIALES ─────────────────────────
    {
      id: 'problemas', titulo: 'Qué revisar si algo falla',
      bloques: [
        { p: 'Casi todo lo que reporta la gente se resuelve con estas preguntas. Revísalas en orden.' },
        { h: 'Alguien no puede entrar' },
        { lista: [
          'En <b>Usuarios y accesos › Usuarios</b>: ¿existe su usuario y está <b>Activo</b>? Si está desactivado, el ojo lo reactiva.',
          '¿Usa su <b>número de nómina</b> y no otro dato? ¿La contraseña es la temporal vigente? Si hay duda, <b>restablece</b> la contraseña (en persona) y entrega la nueva.',
          'Si el portal le pide crear una contraseña nueva, es normal con la temporal.',
        ] },
        { h: 'Alguien no ve una pantalla o un botón' },
        { lista: [
          'Mira su <b>rol del sistema</b> (Usuario, RH, Nóminas) y sus <b>asignaciones</b> (Aut. 2, Aut. 1, Solicitante) con su <b>vigencia</b>: una asignación <b>Vencida</b>, <b>Programada</b> o <b>Revocada</b> no da permisos.',
          'Usa la <b>vista previa por rol</b> con su combinación y compara con lo que dice ver.',
          'Una cuenta «Usuario» con solo Aut. 2 no ve nada de RH (el aviso «¿Esta persona también es de RH?» lo dice).',
          'Si ve un mensaje de «no tienes permiso», casi siempre es de rol o vigencia; revisa lo anterior.',
        ] },
        { h: 'Una solicitud no avanza' },
        { lista: [
          'En <b>Todas las solicitudes › Ver</b>: ¿en qué nivel está?',
          'En el <b>Organigrama</b>: si el área dice <b>Sin Autorización 1</b>, no puede avanzar. Asígnale uno en Asignaciones.',
          'Si pasó la fecha, está <b>Vencida</b>: solo Autorización 2 puede autorizarla fuera de tiempo.',
          'Si es de Administrativo y la capturó RH, la firma otro RH o un Aut. 2 (nadie firma lo que creó).',
        ] },
        { h: 'No aparecen empleados para capturar, o el Formato de rutas sale vacío' },
        { lista: [
          'Padrón: ¿el empleado está <b>activo</b>, con el puesto del área y <b>Elegible para tiempo extra</b>?',
          'Formato de rutas: solo lleva lo <b>confirmado</b> y a quienes <b>llevan transporte</b>. Confirma en Por enviar al proveedor.',
          'Un punto de reunión «huérfano» no aparece: usa <b>Contar documentos</b> y revisa Catálogos.',
        ] },
        { h: 'El portal muestra un error' },
        { p: 'Los errores traen un botón <b>Ver detalle</b>: ábrelo, copia el texto y guárdalo junto con el folio o la pantalla donde pasó. Es lo que se necesita para revisar la causa. Si es un problema de conexión, basta con recargar la página.' },
        { h: 'Algo se borró o se cambió por error' },
        { lista: [
          'Todo cambio importante queda en la <b>bitácora</b> con nombre y fecha; en una solicitud, en su <b>historial</b>.',
          'Para recuperar datos, usa el <b>respaldo completo</b> más reciente (con ayuda de quien administra la plataforma).',
          'Una semana firmada en Nóminas se reabre desde la revisión del área (RH o tú).',
        ] },
      ],
    },
    {
      id: 'casos', titulo: 'Casos especiales',
      bloques: [
        { h: 'Alguien dejó la empresa' },
        { p: 'Desactívalo en <b>Usuarios</b> (el ojo) para que ya no entre, revoca sus asignaciones y, en el <b>Padrón</b>, dalo de baja. Conserva su historial: las solicitudes pasadas guardan su nombre.' },
        { h: 'Cambió el jefe de un área' },
        { p: 'En <b>Asignaciones</b>, revoca (o deja vencer) la Autorización 1 anterior y asigna la nueva. Para suplencias, usa fechas de inicio y fin. Revisa el <b>Organigrama</b> al terminar.' },
        { h: 'Necesito entrar como otra persona para probar' },
        { p: 'No existe «entrar como». Usa la <b>vista previa por rol</b> para ver menú y pantallas, y la cuenta de prueba de cada rol para probar de verdad. Nunca pidas la contraseña de otra persona.' },
        { h: 'Me equivoqué al correr «Preparar para producción»' },
        { p: 'El respaldo del paso 1 contiene todo lo borrado. No hay botón para restaurarlo desde el portal: avisa a quien administra la plataforma <b>de inmediato</b> y no uses el portal hasta resolverlo.' },
        { h: 'Perdí mi acceso de administrador' },
        { p: 'Otro administrador puede restablecer tu contraseña. Si eres el único, la recuperación se hace desde la consola de Firebase, con quien administra la plataforma.' },
        { h: 'El proveedor no recibió a alguien' },
        { p: 'La aplicación no avisa al proveedor por sí sola. Revisa, en este orden: que la solicitud estaba <b>confirmada</b>; que la persona llevaba transporte con ruta, comunidad y punto; que sale en el <b>Formato de rutas del día correcto</b> (lo que cruza la medianoche va al día siguiente); que su teléfono está en el padrón; y que el archivo se mandó <b>después</b> de confirmar. Los pasos están en el manual de Recursos Humanos.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['¿Puedo hacer todo lo que hacen los demás roles?', 'Sí. Tienes todos los permisos de todos los roles. Lo que hagas queda con tu nombre en el historial y la bitácora.'],
          ['¿Con qué frecuencia respaldo?', 'Cada semana, y siempre antes de importar, cargar elegibles o preparar para producción.'],
          ['¿Se puede restaurar un respaldo desde el portal?', 'No. El archivo sirve para recuperar datos con ayuda de quien administra la plataforma.'],
          ['¿Puedo borrar una solicitud de tiempo extra?', 'No hay botón en la pantalla. Se cancela (con motivo) y queda en el historial.'],
          ['¿Quién puede dar Autorización 2?', 'Solo un administrador.'],
          ['¿Puedo restablecer mi propia contraseña desde Usuarios?', 'No. Usa Mi cuenta › Cambiar mi contraseña.'],
          ['¿Cuántas veces se corre «Preparar para producción»?', 'Una sola vez, el día anterior al arranque.'],
          ['¿Quién borra las cuentas de Authentication?', 'Tú, a mano, en la consola de Firebase. El portal solo te da la lista.'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; lo ya hecho no se pierde.'],
        ] },
      ],
    },
    {
      id: 'estatus', titulo: 'Qué significa cada estatus',
      bloques: [
        { p: 'Los estatus del tiempo extra, y qué se hace con cada uno (tú puedes hacer lo de cualquier rol):' },
        { tabla: 'estatus', rol: 'administrador' },
      ],
    },
  ],
};
