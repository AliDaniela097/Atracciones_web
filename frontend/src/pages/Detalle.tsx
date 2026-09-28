import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fechaMasDias } from '../api';
import type { Atraccion, Availability, Reservation } from '../types';
import { formatoDuracion, nombreCiudad, TIPOS_PRODUCTO } from '../ciudades';

export default function Detalle() {
  const { id = '' } = useParams();
  const [a, setA] = useState<Atraccion | null>(null);
  const [error, setError] = useState('');

  // Formulario de reserva
  const [fecha, setFecha] = useState(fechaMasDias(1));
  const [disp, setDisp] = useState<Availability | null>(null);
  const [hora, setHora] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reserva, setReserva] = useState<Reservation | null>(null);
  const [errorReserva, setErrorReserva] = useState('');
  // Una clave por intento de compra: si hay que reintentar, se reutiliza y no se duplica la reserva
  const [clave, setClave] = useState(() => crypto.randomUUID());

  useEffect(() => {
    api.obtener(id).then(setA).catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!fecha) return;
    api
      .disponibilidad(id, fecha)
      .then((d) => {
        setDisp(d);
        setHora(d.times[0] ?? '');
      })
      .catch(() => setDisp(null));
  }, [id, fecha, reserva]);

  const reservar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErrorReserva('');
    try {
      const r = await api.reservar(
        id,
        {
          date: fecha,
          ticket_count: cantidad,
          customer_name: nombre,
          ...(hora ? { time: hora } : {}),
          ...(email ? { customer_email: email } : {}),
        },
        clave,
      );
      setReserva(r);
      setClave(crypto.randomUUID()); // la próxima compra usa una clave nueva
    } catch (err) {
      setErrorReserva((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!a) return <p>Cargando…</p>;

  const ubicacion = a.locations[0];
  const total = (a.price.total * cantidad).toFixed(2);

  return (
    <section className="detalle">
      <Link to="/" className="volver">← Volver</Link>

      <div className="detalle-grid">
        <div>
          {a.photos.length > 0 && (
            <div className="galeria">
              {a.photos.map((p) => (
                <img key={p.url} src={p.url} alt={a.name} />
              ))}
            </div>
          )}
          <span className="etiqueta">{TIPOS_PRODUCTO[a.product_type]}</span>
          <h1>{a.name}</h1>
          <p className="muted">
            {ubicacion && `${nombreCiudad(ubicacion.city)} · ${ubicacion.address}`} · {formatoDuracion(a.duration)}
          </p>
          <p>{a.long_description}</p>

          {a.includes.length > 0 && (
            <>
              <h3>Incluye</h3>
              <ul>{a.includes.map((i) => <li key={i}>{i}</li>)}</ul>
            </>
          )}
          <p className="muted">
            Operador: {a.operator.name} · Idiomas: {a.supported_languages.join(', ') || '—'}
          </p>
          {a.free_cancellation ? (
            <p className="ok">Cancelación gratuita</p>
          ) : (
            <p className="muted">Esta atracción no permite cancelación.</p>
          )}
        </div>

        <aside className="panel">
          <p className="precio">
            ${a.price.total.toFixed(2)} <small>{a.price.currency} por persona</small>
          </p>

          {reserva ? (
            <div className="exito">
              <h3>¡Reserva confirmada!</h3>
              <p>Código de reserva:</p>
              <code>{reserva.reservation_id}</code>
              <p>
                {reserva.ticket_count} entrada(s) · Total ${reserva.total_price.total.toFixed(2)}{' '}
                {reserva.total_price.currency}
              </p>
              <p className="muted">Guarda el código para consultar o cancelar tu reserva en "Mi reserva".</p>
              <button className="btn secundario" onClick={() => setReserva(null)}>Hacer otra reserva</button>
            </div>
          ) : (
            <form onSubmit={reservar} className="form">
              <label>
                Fecha
                <input type="date" value={fecha} min={fechaMasDias(0)} onChange={(e) => setFecha(e.target.value)} required />
              </label>
              {disp && <p className="muted">Cupos disponibles: {disp.available_spots}</p>}

              {disp && disp.times.length > 0 && (
                <label>
                  Horario
                  <select value={hora} onChange={(e) => setHora(e.target.value)}>
                    {disp.times.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              )}

              <label>
                Cantidad de entradas
                <input type="number" min={1} max={disp?.available_spots || 1} value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))} required />
              </label>
              <label>
                Nombre completo
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} />
              </label>
              <label>
                Correo (opcional)
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <p><strong>Total: ${total} {a.price.currency}</strong></p>
              {errorReserva && <p className="error">{errorReserva}</p>}
              <button className="btn" disabled={enviando || disp?.available_spots === 0}>
                {enviando ? 'Reservando…' : 'Reservar'}
              </button>
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}