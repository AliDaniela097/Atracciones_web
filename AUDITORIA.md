# Auditoría WCAG 2.2 AA / UX / Responsive — Dashboard de Observabilidad (Atracciones Web)

Archivos auditados (leídos completos):
- `observabilidad.html`
- `observabilidad.css`
- `observabilidad.js`
- `script.js` (instrumentación global, `window.AtraccionesObservability`)

Auditoría de solo lectura, sin modificaciones. Para las secciones 6-8 se revisó además el código del backend (NestJS) que da soporte a estos archivos, ya que la seguridad y la arquitectura de una página no se pueden juzgar en aislamiento de la API que consume.

---

## 1. Resumen ejecutivo

El dashboard está construido con un nivel de atención a accesibilidad notablemente alto para un panel interno: jerarquía de encabezados correcta, enlace "saltar al contenido" bien implementado, tablas con `<caption class="sr-only">`, botones de verdad (no `div`/`span` con `onclick`), `:focus-visible` global con buen contraste, soporte de `prefers-reduced-motion` tanto en CSS como en JS, y **cero usos de `innerHTML`** (todo el contenido dinámico se inserta con `textContent`, incluso con un comentario explícito en el código recordándolo). Los contrastes de color calculados sobre la paleta de `:root` pasan AA con amplio margen (ver sección 3).

No se encontraron fallas **críticas** (bloqueantes para una tarea esencial). Sí hay **2 hallazgos altos**: la tabla del registro pierde sus encabezados de columna en móvil sin reemplazo, y el ciclo de actualización en JS no aísla errores por sección, por lo que un fallo en una sola función puede congelar todo el refresco sin avisar al usuario. Los hallazgos medios y bajos son en su mayoría matices de ARIA/teclado en componentes que, en general, ya están bien pensados (el gráfico de actividad, por ejemplo, ya ofrece una tabla equivalente accesible vía `<details>`, lo cual mitiga varios problemas potenciales).

En cuanto a seguridad y arquitectura (secciones 6-8), el backend que sirve estos archivos aplica buenas prácticas razonables para un proyecto académico: cabeceras de seguridad con `helmet`, límite de peticiones (`throttler`), validación estricta de entrada (`ValidationPipe` con `whitelist`/`forbidNonWhitelisted`), contraseñas con `bcryptjs`, JWT con emisor verificado, y **todas las consultas SQL usan parámetros posicionales (`$1`, `$2`...)** — no se encontró ningún caso de concatenación de datos de usuario dentro de una consulta. El hallazgo de seguridad más relevante no está en el código sino en la configuración: `TypeORM synchronize` depende de `NODE_ENV` y no existen migraciones, lo que es un riesgo operativo (no de código) para el despliegue en producción.

Total hallazgos de accesibilidad/UX: **9** → 0 críticos, 2 altos, 4 medios, 3 bajos.

---

## 2. Hallazgos por severidad

### Críticos
Ninguno encontrado.

### Altos

| # | Título | Archivo:línea / selector |
|---|--------|---------------------------|
| A1 | La tabla de registro pierde los encabezados de columna en móvil, sin ningún reemplazo visible | `observabilidad.css:991-1014` + `observabilidad.html:169-181` |
| A2 | El ciclo de refresco (`actualizar()`) no aísla errores por sección: un fallo en una función de pintado detiene silenciosamente todo el tablero | `observabilidad.js:586-607` |

### Medios

| # | Título | Archivo:línea / selector |
|---|--------|---------------------------|
| M1 | Las columnas del gráfico de actividad (~7 px de ancho en 320-390px) son objetivos táctiles minúsculos y el tooltip no responde a touch | `observabilidad.css:478-525` / `observabilidad.js:151-171,239-256` |
| M2 | El contenedor de la tabla de actividad (dentro del `<details>`) no es enfocable por teclado para hacer scroll horizontal, a diferencia del contenedor del registro principal | `observabilidad.html:116-122` vs `observabilidad.html:168` |
| M3 | Los KPI no anuncian sus cambios a lectores de pantalla (`aria-busy` pero no `aria-live`) | `observabilidad.html:60-91` / `observabilidad.js:129-146` |
| M4 | Grupos de selección única (chips de filtro, barras "eventos por tipo") usan `aria-pressed` en botones sueltos en vez de un patrón `radiogroup`/`tablist` | `observabilidad.html:148,166` / `observabilidad.js:365-396,475-498` |

### Bajos

