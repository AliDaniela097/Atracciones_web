import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { Reservation } from '../../types';

const ESTADOS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

export default function AdminReservas() {
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [error, setError] = useState('');

  const cargar = () => {
    api.listarReservas().then(setReservas).catch((e: Error) => setError(e.message));
  };
  useEffect(cargar, []);

  const cancelar = async (r: Reservation) => {
    const motivo = window.prompt('Motivo de la cancelación:', 'Cancelada por administración');
    if (!motivo) return;
    try {
      await api.cancelarReserva(r.reservation_id, motivo);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section>
      <div className="titulo-admin">
        <h1>Reservas</h1>
        <Link to="/admin" className="btn secundario">← Atracciones</Link>
      </div>

      {error && <p className="error">{error}</p>}

      <table className="tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Estado</th>
            <th>Entradas</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reservas.length === 0 && (
            <tr><td colSpan={5} className="muted">Todavía no hay reservas.</td></tr>
          )}
          {reservas.map((r) => (
            <tr key={r.reservation_id}>
              <td><code>{r.reservation_id}</code></td>
              <td>{ESTADOS[r.status]}</td>
              <td>{r.ticket_count}</td>
              <td>${r.total_price.total.toFixed(2)} {r.total_price.currency}</td>
              <td>
                {r.status !== 'CANCELLED' && (
                  <button className="link peligro" onClick={() => cancelar(r)}>Cancelar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}