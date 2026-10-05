import type { ReservationStatus } from '../types';

const ESTADOS: Record<ReservationStatus, { texto: string; clase: string }> = {
  CONFIRMED: { texto: 'Confirmada', clase: 'pastilla pastilla--ok' },
  PENDING: { texto: 'Pendiente', clase: 'pastilla pastilla--pendiente' },
  CANCELLED: { texto: 'Cancelada', clase: 'pastilla pastilla--cancelada' },
};

/** Estado de la reserva con color y texto (nunca solo color, por accesibilidad) */
export default function EstadoReserva({ estado }: { estado: ReservationStatus }) {
  const e = ESTADOS[estado];
  return <span className={e.clase}>{e.texto}</span>;
}
