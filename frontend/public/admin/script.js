/*
 * Atracciones Web: instrumentación de observabilidad LOCAL (solo en este navegador).
 *
 * Se carga en la página principal (index.html) y en el dashboard (observabilidad.html).
 * Registra en localStorage, con claves que empiezan por "atracciones-observability:":
 *   1. Tiempos de navegación y carga (Performance API).
 *   2. Errores de JavaScript sin capturar y promesas rechazadas sin manejar.
 *   3. Errores de carga de recursos (imágenes, scripts, hojas de estilo).
 *   4. Clics en enlaces, botones y controles principales.
 *   5. Cambios de visibilidad de la pestaña.
 *   6. Entorno: viewport, tipo de conexión y APIs del navegador disponibles.
 * Además registra cada cambio de vista de la SPA (por ejemplo, abrir /atraccion/:id).
 *
 * Privacidad: nunca guarda lo que la persona escribe (valores de campos, contraseñas, tarjetas).
 * Degradación: si no hay localStorage o alguna API, sigue funcionando en memoria.
 *
 * API global: window.AtraccionesObservability
 *   getSnapshot(), track(tipo, datos), clear(), subscribe(fn), demo(), PREFIX
 */
(function (global) {
  'use strict';

  if (global.AtraccionesObservability) return; // evita instrumentar dos veces

  var PREFIX = 'atracciones-observability:';
  var KEYS = {
    events: PREFIX + 'events',
    performance: PREFIX + 'performance',
    environment: PREFIX + 'environment',
    session: PREFIX + 'session'
  };
  var MAX_EVENTS = 500;
  var MAX_PERF = 50;
  var VERSION = '1.0.0';
  var listeners = [];
  var memory = {}; // respaldo cuando localStorage no está disponible

  // ---------------------------------------------------------------- almacenamiento seguro
  var storageOk = (function () {
    try {
      var k = PREFIX + '__test__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function read(key, fallback) {
    try {
      var raw = storageOk ? global.localStorage.getItem(key) : memory[key];
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    var raw = JSON.stringify(value);
    if (!storageOk) {
      memory[key] = raw;
      return;
    }
    try {
      global.localStorage.setItem(key, raw);
    } catch (e) {
      // Cuota llena: se queda con la mitad más reciente y reintenta una vez
      if (Array.isArray(value) && value.length > 10) {
        try {
          global.localStorage.setItem(key, JSON.stringify(value.slice(-Math.floor(value.length / 2))));
        } catch (e2) {
          memory[key] = raw;
        }
      } else {
        memory[key] = raw;
      }
    }
  }

  function now() {
    return new Date().toISOString();
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function cut(text, max) {
    text = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function path() {
    try {
      return global.location.pathname + global.location.search;
    } catch (e) {
      return '';
    }
  }

  // ---------------------------------------------------------------- sesión
  var session = read(KEYS.session, null);
  if (!session || !session.id) {
    session = { id: id(), startedAt: now() };
  }
  session.lastSeenAt = now();
  write(KEYS.session, session);

  // ---------------------------------------------------------------- registro de eventos
  function notify(evt) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](evt);
      } catch (e) {
        /* un suscriptor con error no debe romper el registro */
      }
    }
    try {
      global.dispatchEvent(new CustomEvent('atracciones-observability', { detail: evt }));
    } catch (e) {
      /* CustomEvent no disponible: los suscriptores ya fueron avisados */
    }
  }

  function track(type, data) {
    var evt = {
      id: id(),
      type: String(type),
      time: now(),
      page: path(),
      session: session.id,
      data: data || {}
    };
    var events = read(KEYS.events, []);
    events.push(evt);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    write(KEYS.events, events);
    notify(evt);
    return evt;
  }

  // ---------------------------------------------------------------- 6. entorno
  function supports() {
    var nav = global.navigator || {};
    return {
      localStorage: storageOk,
      performance: !!global.performance,
      performanceObserver: typeof global.PerformanceObserver === 'function',
      navigationTiming: !!(global.performance && global.performance.getEntriesByType),
      fetch: typeof global.fetch === 'function',
      intersectionObserver: typeof global.IntersectionObserver === 'function',
      serviceWorker: 'serviceWorker' in nav,
      networkInformation: 'connection' in nav,
      sendBeacon: typeof nav.sendBeacon === 'function',
      clipboard: !!nav.clipboard,
      visibility: typeof global.document !== 'undefined' && 'visibilityState' in global.document,
      blobDownload: typeof global.Blob === 'function' && !!(global.URL && global.URL.createObjectURL)
    };
  }

  function environment() {
    var nav = global.navigator || {};
    var c = nav.connection || nav.mozConnection || nav.webkitConnection;
    var env = {
      capturedAt: now(),
      viewport: {
        width: global.innerWidth || null,
        height: global.innerHeight || null,
        devicePixelRatio: global.devicePixelRatio || 1
      },
      screen: global.screen ? { width: global.screen.width, height: global.screen.height } : null,
      connection: c
        ? {
            effectiveType: c.effectiveType || null,
            downlinkMbps: typeof c.downlink === 'number' ? c.downlink : null,
            rttMs: typeof c.rtt === 'number' ? c.rtt : null,
            saveData: !!c.saveData
          }
        : null,
      online: typeof nav.onLine === 'boolean' ? nav.onLine : null,
      language: nav.language || null,
      userAgent: nav.userAgent || null,
      prefersReducedMotion: !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches),
      supports: supports()
    };
    write(KEYS.environment, env);
    return env;
  }

  // ---------------------------------------------------------------- 1. rendimiento
  var paint = {};

  function round(n) {
    return typeof n === 'number' && isFinite(n) ? Math.round(n) : null;
  }

  function navigationMetrics() {
    var perf = global.performance;
    if (!perf) return null;
    var m = null;
    if (perf.getEntriesByType) {
      var nav = perf.getEntriesByType('navigation')[0];
      if (nav) {
        m = {
          api: 'PerformanceNavigationTiming',
          type: nav.type,
          dnsMs: round(nav.domainLookupEnd - nav.domainLookupStart),
          connectMs: round(nav.connectEnd - nav.connectStart),
          ttfbMs: round(nav.responseStart - nav.requestStart),
          responseMs: round(nav.responseEnd - nav.responseStart),
          domInteractiveMs: round(nav.domInteractive),
          domContentLoadedMs: round(nav.domContentLoadedEventEnd),
          loadMs: round(nav.loadEventEnd),
          transferBytes: typeof nav.transferSize === 'number' ? nav.transferSize : null
        };
      }
    }
    if (!m && perf.timing && perf.timing.navigationStart) {
      // API antigua (navegadores viejos)
      var t = perf.timing;
      m = {
        api: 'performance.timing',
        type: null,
        dnsMs: round(t.domainLookupEnd - t.domainLookupStart),
        connectMs: round(t.connectEnd - t.connectStart),
        ttfbMs: round(t.responseStart - t.requestStart),
        responseMs: round(t.responseEnd - t.responseStart),
        domInteractiveMs: round(t.domInteractive - t.navigationStart),
        domContentLoadedMs: round(t.domContentLoadedEventEnd - t.navigationStart),
        loadMs: round(t.loadEventEnd - t.navigationStart),
        transferBytes: null
      };
    }
    if (!m) return null;
    m.firstPaintMs = paint.fp == null ? null : paint.fp;
    m.firstContentfulPaintMs = paint.fcp == null ? null : paint.fcp;
    m.largestContentfulPaintMs = paint.lcp == null ? null : paint.lcp;
    try {
      m.resourceCount = perf.getEntriesByType ? perf.getEntriesByType('resource').length : null;
    } catch (e) {
      m.resourceCount = null;
    }
    m.page = path();
    m.time = now();
    return m;
  }

  function observePaint() {
    if (typeof global.PerformanceObserver !== 'function') return;
    try {
      new global.PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          if (e.name === 'first-paint') paint.fp = round(e.startTime);
          if (e.name === 'first-contentful-paint') paint.fcp = round(e.startTime);
        });
      }).observe({ type: 'paint', buffered: true });
    } catch (e) {
      /* tipo no soportado */
    }
    try {
      new global.PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length) paint.lcp = round(entries[entries.length - 1].startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      /* LCP no soportado (por ejemplo, Firefox o Safari antiguos) */
    }
  }

  function recordPerformance() {
    var m = navigationMetrics();
    if (!m) {
      track('performance', { available: false });
      return;
    }
    var list = read(KEYS.performance, []);
    list.push(m);
    if (list.length > MAX_PERF) list = list.slice(-MAX_PERF);
    write(KEYS.performance, list);
    track('performance', { loadMs: m.loadMs, ttfbMs: m.ttfbMs, fcpMs: m.firstContentfulPaintMs, lcpMs: m.largestContentfulPaintMs });
  }

  // ---------------------------------------------------------------- 2 y 3. errores
  function onError(e) {
    var t = e && e.target;
    // Error de recurso: el evento viene del elemento y no burbujea, por eso se escucha en captura
    if (t && t !== global && t.tagName) {
      var tag = t.tagName.toLowerCase();
      if (tag === 'img' || tag === 'script' || tag === 'link' || tag === 'video' || tag === 'audio' || tag === 'source' || tag === 'iframe') {
        track('resource-error', {
          element: tag,
          url: cut(t.currentSrc || t.src || t.href || '', 300)
        });
      }
      return;
    }
    var mensaje = String((e && e.message) || '');
    // Aviso conocido y sin consecuencias de Chrome/Edge (no es un fallo de la página): no se cuenta como error
    if (/ResizeObserver loop/i.test(mensaje)) return;
    track('js-error', {
      // "Script error." sin detalles = error de un script de otro dominio (extensión del navegador, Google, etc.)
      crossOrigin: mensaje === 'Script error.' || mensaje === 'Script error',
      message: cut(e && e.message, 300),
      source: cut(e && e.filename, 300),
      line: e && e.lineno,
      column: e && e.colno,
      stack: cut(e && e.error && e.error.stack, 800)
    });
  }

  function onRejection(e) {
    var r = e && e.reason;
    track('unhandled-rejection', {
      message: cut(r && r.message ? r.message : r, 300),
      stack: cut(r && r.stack, 800)
    });
  }

  // ---------------------------------------------------------------- 4. interacciones
  var SELECTOR = 'a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="option"]';

  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var info = { element: tag };
    if (el.id) info.id = cut(el.id, 60);
    var label = el.getAttribute('aria-label') || el.getAttribute('title');
    if (!label && (tag === 'a' || tag === 'button' || tag === 'summary' || el.getAttribute('role'))) {
      // En tarjetas, el título describe mejor el enlace que todo su texto junto
      var titulo = el.querySelector('h1, h2, h3, h4');
      label = titulo ? titulo.textContent : el.textContent;
    }
    if (!label && el.labels && el.labels[0]) label = el.labels[0].textContent; // etiqueta del campo, nunca su valor
    if (!label && el.getAttribute('name')) label = el.getAttribute('name');
    info.label = cut(label, 80);
    if (tag === 'input') info.inputType = el.getAttribute('type') || 'text';
    if (tag === 'a' && el.getAttribute('href')) {
      try {
        var u = new URL(el.href, global.location.href);
        info.href = u.origin === global.location.origin ? u.pathname + u.search : u.origin;
      } catch (e) {
        info.href = cut(el.getAttribute('href'), 120);
      }
    }
    return info;
  }

  function onClick(e) {
    var el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!el || el.closest('[data-observability-ignore]')) return;
    track('interaction', describe(el));
  }

  function onChange(e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'select' && !(tag === 'input' && /checkbox|radio|date/.test(el.type))) return;
    if (el.closest('[data-observability-ignore]')) return;
    var info = describe(el);
    info.action = 'change';
    track('interaction', info); // solo qué control cambió, no el valor elegido
  }

  // ---------------------------------------------------------------- 5. visibilidad
  var visibleSince = Date.now();
  function onVisibility() {
    var state = global.document.visibilityState;
    var data = { state: state };
    if (state === 'hidden') data.visibleForMs = Date.now() - visibleSince;
    else visibleSince = Date.now();
    track('visibility', data);
  }

  // ---------------------------------------------------------------- vistas de la SPA
  var lastPath = path();
  function onRoute() {
    var p = path();
    if (p === lastPath) return;
    lastPath = p;
    var m = /^\/atraccion\/([^/?#]+)/.exec(global.location.pathname);
    track('route', m ? { view: 'atraccion', attractionId: m[1] } : { view: global.location.pathname });
  }

  function patchHistory() {
    var h = global.history;
    if (!h || !h.pushState) return;
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = h[name];
      h[name] = function () {
        var result = original.apply(this, arguments);
        setTimeout(onRoute, 0);
        return result;
      };
    });
    global.addEventListener('popstate', onRoute);
  }

  // ---------------------------------------------------------------- snapshot
  function getSnapshot() {
    var events = read(KEYS.events, []);
    var counts = {};
    for (var i = 0; i < events.length; i++) counts[events[i].type] = (counts[events[i].type] || 0) + 1;
    var perf = read(KEYS.performance, []);
    return {
      app: 'Atracciones Web',
      version: VERSION,
      generatedAt: now(),
      storage: storageOk ? 'localStorage' : 'memoria (localStorage no disponible)',
      prefix: PREFIX,
      session: read(KEYS.session, session),
      environment: read(KEYS.environment, null) || environment(),
      performance: { latest: perf.length ? perf[perf.length - 1] : null, history: perf },
      totals: {
        events: events.length,
        byType: counts,
        errors: (counts['js-error'] || 0) + (counts['unhandled-rejection'] || 0) + (counts['resource-error'] || 0)
      },
      events: events
    };
  }

  function clear() {
    var keys = [KEYS.events, KEYS.performance, KEYS.environment, KEYS.session];
    keys.forEach(function (k) {
      try {
        if (storageOk) global.localStorage.removeItem(k);
      } catch (e) {
        /* nada que borrar */
      }
      delete memory[k];
    });
    session = { id: id(), startedAt: now(), lastSeenAt: now() };
    write(KEYS.session, session);
    environment();
    notify({ type: 'cleared', time: now() });
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  /** Genera un evento de cada tipo para demostrar el registro (lo usa el dashboard) */
  function demo() {
    track('interaction', { element: 'button', label: 'Evento de prueba (demo)', demo: true });
    track('visibility', { state: 'hidden', visibleForMs: 1234, demo: true });
    // Error real sin capturar, para comprobar que el listener global funciona
    setTimeout(function () {
      throw new Error('Error de prueba generado desde el dashboard de observabilidad');
    }, 0);
    // Promesa rechazada sin manejar
    if (typeof Promise === 'function') {
      Promise.reject(new Error('Promesa rechazada de prueba (demo)'));
    }
    // Recurso que no existe
    if (global.document && global.document.body) {
      var img = global.document.createElement('img');
      img.alt = '';
      img.hidden = true;
      img.src = '/admin/recurso-inexistente-demo.png?t=' + Date.now();
      img.onerror = function () {
        img.remove();
      };
      global.document.body.appendChild(img);
    }
  }

  // ---------------------------------------------------------------- arranque
  global.addEventListener('error', onError, true);
  global.addEventListener('unhandledrejection', onRejection);
  if (global.document) {
    global.document.addEventListener('click', onClick, true);
    global.document.addEventListener('change', onChange, true);
    if ('visibilityState' in global.document) global.document.addEventListener('visibilitychange', onVisibility);
  }
  observePaint();
  patchHistory();
  environment();
  track('page-view', { title: global.document ? cut(global.document.title, 120) : '', referrer: global.document ? cut(global.document.referrer, 200) : '' });

  var resizeTimer;
  global.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(environment, 500);
  });

  if (global.document && global.document.readyState === 'complete') {
    setTimeout(recordPerformance, 0);
  } else {
    global.addEventListener('load', function () {
      // loadEventEnd se completa justo después del evento load
      setTimeout(recordPerformance, 0);
    });
  }

  global.AtraccionesObservability = {
    PREFIX: PREFIX,
    VERSION: VERSION,
    getSnapshot: getSnapshot,
    track: track,
    clear: clear,
    subscribe: subscribe,
    demo: demo
  };
})(typeof window !== 'undefined' ? window : this);
