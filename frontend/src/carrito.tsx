import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Una línea del carrito: una atracción, en una fecha y horario, con N entradas */
export interface LineaCarrito {
  id: string; // identificador de la línea
  atraccionId: string;
  nombre: string;
  ciudadId?: number;
  foto?: string;
  fecha: string; // YYYY-MM-DD
  hora?: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  /**
   * Idempotency-Key de esta línea. Se genera una sola vez: si el pago se reintenta,
   * el backend reconoce la clave y no crea la reserva dos veces.
   */
  claveIdempotencia: string;
  /** Error del último intento de pago de esta línea (por ejemplo, sin cupos) */
  error?: string;
}

export const MAX_ENTRADAS_POR_LINEA = 20;

interface ContextoCarrito {
  lineas: LineaCarrito[];
  cantidadTotal: number;
  total: number;
  agregar: (l: Omit<LineaCarrito, 'id' | 'claveIdempotencia'>) => void;
  cambiarCantidad: (id: string, cantidad: number) => void;
  quitar: (id: string) => void;
  marcarError: (id: string, error: string) => void;
  vaciar: () => void;
  /** Entradas que ya están en el carrito para una atracción y fecha (para no pasarse del cupo) */
  enCarrito: (atraccionId: string, fecha: string) => number;
}

const CarritoContext = createContext<ContextoCarrito | null>(null);
const LLAVE = 'atracciones.carrito';

/** El carrito se guarda en el navegador para que no se pierda al recargar la página */
function leer(): LineaCarrito[] {
  try {
    const datos = JSON.parse(localStorage.getItem(LLAVE) ?? '[]');
    return Array.isArray(datos) ? (datos as LineaCarrito[]) : [];
  } catch {
    return [];
  }
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>(leer);

  useEffect(() => {
    try {
      localStorage.setItem(LLAVE, JSON.stringify(lineas));
    } catch {
      /* sin almacenamiento: el carrito vive solo en memoria */
    }
  }, [lineas]);

  const agregar = useCallback((l: Omit<LineaCarrito, 'id' | 'claveIdempotencia'>) => {
    setLineas((prev) => {
      // Misma atracción, fecha y horario: se suman las entradas en la misma línea
      const igual = prev.find((x) => x.atraccionId === l.atraccionId && x.fecha === l.fecha && x.hora === l.hora);
      if (igual) {
        return prev.map((x) =>
          x === igual
            ? {
                ...x,
                cantidad: Math.min(x.cantidad + l.cantidad, MAX_ENTRADAS_POR_LINEA),
                claveIdempotencia: crypto.randomUUID(), // cambió la cantidad: es otra operación
                error: undefined,
              }
            : x,
        );
      }
      return [...prev, { ...l, id: crypto.randomUUID(), claveIdempotencia: crypto.randomUUID() }];
    });
  }, []);

  const cambiarCantidad = useCallback((id: string, cantidad: number) => {
    const n = Math.max(1, Math.min(Math.round(cantidad) || 1, MAX_ENTRADAS_POR_LINEA));
    setLineas((prev) =>
      prev.map((x) => (x.id === id ? { ...x, cantidad: n, claveIdempotencia: crypto.randomUUID(), error: undefined } : x)),
    );
  }, []);

  const quitar = useCallback((id: string) => setLineas((prev) => prev.filter((x) => x.id !== id)), []);
  const marcarError = useCallback(
    (id: string, error: string) => setLineas((prev) => prev.map((x) => (x.id === id ? { ...x, error } : x))),
    [],
  );
  const vaciar = useCallback(() => setLineas([]), []);

  const valor = useMemo<ContextoCarrito>(
    () => ({
      lineas,
      cantidadTotal: lineas.reduce((s, l) => s + l.cantidad, 0),
      total: Number(lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0).toFixed(2)),
      agregar,
      cambiarCantidad,
      quitar,
      marcarError,
      vaciar,
      enCarrito: (atraccionId, fecha) =>
        lineas.filter((l) => l.atraccionId === atraccionId && l.fecha === fecha).reduce((s, l) => s + l.cantidad, 0),
    }),
    [lineas, agregar, cambiarCantidad, quitar, marcarError, vaciar],
  );

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return ctx;
}

/** "2026-10-20" -> "martes, 20 de octubre de 2026" */
export function fechaLarga(fecha: string) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function dinero(valor: number) {
  return valor === 0 ? 'Gratis' : `$${valor.toFixed(2)}`;
}
