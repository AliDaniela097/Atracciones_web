// Tipos que reflejan EXACTAMENTE los JSON del contrato atracciones-openapi.yaml

export type ProductType = 'SINGLE_TICKET' | 'GUIDED_TOUR' | 'PACKAGE';
export type ReservationStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export interface Price {
  currency: string;
  total: number;
}

export interface Location {
  address: string;
  city: number;
  country: string;
  coordinates: { latitude: number; longitude: number };
  type?: string;
}

export interface Atraccion {
  id: string;
  name: string;
  long_description: string;
  duration: string;
  price: Price;
  operator: { id: number; name: string };
  product_type: ProductType;
  includes: string[];
  categories: string[];
  badges: string[];
  locations: Location[];
  photos: { url: string }[];
  supported_languages: string[];
  free_cancellation: boolean;
  ratings?: { number_of_reviews: number; score: number };
}

/** Lo que se envía al crear o reemplazar (CreateAtraccionRequest) */
export type AtraccionInput = Omit<Atraccion, 'id' | 'ratings'>;

export interface PaginatedAtracciones {
  data: Atraccion[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface SearchResponse {
  data: Atraccion[];
  metadata: { total_results: number; next_page?: string };
  request_id: string;
}

export interface Availability {
  date: string;
  available_spots: number;
  times: string[];
}

export interface ReservationRequest {
  date: string;
  time?: string;
  ticket_count: number;
  customer_name: string;
  customer_email?: string;
}

export interface Reservation {
  reservation_id: string;
  status: ReservationStatus;
  ticket_count: number;
  total_price: Price;
}

/** Formato de error RFC 7807 que devuelve el backend */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
// ---------- Autenticación (POST /auth/login y /auth/registro) ----------
export type Rol = 'CLIENTE' | 'OPERADOR';

export interface Usuario {
  id: string;
  name: string;
  email: string;
  role: Rol;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  user: Usuario;
}

// ---------- Reporte de ventas del operador (GET /reportes/ventas, endpoint interno) ----------
export interface ReporteVentas {
  moneda: string;
  periodo: { desde: string; hasta: string };
  generadoEn: string;
  resumen: {
    reservas: number;
    confirmadas: number;
    canceladas: number;
    entradasVendidas: number;
    ingresos: number;
    montoCancelado: number;
    ticketPromedio: number;
    clientes: number;
  };
  porAtraccion: { id: string; nombre: string; ciudadId: number | null; reservas: number; entradas: number; ingresos: number; canceladas: number }[];
  porAeropuerto: { ciudadId: number; nombre: string; iata: string; reservas: number; entradas: number; ingresos: number }[];
  porDia: { fecha: string; reservas: number; entradas: number; ingresos: number }[];
  ultimas: {
    id: string;
    fechaCompra: string;
    fechaVisita: string;
    hora: string | null;
    atraccion: string;
    entradas: number;
    total: number;
    moneda: string;
    estado: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
    cliente: string;
    email: string | null;
  }[];
}

/** GET /auth/proveedores: inicios de sesión sociales configurados en el servidor */
export interface ProveedoresSociales {
  google: { clientId: string } | null;
  facebook: { appId: string } | null;
}

/** GET /reportes/reservas/{codigo}: verificación de una entrada (operador) */
export interface VerificacionReserva {
  id: string;
  estado: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  entradas: number;
  total: number;
  moneda: string;
  fechaVisita: string;
  hora: string | null;
  fechaCompra: string;
  cliente: string;
  motivoCancelacion: string | null;
  atraccionId: string;
  atraccion: string;
  ciudadId: number | null;
  valida: boolean;
  vencida: boolean;
}
