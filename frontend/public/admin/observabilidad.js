/*
 * Dashboard de observabilidad del operador (Atracciones Web).
 * Lee los datos con window.AtraccionesObservability.getSnapshot() (definida en /admin/script.js)
 * y los muestra animados: números que cuentan, columnas por minuto, medidores de velocidad
 * y un registro donde las filas nuevas se iluminan.
 * Sin dependencias; degrada con cuidado si falta alguna API del navegador.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var obs = global.AtraccionesObservability;
  var LLAVE_SESION = 'atracciones.sesion'; // la misma que usa la app React (src/auth.tsx)
  var INTERVALO_MS = 2000;
  var MAX_FILAS = 150;
  var MINUTOS = 30;
  var menosMovimiento = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var NOMBRES = {
    'page-view': 'Página abierta',
    route: 'Cambio de pantalla',
    performance: 'Medición de velocidad',
    interaction: 'Clic o interacción',
    visibility: 'Cambio de pestaña',
    'js-error': 'Error de JavaScript',
    'unhandled-rejection': 'Promesa rechazada',
    'resource-error': 'Archivo que no cargó'
  };
  var ERRORES = { 'js-error': true, 'unhandled-rejection': true, 'resource-error': true };

  // Umbrales de Google Web Vitals (web.dev) en milisegundos: [bueno hasta, lento desde]
  var METRICAS = [
    { clave: 'ttfbMs', nombre: 'Respuesta del servidor', sigla: 'TTFB', que: 'Cuánto tardó el servidor en empezar a responder', umbral: [800, 1800] },
    { clave: 'firstContentfulPaintMs', nombre: 'Primer contenido en pantalla', sigla: 'FCP', que: 'Cuándo apareció lo primero que se ve', umbral: [1800, 3000] },
    { clave: 'largestContentfulPaintMs', nombre: 'Contenido principal visible', sigla: 'LCP', que: 'Cuándo apareció lo más grande, como la foto principal', umbral: [2500, 4000] },
    { clave: 'loadMs', nombre: 'Carga completa', sigla: 'load', que: 'Cuándo terminó de cargar todo, incluidas las imágenes', umbral: [3000, 6000] }
  ];
  var CALIFICACION = {
    bien: { icono: '✓', texto: 'Rápido' },
    regular: { icono: '!', texto: 'Aceptable' },
    mal: { icono: '✕', texto: 'Lento' },
    na: { icono: '–', texto: 'Sin dato' }
  };

  var filtroActual = 'todos';
  var idsVistos = null; // ids de eventos ya dibujados (para iluminar solo los nuevos)
  var ultimaFirma = '';
  var temporizador = null;

  function $(id) {
    return doc.getElementById(id);
  }

  function texto(el, valor) {
    if (el) el.textContent = valor;
  }

  function nombreTipo(t) {
    return NOMBRES[t] || t;
  }

  function seg(ms) {
    return typeof ms === 'number' ? (ms / 1000).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' s' : 'No disponible';
  }

  function hora(iso, conSegundos) {
    try {
      var o = { hour: '2-digit', minute: '2-digit' };
      if (conSegundos !== false) o.second = '2-digit';
      return new Date(iso).toLocaleTimeString('es-EC', o);
    } catch (e) {
      return String(iso);
    }
  }

  function crear(tag, clase, contenido) {
    var el = doc.createElement(tag);
    if (clase) el.className = clase;
    if (contenido != null) el.textContent = contenido;
    return el;
  }

  // ------------------------------------------------------------------ acceso
  /** Solo el operador ve el tablero. Es un control de interfaz: los datos viven en este navegador. */
  function esOperador() {
    try {
      var s = JSON.parse(global.sessionStorage.getItem(LLAVE_SESION) || 'null');
      return !!(s && s.usuario && s.usuario.role === 'OPERADOR' && s.vence > Date.now());
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------ números animados
  /** Cuenta desde el valor actual hasta el nuevo; ilumina la tarjeta si subió */
  function contar(el, nuevo, formato) {
    if (!el) return;
    var anterior = Number(el.getAttribute('data-valor') || 0);
    el.setAttribute('data-valor', String(nuevo));
    var fmt = formato || function (n) {
      return Math.round(n).toLocaleString('es-EC');
    };
    if (nuevo > anterior && el.closest) {
      var tarjeta = el.closest('.kpi');
      if (tarjeta && el.getAttribute('data-listo')) {
        tarjeta.classList.remove('subio');
        void tarjeta.offsetWidth; // reinicia la animación
        tarjeta.classList.add('subio');
      }
    }
    el.setAttribute('data-listo', '1');
    if (menosMovimiento || typeof global.requestAnimationFrame !== 'function' || anterior === nuevo) {
      el.textContent = fmt(nuevo);
      return;
    }
    var inicio = null;
    var duracion = 650;
    function paso(t) {
      if (inicio === null) inicio = t;
      var p = Math.min((t - inicio) / duracion, 1);
      var suave = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(anterior + (nuevo - anterior) * suave);
      if (p < 1) global.requestAnimationFrame(paso);
    }
    global.requestAnimationFrame(paso);
  }

  // ------------------------------------------------------------------ 1. KPIs
  function pintarKpis(s) {
    var t = s.totals.byType;
    contar($('k-eventos'), s.totals.events);
    contar($('k-errores'), s.totals.errors);
    $('k-errores').classList.toggle('alerta', s.totals.errors > 0);
    contar($('k-clics'), t.interaction || 0);
    contar($('k-vistas'), (t['page-view'] || 0) + (t.route || 0));
    contar($('k-visibilidad'), t.visibility || 0);
    var p = s.performance.latest;
    if (p && typeof p.loadMs === 'number') {
      contar($('k-carga'), p.loadMs / 1000, function (n) {
        return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' s';
      });
    } else {
      texto($('k-carga'), 'Sin dato');
    }
    $('kpis').setAttribute('aria-busy', 'false');
  }

  // ------------------------------------------------------------------ 2. actividad por minuto
  var columnas = [];

  function prepararColumnas() {
    var cont = $('columnas');
    cont.textContent = '';
    columnas = [];
    for (var i = 0; i < MINUTOS; i++) {
      var col = crear('div', 'columna');
      col.setAttribute('role', 'listitem');
      col.setAttribute('aria-describedby', 'tooltip'); // B2: enlaza la columna con el tooltip que describe
      col.tabIndex = 0;
      var normal = crear('span', 'seg seg--normal');
      var error = crear('span', 'seg seg--error');
      col.appendChild(normal); // column-reverse: el primero queda abajo
      col.appendChild(error);
      if (i === MINUTOS - 1) col.classList.add('actual');
      col.addEventListener('mouseenter', mostrarTooltip);
      col.addEventListener('focus', mostrarTooltip);
      col.addEventListener('mouseleave', ocultarTooltip);
      col.addEventListener('blur', ocultarTooltip);
      // M1: en pantallas táctiles no hay mouseenter; click/pointerup da una vía de activación equivalente
      col.addEventListener('click', mostrarTooltip);
      cont.appendChild(col);
      columnas.push({ el: col, normal: normal, error: error, datos: null });
    }
  }

  function techoBonito(n) {
    if (n <= 3) return 3;
    var paso = Math.ceil(n / 3);
    var mag = Math.pow(10, Math.floor(Math.log(paso) / Math.LN10));
    var lindo = [1, 2, 5, 10].map(function (m) {
      return m * mag;
    }).filter(function (v) {
      return v >= paso;
    })[0];
    return lindo * 3;
  }

  function pintarActividad(s) {
    var ahora = Date.now();
    var finMinuto = Math.floor(ahora / 60000) * 60000 + 60000;
    var inicio = finMinuto - MINUTOS * 60000;
    var cubetas = [];
    for (var i = 0; i < MINUTOS; i++) cubetas.push({ desde: inicio + i * 60000, total: 0, errores: 0 });
    s.events.forEach(function (e) {
      var t = Date.parse(e.time);
      if (!(t >= inicio && t < finMinuto)) return;
      var c = cubetas[Math.floor((t - inicio) / 60000)];
      c.total++;
      if (ERRORES[e.type]) c.errores++;
    });
    var maximo = techoBonito(Math.max.apply(null, cubetas.map(function (c) { return c.total; })));

    // eje Y: 0, 1/3, 2/3 y máximo
    var eje = $('eje-y');
    eje.textContent = '';
    [0, 1, 2, 3].forEach(function (k) {
      var lbl = crear('span', null, String(Math.round((maximo * k) / 3)));
      lbl.style.bottom = (k * 100) / 3 + '%';
      eje.appendChild(lbl);
    });

    var tabla = $('tabla-actividad');
    tabla.textContent = '';
    cubetas.forEach(function (c, i) {
      var col = columnas[i];
      var normales = c.total - c.errores;
      col.datos = c;
      col.normal.style.height = (normales / maximo) * 100 + '%';
      col.error.style.height = (c.errores / maximo) * 100 + '%';
      col.normal.classList.toggle('tope', c.errores === 0);
      col.el.setAttribute(
        'aria-label',
        hora(new Date(c.desde).toISOString(), false) + ': ' + c.total + (c.total === 1 ? ' evento' : ' eventos') + (c.errores ? ', ' + c.errores + (c.errores === 1 ? ' error' : ' errores') : '')
      );
      if (c.total > 0) {
        var tr = doc.createElement('tr');
        tr.appendChild(crear('td', null, hora(new Date(c.desde).toISOString(), false)));
        tr.appendChild(crear('td', null, String(c.total)));
        tr.appendChild(crear('td', null, String(c.errores)));
        tabla.appendChild(tr);
      }
    });
    if (!tabla.children.length) {
      var vacia = doc.createElement('tr');
      var td = crear('td', null, 'Sin actividad en los últimos 30 minutos.');
      td.colSpan = 3;
      vacia.appendChild(td);
      tabla.appendChild(vacia);
    }
  }

  function mostrarTooltip(e) {
    var col = columnas.filter(function (c) {
      return c.el === e.currentTarget;
    })[0];
    if (!col || !col.datos) return;
    var tip = $('tooltip');
    var c = col.datos;
    tip.textContent = '';
    tip.appendChild(crear('strong', null, 'Minuto ' + hora(new Date(c.desde).toISOString(), false)));
    tip.appendChild(crear('span', null, c.total + (c.total === 1 ? ' evento' : ' eventos') + (c.errores ? ', ' + c.errores + (c.errores === 1 ? ' error' : ' errores') : ', sin errores')));
    var caja = $('grafico-actividad').getBoundingClientRect();
    var r = col.el.getBoundingClientRect();
    var alto = col.normal.getBoundingClientRect().height + col.error.getBoundingClientRect().height;
    var x = r.left - caja.left + r.width / 2;
    tip.style.left = Math.min(Math.max(x, 80), caja.width - 80) + 'px';
    tip.style.top = Math.max(r.bottom - caja.top - alto, 40) + 'px';
    tip.hidden = false;
  }

  function ocultarTooltip() {
    $('tooltip').hidden = true;
  }

  // ------------------------------------------------------------------ 3. velocidad (semáforo + medidores)
  function calificar(valor, umbral) {
    if (typeof valor !== 'number') return 'na';
    if (valor <= umbral[0]) return 'bien';
    if (valor <= umbral[1]) return 'regular';
    return 'mal';
  }

  var medidores = {};

  function pintarSalud(s) {
    var p = s.performance.latest || {};
    var lista = $('medidores');
    var peor = 'na';
    var orden = { na: 0, bien: 1, regular: 2, mal: 3 };

    METRICAS.forEach(function (m) {
      var valor = typeof p[m.clave] === 'number' ? p[m.clave] : null;
      var cal = calificar(valor, m.umbral);
      if (orden[cal] > orden[peor]) peor = cal;
      var maximo = m.umbral[1] * 1.5;
      var ref = medidores[m.clave];
      if (!ref) {
        var li = crear('li', 'medidor');
        var fila = crear('div', 'medidor-fila');
        var nombre = crear('span', 'medidor-nombre', m.nombre + ' (' + m.sigla + ')');
        nombre.appendChild(crear('span', 'medidor-que', m.que));
        var derecha = crear('span', 'medidor-valor');
        var val = crear('span', null, '');
        var chip = crear('span', 'calificacion');
        derecha.appendChild(val);
        derecha.appendChild(chip);
        fila.appendChild(nombre);
        fila.appendChild(derecha);
        var pista = crear('div', 'pista');
        pista.setAttribute('aria-hidden', 'true');
        var z1 = crear('span', 'zona zona--bien');
        var z2 = crear('span', 'zona zona--regular');
        var z3 = crear('span', 'zona zona--mal');
        z1.style.width = (m.umbral[0] / maximo) * 100 + '%';
        z2.style.width = ((m.umbral[1] - m.umbral[0]) / maximo) * 100 + '%';
        z3.style.width = ((maximo - m.umbral[1]) / maximo) * 100 + '%';
        var aguja = crear('span', 'aguja');
        pista.appendChild(z1);
        pista.appendChild(z2);
        pista.appendChild(z3);
        pista.appendChild(aguja);
        li.appendChild(fila);
        li.appendChild(pista);
        lista.appendChild(li);
        ref = medidores[m.clave] = { val: val, chip: chip, aguja: aguja };
      }
      ref.val.textContent = seg(valor);
      ref.chip.className = 'calificacion ' + cal;
      ref.chip.textContent = CALIFICACION[cal].icono + ' ' + CALIFICACION[cal].texto;
      ref.aguja.style.display = valor === null ? 'none' : '';
      ref.aguja.style.left = valor === null ? '0%' : Math.min(valor / maximo, 1) * 100 + '%';
    });

    // Semáforo general: la peor medición, y si hay errores al menos "regular"
    var estado = peor;
    if (s.totals.errors > 0 && orden[estado] < orden.regular) estado = 'regular';
    var sem = $('semaforo');
    sem.className = 'semaforo ' + (estado === 'na' ? '' : estado);
    var titulos = {
      na: ['Sin datos todavía', 'Abre la página principal y espera a que cargue para medir su velocidad.'],
      bien: ['Todo bien', 'La página carga rápido y no hay errores.'],
      regular: ['Se puede mejorar', s.totals.errors > 0 ? 'Carga bien, pero hay ' + s.totals.errors + (s.totals.errors === 1 ? ' error' : ' errores') + ' registrados. Revísalos en el registro.' : 'Alguna medición está en la zona amarilla.'],
      mal: ['Hay problemas', 'Alguna medición está en la zona roja: la página tarda demasiado.']
    };
    texto($('semaforo-icono'), CALIFICACION[estado].icono);
    texto($('semaforo-titulo'), titulos[estado][0]);
    texto($('semaforo-texto'), titulos[estado][1]);
  }

  // ------------------------------------------------------------------ 4. eventos por tipo
  var barras = {};

  function pintarTipos(s) {
    var ul = $('por-tipo');
    var tipos = Object.keys(s.totals.byType).sort(function (a, b) {
      return s.totals.byType[b] - s.totals.byType[a];
    });
    if (!tipos.length) {
      ul.textContent = '';
      barras = {};
      ul.appendChild(crear('li', 'nota', 'Todavía no hay eventos.'));
      return;
    }
    var vacio = ul.querySelector('.nota');
    if (vacio) vacio.remove();
    var max = s.totals.byType[tipos[0]];
    Object.keys(barras).forEach(function (t) {
      if (!s.totals.byType[t]) {
        barras[t].li.remove();
        delete barras[t];
      }
    });
    tipos.forEach(function (t) {
      var n = s.totals.byType[t];
      var b = barras[t];
      if (!b) {
        var li = crear('li');
        var boton = crear('button', 'barra-boton');
        boton.type = 'button';
        boton.addEventListener('click', function () {
          verTipo(t);
        });
        var nombre = crear('span', null, nombreTipo(t));
        if (ERRORES[t]) nombre.appendChild(crear('span', 'etiqueta-error', 'error'));
        var fondo = crear('span', 'barra-fondo');
        fondo.setAttribute('aria-hidden', 'true');
        var relleno = crear('span', 'barra-relleno' + (ERRORES[t] ? ' error' : ''));
        fondo.appendChild(relleno);
        var cant = crear('span', 'cantidad');
        boton.appendChild(nombre);
        boton.appendChild(fondo);
        boton.appendChild(cant);
        li.appendChild(boton);
        b = barras[t] = { li: li, boton: boton, relleno: relleno, cant: cant };
      }
      ul.appendChild(b.li); // reordena según la cantidad
      b.cant.textContent = String(n);
      b.boton.setAttribute('aria-label', 'Ver ' + n + ' eventos de tipo ' + nombreTipo(t) + ' en el registro');
      b.boton.setAttribute('aria-pressed', filtroActual === t ? 'true' : 'false');
      var ancho = Math.max((n / max) * 100, 2) + '%';
      // El ancho se aplica en el siguiente cuadro para que la barra "crezca"
      if (global.requestAnimationFrame) {
        global.requestAnimationFrame(function () {
          b.relleno.style.width = ancho;
        });
      } else {
        b.relleno.style.width = ancho;
      }
    });
  }

  // ------------------------------------------------------------------ 5. entorno
  function pintarEntorno(s) {
    var e = s.environment || {};
    var v = e.viewport || {};
    var c = e.connection;
    var datos = [
      ['Pantalla', v.width ? v.width + ' × ' + v.height + ' px' : 'No disponible', 'Densidad de píxeles: ' + (v.devicePixelRatio || 1)],
      ['Internet', c ? (c.effectiveType || 'desconocida').toUpperCase() : 'Sin información', c ? (c.downlinkMbps != null ? c.downlinkMbps + ' Mbps' : '') + (c.rttMs != null ? ', latencia ' + c.rttMs + ' ms' : '') : 'Este navegador no lo informa'],
      ['Conexión', e.online == null ? 'No disponible' : e.online ? 'En línea' : 'Sin conexión', c && c.saveData ? 'Ahorro de datos activado' : ''],
      ['Idioma', e.language || 'No disponible', ''],
      ['Almacenamiento', s.storage.indexOf('localStorage') === 0 ? 'localStorage' : 'Memoria', s.storage.indexOf('localStorage') === 0 ? 'Los datos se conservan al recargar' : 'Se pierden al cerrar la página'],
      ['Sesión de registro', s.session ? s.session.id : '–', s.session && s.session.startedAt ? 'Desde ' + new Date(s.session.startedAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '']
    ];
    var cont = $('entorno');
    cont.textContent = '';
    datos.forEach(function (d) {
      var card = crear('div', 'dato-entorno');
      card.appendChild(crear('p', 'titulo', d[0]));
      card.appendChild(crear('p', 'valor', d[1]));
      if (d[2]) card.appendChild(crear('p', 'extra', d[2]));
      cont.appendChild(card);
    });
    var nombres = {
      localStorage: 'localStorage',
      performance: 'Performance',
      performanceObserver: 'PerformanceObserver',
      navigationTiming: 'Navigation Timing',
      fetch: 'Fetch',
      intersectionObserver: 'IntersectionObserver',
      serviceWorker: 'Service Worker',
      networkInformation: 'Network Information',
      sendBeacon: 'sendBeacon',
      clipboard: 'Portapapeles',
      visibility: 'Page Visibility',
      blobDownload: 'Descarga de archivos'
    };
    var sop = e.supports || {};
    var ul = $('apis');
    ul.textContent = '';
    Object.keys(nombres).forEach(function (k) {
      var li = crear('li', sop[k] ? 'si' : 'no', (sop[k] ? '✓ ' : '✕ ') + nombres[k]);
      li.setAttribute('aria-label', nombres[k] + (sop[k] ? ': disponible' : ': no disponible'));
      ul.appendChild(li);
    });
  }

  // ------------------------------------------------------------------ 6. registro
  function detalle(evt) {
    var d = evt.data || {};
    switch (evt.type) {
      case 'interaction':
        return (d.action === 'change' ? 'Cambió ' : 'Tocó ') + (d.element === 'a' ? 'el enlace' : d.element === 'button' ? 'el botón' : d.element) + (d.label ? ' “' + d.label + '”' : '') + (d.href ? ' (va a ' + d.href + ')' : '');
      case 'js-error':
        if (d.crossOrigin) return 'Error en un script de otro sitio (por ejemplo, una extensión del navegador); el navegador oculta el detalle por seguridad.';
        return (d.message || 'Sin mensaje') + (d.source ? ' (' + d.source + (d.line ? ', línea ' + d.line : '') + ')' : '');
      case 'unhandled-rejection':
        return d.message || 'Una operación asíncrona falló sin ser manejada';
      case 'resource-error':
        return 'No cargó ' + ({ img: 'la imagen', script: 'el script', link: 'el estilo' }[d.element] || d.element) + ': ' + d.url;
      case 'visibility':
        return d.state === 'hidden' ? 'Se fue a otra pestaña' + (d.visibleForMs != null ? ' tras ' + Math.round(d.visibleForMs / 1000) + ' s mirando la página' : '') : 'Volvió a la pestaña';
      case 'performance':
        return d.available === false ? 'Este navegador no permite medir la velocidad' : 'La página cargó en ' + seg(d.loadMs) + ' (el servidor respondió en ' + seg(d.ttfbMs) + ')';
      case 'route':
        return d.view === 'atraccion' ? 'Abrió el detalle de una atracción' : 'Abrió ' + d.view;
      case 'page-view':
        return 'Cargó la página “' + (d.title || 'sin título') + '”';
      default:
        try {
          return JSON.stringify(d);
        } catch (e) {
          return '';
        }
    }
  }

  function pintarFiltros(s) {
    var cont = $('filtros');
    var tipos = Object.keys(s.totals.byType).sort();
    if (filtroActual !== 'todos' && tipos.indexOf(filtroActual) < 0) filtroActual = 'todos';
    var opciones = [['todos', 'Todos (' + s.totals.events + ')']].concat(
      tipos.map(function (t) {
        return [t, nombreTipo(t) + ' (' + s.totals.byType[t] + ')'];
      })
    );
    cont.textContent = '';
    opciones.forEach(function (o) {
      var b = crear('button', 'chip', o[1]);
      b.type = 'button';
      // #filtros es role="radiogroup" (selección única): se anuncia como radio, no como botón suelto
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', filtroActual === o[0] ? 'true' : 'false');
      b.addEventListener('click', function () {
        filtroActual = o[0];
        var snap = obs.getSnapshot();
        pintarFiltros(snap);
        pintarTipos(snap);
        pintarRegistro(snap, false);
      });
      cont.appendChild(b);
    });
  }

  function filaEvento(evt) {
    var tr = doc.createElement('tr');
    var c1 = doc.createElement('td');
    c1.setAttribute('data-label', 'Hora'); // etiqueta visible en móvil (A1); el thead se oculta ahí
    var t = crear('time', null, hora(evt.time));
    t.dateTime = evt.time;
    c1.appendChild(t);
    var c2 = doc.createElement('td');
    c2.setAttribute('data-label', 'Tipo');
    c2.appendChild(crear('span', 'etiqueta' + (ERRORES[evt.type] ? ' error' : ''), nombreTipo(evt.type)));
    tr.appendChild(c1);
    tr.appendChild(c2);
    var c3 = crear('td', null, evt.page || '/');
    c3.setAttribute('data-label', 'Página');
    tr.appendChild(c3);
    var c4 = crear('td', null, detalle(evt)); // textContent: nunca se interpreta como HTML
    c4.setAttribute('data-label', 'Qué pasó');
    tr.appendChild(c4);
    tr.setAttribute('data-id', evt.id);
    return tr;
  }

  var filtroDibujado = null;

  /**
   * Dibuja el registro. Si solo llegaron eventos nuevos (mismo filtro), los agrega arriba
   * con una animación en vez de redibujar toda la tabla.
   */
  function pintarRegistro(s, resaltar) {
    var lista = s.events.filter(function (e) {
      return filtroActual === 'todos' || e.type === filtroActual;
    });
    var visibles = lista.slice(-MAX_FILAS).reverse();
    var tbody = $('registro');
    var incremental = resaltar && idsVistos !== null && filtroDibujado === filtroActual && tbody.querySelector('tr[data-id]');

    if (incremental) {
      var nuevos = visibles.filter(function (e) {
        return !idsVistos[e.id];
      });
      // El primer evento ya conocido debe ser la fila de arriba; si no, algo cambió (se limpió) y se redibuja todo
      var siguiente = visibles[nuevos.length];
      var arriba = tbody.firstChild && tbody.firstChild.getAttribute && tbody.firstChild.getAttribute('data-id');
      if (nuevos.length === 0 || !siguiente || siguiente.id !== arriba) incremental = nuevos.length === 0 && !!arriba;
      else {
        for (var k = nuevos.length - 1; k >= 0; k--) {
          var fila = filaEvento(nuevos[k]);
          fila.className = 'nueva';
          tbody.insertBefore(fila, tbody.firstChild);
          idsVistos[nuevos[k].id] = true;
        }
        while (tbody.children.length > MAX_FILAS) tbody.removeChild(tbody.lastChild);
      }
    }

    if (!incremental) {
      tbody.textContent = '';
      idsVistos = {};
      if (!visibles.length) {
        var tr0 = doc.createElement('tr');
        var td0 = crear('td', null, 'No hay eventos para mostrar.');
        td0.colSpan = 4;
        tr0.appendChild(td0);
        tbody.appendChild(tr0);
      }
      visibles.forEach(function (evt) {
        idsVistos[evt.id] = true;
        tbody.appendChild(filaEvento(evt));
      });
      filtroDibujado = filtroActual;
    }

    texto(
      $('nota-registro'),
      (filtroActual === 'todos' ? '' : 'Filtro: ' + nombreTipo(filtroActual) + '. ') +
        (lista.length > MAX_FILAS ? 'Se muestran los ' + MAX_FILAS + ' más recientes de ' + lista.length + '; el JSON exportado incluye todos.' : lista.length + (lista.length === 1 ? ' evento' : ' eventos') + ', del más nuevo al más antiguo.')
    );
  }

  /** Filtra el registro por un tipo y mueve la vista hasta la tabla */
  function verTipo(tipo) {
    filtroActual = tipo;
    var snap = obs.getSnapshot();
    pintarFiltros(snap);
    pintarTipos(snap);
    pintarRegistro(snap, false);
    var titulo = $('titulo-registro');
    if (titulo && titulo.scrollIntoView) titulo.scrollIntoView({ behavior: menosMovimiento ? 'auto' : 'smooth', block: 'start' });
    texto($('estado'), 'Mostrando solo: ' + nombreTipo(tipo) + '.');
  }

  // ------------------------------------------------------------------ ciclo de actualización
  /**
   * Pinta una sección sin dejar que un error ahí detenga el resto del tablero (A2).
   * Antes, una excepción en cualquiera de estas funciones se propagaba fuera de actualizar()
   * y el setInterval seguía llamando a actualizar() pero esa sección (y las que venían
   * después en el mismo tick) dejaba de refrescarse en silencio, sin avisar al operador.
   */
  function pintarSeguro(fn, nombre, s, extra) {
    try {
      fn(s, extra);
    } catch (e) {
      console.error('Observabilidad: fallo al pintar "' + nombre + '"', e);
      texto($('estado'), 'Hubo un problema mostrando "' + nombre + '"; el resto del tablero sigue actualizándose.');
    }
  }

  function actualizar(forzar) {
    var s;
    try {
      s = obs.getSnapshot();
    } catch (e) {
      texto($('estado'), 'No se pudo leer el registro: ' + (e && e.message ? e.message : e));
      return;
    }
    var ultimo = s.events.length ? s.events[s.events.length - 1].id : '';
    var minuto = Math.floor(Date.now() / 60000); // el gráfico avanza cada minuto aunque no haya eventos
    var firma = s.totals.events + '|' + ultimo + '|' + (s.performance.latest ? s.performance.latest.time : '') + '|' + minuto;
    if (!forzar && firma === ultimaFirma) return;
    ultimaFirma = firma;
    pintarSeguro(pintarKpis, 'resumen', s);
    pintarSeguro(pintarActividad, 'actividad', s);
    pintarSeguro(pintarSalud, 'velocidad', s);
    pintarSeguro(pintarTipos, 'eventos por tipo', s);
    pintarSeguro(pintarEntorno, 'entorno', s);
    pintarSeguro(pintarFiltros, 'filtros', s);
    pintarSeguro(pintarRegistro, 'registro', s, true);
    texto($('estado'), 'Actualizado a las ' + hora(s.generatedAt) + ': ' + s.totals.events + ' eventos, ' + s.totals.errors + (s.totals.errors === 1 ? ' error.' : ' errores.'));
  }

  function automatico(activo) {
    $('btn-auto').setAttribute('aria-pressed', activo ? 'true' : 'false');
    $('en-vivo').classList.toggle('pausado', !activo);
    texto($('en-vivo-texto'), activo ? 'En vivo' : 'En pausa');
    if (temporizador) global.clearInterval(temporizador);
    temporizador = activo
      ? global.setInterval(function () {
          actualizar(false);
        }, INTERVALO_MS)
      : null;
  }

  function nombreArchivo() {
    var d = new Date();
    function dos(n) {
      return (n < 10 ? '0' : '') + n;
    }
    return 'atracciones-observability-' + d.getFullYear() + dos(d.getMonth() + 1) + dos(d.getDate()) + '-' + dos(d.getHours()) + dos(d.getMinutes()) + '.json';
  }

  function exportar() {
    var json = JSON.stringify(obs.getSnapshot(), null, 2);
    var puede = typeof global.Blob === 'function' && global.URL && typeof global.URL.createObjectURL === 'function' && 'download' in doc.createElement('a');
    if (puede) {
      try {
        var url = global.URL.createObjectURL(new global.Blob([json], { type: 'application/json' }));
        var a = doc.createElement('a');
        a.href = url;
        a.download = nombreArchivo();
        doc.body.appendChild(a);
        a.click();
        a.remove();
        global.setTimeout(function () {
          global.URL.revokeObjectURL(url);
        }, 1000);
        texto($('estado'), 'Se descargó ' + a.download + '.');
        return;
      } catch (e) {
        /* sigue con el respaldo */
      }
    }
    $('panel-respaldo').hidden = false;
    $('json-respaldo').value = json;
    $('json-respaldo').focus();
    texto($('estado'), 'No se pudo descargar el archivo; el snapshot está en el cuadro de texto para copiarlo.');
  }

  function limpiar() {
    obs.clear();
    ultimaFirma = '';
    idsVistos = null;
    filtroActual = 'todos';
    actualizar(true);
    texto($('estado'), 'Registro limpiado. Se empezó una sesión nueva.');
  }

  function pedirConfirmacion() {
    var dialogo = $('dialogo-limpiar');
    if (dialogo && typeof dialogo.showModal === 'function') {
      dialogo.returnValue = '';
      dialogo.showModal();
      return;
    }
    if (global.confirm('¿Limpiar el registro? Se borran todos los eventos guardados en este navegador.')) limpiar();
  }

  function demo() {
    obs.demo();
    texto($('estado'), 'Se generaron eventos de prueba: un clic, un cambio de pestaña, un error de JavaScript, una promesa rechazada y una imagen que no carga.');
    global.setTimeout(function () {
      actualizar(true);
    }, 600);
  }

  // ------------------------------------------------------------------ inicio
  function iniciar() {
    if (!obs || typeof obs.getSnapshot !== 'function') {
      $('tablero').hidden = false;
      texto($('estado'), 'No se cargó /admin/script.js, así que no hay registro que mostrar.');
      return;
    }
    if (!esOperador()) {
      $('sin-acceso').hidden = false;
      $('en-vivo').hidden = true;
      return;
    }
    $('tablero').hidden = false;
    $('barra').hidden = false;
    prepararColumnas();

    var faltan = [];
    var sop = (obs.getSnapshot().environment || {}).supports || {};
    if (!sop.localStorage) faltan.push('localStorage (el registro solo dura mientras la página esté abierta)');
    if (!sop.performanceObserver) faltan.push('PerformanceObserver (no se pueden medir FCP ni LCP)');
    if (faltan.length) {
      $('aviso-api').hidden = false;
      texto($('aviso-api'), 'Este navegador no ofrece: ' + faltan.join('; ') + '.');
    }

    $('btn-actualizar').addEventListener('click', function () {
      actualizar(true);
    });
    $('btn-auto').addEventListener('click', function () {
      automatico($('btn-auto').getAttribute('aria-pressed') !== 'true');
    });
    $('btn-demo').addEventListener('click', demo);
    $('btn-exportar').addEventListener('click', exportar);
    $('btn-limpiar').addEventListener('click', pedirConfirmacion);
    var dialogo = $('dialogo-limpiar');
    if (dialogo) {
      dialogo.addEventListener('close', function () {
        if (dialogo.returnValue === 'limpiar') limpiar();
        $('btn-limpiar').focus();
      });
    }

    // Tiempo real: eventos de esta pestaña, de otras pestañas (storage) y sondeo periódico
    // B3: se guarda la función de desuscripción que devuelve obs.subscribe(); esta página
    // nunca se desmonta, pero si este patrón se reutiliza en una vista que sí se destruye,
    // queda disponible como window.AtraccionesObservability.__desuscribirPanel().
    var desuscribir = obs.subscribe(function () {
      if ($('btn-auto').getAttribute('aria-pressed') === 'true') actualizar(false);
    });
    global.__desuscribirPanelObservabilidad = desuscribir;
    global.addEventListener('storage', function (e) {
      if ((!e.key || e.key.indexOf(obs.PREFIX) === 0) && $('btn-auto').getAttribute('aria-pressed') === 'true') actualizar(false);
    });
    actualizar(true);
    automatico(true);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
