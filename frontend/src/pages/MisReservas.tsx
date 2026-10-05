import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Reservation } from '../types';
import { precioTexto } from '../ciudades';
import { useAuth } from '../auth';
import EstadoReserva from '../components/EstadoReserva';
import BotonCopiar from '../components/BotonCopiar';
import CodigoQR from '../components/CodigoQR';
import { codigoCorto, urlVerificacion } from '../reservas';
import { EstadoError, EstadoVacio, MensajeError } from '../components/Estados';

const POR_PAGINA = 6;

/** Historial de reservas del cliente que inició sesión (GET /atracciones/reservations con su token) */
export default function MisReservas() {
  const { usuario } = useAuth();
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [cancelando, setCancelando] = useState<string | null>(null);

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

  // POST /atracciones/reservations/{id}/cancel
  const cancelar = async (r: Reservation) => {
    if (!window.confirm('¿Seguro que quieres cancelar esta reserva? Esta acción no se puede deshacer.')) return;
    setError('');
    setCancelando(r.reservation_id);
    try {
      await api.cancelarReserva(r.reservation_id, 'Cancelada por el cliente');
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelando(null);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <section className="angosto" aria-labelledby="titulo-mis-reservas">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-mis-reservas">Mis reservas</h1>
          <p>
            {usuario?.name}
            {cargando ? '' : `, tienes ${total} ${total === 1 ? 'reserva' : 'reservas'}`}
          </p>
        </div>
      </header>

      {error && <MensajeError>{error}</MensajeError>}

      {errorCarga ? (
        <EstadoError mensaje={errorCarga} onReintentar={cargar} />
      ) : cargando ? (
        <div className="lista-reservas" aria-busy="true">
          <p className="sr-only" role="status">Cargando tus reservas…</p>
          {[0, 1].map((i) => (
            <div key={i} className="pase pase--cargando-corto fantasma" aria-hidden="true" />
          ))}
        </div>
      ) : reservas.length === 0 ? (
        <EstadoVacio titulo="Todavía no tienes reservas">
          <p>Elige el aeropuerto al que llegas y reserva tu primera atracción.</p>
          <Link to="/explorar" className="btn">
            Explorar atracciones
          </Link>
        </EstadoVacio>
      ) : (
        <ul className="lista-reservas">
          {reservas.map((r) => (
            <li key={r.reservation_id} className="pase">
              <div className="pase-cuerpo">
                <p className="codigo-corto-etiqueta">Código de reserva</p>
                <p className="codigo-corto">{codigoCorto(r.reservation_id)}</p>
                <dl className="pase-datos">
                  <div>
                    <dt>Estado</dt>
                    <dd>
                      <EstadoReserva estado={r.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Entradas</dt>
                    <dd>{r.ticket_count}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{precioTexto(r.total_price)}</dd>
                  </div>
                </dl>
                {r.status !== 'CANCELLED' && (
                  <details className="ver-qr">
                    <summary>Mostrar QR de la entrada</summary>
                    <CodigoQR valor={urlVerificacion(r.reservation_id)} etiqueta={`Código QR de la reserva ${codigoCorto(r.reservation_id)}`} tamano={160} />
                  </details>
                )}
                <div className="codigo-reserva">
                  <span>{r.reservation_id}</span>
                  <BotonCopiar texto={r.reservation_id} />
                </div>
              </div>
              {r.status !== 'CANCELLED' && (
                <div className="pase-pie">
                  <button
                    type="button"
                    className="btn-texto btn-texto--peligro"
                    onClick={() => cancelar(r)}
                    disabled={cancelando === r.reservation_id}
                  >
                    {cancelando === r.reservation_id ? 'Cancelando…' : 'Cancelar reserva'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {total > POR_PAGINA && (
        <nav className="paginacion" aria-label="Paginación de mis reservas">
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
      )}
    </section>
  );
}
