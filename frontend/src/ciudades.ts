/**
 * Nombres de las ciudades con aeropuerto, para mostrarlas en pantalla.
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

export function nombreCiudad(id: number) {
  const c = CIUDADES.find((x) => x.id === id);
  return c ? `${c.nombre} (${c.iata})` : `Ciudad ${id}`;
}

export const TIPOS_PRODUCTO: Record<string, string> = {
  SINGLE_TICKET: 'Entrada',
  GUIDED_TOUR: 'Tour guiado',
  PACKAGE: 'Paquete',
};

/** PT6H -> "6 h", PT1H30M -> "1 h 30 min" */
export function formatoDuracion(iso: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  if (!m) return iso;
  const partes = [];
  if (m[1]) partes.push(`${m[1]} h`);
  if (m[2]) partes.push(`${m[2]} min`);
  return partes.join(' ') || iso;
}