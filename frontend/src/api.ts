import type {
  Atraccion, AtraccionInput, Availability, PaginatedAtracciones, ProblemDetails,
  Reservation, ReservationRequest, SearchResponse, TokenResponse,
} from './types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// ---------- Token de la sesión ----------
// Lo guarda el AuthProvider (auth.tsx). Aquí solo se agrega a cada petición como "Authorization: Bearer".
let tokenActual: string | null = null;

export function establecerToken(token: string | null) {
  tokenActual = token;
}

function cabecerasAuth(): Record<string, string> {
  return tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {};
}

/** Evento que avisa a la app que el token venció o ya no es válido (respuesta 401) */
export const EVENTO_SESION_VENCIDA = 'sesion-vencida';

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
    headers: { 'Content-Type': 'application/json', ...cabecerasAuth(), ...(options.headers ?? {}) },
  });
  if (!res.ok) await lanzarError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Convierte la respuesta de error del backend (RFC 7807) en un ApiError */
async function lanzarError(res: Response): Promise<never> {
  if (res.status === 401 && tokenActual) window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
  const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
  throw new ApiError(problem ?? { type: 'error', title: `Error ${res.status}`, status: res.status });
}

/** Fecha de hoy (YYYY-MM-DD) más N días */
export function fechaMasDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA'); // formato YYYY-MM-DD en hora local
}

export const api = {
  // ---------- Cuenta ----------
  login: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  registro: (name: string, email: string, password: string) =>
    request<TokenResponse>('/auth/registro', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  // ---------- Catálogo ----------
  listar: (limit = 12, offset = 0) =>
    request<PaginatedAtracciones>(`/atracciones?limit=${limit}&offset=${offset}`),

  /** POST /atracciones/search  (sort.by: most_popular, top_rated, price_asc, price_desc) */
  buscar: (cities: number[], orden = 'most_popular', next_page?: string) =>
    request<SearchResponse>('/atracciones/search', {
      method: 'POST',
      body: JSON.stringify({
        currency: 'USD',
        cities,
        countries: ['ec'],
        dates: { start_date: fechaMasDias(0), end_date: fechaMasDias(30) },
        rows: 12,
        sort: { by: orden },
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

  /** Paginado: el contrato devuelve un arreglo, y el total viene en la cabecera X-Total-Count */
  listarReservas: async (limit = 10, offset = 0) => {
    const res = await fetch(`${API}/atracciones/reservations?limit=${limit}&offset=${offset}`, {
      cache: 'no-store',
      headers: cabecerasAuth(),
    });
    if (!res.ok) await lanzarError(res);
    const data = (await res.json()) as Reservation[];
    const total = Number(res.headers.get('X-Total-Count') ?? data.length);
    return { data, total };
  },

  obtenerReserva: (id: string) => request<Reservation>(`/atracciones/reservations/${id}`),

  cancelarReserva: (id: string, reason: string) =>
    request<Reservation>(`/atracciones/reservations/${id}/cancel`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ reason }),
    }),
};