| # | Título | Archivo:línea / selector |
|---|--------|---------------------------|
| B1 | `main:focus { outline: none; }` sin indicador alternativo tras usar "Saltar al contenido" | `observabilidad.css:283-285` |
| B2 | El `role="tooltip"` del `#tooltip` no está enlazado por `aria-describedby` desde la columna que lo activa | `observabilidad.html:109` / `observabilidad.js:239-256` |
| B3 | Suscripciones (`obs.subscribe`, listener de `storage`) nunca se desuscriben | `observabilidad.js:726-731` |

---

## 3. Evidencia concreta

### A1 — Tabla de registro sin encabezados en móvil

`observabilidad.css:991-1014`:
```css
@media (max-width: 640px) {
  .tabla thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
  .tabla tr {
    display: grid;
    gap: 4px;
    padding: 10px 0;
    border-bottom: 1px solid var(--linea);
  }
  .tabla td {
    border: 0;
    padding: 0 4px;
  }
  ...
}
```
Y las celdas en `observabilidad.html:172-179` no llevan ningún atributo (`data-label` o similar) que la CSS pueda usar para mostrar una etiqueta:
```html
<thead>
  <tr>
    <th scope="col">Hora</th>
    <th scope="col">Tipo</th>
    <th scope="col">Página</th>
    <th scope="col">Qué pasó</th>
  </tr>
</thead>
```
En `<640px` el `<thead>` se oculta visualmente con la técnica clip-rect clásica y cada fila pasa a `display:grid`. Dos problemas reales:
1. **Para personas con visión**: cada fila queda como 4 líneas de texto sueltas (hora, chip de tipo, ruta, detalle) sin ninguna etiqueta de columna visible. El tipo de evento se distingue por el chip de color, pero la hora y la página no tienen ninguna marca.
2. **Para lectores de pantalla**: al cambiar `display` de `table-row` a `grid` en varios navegadores (notablemente Firefox, y en ciertas versiones de Safari/VoiceOver) se pierde la semántica implícita de tabla en el árbol de accesibilidad, por lo que la asociación celda↔encabezado (`scope="col"`) puede dejar de anunciarse aunque el `<thead>` siga en el DOM.

### A2 — Sin aislamiento de errores en el ciclo de refresco

`observabilidad.js:586-607`:
```js
function actualizar(forzar) {
  var s;
  try {
    s = obs.getSnapshot();
  } catch (e) {
    texto($('estado'), 'No se pudo leer el registro: ' + (e && e.message ? e.message : e));
    return;
  }
  var ultimo = s.events.length ? s.events[s.events.length - 1].id : '';
  var minuto = Math.floor(Date.now() / 60000);
  var firma = s.totals.events + '|' + ultimo + '|' + (s.performance.latest ? s.performance.latest.time : '') + '|' + minuto;
  if (!forzar && firma === ultimaFirma) return;
  ultimaFirma = firma;
  pintarKpis(s);
  pintarActividad(s);
  pintarSalud(s);
  pintarTipos(s);
  pintarEntorno(s);
  pintarFiltros(s);
  pintarRegistro(s, true);
  texto($('estado'), 'Actualizado a las ' + hora(s.generatedAt) + ...);
}
```
Solo la lectura del snapshot (`obs.getSnapshot()`) está dentro de un `try/catch`. Las siete funciones de pintado que siguen no lo están, y varias acceden a elementos del DOM sin comprobar que existan, por ejemplo `observabilidad.js:145`:
```js
$('kpis').setAttribute('aria-busy', 'false');
```
Si cualquiera de esas siete funciones lanza una excepción (un `id` de elemento ausente, un dato con forma inesperada, etc.), la excepción se propaga fuera de `actualizar()`. Como `actualizar` se llama desde `global.setInterval(..., 2000)` (línea 614-617), el intervalo **sigue vivo** pero cada vez que ocurre el error ese tick no actualiza nada, el texto de `#estado` queda congelado en el último valor exitoso, y no hay ningún mensaje de error visible para el operador — solo quedaría en la consola del navegador.

### M1 — Columnas del gráfico de actividad: objetivo táctil mínimo y sin soporte touch

`observabilidad.css:478-483`:
```css
.grafico {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  height: clamp(220px, 28vh, 320px);
}
```
`observabilidad.css:498-505`:
```css
.grafico-columnas {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  ...
}
```
Con `MINUTOS = 30` columnas (`observabilidad.js:16,155`) repartiendo el ancho disponible (`minmax(0,1fr)` menos los 34px/26px del eje Y y 29 gaps de 2px), en un viewport de 320-390px cada columna queda en torno a 6-8 px de ancho — muy por debajo del mínimo de 24×24 px CSS de WCAG 2.2 SC 2.5.8 (Target Size Minimum, AA).

