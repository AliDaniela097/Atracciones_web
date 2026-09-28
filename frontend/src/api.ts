import type {
  Atraccion, AtraccionInput, Availability, PaginatedAtracciones, ProblemDetails,
  Reservation, ReservationRequest, SearchResponse,
} from './types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/** Error con el mensaje que devolvió el backend (formato RFC 7807) */
export class ApiError extends Error {
  status: number;
  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.status = problem.status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    // El backend envía Cache-Control: max-age=300 (como pide el contrato).
    // En esta app siempre queremos datos frescos (por ejemplo, después de editar en el admin).
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
    throw new ApiError(problem ?? { type: 'error', title: `Error ${res.status}`, status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Fecha de hoy (YYYY-MM-DD) más N días */
export function fechaMasDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA'); // formato YYYY-MM-DD en hora local
}

export const api = {
  // ---------- Catálogo ----------
  listar: (limit = 12, offset = 0) =>
    request<PaginatedAtracciones>(`/atracciones?limit=${limit}&offset=${offset}`),

  buscar: (cities: number[], next_page?: string) =>
    request<SearchResponse>('/atracciones/search', {
      method: 'POST',
      body: JSON.stringify({
        currency: 'USD',
        cities,
        countries: ['ec'],
        dates: { start_date: fechaMasDias(0), end_date: fechaMasDias(30) },
        rows: 12,
        sort: { by: 'most_popular' },
        ...(next_page ? { next_page } : {}),
      }),
    }),

  obtener: (id: string) => request<Atraccion>(`/atracciones/${id}`),

  crear: (data: AtraccionInput) =>
    request<Atraccion>('/atracciones', { method: 'POST', body: JSON.stringify(data) }),

  reemplazar: (id: string, data: AtraccionInput) =>
    request<void>(`/atracciones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  eliminar: (id: string) => request<void>(`/atracciones/${id}`, { method: 'DELETE' }),

  disponibilidad: (id: string, date: string) =>
    request<Availability>(`/atracciones/${id}/availability?date=${date}`),

  // ---------- Reservas ----------
  /** La Idempotency-Key se genera UNA vez por intento de compra y se reutiliza si hay que reintentar */
  reservar: (id: string, data: ReservationRequest, idempotencyKey: string) =>
    request<Reservation>(`/atracciones/${id}/reservations`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(data),
    }),

  listarReservas: () => request<Reservation[]>('/atracciones/reservations'),

  obtenerReserva: (id: string) => request<Reservation>(`/atracciones/reservations/${id}`),

  cancelarReserva: (id: string, reason: string) =>
    request<Reservation>(`/atracciones/reservations/${id}/cancel`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ reason }),
    }),
};