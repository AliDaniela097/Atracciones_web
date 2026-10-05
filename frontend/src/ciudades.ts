import type { Atraccion, Price } from './types';

/**
 * Ciudades con aeropuerto (vuelos comerciales), para mostrarlas en pantalla.
 * Los ids DEBEN ser los mismos del seed del backend
 * (src/modules/atracciones/seeds/ciudades.seed.ts), porque el contrato
 * solo envía el número en "city".
 */
export const CIUDADES: { id: number; nombre: string; iata: string }[] = [
  { id: 1, nombre: 'Quito', iata: 'UIO' },
  { id: 2, nombre: 'Guayaquil', iata: 'GYE' },
  { id: 3, nombre: 'Cuenca', iata: 'CUE' },
  { id: 4, nombre: 'Manta', iata: 'MEC' },
  { id: 5, nombre: 'Loja (Catamayo)', iata: 'LOH' },
  { id: 6, nombre: 'Coca', iata: 'OCC' },
  { id: 7, nombre: 'Santa Rosa', iata: 'ETR' },
  { id: 8, nombre: 'Baltra (Galápagos)', iata: 'GPS' },
  { id: 9, nombre: 'San Cristóbal (Galápagos)', iata: 'SCY' },
];

/** Par de colores folclóricos de cada aeropuerto (portadas sin foto y tarjetas de inicio) */
const COLORES: Record<number, [string, string]> = {
  1: ['var(--coral)', 'var(--oro)'],
  2: ['var(--cielo)', 'var(--verde)'],
  3: ['var(--fucsia)', 'var(--oro)'],
  4: ['var(--cielo)', 'var(--oro)'],
  5: ['var(--verde)', 'var(--fucsia)'],
  6: ['var(--verde)', 'var(--cielo)'],
  7: ['var(--coral)', 'var(--verde)'],
  8: ['var(--cielo)', 'var(--coral)'],
  9: ['var(--verde)', 'var(--oro)'],
};

/** Variables CSS --c1 y --c2 con los colores del aeropuerto */
export function coloresCiudad(id?: number) {
  const [c1, c2] = COLORES[id ?? 0] ?? ['var(--coral)', 'var(--oro)'];
  return { '--c1': c1, '--c2': c2 } as Record<string, string>;
}

export function ciudadPorId(id?: number) {
  return CIUDADES.find((c) => c.id === id);
}

export function nombreCiudad(id: number) {
  const c = ciudadPorId(id);
  return c ? `${c.nombre} (${c.iata})` : `Ciudad ${id}`;
}

/** Ciudad de la primera ubicación de la atracción */
export function ciudadDe(a: Atraccion) {
  return ciudadPorId(a.locations[0]?.city);
}

export const TIPOS_PRODUCTO: Record<string, string> = {
  SINGLE_TICKET: 'Entrada',
  GUIDED_TOUR: 'Tour guiado',
  PACKAGE: 'Paquete',
};

export const ORDENES: { valor: string; texto: string }[] = [
  { valor: 'most_popular', texto: 'Más populares' },
  { valor: 'top_rated', texto: 'Mejor calificadas' },
  { valor: 'price_asc', texto: 'Precio: menor a mayor' },
  { valor: 'price_desc', texto: 'Precio: mayor a menor' },
];

const IDIOMAS: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  fr: 'Francés',
  de: 'Alemán',
  pt: 'Portugués',
  it: 'Italiano',
  qu: 'Kichwa',
};

export function nombreIdioma(codigo: string) {
  return IDIOMAS[codigo.toLowerCase().slice(0, 2)] ?? codigo.toUpperCase();
}

/** PT6H -> "6 h", PT1H30M -> "1 h 30 min" */
export function formatoDuracion(iso: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  if (!m) return iso;
  const partes = [];
  if (m[1]) partes.push(`${m[1]} h`);
  if (m[2]) partes.push(`${m[2]} min`);
  return partes.join(' ') || iso;
}

/** 0 -> "Gratis", 9 -> "$9.00" */
export function precioTexto(p: Price) {
  return p.total === 0 ? 'Gratis' : `$${p.total.toFixed(2)}`;
}

/** Quita tildes y mayúsculas para comparar textos ("Cuénca" = "cuenca") */
export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** -0.00222, -78.45583 -> "0°0′8″ S, 78°27′21″ O" (Ecuador está sobre la latitud 0) */
export function coordenadasTexto(lat: number, lng: number) {
  const gms = (v: number) => {
    const abs = Math.abs(v);
    const g = Math.floor(abs);
    const m = Math.floor((abs - g) * 60);
    const s = Math.round(((abs - g) * 60 - m) * 60);
    return `${g}°${m}′${s}″`;
  };
  return `${gms(lat)} ${lat < 0 ? 'S' : 'N'}, ${gms(lng)} ${lng < 0 ? 'O' : 'E'}`;
}