Además, la única forma de ver el detalle de una columna es `mouseenter`/`focus` (`observabilidad.js:164-167`):
```js
col.addEventListener('mouseenter', mostrarTooltip);
col.addEventListener('focus', mostrarTooltip);
col.addEventListener('mouseleave', ocultarTooltip);
col.addEventListener('blur', ocultarTooltip);
```
No hay `click`/`touchstart`, por lo que en una pantalla táctil (el propio CSS tiene un breakpoint `@media (max-width:640px)`, confirmando que se espera uso móvil) es prácticamente imposible activar el tooltip con el dedo.

*Mitigación ya presente*: el bloque `<details><summary>Ver estos datos en tabla</summary>...` (`observabilidad.html:114-123`) da acceso a los mismos datos por minuto en una tabla normal, utilizable con teclado, lector de pantalla y touch. Por eso el hallazgo es Medio y no Alto.

### M2 — Contenedor de la tabla de actividad sin foco para scroll por teclado

`observabilidad.html:116-122` (tabla de actividad, dentro de `<details>`):
```html
<div class="tabla-contenedor">
  <table class="tabla tabla--compacta">
    ...
  </table>
</div>
```
Comparar con `observabilidad.html:168` (tabla de registro principal):
```html
<div class="tabla-contenedor" tabindex="0" role="region" aria-labelledby="titulo-registro">
```
Ambos usan la misma clase `.tabla-contenedor` con `overflow-x:auto` (`observabilidad.css:881-886`), pero solo el segundo es enfocable (`tabindex="0"`) y tiene `role="region"`. Un usuario que navega solo con teclado no puede poner el foco en el primer contenedor para desplazarlo horizontalmente con las flechas si la tabla compacta desborda (por ejemplo con nombres de minuto largos o fuentes ampliadas por el usuario).

### M3 — KPIs sin `aria-live`

`observabilidad.html:60-64`:
```html
<section class="kpis" id="kpis" aria-label="Resumen" aria-busy="true">
  <article class="kpi" data-kpi="eventos">
    <p class="kpi-etiqueta">Eventos registrados</p>
    <p class="kpi-valor" id="k-eventos">0</p>
```
`observabilidad.js:145` solo cambia `aria-busy` a `false` una vez; los valores en sí (`#k-eventos`, `#k-errores`, etc.) se actualizan cada 2 segundos vía `contar()` (`observabilidad.js:96-126`) con `el.textContent = ...` dentro de una animación de conteo, sin ningún `aria-live="polite"` en la sección ni en los nodos. Un usuario de lector de pantalla que entra al dashboard no es avisado cuando, por ejemplo, el contador de errores sube de 0 a 1 — tendría que volver a enfocar manualmente cada valor para notarlo.

### M4 — `aria-pressed` en botones sueltos en vez de `radiogroup`/`tablist`

Chips de filtro, `observabilidad.js:486-488`:
```js
var b = crear('button', 'chip', o[1]);
b.type = 'button';
b.setAttribute('aria-pressed', filtroActual === o[0] ? 'true' : 'false');
```
Contenedor, `observabilidad.html:166`:
```html
<div class="filtros" id="filtros" role="group" aria-label="Filtrar por tipo"></div>
```
`role="group"` con varios botones con `aria-pressed` es técnicamente válido (son botones de alternancia), pero no comunica a la tecnología asistiva que es un **conjunto de selección única** (como sí lo haría `role="radiogroup"` + `role="radio"`/`aria-checked`, o `role="tablist"` + `role="tab"`/`aria-selected`). El mismo patrón se repite en las barras de "Eventos por tipo" (`observabilidad.js:365-396`, contenedor `<ul class="barras" id="por-tipo">` sin `role="group"` ni etiqueta).

### B1 — `outline: none` en `main:focus`

`observabilidad.css:278-285`:
```css
main {
  padding: 22px var(--gutter) 56px;
}

main:focus {
  outline: none;
}
```
El `<main id="contenido" tabindex="-1">` (`observabilidad.html:48`) recibe el foco cuando se activa el enlace "Saltar al contenido" (`observabilidad.html:21`). Quitarle el `outline` sin ofrecer ningún indicador visual alternativo (ni siquiera un cambio de color temporal) hace que, si el usuario vuelve a pulsar Tab inmediatamente tras saltar, no tenga ninguna pista visual de dónde estaba el foco un instante antes.

### B2 — `role="tooltip"` sin `aria-describedby`

