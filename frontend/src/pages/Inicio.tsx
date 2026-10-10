import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Atraccion } from '../types';
import { CIUDADES } from '../ciudades';
import AtraccionCard from '../components/AtraccionCard';
import { TarjetasCargando } from '../components/Estados';
import { ANCHO, fotoUrl } from '../lib/imagen';
import Icono from '../components/Icono';

/**
 * Cuadrícula de la portada: 3 columnas de tarjetas que alternan foto y color.
 * Colores = bandera de Ecuador (amarillo, azul, rojo) + verde de la Amazonía + negro.
 * 'aeropuerto' = tarjeta de color con el código del aeropuerto; 'total' = cuántas atracciones hay.
 */
/** Baltra (azul de mar), Quito (rojo), Coca (verde de la Amazonía), Guayaquil (amarillo), Cuenca (azul) */
const ORDEN_AEROPUERTOS = [8, 1, 6, 2, 3];
type Celda = 'foto' | 'aeropuerto' | 'total';
const COLUMNAS_PORTADA: { color: string; tipo: Celda }[][] = [
  [
    { color: 'azul', tipo: 'aeropuerto' },
    { color: 'foto', tipo: 'foto' },
    { color: 'rojo', tipo: 'aeropuerto' },
    { color: 'foto', tipo: 'foto' },
  ],
  [
    { color: 'tinta', tipo: 'total' },
    { color: 'foto', tipo: 'foto' },
    { color: 'verde', tipo: 'aeropuerto' },
    { color: 'foto', tipo: 'foto' },
  ],
  [
    { color: 'amarillo', tipo: 'aeropuerto' },
    { color: 'foto', tipo: 'foto' },
    { color: 'azul', tipo: 'aeropuerto' },
    { color: 'foto', tipo: 'foto' },
  ],
];

/**
 * Página de inicio.
 * - Portada: cuadrícula de tarjetas que alternan fotos reales del catálogo (una por aeropuerto) y tarjetas de color.
 * - Aeropuertos: cada uno con la foto de una de sus atracciones y cuántas hay.
 * - Destacadas: POST /atracciones/search ordenadas por most_popular.
 * El catálogo se lee con GET /atracciones (paginado).
 */
export default function Inicio() {
  const [catalogo, setCatalogo] = useState<Atraccion[]>([]);
  const [destacadas, setDestacadas] = useState<Atraccion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    // 100 es el máximo que acepta el backend (ver ListAtraccionesQueryDto); con 89 atracciones
    // en el catálogo esto trae el total completo, así el conteo por aeropuerto no queda truncado.
    Promise.allSettled([api.listar(100, 0), api.buscar([], 'most_popular')]).then(([cat, pop]) => {
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

  // Reparte fotos y aeropuertos por la cuadrícula, en orden, sin repetir
  const celdas = useMemo(() => {
    let foto = 0;
    let aeropuerto = 0;
    return COLUMNAS_PORTADA.map((col) =>
      col.map((c) => {
        if (c.tipo === 'foto') return { ...c, atraccion: portadas[foto++ % Math.max(portadas.length, 1)] as Atraccion | undefined };
        if (c.tipo === 'aeropuerto') {
          const id = ORDEN_AEROPUERTOS[aeropuerto++];
          return { ...c, ciudad: CIUDADES.find((x) => x.id === id) };
        }
        return c;
      }),
    );
  }, [portadas]);

  return (
    <div className="inicio">
      <section className="heroe" aria-labelledby="titulo-inicio">
        <div className="heroe-contenido">
          <h1 id="titulo-inicio">Ecuador empieza donde aterrizas</h1>
          <p>
            Entradas y tours cerca de los {CIUDADES.length} aeropuertos con vuelos comerciales del país, desde la Mitad del
            Mundo hasta las islas Galápagos.
          </p>
          <div className="acciones">
            <Link to="/explorar" className="btn-pildora">
              Explorar atracciones
              <span className="btn-pildora-icono" aria-hidden="true">
                <Icono nombre="explorar" tamano={20} />
              </span>
            </Link>
            <a href="#aeropuertos" className="enlace-flecha">
              Elegir mi aeropuerto
              <span className="btn-circulo" aria-hidden="true">
                <Icono nombre="atras" tamano={16} />
              </span>
            </a>
          </div>
        </div>

        <div className="heroe-cuadricula">
          {celdas.map((col, i) => (
            <div className="heroe-columna" key={i}>
              {col.map((c, j) => {
                if (c.tipo === 'foto') {
                  const a = 'atraccion' in c ? c.atraccion : undefined;
                  if (!a) return <span key={j} className="celda celda--vacia" aria-hidden="true" />;
                  return (
                    <Link key={j} to={`/atraccion/${a.id}`} className="celda celda--foto" aria-label={a.name}>
                      <img src={fotoUrl(a.photos[0].url, ANCHO.tarjeta)} alt="" loading={i === 0 && j === 1 ? 'eager' : 'lazy'} decoding="async" />
                      <span className="celda-nombre">{a.name}</span>
                    </Link>
                  );
                }
                if (c.tipo === 'total') {
                  return (
                    <Link key={j} to="/explorar" className={`celda celda--${c.color}`}>
                      <span className="celda-grande">{cargando ? '…' : catalogo.length}</span>
                      <span className="celda-texto">atracciones en el catálogo</span>
                    </Link>
                  );
                }
                const ciudad = 'ciudad' in c ? c.ciudad : undefined;
                if (!ciudad) return null;
                return (
                  <Link
                    key={j}
                    to={`/explorar?ciudad=${ciudad.id}`}
                    className={`celda celda--${c.color}`}
                    aria-label={`${ciudad.nombre}, aeropuerto ${ciudad.iata}: ver atracciones`}
                  >
                    <span className="celda-grande">{ciudad.iata}</span>
                    <span className="celda-texto">{ciudad.nombre}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
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
                  {foto ? <img src={fotoUrl(foto, ANCHO.tarjeta)} alt="" loading="lazy" /> : <span className="destino-sin-foto" />}
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
