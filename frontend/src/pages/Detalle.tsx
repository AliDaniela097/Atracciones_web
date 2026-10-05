import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fechaMasDias } from '../api';
import type { Atraccion, Availability, Reservation } from '../types';
import { ciudadDe, formatoDuracion, nombreIdioma, precioTexto, TIPOS_PRODUCTO } from '../ciudades';
import MediaAtraccion from '../components/MediaAtraccion';
import Icono from '../components/Icono';
import { EstadoError, MensajeError } from '../components/Estados';
import BotonCopiar from '../components/BotonCopiar';
import { useAuth } from '../auth';

export default function Detalle() {
  const { id = '' } = useParams();
  const { usuario } = useAuth();
  const [a, setA] = useState<Atraccion | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  // Formulario de reserva
  const [fecha, setFecha] = useState(fechaMasDias(1));
  const [disp, setDisp] = useState<Availability | null>(null);
  const [cargandoDisp, setCargandoDisp] = useState(true);
  const [hora, setHora] = useState('');
  const [cantidad, setCantidad] = useState(1);
  // Se completan con los datos de la cuenta; el cliente puede cambiarlos (por ejemplo, si reserva para otra persona)
  const [nombre, setNombre] = useState(usuario?.name ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [enviando, setEnviando] = useState(false);
  const [reserva, setReserva] = useState<Reservation | null>(null);
  const [errorReserva, setErrorReserva] = useState('');
  // Una clave por intento de compra: si hay que reintentar, se reutiliza y no se duplica la reserva
  const [clave, setClave] = useState(() => crypto.randomUUID());

  // GET /atracciones/{id}
  useEffect(() => {
    setError('');
    setA(null);
    api.obtener(id).then(setA).catch((e: Error) => setError(e.message));
  }, [id, intento]);

  // GET /atracciones/{id}/availability?date=
  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    setCargandoDisp(true);
    api
      .disponibilidad(id, fecha)
      .then((d) => {
        if (!vigente) return;
        setDisp(d);
        setHora(d.times[0] ?? '');
      })
      .catch(() => vigente && setDisp(null))
      .finally(() => vigente && setCargandoDisp(false));
    return () => {
      vigente = false;
    };
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
          customer_name: nombre.trim(),
          ...(hora ? { time: hora } : {}),
          ...(email ? { customer_email: email.trim() } : {}),
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

  if (error) return <EstadoError mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />;

  if (!a) {
    return (
      <div className="detalle" aria-busy="true">
        <p className="sr-only" role="status">Cargando atracción…</p>
        <div>
          <div className="detalle-portada fantasma" />
          <div className="fantasma fantasma--linea" style={{ width: '60%', height: 28 }} />
          <div className="fantasma fantasma--linea" />
          <div className="fantasma fantasma--linea corta" />
        </div>
        <div className="pase pase--cargando fantasma" />
      </div>
    );
  }

  const ciudad = ciudadDe(a);
  const ubicacion = a.locations[0];
  const sinCupos = disp?.available_spots === 0;
  const total = a.price.total * cantidad;

  return (
    <>
      <Link to="/explorar" className="btn-texto volver">
        <Icono nombre="atras" tamano={18} />
        Volver a explorar
      </Link>

      <div className="detalle">
        <article className="detalle-info">
          <div className="detalle-portada">
            <MediaAtraccion a={a} />
          </div>
          {a.photos.length > 1 && (
            <div className="galeria">
              {a.photos.slice(1).map((p, i) => (
                <img key={p.url} src={p.url} alt={`Foto ${i + 2} de ${a.name}`} loading="lazy" />
              ))}
            </div>
          )}

          <span className="pastilla">{TIPOS_PRODUCTO[a.product_type]}</span>
          <h1 style={{ marginTop: 12 }}>{a.name}</h1>
          <div className="detalle-meta">
            <span>
              <Icono nombre="pin" tamano={18} />
              {ciudad ? `${ciudad.nombre}, aeropuerto ${ciudad.iata}` : 'Ecuador'}
            </span>
            <span>
              <Icono nombre="reloj" tamano={18} />
              {formatoDuracion(a.duration)}
            </span>
            {a.ratings && a.ratings.number_of_reviews > 0 && (
              <span>
                <Icono nombre="estrella" tamano={18} />
                {a.ratings.score.toFixed(1)} de 5 ({a.ratings.number_of_reviews} reseñas)
              </span>
            )}
          </div>

          <p>{a.long_description}</p>
          {ubicacion?.address && <p className="nota">Dirección: {ubicacion.address}</p>}

          {a.includes.length > 0 && (
            <>
              <h2 style={{ marginTop: 24 }}>Qué incluye</h2>
              <ul className="lista-incluye">
                {a.includes.map((i) => (
                  <li key={i}>
                    <Icono nombre="check" />
                    {i}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 style={{ marginTop: 24 }}>Antes de reservar</h2>
          <p className="nota">Operado por {a.operator.name}.</p>
          <p className="nota">Idiomas: {a.supported_languages.map(nombreIdioma).join(', ') || 'no indicado'}.</p>
          <p className={a.free_cancellation ? 'nota nota--ok' : 'nota'}>
            {a.free_cancellation ? 'Cancelación gratuita.' : 'Esta atracción no permite cancelar la reserva.'}
          </p>
        </article>

        <aside className="pase" aria-label="Reservar">
          <div className="pase-cuerpo">
            <p className="pase-ruta">
              <span className="codigo-iata">{ciudad?.iata ?? 'EC'}</span>
              {ciudad?.nombre ?? 'Ecuador'}
            </p>
            <p className="card-precio" style={{ fontSize: '1.6rem' }}>
              {precioTexto(a.price)}
              {a.price.total > 0 && <small> por persona</small>}
            </p>
          </div>

          <div className="pase-corte" aria-hidden="true" />

          <div className="pase-pie">
            {reserva ? (
              <div className="confirmacion" role="status">
                <h2>Reserva confirmada</h2>
                <p className="nota">La reserva quedó guardada en “Mis reservas”. Este es tu código:</p>
                <div className="codigo-reserva">
                  <span>{reserva.reservation_id}</span>
                  <BotonCopiar texto={reserva.reservation_id} />
                </div>
                <p>
                  {reserva.ticket_count} {reserva.ticket_count === 1 ? 'entrada' : 'entradas'}, total{' '}
                  <strong>{precioTexto(reserva.total_price)}</strong>
                </p>
                <div className="acciones">
                  <Link to="/mis-reservas" className="btn">
                    Ver mis reservas
                  </Link>
                  <button type="button" className="btn btn--suave" onClick={() => setReserva(null)}>
                    Hacer otra reserva
                  </button>
                </div>
              </div>
            ) : !usuario ? (
              <div className="formulario">
                <p className="pase-cupos" aria-live="polite">
                  {cargandoDisp ? (
                    'Consultando cupos…'
                  ) : disp ? (
                    <>
                      <strong>{disp.available_spots}</strong> cupos para el {fecha}
                    </>
                  ) : (
                    ''
                  )}
                </p>
                <p className="nota">Para reservar necesitas una cuenta. Es gratis y tarda un minuto.</p>
                <Link to={`/ingresar?volver=${encodeURIComponent(`/atraccion/${id}`)}`} className="btn btn--bloque">
                  Ingresar para reservar
                </Link>
                <Link to={`/registro?volver=${encodeURIComponent(`/atraccion/${id}`)}`} className="btn btn--suave btn--bloque">
                  Crear cuenta
                </Link>
              </div>
            ) : (
              <form onSubmit={reservar} className="formulario">
                <label className="campo">
                  Fecha de la visita
                  <input type="date" value={fecha} min={fechaMasDias(0)} onChange={(e) => setFecha(e.target.value)} required />
                </label>
                <p className="pase-cupos" aria-live="polite">
                  {cargandoDisp ? (
                    'Consultando cupos…'
                  ) : disp ? (
                    sinCupos ? (
                      'No quedan cupos para esta fecha. Prueba con otro día.'
                    ) : (
                      <>
                        <strong>{disp.available_spots}</strong> cupos disponibles
                      </>
                    )
                  ) : (
                    'No se pudo consultar los cupos para esta fecha.'
                  )}
                </p>

                {disp && disp.times.length > 0 && (
                  <label className="campo">
                    Horario
                    <select value={hora} onChange={(e) => setHora(e.target.value)}>
                      {disp.times.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="campo">
                  Número de entradas
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(disp?.available_spots ?? 1, 1)}
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    required
                  />
                </label>
                <label className="campo">
                  Nombre completo
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required minLength={3} />
                </label>
                <label className="campo">
                  <span>Correo <small>(opcional)</small></span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>

                <p className="resumen-total">
                  Total
                  <strong>{precioTexto({ currency: a.price.currency, total })}</strong>
                </p>
                {errorReserva && <MensajeError>{errorReserva}</MensajeError>}
                <button className="btn btn--bloque" disabled={enviando || cargandoDisp || sinCupos}>
                  {enviando ? 'Reservando…' : 'Reservar'}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