`observabilidad.html:109`:
```html
<div class="tooltip" id="tooltip" role="tooltip" hidden></div>
```
Ninguna columna (`observabilidad.js:151-171`) referencia este `id` con `aria-describedby`. El rol ARIA `tooltip` está pensado para describir, mediante esa relación, el elemento que lo dispara; aquí queda "suelto". En la práctica no es grave porque cada columna ya lleva toda la información en su propio `aria-label` (`observabilidad.js:218-221`), pero la relación ARIA formal falta.

### B3 — Suscripciones sin limpieza

`observabilidad.js:726-731`:
```js
obs.subscribe(function () {
  if ($('btn-auto').getAttribute('aria-pressed') === 'true') actualizar(false);
});
global.addEventListener('storage', function (e) {
  if ((!e.key || e.key.indexOf(obs.PREFIX) === 0) && $('btn-auto').getAttribute('aria-pressed') === 'true') actualizar(false);
});
```
`subscribe()` en `script.js:439-447` sí devuelve una función de desuscripción, pero `observabilidad.js` nunca la guarda ni la invoca. En esta página (que vive sola, sin montarse/desmontarse como un componente SPA) esto no causa fugas de memoria perceptibles, pero es una fragilidad latente si este patrón se reutiliza en un contexto donde la vista se destruye y recrea.

---

## 4. Recomendaciones de corrección

### A1 — Encabezados en tabla móvil
Añadir `data-label` a cada `<td>` y mostrarlo con un pseudo-elemento, o usar `role="group"`/`aria-label` por fila. Ejemplo mínimo sin tocar el JS de generación de filas (usar `attr()`):
```html
<td data-label="Hora">...</td>
<td data-label="Tipo">...</td>
<td data-label="Página">...</td>
<td data-label="Qué pasó">...</td>
```
```css
@media (max-width: 640px) {
  .tabla td::before {
    content: attr(data-label) ": ";
    color: var(--suave);
    font-weight: 600;
  }
}
```
O, si se prefiere no tocar el layout visual, mantener la tabla como `<table>` de verdad en todos los anchos (con `overflow-x:auto` en vez de reflujo a grid) para no arriesgar la semántica. Como mínimo, si se conserva la técnica actual, forzar `role="table"`, `role="row"` y `role="cell"` explícitos en los elementos cuando `display` deja de ser tabular, para que algunos navegadores no eliminen la semántica implícita.

### A2 — Aislar errores por sección
Envolver cada función de pintado en su propio `try/catch` dentro de `actualizar()`, y mostrar un aviso visible (reutilizando `#aviso-api` o similar) cuando algo falla, en vez de dejarlo silencioso:
```js
function pintarSeguro(fn, nombre, s) {
  try {
    fn(s);
  } catch (e) {
    console.error('Fallo al pintar ' + nombre, e);
    texto($('estado'), 'Hubo un problema mostrando "' + nombre + '"; el resto del tablero sigue funcionando.');
  }
}
...
pintarSeguro(pintarKpis, 'resumen', s);
pintarSeguro(pintarActividad, 'actividad', s);
pintarSeguro(pintarSalud, 'velocidad', s);
pintarSeguro(pintarTipos, 'eventos por tipo', s);
pintarSeguro(pintarEntorno, 'entorno', s);
pintarSeguro(pintarFiltros, 'filtros', s);
pintarSeguro(pintarRegistro, 'registro', s, true);
```

### M1 — Objetivo táctil del gráfico de actividad
Dos cambios independientes y compatibles entre sí:
1. Añadir un manejador de `click`/`pointerup` a cada columna que también muestre el tooltip (o, más simple, que haga scroll/resalte la fila correspondiente en la tabla de `<details>`), para que el touch tenga una vía de activación:
```js
col.addEventListener('click', function (e) {
  mostrarTooltip(e);
  // opcional: ocultar tras unos segundos en touch
});
```
2. En viewports estrechos, considerar reducir la cantidad de columnas visibles (por ejemplo agrupar de 2 en 2 minutos) o aceptar que el detalle fino solo se consuma vía la tabla accesible — documentándolo como decisión de diseño.

### M2 — Scroll por teclado en la tabla de actividad
Igualar el contenedor de la tabla compacta al del registro principal:
```html
<div class="tabla-contenedor" tabindex="0" role="region" aria-label="Eventos y errores por minuto">
  <table class="tabla tabla--compacta">...</table>
</div>
```

