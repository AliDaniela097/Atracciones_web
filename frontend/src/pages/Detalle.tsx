import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fechaMasDias } from '../api';
import type { Atraccion, Availability } from '../types';
import { ciudadDe, coordenadasTexto, formatoDuracion, nombreIdioma, precioTexto, TIPOS_PRODUCTO } from '../ciudades';
import MediaAtraccion from '../components/MediaAtraccion';
import Icono from '../components/Icono';
import { EstadoError, MensajeError } from '../components/Estados';
import { dinero, fechaLarga, MAX_ENTRADAS_POR_LINEA, useCarrito } from '../carrito';
import { useAuth } from '../auth';
import { ANCHO, fotoUrl } from '../lib/imagen';

export default function Detalle() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { agregar, enCarrito, cantidadTotal } = useCarrito();
  const { esOperador } = useAuth();
  const [a, setA] = useState<Atraccion | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  // Selección de fecha, horario y entradas (se agrega al carrito; el pago se hace en el checkout)
  const [fecha, setFecha] = useState(fechaMasDias(1));
  const [disp, setDisp] = useState<Availability | null>(null);
  const [cargandoDisp, setCargandoDisp] = useState(true);
  const [hora, setHora] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [aviso, setAviso] = useState('');
  const [errorCarrito, setErrorCarrito] = useState('');

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
    setAviso('');
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
  }, [id, fecha]);

  // Cupos libres descontando lo que el cliente ya tiene en su carrito para esa fecha
  const yaEnCarrito = enCarrito(id, fecha);
  const libres = disp ? Math.max(disp.available_spots - yaEnCarrito, 0) : 0;
  const maximo = Math.max(Math.min(libres, MAX_ENTRADAS_POR_LINEA), 1);

  const agregarAlCarrito = (irAlCarrito: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    setErrorCarrito('');
    if (!a || !disp) return;
    if (cantidad < 1 || cantidad > libres) {
      setErrorCarrito(libres === 0 ? 'Ya no quedan cupos libres para esta fecha.' : `Puedes agregar hasta ${libres} entradas para esta fecha.`);
      return;
    }
    agregar({
      atraccionId: a.id,
      nombre: a.name,
      ciudadId: a.locations[0]?.city,
      foto: a.photos[0]?.url,
      fecha,
      ...(hora ? { hora } : {}),
      cantidad,
      precioUnitario: a.price.total,
      moneda: a.price.currency,
    });
    if (irAlCarrito) {
      navigate('/carrito');
    } else {
      setAviso(`Agregaste ${cantidad} ${cantidad === 1 ? 'entrada' : 'entradas'} al carrito.`);
      setCantidad(1);
    }
  };

  if (error) return <EstadoError mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />;

  if (!a) {
    return (
      <div className="detalle" aria-busy="true">
        <p className="sr-only" role="status">Cargando atracción…</p>
        <div>
          <div className="mosaico-cargando fantasma" />
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

  return (
    <>
      <Link to="/explorar" className="btn-texto volver">
        <Icono nombre="atras" tamano={18} />
        Volver a explorar
      </Link>

      <header className="detalle-cabecera">
        <span className="pastilla">{TIPOS_PRODUCTO[a.product_type]}</span>
        <h1>{a.name}</h1>
        <div className="detalle-meta">
          <span>
            <Icono nombre="pin" tamano={18} />
            {ciudad ? `${ciudad.nombre}, aeropuerto ${ciudad.iata}` : 'Ecuador'}
          </span>
          <span>
            <Icono nombre="reloj" tamano={18} />
            {formatoDuracion(a.duration)}
          </span>
          {ubicacion && <span className="detalle-coordenadas">{coordenadasTexto(ubicacion.coordinates.latitude, ubicacion.coordinates.longitude)}</span>}
          {a.ratings && a.ratings.number_of_reviews > 0 && (
            <span>
              <Icono nombre="estrella" tamano={18} />
              {a.ratings.score.toFixed(1)} de 5 ({a.ratings.number_of_reviews} reseñas)
            </span>
          )}
        </div>
      </header>

      <div className={`mosaico mosaico--${Math.min(Math.max(a.photos.length, 1), 3)}`}>
        <div className="mosaico-principal">
          <MediaAtraccion a={a} ancho={ANCHO.grande} />
        </div>
        {a.photos.slice(1, 3).map((p, i) => (
          <img
            key={p.url}
            src={fotoUrl(p.url, ANCHO.tarjeta)}
            alt={`Foto ${i + 2} de ${a.name}`}
            loading="lazy"
            onError={(e) => e.currentTarget.classList.add('foto-fallida')}
          />
        ))}
      </div>

      <div className="detalle">
        <article className="detalle-info">
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
            {a.free_cancellation
              ? 'Cancelación gratuita: puedes cancelar sin costo desde “Mis reservas”.'
              : 'Esta atracción no permite cancelar la compra.'}
          </p>
        </article>

        <aside className="pase" aria-label={esOperador ? 'Información para el operador' : 'Comprar entradas'}>
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

          {esOperador ? (
            <div className="pase-pie">
              <p className="nota">
                Estás en modo operador. El operador administra el catálogo y no compra entradas; las compras las hacen los
                clientes.
              </p>
              {disp && (
                <p className="pase-cupos">
                  <strong>{disp.available_spots}</strong> cupos libres el {fechaLarga(fecha)}
                </p>
              )}
              <Link to={`/admin/editar/${a.id}`} className="btn btn--bloque">
                <Icono nombre="editar" tamano={18} />
                Editar esta atracción
              </Link>
              <Link to="/admin" className="btn btn--suave btn--bloque">
                Volver al panel
              </Link>
            </div>
          ) : (
            <div className="pase-pie">
              <form onSubmit={agregarAlCarrito(false)} className="formulario">
                <label className="campo">
                  Fecha de la visita
                  <input type="date" value={fecha} min={fechaMasDias(0)} onChange={(e) => setFecha(e.target.value)} required />
                </label>
                <p className="pase-cupos" aria-live="polite">
                  {cargandoDisp ? (
                    'Consultando cupos…'
                  ) : disp ? (
                    libres === 0 ? (
                      yaEnCarrito > 0 ? 'Ya tienes en tu carrito todos los cupos de esta fecha.' : 'No quedan cupos para esta fecha. Prueba con otro día.'
                    ) : (
                      <>
                        <strong>{libres}</strong> cupos disponibles
                        {yaEnCarrito > 0 && ` (tienes ${yaEnCarrito} en tu carrito)`}
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
                    max={maximo}
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    required
                  />
                </label>

                <p className="resumen-total">
                  Subtotal
                  <strong>{dinero(a.price.total * cantidad)}</strong>
                </p>
                {errorCarrito && <MensajeError>{errorCarrito}</MensajeError>}
                {aviso && (
                  <p className="aviso-ok" role="status">
                    <Icono nombre="check" tamano={18} />
                    {aviso} <Link to="/carrito">Ver carrito ({cantidadTotal})</Link>
                  </p>
                )}
                <button className="btn btn--bloque" disabled={cargandoDisp || !disp || libres === 0}>
                  <Icono nombre="carrito" tamano={18} />
                  Agregar al carrito
                </button>
                <button
                  type="button"
                  className="btn btn--suave btn--bloque"
                  disabled={cargandoDisp || !disp || libres === 0}
                  onClick={() => agregarAlCarrito(true)()}
                >
                  Comprar ahora
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
