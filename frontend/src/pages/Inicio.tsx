import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Atraccion } from '../types';
import { CIUDADES, ciudadDe, coordenadasTexto } from '../ciudades';
import AtraccionCard from '../components/AtraccionCard';
import { TarjetasCargando } from '../components/Estados';

const SEGUNDOS_POR_FOTO = 8;

/**
 * Página de inicio.
 * - Portada: fotos grandes de atracciones reales del catálogo (una por aeropuerto), con sus coordenadas.
 * - Aeropuertos: cada uno con la foto de una de sus atracciones y cuántas hay.
 * - Destacadas: POST /atracciones/search ordenadas por most_popular.
 * El catálogo se lee con GET /atracciones (paginado).
 */
export default function Inicio() {
  const [catalogo, setCatalogo] = useState<Atraccion[]>([]);
  const [destacadas, setDestacadas] = useState<Atraccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.allSettled([api.listar(50, 0), api.buscar([], 'most_popular')]).then(([cat, pop]) => {
      if (!vigente) return;
      if (cat.status === 'fulfilled') setCatalogo(cat.value.data);
      if (pop.status === 'fulfilled') setDestacadas(pop.value.data.slice(0, 6));
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  // Una atracción con foto por aeropuerto, en el orden de CIUDADES
  const portadas = useMemo(() => {
    const lista: Atraccion[] = [];
    for (const c of CIUDADES) {
      const a = catalogo.find((x) => x.photos.length > 0 && x.locations[0]?.city === c.id);
      if (a) lista.push(a);
    }
    return lista;
  }, [catalogo]);

  // Cambia de foto sola, salvo que la persona prefiera menos movimiento o esté interactuando
  useEffect(() => {
    if (portadas.length < 2 || pausa) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setActual((i) => (i + 1) % portadas.length), SEGUNDOS_POR_FOTO * 1000);
    return () => window.clearInterval(t);
  }, [portadas.length, pausa]);

  const enPortada = portadas[actual];
  const lugar = enPortada?.locations[0];

  return (
    <div className="inicio">
      <section
        className="heroe"
        aria-labelledby="titulo-inicio"
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
        onFocus={() => setPausa(true)}
        onBlur={() => setPausa(false)}
      >
        <div className="heroe-fotos" aria-hidden="true">
          {portadas.map((a, i) => (
            <img key={a.id} src={a.photos[0].url} alt="" className={i === actual ? 'activa' : undefined} />
          ))}
        </div>
        <div className="heroe-velo" aria-hidden="true" />

        <div className="heroe-contenido">
          <h1 id="titulo-inicio">Ecuador empieza donde aterrizas</h1>
          <p>
            Entradas y tours cerca de los {CIUDADES.length} aeropuertos con vuelos comerciales del país, desde la Mitad del
            Mundo hasta las islas Galápagos.
          </p>
          <div className="acciones">
            <Link to="/explorar" className="btn">
              Explorar atracciones
            </Link>
            <a href="#aeropuertos" className="btn btn--vidrio">
              Elegir mi aeropuerto
            </a>
          </div>
        </div>

        {enPortada && (
          <div className="heroe-lugar">
            {lugar && <p className="heroe-coordenadas">{coordenadasTexto(lugar.coordinates.latitude, lugar.coordinates.longitude)}</p>}
            <Link to={`/atraccion/${enPortada.id}`} className="heroe-nombre">
              {enPortada.name}
            </Link>
            <p className="heroe-ciudad">{ciudadDe(enPortada)?.nombre}</p>
            {portadas.length > 1 && (
              <div className="heroe-puntos">
                {portadas.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={`Mostrar ${a.name}`}
                    aria-pressed={i === actual}
                    onClick={() => setActual(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section id="aeropuertos" aria-labelledby="titulo-aeropuertos" className="bloque-inicio">
        <div className="encabezado-bloque">
          <h2 id="titulo-aeropuertos">¿A qué aeropuerto llegas?</h2>
          <p className="nota">Cada destino muestra lo que puedes visitar cerca.</p>
        </div>
        <ul className="destinos">
          {CIUDADES.map((c) => {
            const deCiudad = catalogo.filter((a) => a.locations[0]?.city === c.id);
            const foto = deCiudad.find((a) => a.photos.length > 0)?.photos[0].url;
            return (
              <li key={c.id}>
                <Link to={`/explorar?ciudad=${c.id}`} className="destino" aria-label={`${c.nombre}, aeropuerto ${c.iata}: ver atracciones`}>
                  {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="destino-sin-foto" />}
                  <span className="destino-texto">
                    <span className="destino-iata">{c.iata}</span>
                    <span className="destino-ciudad">{c.nombre}</span>
                    {!cargando && (
                      <span className="destino-cuenta">
                        {deCiudad.length === 1 ? '1 atracción' : `${deCiudad.length} atracciones`}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="titulo-destacadas" className="bloque-inicio">
        <div className="encabezado-bloque">
          <h2 id="titulo-destacadas">Las más reservadas</h2>
          <Link to="/explorar" className="btn-texto">
            Ver todo el catálogo
          </Link>
        </div>
        {cargando ? (
          <TarjetasCargando cantidad={3} />
        ) : destacadas.length === 0 ? (
          <p className="nota">Todavía no hay atracciones publicadas.</p>
        ) : (
          <div className="grid">
            {destacadas.map((a) => (
              <AtraccionCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-pasos" className="bloque-inicio">
        <h2 id="titulo-pasos">Cómo reservar</h2>
        <ol className="pasos">
          <li>
            <h3>Elige tu aeropuerto</h3>
            <p>Mira lo que hay para hacer cerca de la ciudad a la que llegas.</p>
          </li>
          <li>
            <h3>Agrega al carrito</h3>
            <p>Escoge fecha y número de entradas; ves los cupos de cada día antes de comprar.</p>
          </li>
          <li>
            <h3>Paga y recibe tu comprobante</h3>
            <p>Tus compras quedan en “Mis reservas”, donde también puedes cancelarlas.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