### M3 — Anunciar cambios de KPI
Agregar `aria-live="polite"` a la sección de KPIs (o a cada `.kpi-valor`), con cuidado de no saturar al lector de pantalla en cada tick de 2 s — por ejemplo, limitarlo a anunciar solo cuando sube `k-errores`:
```html
<p class="kpi-valor" id="k-errores" aria-live="polite" aria-atomic="true">0</p>
```
o añadir una región de estado aparte que solo anuncie "Nuevo error registrado" cuando `s.totals.errors` suba, reutilizando el patrón que ya existe en `#estado role="status" aria-live="polite"`.

### M4 — Semántica de selección única
Para los chips de filtro, migrar a `role="radiogroup"` en el contenedor y `role="radio"` + `aria-checked` en cada botón (o `role="tablist"`/`role="tab"`/`aria-selected` si se quiere que las flechas naveguen entre opciones):
```html
<div class="filtros" id="filtros" role="radiogroup" aria-label="Filtrar por tipo"></div>
```
```js
b.setAttribute('role', 'radio');
b.setAttribute('aria-checked', filtroActual === o[0] ? 'true' : 'false');
```
Aplicar el mismo criterio a `#por-tipo` si se quiere que ese grupo también se anuncie como selección única (hoy ni siquiera tiene `role="group"`).

### B1 — Indicador de foco en `main`
Sustituir el `outline:none` por un estilo visible equivalente al resto del sitio, o simplemente eliminar la regla y dejar que aplique `:focus-visible` global:
```css
main:focus-visible {
  outline: 3px solid var(--oro);
  outline-offset: -3px;
}
```

### B2 — Enlazar el tooltip
```js
col.id = 'col-' + i;
col.setAttribute('aria-describedby', 'tooltip');
```
(o, más correcto semánticamente, quitar `role="tooltip"` del `div` ya que la información ya vive en el `aria-label` de la columna, y dejarlo puramente visual con `aria-hidden="true"`).

### B3 — Limpieza de listeners
Guardar y, si en el futuro esta vista se desmonta programáticamente, invocar las funciones de desuscripción:
```js
var desuscribir = obs.subscribe(function () { ... });
// en un eventual destructor de la vista: desuscribir();
```

---

## 5. Pruebas a repetir después de corregir

1. **Zoom de texto al 200%** en 320px, 390px, 768px y escritorio: confirmar que ninguna tabla ni botón produzca overflow horizontal de página (solo scroll interno en `.tabla-contenedor`).
2. **Navegación solo con teclado** (Tab/Shift+Tab/Enter/Espacio) desde el enlace "Saltar al contenido" hasta el botón "Limpiar registro" y el diálogo de confirmación: verificar foco visible en cada paso, incluida la tabla de actividad tras aplicar M2.
3. **Lector de pantalla** (NVDA o VoiceOver) en modo de navegación por tabla: confirmar que en <640px las celdas sigan anunciando su encabezado de columna tras aplicar A1.
4. **Simulación de error**: forzar que `pintarActividad` (o cualquier otra función de pintado) lance una excepción (por ejemplo, renombrar temporalmente un `id` en el HTML) y confirmar que, tras A2, el resto del tablero sigue actualizándose y aparece un aviso visible.
5. **Dispositivo táctil real o emulado** (Chrome DevTools "Touch" + "390×844"): confirmar que tocar una columna del gráfico de actividad muestra el tooltip tras aplicar M1, y que el objetivo es razonablemente alcanzable con el dedo.
6. **`prefers-reduced-motion: reduce` activado**: repetir el recorrido de KPIs, gráfico y registro para confirmar que ninguna animación nueva introducida por las correcciones (M3, M1) rompa esa preferencia.
7. **Contraste** con una herramienta automatizada (axe DevTools o Lighthouse) sobre la página ya renderizada, para corroborar los cálculos manuales de la sección 3 y detectar cualquier combinación de color no cubierta en esta auditoría (por ejemplo, estados hover/active no evaluados aquí).
8. **`aria-pressed`/`aria-checked`** con el inspector de accesibilidad del navegador: confirmar que, tras M4, solo un chip/botón del grupo se marque como seleccionado a la vez y que el lector de pantalla lo anuncie como tal.

---

## 6. Seguridad de la página

Esta sección evalúa tanto el frontend estático (`observabilidad.html/.css/.js`, `script.js`) como el backend NestJS que les da datos, porque la seguridad de un panel de observabilidad depende sobre todo de qué expone la API, no solo del HTML.

### Lo que ya está bien (verificado en el código, no asumido)

