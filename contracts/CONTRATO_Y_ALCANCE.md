# Contrato de la API de Atracciones y alcance de la implementación

Proyecto: **Atracciones Web** (dominio Atracciones del proyecto grupal "Booking Prototipo")
Contrato fuente: `contracts/atracciones-openapi.yaml` (OpenAPI 3.0.3, versión 1.2.0)
Ruta base de la API: `/api/v1` · Documentación interactiva: `/api/docs` (Swagger)

Este documento compara tres cosas: lo que **pide el contrato**, lo que se **agregó** por encima del contrato y lo que el contrato **menciona pero no se implementó**.

---

## 1. Lo que pide el contrato (14 operaciones, todas implementadas)

| # | Método y ruta | Permiso (scope) en el contrato | Estado en la implementación |
|---|---|---|---|
| 1 | `POST /atracciones/search` | `attractions:read` | Implementado, público |
| 2 | `POST /atracciones/details` (por lote) | `attractions:read` | Implementado, público |
| 3 | `GET /atracciones/health` | ninguno | Implementado |
| 4 | `GET /atracciones` (lista paginada) | `attractions:read` | Implementado, público |
| 5 | `POST /atracciones` (crear) | `attractions:write` | Implementado, protegido |
| 6 | `GET /atracciones/{id}` | `attractions:read` | Implementado, público |
| 7 | `PUT /atracciones/{id}` | `attractions:write` | Implementado, protegido |
| 8 | `PATCH /atracciones/{id}` | `attractions:write` | Implementado, protegido |
| 9 | `DELETE /atracciones/{id}` | `attractions:write` | Implementado, protegido (borrado lógico) |
| 10 | `GET /atracciones/{id}/availability` | `attractions:read` | Implementado, público |
| 11 | `POST /atracciones/{id}/reservations` | `attractions:book` | Implementado, protegido, con `Idempotency-Key` |
| 12 | `POST /atracciones/reservations/{reservationId}/cancel` | `attractions:cancel` | Implementado, protegido, con `Idempotency-Key` |
| 13 | `GET /atracciones/reservations` | `attractions:read` | Implementado, protegido |
| 14 | `GET /atracciones/reservations/{reservationId}` | `attractions:read` | Implementado, protegido |

### Reglas generales del contrato

- Los endpoints transaccionales (reservar y cancelar) exigen la cabecera `Idempotency-Key` (UUID v4) para evitar reservas o cancelaciones duplicadas.
- Los errores siguen el estándar RFC 7807 (`application/problem+json`). El contrato define las respuestas 404 y 409.
- **Reserva (`ReservationRequest`):** campos obligatorios `date`, `ticket_count` y `customer_name`; opcionales `time` y `customer_email`.
- **Cancelación (`CancelReservationRequest`):** campo obligatorio `reason`.

### Esquemas definidos en el contrato

ProblemDetails, Price, Coordinates, Location, Photo, Operator, Rating, Url, DetailsRequest, SearchAtraccionesRequest, SearchAtraccionesResponse, CreateAtraccionRequest, UpdateAtraccionRequest, AtraccionResponse, PaginatedAtraccionResponse, AvailabilityResponse, ReservationRequest, ReservationResponse, CancelReservationRequest.

---

## 2. Lo que se agregó y el contrato no pide

### Endpoints adicionales

| Método y ruta | Para qué sirve | Permiso |
|---|---|---|
| `POST /auth/registro` | Registrar un cliente | Público |
| `POST /auth/login` | Iniciar sesión con correo y contraseña, devuelve JWT | Público |
| `GET /auth/proveedores` | Indica qué proveedores de acceso están disponibles | Público |
| `POST /auth/google` | Iniciar sesión con Google (verificado en el servidor) | Público |
| `GET /auth/me` | Datos del usuario autenticado | `attractions:read` |
| `GET /reportes/ventas` | Reporte de ventas para el panel de administración | `attractions:write` |
| `GET /reportes/reservas/:codigo` | Verificar una reserva por código | `attractions:write` |
| `GET /administradores` | Listar cuentas de administrador (solo el administrador principal) | `attractions:write` |
| `POST /administradores` | Crear un administrador; el correo se arma solo: `nombre.apellido@atracciones.ec` (solo el principal) | `attractions:write` |
| `DELETE /administradores/:id` | Eliminar un administrador; el principal no se puede eliminar (solo el principal) | `attractions:write` |

### Extensión a una operación del contrato

| Operación | Qué se agregó | Compatibilidad |
|---|---|---|
| `POST /atracciones/search` | Campo opcional `query` (texto libre, máximo 100 caracteres). Busca en nombre, descripción, categorías y dirección, sin distinguir mayúsculas ni tildes. Con varias palabras, todas deben aparecer. | Compatible hacia atrás: sin `query` responde igual que el contrato del grupo. |

En el frontend, la lupa de la barra superior usa este campo: sugiere atracciones mientras se escribe y el catálogo acepta `?q=texto`.

### Comportamiento adicional

- Autenticación con JWT propio y dos roles: CLIENTE (leer, reservar, cancelar) y OPERADOR (leer, cancelar, escribir).
- Administrador principal (`OPERADOR_EMAIL`): crea y elimina otros administradores desde el panel. Una cuenta eliminada pierde el acceso de inmediato.
- Contraseñas con hash bcrypt.
- Límite de 100 peticiones por minuto por IP.
- Cabeceras de seguridad (helmet) y CORS restringido por variable de entorno.
- Validación de entradas (`whitelist`, `forbidNonWhitelisted`).
- Validación de cupos con transacción y bloqueo de fila para evitar sobreventa.
- Frontend completo en React: catálogo, detalle, carrito, checkout, mis reservas y panel de administración.
- Buscador de la barra superior: aeropuertos (ciudad o código) y atracciones (texto libre).

---

## 3. Lo que el contrato menciona y no se implementó

| Elemento del contrato | Estado | Explicación |
|---|---|---|
| Permiso `attractions:webhooks` | No implementado | No existen endpoints de webhooks. |
| Servidor OAuth externo (`auth.booking-hub.com`) | No usado | La API emite su propio JWT con los mismos nombres de permisos. |
| `attractions:read` obligatorio en el catálogo | Lecturas públicas | Las consultas de catálogo y disponibilidad no exigen token. Fue permitido por el líder del grupo. |

---

## 4. Observaciones

- **Contrato con un bloque repetido:** la ruta `/atracciones/{id}` aparece dos veces en el YAML, con `PUT`, `PATCH` y `DELETE` duplicados. Es una duplicación del archivo y no afecta la implementación.
- **Código de la plantilla del curso:** en `src/modules/` quedan las carpetas `alojamientos`, `autos` y `vuelos`. Están comentadas en `app.module.ts`, por lo que no se ejecutan.
- **Pago:** no existe una pasarela de pago real. La reserva se confirma al crearla.
- **Datos de identificación:** el sistema no pide cédula. La reserva usa nombre del cliente, según el contrato.
