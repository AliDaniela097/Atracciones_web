/*
 * Dashboard de observabilidad del operador (Atracciones Web).
 * Lee los datos con window.AtraccionesObservability.getSnapshot() (definida en /admin/script.js).
 * Funciona sin dependencias y degrada con cuidado si falta alguna API del navegador.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var obs = global.AtraccionesObservability;
  var LLAVE_SESION = 'atracciones.sesion'; // la misma que usa la app React (src/auth.tsx)
  var INTERVALO_MS = 2000;
  var MAX_FILAS = 100;

  var NOMBRES = {
    'page-view': 'Página abierta',
    route: 'Vista de la app',
    performance: 'Rendimiento',
    interaction: 'Interacción',
    visibility: 'Visibilidad',
    'js-error': 'Error de JavaScript',
    'unhandled-rejection': 'Promesa rechazada',
    'resource-error': 'Error de recurso'
  };
  var ERRORES = { 'js-error': true, 'unhandled-rejection': true, 'resource-error': true };

  function $(id) {
    return doc.getElementById(id);
  }

  function texto(el, valor) {
    if (el) el.textContent = valor;
  }

  function nombreTipo(t) {
    return NOMBRES[t] || t;
  }

  function ms(v) {
    return typeof v === 'number' ? v.toLocaleString('es-EC') + ' ms' : 'No disponible';
  }

  function hora(iso) {
    try {
      return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return iso;
    }
  }

  // ------------------------------------------------------------------ acceso
  /** Solo el operador puede ver el tablero. Es un control de interfaz: los datos viven en este navegador. */
  function esOperador() {
    try {
      var s = JSON.parse(global.sessionStorage.getItem(LLAVE_SESION) || 'null');
      return !!(s && s.usuario && s.usuario.role === 'OPERADOR' && s.vence > Date.now());
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------ dibujo
  function filasDatos(dl, pares) {
    dl.textContent = '';
    pares.forEach(function (p) {
      var dt = doc.createElement('dt');
      var dd = doc.createElement('dd');
      dt.textContent = p[0];
      dd.textContent = p[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
  }

  function pintarKpis(s) {
    var t = s.totals.byType;
    var vistas = (t['page-view'] || 0) + (t.route || 0);
    texto($('k-eventos'), s.totals.events.toLocaleString('es-EC'));
    texto($('k-errores'), s.totals.errors.toLocaleString('es-EC'));
    $('k-errores').classList.toggle('alerta', s.totals.errors > 0);
    texto($('k-clics'), (t.interaction || 0).toLocaleString('es-EC'));
    texto($('k-vistas'), vistas.toLocaleString('es-EC'));
    texto($('k-visibilidad'), (t.visibility || 0).toLocaleString('es-EC'));
    var p = s.performance.latest;
    texto($('k-carga'), p && typeof p.loadMs === 'number' ? (p.loadMs / 1000).toFixed(2) + ' s' : 'Sin dato');
    $('kpis').setAttribute('aria-busy', 'false');
  }

  function pintarRendimiento(s) {
    var p = s.performance.latest;
    if (!p) {
      filasDatos($('rendimiento'), [['Estado', 'Aún no hay mediciones (abre la página principal y espera a que cargue)']]);
      return;
    }
    filasDatos($('rendimiento'), [
      ['Página medida', p.page || '/'],
      ['Tiempo hasta el primer byte (TTFB)', ms(p.ttfbMs)],
      ['Primer contenido pintado (FCP)', ms(p.firstContentfulPaintMs)],
      ['Mayor contenido pintado (LCP)', ms(p.largestContentfulPaintMs)],
      ['DOM listo (DOMContentLoaded)', ms(p.domContentLoadedMs)],
      ['Carga completa (load)', ms(p.loadMs)],
      ['Búsqueda DNS', ms(p.dnsMs)],
      ['Conexión', ms(p.connectMs)],
      ['Recursos descargados', p.resourceCount == null ? 'No disponible' : String(p.resourceCount)],
      ['Tipo de navegación', p.type || 'No disponible'],
      ['API usada', p.api],
      ['Mediciones guardadas', String(s.performance.history.length)]
    ]);
  }

  function pintarEntorno(s) {
    var e = s.environment || {};
    var v = e.viewport || {};
    var c = e.connection;
    filasDatos($('entorno'), [
      ['Ventana (viewport)', v.width ? v.width + ' × ' + v.height + ' px' : 'No disponible'],
      ['Densidad de píxeles', String(v.devicePixelRatio || 1)],
      ['Pantalla', e.screen ? e.screen.width + ' × ' + e.screen.height + ' px' : 'No disponible'],
      ['Conexión', c ? (c.effectiveType || 'desconocida') + (c.downlinkMbps != null ? ', ' + c.downlinkMbps + ' Mbps' : '') : 'API no disponible en este navegador'],
      ['Latencia estimada (RTT)', c && c.rttMs != null ? c.rttMs + ' ms' : 'No disponible'],
      ['Ahorro de datos', c ? (c.saveData ? 'Activado' : 'Desactivado') : 'No disponible'],
      ['En línea', e.online == null ? 'No disponible' : e.online ? 'Sí' : 'No'],
      ['Idioma', e.language || 'No disponible'],
      ['Almacenamiento', s.storage],
      ['Sesión', s.session ? s.session.id : '–']
    ]);
    var ul = $('apis');
    ul.textContent = '';
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
    var soporte = e.supports || {};
    Object.keys(nombres).forEach(function (k) {
      var li = doc.createElement('li');
      li.className = soporte[k] ? 'si' : 'no';
      li.textContent = nombres[k] + (soporte[k] ? ': sí' : ': no');
      ul.appendChild(li);
    });
  }

  function pintarTipos(s) {
    var ul = $('por-tipo');
    ul.textContent = '';
    var tipos = Object.keys(s.totals.byType).sort(function (a, b) {
      return s.totals.byType[b] - s.totals.byType[a];
    });
    if (!tipos.length) {
      var vacio = doc.createElement('li');
      vacio.textContent = 'Todavía no hay eventos.';
      ul.appendChild(vacio);
      return;
    }
    var max = s.totals.byType[tipos[0]];
    tipos.forEach(function (t) {
      var n = s.totals.byType[t];
      var li = doc.createElement('li');
      // Cada fila es un botón: filtra el registro por ese tipo y lleva al detalle
      var boton = doc.createElement('button');
      boton.type = 'button';
      boton.className = 'barra-boton';
      boton.setAttribute('aria-label', 'Ver ' + n + ' eventos de tipo ' + nombreTipo(t) + ' en el registro');
      boton.addEventListener('click', function () {
        verTipo(t);
      });
      var nombre = doc.createElement('span');
      nombre.textContent = nombreTipo(t);
      var fondo = doc.createElement('span');
      fondo.className = 'barra-fondo';
      fondo.setAttribute('aria-hidden', 'true');
      var relleno = doc.createElement('span');
      relleno.className = 'barra-relleno' + (ERRORES[t] ? ' error' : '');
      relleno.style.display = 'block';
      relleno.style.width = Math.max((n / max) * 100, 2) + '%';
      fondo.appendChild(relleno);
      var cant = doc.createElement('span');
      cant.className = 'cantidad';
      cant.textContent = String(n);
      boton.appendChild(nombre);
      boton.appendChild(fondo);
      boton.appendChild(cant);
      li.appendChild(boton);
      ul.appendChild(li);
    });
  }

  function detalle(evt) {
    var d = evt.data || {};
    switch (evt.type) {
      case 'interaction':
        return (d.action === 'change' ? 'Cambió ' : 'Clic en ') + d.element + (d.label ? ': “' + d.label + '”' : '') + (d.href ? ' → ' + d.href : '');
      case 'js-error':
        if (d.crossOrigin) return 'Error en un script de otro sitio (por ejemplo, una extensión del navegador); el navegador oculta el detalle por seguridad.';
        return (d.message || 'Sin mensaje') + (d.source ? ' (' + d.source + (d.line ? ':' + d.line : '') + ')' : '');
      case 'unhandled-rejection':
        return (d.message || 'Sin mensaje') + (d.source ? ' (' + d.source + (d.line ? ':' + d.line : '') + ')' : '');
      case 'resource-error':
        return 'No cargó ' + d.element + ': ' + d.url;
      case 'visibility':
        return d.state === 'hidden' ? 'Pestaña oculta' + (d.visibleForMs != null ? ' tras ' + Math.round(d.visibleForMs / 1000) + ' s visible' : '') : 'Pestaña visible de nuevo';
      case 'performance':
        return d.available === false ? 'Performance API no disponible' : 'Carga ' + ms(d.loadMs) + ', TTFB ' + ms(d.ttfbMs) + ', FCP ' + ms(d.fcpMs);
      case 'route':
        return d.view === 'atraccion' ? 'Abrió la atracción ' + d.attractionId : 'Abrió ' + d.view;
      case 'page-view':
        return d.title || 'Página cargada';
      default:
        try {
          return JSON.stringify(d);
        } catch (e) {
          return '';
        }
    }
  }

  /** Filtra el registro por un tipo de evento y mueve la vista hasta la tabla */
  function verTipo(tipo) {
    var sel = $('filtro');
    sel.value = tipo;
    pintarRegistro(obs.getSnapshot());
    var titulo = $('titulo-registro');
    if (titulo && titulo.scrollIntoView) titulo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sel.focus();
    texto($('estado'), 'Mostrando solo: ' + nombreTipo(tipo) + '.');
  }

  function pintarFiltro(s) {
    var sel = $('filtro');
    var actual = sel.value || 'todos';
    var tipos = Object.keys(s.totals.byType).sort();
    var opciones = [['todos', 'Todos (' + s.totals.events + ')']].concat(
      tipos.map(function (t) {
        return [t, nombreTipo(t) + ' (' + s.totals.byType[t] + ')'];
      })
    );
    sel.textContent = '';
    opciones.forEach(function (o) {
      var op = doc.createElement('option');
      op.value = o[0];
      op.textContent = o[1];
      sel.appendChild(op);
    });
    sel.value = tipos.indexOf(actual) >= 0 || actual === 'todos' ? actual : 'todos';
  }

  function pintarRegistro(s) {
    var filtro = $('filtro').value || 'todos';
    var lista = s.events.filter(function (e) {
      return filtro === 'todos' || e.type === filtro;
    });
    var visibles = lista.slice(-MAX_FILAS).reverse();
    var tbody = $('registro');
    tbody.textContent = '';
    if (!visibles.length) {
      var tr = doc.createElement('tr');
      var td = doc.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No hay eventos para mostrar.';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    visibles.forEach(function (evt) {
      var tr = doc.createElement('tr');
      var c1 = doc.createElement('td');
      var t = doc.createElement('time');
      t.dateTime = evt.time;
      t.textContent = hora(evt.time);
      c1.appendChild(t);
      var c2 = doc.createElement('td');
      var et = doc.createElement('span');
      et.className = 'etiqueta' + (ERRORES[evt.type] ? ' error' : '');
      et.textContent = nombreTipo(evt.type);
      c2.appendChild(et);
      var c3 = doc.createElement('td');
      c3.textContent = evt.page || '/';
      var c4 = doc.createElement('td');
      c4.textContent = detalle(evt); // textContent: nunca se interpreta como HTML
      tr.appendChild(c1);
      tr.appendChild(c2);
      tr.appendChild(c3);
      tr.appendChild(c4);
      tbody.appendChild(tr);
    });
    texto(
      $('nota-registro'),
      lista.length > MAX_FILAS
        ? 'Se muestran los ' + MAX_FILAS + ' eventos más recientes de ' + lista.length + '. El archivo exportado incluye todos.'
        : lista.length + (lista.length === 1 ? ' evento.' : ' eventos.')
    );
  }

  var ultimaFirma = '';
  function actualizar(forzar) {
    var s;
    try {
      s = obs.getSnapshot();
    } catch (e) {
      texto($('estado'), 'No se pudo leer el registro: ' + (e && e.message ? e.message : e));
      return;
    }
    var ultimo = s.events.length ? s.events[s.events.length - 1].id : '';
    var firma = s.totals.events + '|' + ultimo + '|' + (s.performance.latest ? s.performance.latest.time : '');
    if (!forzar && firma === ultimaFirma) return; // nada nuevo: no se redibuja
    ultimaFirma = firma;
    pintarKpis(s);
    pintarRendimiento(s);
    pintarEntorno(s);
    pintarTipos(s);
    pintarFiltro(s);
    pintarRegistro(s);
    texto($('estado'), 'Actualizado a las ' + hora(s.generatedAt) + ': ' + s.totals.events + ' eventos, ' + s.totals.errors + ' errores.');
  }

  // ------------------------------------------------------------------ acciones
  var temporizador = null;
  function automatico(activo) {
    $('btn-auto').setAttribute('aria-pressed', activo ? 'true' : 'false');
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
    // Respaldo: mostrar el JSON para copiarlo
    $('panel-respaldo').hidden = false;
    $('json-respaldo').value = json;
    $('json-respaldo').focus();
    texto($('estado'), 'No se pudo descargar el archivo; el snapshot está en el cuadro de texto para copiarlo.');
  }

  function limpiar() {
    obs.clear();
    ultimaFirma = '';
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
      return;
    }
    $('tablero').hidden = false;

    var faltan = [];
    var sop = (obs.getSnapshot().environment || {}).supports || {};
    if (!sop.localStorage) faltan.push('localStorage (el registro solo dura mientras la página esté abierta)');
    if (!sop.performanceObserver) faltan.push('PerformanceObserver (no hay FCP ni LCP)');
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
    $('filtro').addEventListener('change', function () {
      var s = obs.getSnapshot();
      pintarRegistro(s);
    });
    var dialogo = $('dialogo-limpiar');
    if (dialogo) {
      dialogo.addEventListener('close', function () {
        if (dialogo.returnValue === 'limpiar') limpiar();
        $('btn-limpiar').focus();
      });
    }

    // Tiempo real: eventos de esta pestaña, de otras pestañas (storage) y sondeo periódico
    obs.subscribe(function () {
      actualizar(false);
    });
    global.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf(obs.PREFIX) === 0) actualizar(false);
    });
    actualizar(true);
    automatico(true);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