- **Sin SQL injection**: se revisó íntegramente `src/modules/atracciones/reportes/reportes.service.ts` (el único archivo con SQL crudo vía `this.db.query(...)`, en las líneas 36, 49, 62, 72 y 147). **Todas** las consultas pasan los valores variables como parámetros posicionales (`$1`, `$2`) en un arreglo separado (`p` o `[valor]`); los únicos fragmentos insertados por interpolación de cadena (`${rango}`, `${ciudadDe}`, `${condicion}`) son texto SQL fijo definido en constantes del propio archivo, nunca datos de entrada del usuario. El método `verificar(codigo)` incluso valida el formato del código con una expresión regular (`/^[0-9a-f]{32}$/` o `/^[0-9a-f]{8}$/`) **antes** de decidir qué condición fija usar, y lanza `BadRequestException` si no calza con ninguna — no hay forma de inyectar SQL a través de ese parámetro. Conclusión: no se encontró ningún caso de inyección SQL en el código auditado.
- **Cabeceras de seguridad HTTP**: `src/main.ts:15-24` aplica `helmet()` globalmente (protección contra clickjacking, sniffing de MIME, etc.), con `contentSecurityPolicy.upgradeInsecureRequests` activado solo en producción (para no romper el desarrollo local en `http://`).
- **Límite de peticiones (rate limiting)**: `src/app.module.ts:34-38` registra `ThrottlerModule` globalmente (100 peticiones/minuto por IP vía `APP_GUARD`), con límites más estrictos (`LIMITE_LOGIN`, `LIMITE_TRANSACCIONAL`) en rutas sensibles como login — mitiga fuerza bruta y abuso.
- **CORS con lista blanca**: `src/main.ts:29-43` solo permite los orígenes listados en `CORS_ORIGINS` (más cualquier puerto de `localhost` únicamente cuando `NODE_ENV!=='production'`); en producción un origen no autorizado es rechazado.
- **Contraseñas con hash + costo**: `bcryptjs` con una constante `RONDAS_BCRYPT` (no contraseñas en texto plano ni hashes débiles como MD5/SHA1 sin sal).
- **JWT con emisor verificado**: el token se firma y verifica con `issuer: 'atracciones-api'`, lo que evita aceptar tokens emitidos por otro sistema que use el mismo secreto por error.
- **Validación estricta de entrada**: `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })` global en `main.ts:48-54` — cualquier campo no declarado en un DTO es rechazado (no solo ignorado), y 16 DTOs usan `class-validator` para tipar y restringir cada campo.
- **Errores sin fuga de información interna**: el filtro global `ProblemDetailsFilter` (RFC 7807) centraliza las respuestas de error; no se detectaron `console.log`/respuestas que devuelvan *stack traces* o detalles de la base de datos al cliente.
- **Sin `innerHTML` en el frontend auditado**: ya señalado en la sección 1 — todo el contenido dinámico de `observabilidad.js` se inserta con `textContent`, lo que elimina el vector de XSS vía inyección de HTML/scripts a través de datos del propio registro de observabilidad (que es local, vía `localStorage`, pero igual queda cerrado el vector).
- **Dashboard protegido por rol**: el panel de observabilidad está gateado a usuarios `OPERADOR` vía `sessionStorage` (según lo revisado en sesiones previas de este proyecto) — no es de acceso público por diseño.

### Hallazgo de seguridad relevante (no es una vulnerabilidad de código, es de configuración de despliegue)

| Severidad | Hallazgo | Evidencia |
|---|---|---|
| Alto (operativo, no de código) | `OPERADOR_PASSWORD=admin` en el `.env` real tiene solo 5 caracteres. En desarrollo el seed la acepta igual; si este mismo valor llegara a usarse en producción, `OperadorSeed` la **rechaza** (política de mínimo 8 caracteres cuando `NODE_ENV==='production'`), por lo que la cuenta de operador simplemente no se crearía — un fallo silencioso, no una contraseña débil expuesta. | `src/modules/auth/seeds/operador.seed.ts` (longitud mínima en producción) + `.env` real de desarrollo |
| Medio (config, no código) | No hay configuración SSL explícita en la conexión de TypeORM/`pg` (`src/app.module.ts:26-31`). Para desarrollo local no importa, pero proveedores como Neon exigen SSL; sin `ssl: { rejectUnauthorized: ... }` en la URL o en las opciones de conexión, la conexión a producción puede fallar o (peor) negociar sin cifrado si el proveedor lo permitiera. | `src/app.module.ts:26-31` |
| Bajo | `localStorage` se usa como almacenamiento del registro de observabilidad (`script.js`). No contiene credenciales, pero cualquier script que corra en el mismo origen podría leerlo; es un riesgo aceptado y razonable para un panel de métricas internas, no una fuga de datos sensibles. | `script.js` (uso de `localStorage` para el registro de eventos) |

