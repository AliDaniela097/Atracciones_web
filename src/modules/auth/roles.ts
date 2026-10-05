/**
 * Roles del sistema y permisos (scopes) que da cada uno.
 * Los scopes son exactamente los del contrato atracciones-openapi.yaml (OAuth2Security).
 */
/** Nombre del metadato donde cada endpoint guarda los scopes que exige */
export const SCOPES_KEY = 'scopes_requeridos';

export enum Rol {
  CLIENTE = 'CLIENTE', // turista: reserva y cancela sus reservas
  OPERADOR = 'OPERADOR', // administra el catálogo y ve todas las reservas
}

export const SCOPES = {
  LEER: 'attractions:read',
  RESERVAR: 'attractions:book',
  CANCELAR: 'attractions:cancel',
  ESCRIBIR: 'attractions:write',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/**
 * El CLIENTE compra (book) y cancela lo suyo.
 * El OPERADOR administra: lee, escribe el catálogo y puede cancelar reservas, pero NO compra
 * (no tiene attractions:book). Así una cuenta administrativa nunca genera ventas.
 */
export const SCOPES_POR_ROL: Record<Rol, Scope[]> = {
  [Rol.CLIENTE]: [SCOPES.LEER, SCOPES.RESERVAR, SCOPES.CANCELAR],
  [Rol.OPERADOR]: [SCOPES.LEER, SCOPES.CANCELAR, SCOPES.ESCRIBIR],
};

/** Datos del usuario que viajan dentro del token y llegan a los controladores */
export interface UsuarioToken {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  scopes: string[];
}

export function esOperador(u: UsuarioToken) {
  return u.scopes.includes(SCOPES.ESCRIBIR);
}
