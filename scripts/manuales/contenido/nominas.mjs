// Contenido del manual de NÓMINAS. Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
export default {
  rol: 'Nóminas',
  archivo: 'nominas',
  quien: 'Para quien prepara cada semana el formato de autorización de tiempo extra por área: lo revisa, lo ajusta, lo firma y lo descarga.',
  guia: {
    titulo: 'Guía rápida · Nóminas',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Semana', 'Toca <b>Formato de tiempo extra</b>. Elige la semana con las flechas ‹ ›.'],
      ['Área', 'Toca <b>Revisar</b> en el área. Se abre la hoja con las horas de cada día.'],
      ['Corrige', 'Escribe las horas en la celda. <b>Quitar</b>, <b>Agregar empleado</b> o reemplazar: el motivo se pide en el momento.'],
      ['Guarda', 'Toca <b>Guardar cambios</b>. Si hay cambios de horas, pide un motivo general.'],
      ['Firma', 'Toca <b>Marcar como firmada</b>: el área queda bloqueada.'],
      ['Descarga', 'Toca <b>Descargar</b> para el Excel de esa área (o <b>Descargar todas</b> en la semana).'],
    ],
    recuerda: [
      'Solo entra al formato lo <b>autorizado</b>. Lo pendiente o vencido no cuenta; si alguien trabajó, agrégalo a mano.',
      'Nada de lo que cambies altera las solicitudes: son ajustes <b>del formato</b>, con su motivo y su bitácora.',
      'Con cambios sin guardar, <b>no puedes firmar ni descargar</b>: guarda primero.',
      'Una área <b>firmada</b> solo la reabre Recursos Humanos.',
    ],
    contacto: 'Dudas del formato: <b>Recursos Humanos</b> · Contraseña o fallas: <b>Sistemas</b> (en persona, con tu identificación)',
  },
  secciones: [
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir tiempo extra y transporte. <b>Nóminas</b> usa lo que ya quedó autorizado para armar, cada semana y por área, el <b>formato de autorización de tiempo extra</b> que se firma y se manda a pago.' },
        { lista: [
          'El formato muestra, por empleado, las <b>horas de cada día</b> de la semana, su motivo y su P.O. o TB.',
          'Sale de las solicitudes <b>autorizadas</b>. Tú lo revisas y, si hace falta, lo corriges.',
          'Cuando está bien, lo <b>firmas</b> (queda bloqueado) y lo descargas en Excel.',
        ] },
        { nota: 'Tus cambios son <b>ajustes del formato</b>: no modifican las solicitudes. Cada cambio lleva su motivo y queda en la bitácora.' },
        { aviso: 'Nóminas no autoriza, devuelve ni cancela solicitudes. Solo ve el tiempo extra de toda la planta, confirma lo que va al proveedor y trabaja el formato.' },
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
          'Si no la recuerdas, toca <b>¿Olvidaste tu contraseña?</b>. Solo se restablece en persona con Sistemas o Recursos Humanos.',
        ], img: 'solicitante/01-entrar' },
        { h: 'Tu pantalla de inicio' },
        { pasos: [
          'En el menú, bajo <b>Reportes de nómina</b>, está <b>Formato de tiempo extra</b>: tu pantalla principal.',
          'El inicio resume el tiempo extra de la planta.',
        ], img: 'nominas/01-inicio' },
        { nota: 'En el pie del menú están <b>Ayuda y manuales</b> (este manual y su guía rápida en PDF) y <b>Cerrar sesión</b>.' },
      ],
    },
    {
      id: 'semana', titulo: 'Elegir la semana',
      bloques: [
        { p: 'Al entrar a <b>Formato de tiempo extra</b> se abre la <b>última semana completa</b>. Cada área con tiempo extra aparece con su estado: <b>Sin revisar</b>, <b>Ajustada</b> o <b>Firmada</b>.' },
        { pasos: [
          'Las flechas cambian de semana. Para la semana en curso, toca <b>Semana siguiente</b>.',
          '<b>Revisar</b> abre la hoja de esa área.',
          '<b>Descargar todas</b> baja el Excel de todas las áreas con tiempo extra, con una hoja de resumen.',
        ], img: 'nominas/02-semana' },
        { nota: 'Arriba de las áreas, el portal te avisa si hay solicitudes de esa semana <b>sin autorizar</b> (no entran al formato; puedes firmar sin ellas) o <b>vencidas</b> (no cuentan; si alguien trabajó de todos modos, agrégalo a mano).' },
      ],
    },
    {
      id: 'revisar', titulo: 'Revisar y corregir un área',
      bloques: [
        { p: 'La hoja se parece a Excel: una fila por empleado y una columna por día. Todo lo que ves viene de lo autorizado.' },
        { pasos: [
          'Cada columna es un día de la semana, con su fecha.',
          'Cada celda trae las horas autorizadas de ese empleado ese día. Se escribe directo (acepta medios y cuartos: 0.5, 7.25).',
          '<b>Agregar empleado</b> mete a alguien que no venía en las solicitudes.',
          '<b>Descargar</b> baja el Excel del área.',
        ], img: 'nominas/03-revisar-area' },
        { h: 'Corregir horas' },
        { pasos: [
          'Escribe las horas en la celda y pulsa Tab, Enter o una flecha. La celda cambiada se pinta de otro color.',
          'Arriba o abajo ves cuántos <b>cambios sin guardar</b> llevas.',
          'Toca <b>Guardar cambios</b> cuando termines.',
        ], img: 'nominas/04-horas' },
        { nota: 'Para volver a lo autorizado en un renglón, usa el menú ⋯ de la fila › <b>Restaurar lo autorizado</b>.' },
      ],
    },
    {
      id: 'quitar-agregar', titulo: 'Quitar, agregar o reemplazar',
      bloques: [
        { h: 'Quitar a alguien que no asistió' },
        { pasos: ['En el menú ⋯ de la fila, toca <b>Quitar (no asistió)</b>.'], img: 'nominas/05-menu-renglon', ancho: 'chico' },
        { pasos: [
          'Escribe el <b>motivo</b> (por ejemplo, «No asistió»). Se pide en el momento.',
          'Toca <b>Quitar</b>.',
        ], img: 'nominas/06-quitar-motivo', ancho: 'chico' },
        { p: 'La fila queda tachada y ya no cuenta en el total. Con <b>Restaurar lo autorizado</b> puedes regresarla.' },
        { h: 'Agregar a alguien que no venía' },
        { pasos: [
          'Toca <b>Agregar empleado</b> y busca a la persona por nómina o nombre.',
          'Elige el <b>motivo</b> del tiempo extra y escribe el <b>motivo del ajuste</b> (por qué se agrega).',
          'Toca <b>Agregar al formato</b>.',
        ], img: 'nominas/07-agregar' },
        { pasos: ['La fila nueva se resalta unos segundos y el cursor queda en su primera celda de horas: <b>captura sus horas</b>.'], img: 'nominas/08-agregado', ancho: 'chico' },
        { aviso: 'Un empleado agregado <b>no crea solicitudes</b>: solo entra al formato de esa área. Si no está en el padrón, puedes capturarlo a mano; queda marcado como «fuera del padrón».' },
        { p: 'También puedes <b>reemplazar</b> a alguien por otra persona (sus horas pasan a quien elijas) o <b>cambiar el motivo y el P.O./TB</b> de un renglón, desde el mismo menú ⋯.' },
      ],
    },
    {
      id: 'guardar-firmar', titulo: 'Guardar, firmar y descargar',
      bloques: [
        { h: 'Guardar' },
        { pasos: [
          'Toca <b>Guardar cambios</b>.',
          'Si hay cambios de horas, reemplazos o de motivo, escribe el <b>motivo del ajuste</b> (de 3 a 120 letras): se aplica a todos y queda en la bitácora. Lo que agregaste o quitaste ya trae el suyo.',
          'Confirma.',
        ], img: 'nominas/09-guardar' },
        { aviso: 'Con cambios sin guardar, <b>Marcar como firmada</b> y <b>Descargar</b> están apagados: guarda primero.' },
        { h: 'Firmar' },
        { pasos: [
          '<b>Marcar como firmada</b> cierra el área: queda bloqueada.',
          '<b>Descargar</b> baja el Excel con lo ya guardado.',
        ], img: 'nominas/10-firmar' },
        { pasos: ['Confirma la firma.'], img: 'nominas/11-firmar-confirmar', ancho: 'chico' },
        { pasos: ['El aviso dice que el área ya está firmada. Desde ese momento <b>nadie la cambia</b>: solo Recursos Humanos puede reabrirla.'], img: 'nominas/12-firmada' },
        { nota: 'Al descargar, el portal te dice qué archivo bajó. Ábrelo desde el ícono de descargas del navegador o en la carpeta Descargas de tu computadora.' },
      ],
    },
    {
      id: 'consultar', titulo: 'Consultar el tiempo extra de la planta',
      bloques: [
        { pasos: ['<b>Tiempo extra</b> muestra todas las solicitudes (sin los borradores) con filtros por área, estatus, fechas, turno y motivo, y deja descargar el resumen en Excel. Es de solo lectura.'], img: 'nominas/13-tiempo-extra' },
        { p: 'También ves <b>Solicitudes de transporte</b> y el <b>Formato de rutas</b> (solo ver y descargar), <b>Personal</b> (con teléfono) y <b>Por enviar al proveedor</b>, donde puedes confirmar lo autorizado.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['Mi semana sale vacía.', 'Al entrar se abre la última semana completa. Para la semana en curso toca la flecha «Semana siguiente». Si aun así no hay nada, no hay tiempo extra autorizado esa semana.'],
          ['Faltan solicitudes en el formato.', 'Solo entra lo autorizado. Mira el aviso de arriba: pendientes y devueltas no cuentan hasta que se autoricen; las vencidas no cuentan nunca (agrega a mano a quien sí trabajó).'],
          ['Firmé un área y quedó mal.', 'Pide a Recursos Humanos que la reabra; luego corriges y vuelves a firmar.'],
          ['No puedo firmar ni descargar.', 'Tienes cambios sin guardar. Toca Guardar cambios primero.'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Tus cambios sin guardar se pierden: guarda seguido.'],
        ] },
      ],
    },
  ],
};