Estos dos primeros puntos son los mismos que bloquean el despliegue en Railway/Neon (ver pendientes del proyecto) y no fixes del HTML/CSS/JS auditado — se documentan aquí porque la consigna pedía evaluar "seguridad de la página" de forma integral.

### Lo que no se evaluó (fuera del alcance de esta auditoría de solo lectura)
- Pruebas de penetración activas (fuzzing, intentos reales de bypass de CORS/CSRF).
- Auditoría de dependencias (`npm audit`/`Snyk`) de las versiones exactas de `helmet`, `bcryptjs`, `pg`, `typeorm` listadas en `package.json`.
- Gestión de secretos en producción (cómo se inyectará `JWT_SECRET`/`DATABASE_URL` en Railway) — se abordará en la fase de despliegue.

---

## 7. Los estilos arquitectónicos

El backend sigue, en términos de estilo arquitectónico, un diseño **monolito modular (modular monolith) con API REST** sobre NestJS:

- **REST + API-first**: todos los endpoints se exponen bajo el prefijo `api/v1` (`main.ts:11`), documentados con OpenAPI/Swagger (`DocumentBuilder` + `SwaggerModule.setup('api/docs', app, document)`, `main.ts:56-65`), lo que corresponde al estilo **API-first**: el contrato (`/api/docs`) es generado directamente del código con decoradores (`@ApiOperation`, `@ApiResponse`, DTOs tipados), así que el contrato nunca puede desincronizarse silenciosamente del comportamiento real.
- **Errores uniformes (RFC 7807 — Problem Details)**: el filtro global `ProblemDetailsFilter` adopta el estándar RFC 7807 para las respuestas de error, un patrón de diseño de API REST madura que facilita la interoperabilidad con cualquier cliente (no solo el frontend propio).
- **Arquitectura por capas dentro de cada módulo** (patrón típico de NestJS): Controller (HTTP) → Service (lógica de negocio) → Repository/DataSource (TypeORM, acceso a datos) → Entity (modelo). Se ve claramente en `reportes.service.ts` (el `ReportesService` no conoce HTTP, solo recibe parámetros y devuelve datos; el controlador —no mostrado aquí— es el que traduce HTTP ↔ servicio).
- **Modularidad por dominio (feature modules)**: la carpeta `src/modules/` separa `atracciones`, `auth`, `alojamientos`, `autos`, `vuelos` — cada uno es un módulo NestJS independiente con sus propios controladores, servicios, DTOs y entidades. En `app.module.ts` se ve explícitamente que solo el módulo del dominio de cada grupo se descomenta (`AtraccionesModule` activo; `AlojamientosModule`, `AutosModule`, `VuelosModule` comentados) — confirma que el proyecto completo (Booking Prototipo) está diseñado como **varios monolitos modulares independientes por dominio**, cada grupo despliega el suyo, no un monolito único compartido ni microservicios reales todavía.
- **Transversal (cross-cutting concerns) vía decoradores y guards globales**: autenticación (JWT Guard), autorización por rol, rate limiting (`ThrottlerGuard` como `APP_GUARD` global), validación (`ValidationPipe` global) y manejo de errores (filtro global) se aplican de forma declarativa y centralizada — el estilo arquitectónico de NestJS basado en decoradores/inyección de dependencias (inspirado en Angular/Spring).
- **Frontend**: SPA (Single Page Application) con React + Vite, consumiendo la API REST del backend vía `fetch`/cliente HTTP propio (`api.ts`) — estilo cliente-servidor desacoplado clásico, sin renderizado del lado del servidor.
- **No hay (todavía) arquitectura orientada a eventos (EDA) real**: no se encontró ningún *message broker*, cola, *event bus* o publicación/suscripción entre servicios en el código backend revisado — el único `subscribe`/`publish` presente es el patrón observador **dentro del navegador** (`script.js`, `observabilidad.js`), que es un mecanismo de UI (JS puro, sin red), no una arquitectura EDA entre sistemas. Esto es relevante para el punto 8 del criterio de calificación ("diseño preliminar de arquitectura orientada a eventos/servicios"): hoy el proyecto es **API-first/REST**, no EDA; si la rúbrica exige evidencia de un diseño EDA preliminar, se necesitaría documentar (no necesariamente implementar) cómo se vería, por ejemplo, un evento `ReservaConfirmada` publicado hacia los otros dominios (Alojamientos, Autos, Vuelos) del proyecto grupal.

