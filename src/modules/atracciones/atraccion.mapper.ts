import { Atraccion } from './entities/atraccion.entity';
import { Reserva } from './entities/reserva.entity';
import { AtraccionResponseDto } from './dto/atraccion-response.dto';
import { ReservationResponseDto } from './dto/reservation.dto';

const BASE = '/api/v1/atracciones';
// Página pública de la atracción en el marketplace (campo "url.web" del contrato)
const WEB = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');

/**
 * Traduce una fila de la base de datos (nombres en español)
 * al JSON exacto que exige el contrato (nombres en inglés).
 */
export function toAtraccionResponse(a: Atraccion): AtraccionResponseDto {
  const fotos = [...(a.fotos ?? [])].sort((x, y) => x.orden - y.orden);

  return {
    id: a.id,
    name: a.nombre,
    long_description: a.descripcion,
    duration: a.duracion,
    price: { currency: a.moneda, total: a.precioTicket },
    operator: { id: a.operador?.id ?? a.operadorId, name: a.operador?.nombre ?? '' },
    product_type: a.tipoProducto,
    includes: a.incluye ?? [],
    categories: a.categorias ?? [],
    badges: a.insignias ?? [],
    locations: (a.ubicaciones ?? []).map((u) => ({
      address: u.direccion,
      city: u.ciudadId,
      country: u.pais,
      coordinates: { latitude: u.latitud, longitude: u.longitud },
      type: u.tipo ?? undefined,
    })),
    photos: fotos.map((f) => ({ url: f.url })),
    supported_languages: a.idiomas ?? [],
    free_cancellation: a.cancelacionGratuita,
    ratings: { number_of_reviews: a.numeroResenas, score: a.puntuacion ?? 0 },
    url: { web: `${WEB}/atraccion/${a.id}` },
    _links: {
      self: { href: `${BASE}/${a.id}`, method: 'GET' },
      actualizar: { href: `${BASE}/${a.id}`, method: 'PATCH' },
      eliminar: { href: `${BASE}/${a.id}`, method: 'DELETE' },
      disponibilidad: { href: `${BASE}/${a.id}/availability`, method: 'GET' },
      reservar: { href: `${BASE}/${a.id}/reservations`, method: 'POST' },
    },
  };
}

export function toReservationResponse(r: Reserva): ReservationResponseDto {
  return {
    reservation_id: r.id,
    status: r.estado,
    ticket_count: r.cantidadTickets,
    total_price: { currency: r.moneda, total: r.precioTotal },
  };
}