import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { Reservation } from '../../types';

const ESTADOS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
};

const POR_PAGINA = 10;

export default function AdminReservas() {
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  // GET /atracciones/reservations?limit=&offset=
  const cargar = () => {
    api
      .listarReservas(POR_PAGINA, (pagina - 1) * POR_PAGINA)
      .then((r) => {
        setReservas(r.data);
        setTotal(r.total);
      })
      .catch((e: Error) => setError(e.message));
  };
  useEffect(cargar, [pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

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

      <div className="paginacion">
        <button className="btn secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {totalPaginas} · {total} reservas</span>
        <button className="btn secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
    </section>
  );
}