**En síntesis**: el estilo arquitectónico actual es **REST / API-first sobre un monolito modular por dominio**, con buenas prácticas de capas y transversalidad típicas de NestJS. Es coherente y bien ejecutado para lo que es; lo que falta (si la rúbrica lo exige explícitamente) es la *documentación* de un diseño preliminar orientado a eventos, no una reescritura del código.

---

## 8. Cómo está la arquitectura

Vista de conjunto, basada en lo inspeccionado directamente en el repositorio:

```
┌─────────────────────────────┐        HTTPS / REST (JSON)        ┌──────────────────────────────┐
│   Frontend (Netlify)        │ ───────────────────────────────▶ │   Backend (Railway)           │
│   React + Vite (SPA)        │ ◀─────────────────────────────── │   NestJS 10 (api/v1)           │
│   frontend/src/*            │                                   │   src/modules/*                │
│   frontend/public/admin/*   │                                   │                                 │
│   (observabilidad.*, script.js) │                               │  Controller → Service → Entity │
└─────────────────────────────┘                                   │  Guards: JWT, Throttler, Roles │
                                                                    │  Pipes: ValidationPipe global  │
        Google OAuth (GIS) ──────▶ verificación JWKS ─────────────▶│  Filters: ProblemDetailsFilter │
                                                                    │  Docs: Swagger/OpenAPI /api/docs│
                                                                    └───────────────┬────────────────┘
                                                                                     │ TypeORM (pg)
                                                                                     ▼
                                                                     ┌──────────────────────────────┐
                                                                     │   PostgreSQL (Neon)           │
                                                                     │   tablas: usuarios, atracciones,│
                                                                     │   reservas, ubicaciones_atraccion│
                                                                     └──────────────────────────────┘
```

- **Capa de presentación**: SPA React/Vite (`frontend/src/`) + un pequeño conjunto de páginas HTML/JS estáticas servidas directamente por Vite desde `frontend/public/` (el panel `observabilidad.html` y el instrumentador `script.js` que es el objeto de esta auditoría). Ambas rutas de frontend terminan desplegadas juntas en Netlify como un solo sitio estático.
- **Capa de API/aplicación**: NestJS, organizado por módulo de dominio (`atracciones`, `auth`, y los módulos comentados de los otros dominios del proyecto grupal). Cada módulo contiene sus propios controladores, DTOs, entidades y servicios; `CommonModule` agrupa filtros/guards/transformadores compartidos (`src/common/`).
- **Capa transversal (cross-cutting)**: aplicada globalmente desde `main.ts`/`app.module.ts` — seguridad HTTP (`helmet`), CORS, rate limiting (`ThrottlerGuard` como `APP_GUARD`), validación de entrada (`ValidationPipe`), manejo uniforme de errores (`ProblemDetailsFilter`, RFC 7807), documentación autogenerada (Swagger en `/api/docs`).
- **Capa de persistencia**: PostgreSQL vía TypeORM, con `autoLoadEntities: true` y `synchronize` condicionado a `NODE_ENV!=='production'` (sin migraciones formales — este es el punto que hay que resolver antes de apuntar a una base Neon nueva en producción, documentado en la sección 6 y en los pendientes del proyecto).
- **Autenticación**: JWT propio (`@nestjs/jwt`, emisor `atracciones-api`) para login con correo/contraseña, más inicio de sesión social solo con Google (verificación del `id_token` contra las claves públicas JWKS de Google en `proveedores-sociales.ts`, sin SDK de Facebook ya que fue removido de esta rama de trabajo).
- **Observabilidad**: capa de instrumentación cliente-side (`script.js`) que registra eventos de la SPA en `localStorage` del propio navegador, consumida y visualizada solo por el panel `observabilidad.html/.css/.js`, gateado a usuarios con rol `OPERADOR`. Es observabilidad *client-side*, no telemetría centralizada en el backend (no hay, por ejemplo, un endpoint `/metrics` ni integración con un backend de logs/APM) — razonable para el alcance académico del proyecto, pero vale mencionarlo como límite de la arquitectura actual si la defensa pregunta por monitoreo "real".
- **Despliegue objetivo** (en curso, parte de las tareas pendientes de este proyecto): Neon (Postgres administrado) + Railway (backend NestJS, contenedor/build automático) + Netlify (frontend estático, build de Vite). Las tres piezas se comunican por HTTPS; el dominio de Netlify deberá añadirse tanto a `CORS_ORIGINS`/`FRONTEND_URL` del backend como a los orígenes autorizados de Google Cloud OAuth una vez exista.

---

*Auditoría realizada el 2026-10-06 sobre el estado del código en el momento de la revisión. No se modificó ningún archivo durante esta auditoría.*
