import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Reservation } from '../types';

const ESTADOS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

export default function ConsultarReserva() {
  const [codigo, setCodigo] = useState('');
  const [reserva, setReserva] = useState<Reservation | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  const buscar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setReserva(null);
    try {
      setReserva(await api.obtenerReserva(codigo.trim()));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancelar = async () => {
    if (!reserva) return;
    setError('');
    try {
      setReserva(await api.cancelarReserva(reserva.reservation_id, motivo || 'Cancelada por el cliente'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="angosto">
      <h1>Mi reserva</h1>
      <form onSubmit={buscar} className="form fila">
        <input placeholder="Código de reserva" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        <button className="btn">Buscar</button>
      </form>

      {error && <p className="error">{error}</p>}

      {reserva && (
        <div className="panel">
          <p><strong>Código:</strong> <code>{reserva.reservation_id}</code></p>
          <p><strong>Estado:</strong> {ESTADOS[reserva.status]}</p>
          <p><strong>Entradas:</strong> {reserva.ticket_count}</p>
          <p><strong>Total:</strong> ${reserva.total_price.total.toFixed(2)} {reserva.total_price.currency}</p>

          {reserva.status !== 'CANCELLED' && (
            <div className="form">
              <label>
                Motivo de cancelación
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Opcional" />
              </label>
              <button className="btn peligro" onClick={cancelar}>Cancelar reserva</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}