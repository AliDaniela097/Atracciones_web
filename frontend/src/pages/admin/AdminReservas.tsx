import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import type { Reservation } from '../../types';
import { precioTexto } from '../../ciudades';
import EstadoReserva from '../../components/EstadoReserva';
import { EstadoError, MensajeError } from '../../components/Estados';

const POR_PAGINA = 10;

export default function AdminReservas() {
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');

  // GET /atracciones/reservations?limit=&offset=  (el total viene en X-Total-Count)
  const cargar = useCallback(() => {
    setCargando(true);
    setErrorCarga('');
    api
      .listarReservas(POR_PAGINA, (pagina - 1) * POR_PAGINA)
      .then((r) => {
        setReservas(r.data);
        setTotal(r.total);
      })
      .catch((e: Error) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, [pagina]);

  useEffect(cargar, [cargar]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // POST /atracciones/reservations/{id}/cancel
  const cancelar = async (r: Reservation) => {
    const motivo = window.prompt('Motivo de la cancelación:', 'Cancelada por administración');
    if (!motivo) return;
    setError('');
    try {
      await api.cancelarReserva(r.reservation_id, motivo);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section aria-labelledby="titulo-reservas">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-reservas">Historial de reservas</h1>
          <p>{cargando ? 'Cargando…' : `${total} ${total === 1 ? 'reserva' : 'reservas'}, de la más reciente a la más antigua`}</p>
        </div>
      </header>

      {error && <MensajeError>{error}</MensajeError>}

      {errorCarga ? (
        <EstadoError mensaje={errorCarga} onReintentar={cargar} />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla" aria-busy={cargando}>
            <caption className="sr-only">Reservas, página {pagina} de {totalPaginas}</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Estado</th>
                <th scope="col" className="num">Entradas</th>
                <th scope="col" className="num">Total</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={5}>
                      <div className="fantasma fantasma--linea" style={{ margin: 0 }} />
                    </td>
                  </tr>
                ))}
              {!cargando && reservas.length === 0 && (
                <tr>
                  <td colSpan={5} className="sin-etiqueta">
                    Todavía no hay reservas. Aparecerán aquí cuando alguien reserve desde el catálogo.
                  </td>
                </tr>
              )}
              {!cargando &&
                reservas.map((r) => (
                  <tr key={r.reservation_id}>
                    <td data-etiqueta="Código" className="celda-codigo" title={r.reservation_id}>
                      {r.reservation_id.slice(0, 8)}
                    </td>
                    <td data-etiqueta="Estado">
                      <EstadoReserva estado={r.status} />
                    </td>
                    <td data-etiqueta="Entradas" className="num">{r.ticket_count}</td>
                    <td data-etiqueta="Total" className="num">{precioTexto(r.total_price)}</td>
                    <td className="sin-etiqueta">
                      {r.status !== 'CANCELLED' && (
                        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-texto btn-texto--peligro"
                            onClick={() => cancelar(r)}
                            aria-label={`Cancelar la reserva ${r.reservation_id.slice(0, 8)}`}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="paginacion" aria-label="Paginación de reservas">
        <button type="button" className="btn btn--suave" disabled={pagina <= 1 || cargando} onClick={() => setPagina(pagina - 1)}>
          Anterior
        </button>
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <button type="button" className="btn btn--suave" disabled={pagina >= totalPaginas || cargando} onClick={() => setPagina(pagina + 1)}>
          Siguiente
        </button>
      </nav>
    </section>
  );
}
