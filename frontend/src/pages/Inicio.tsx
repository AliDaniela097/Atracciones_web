import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Atraccion } from '../types';
import { CIUDADES, coloresCiudad } from '../ciudades';
import AtraccionCard from '../components/AtraccionCard';
import { TarjetasCargando } from '../components/Estados';

/**
 * Página de inicio: presenta el servicio, los 9 aeropuertos y las atracciones más reservadas.
 * Las destacadas salen de POST /atracciones/search ordenadas por most_popular.
 */
export default function Inicio() {
  const [destacadas, setDestacadas] = useState<Atraccion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    api
      .buscar([], 'most_popular')
      .then((r) => vigente && setDestacadas(r.data.slice(0, 3)))
      .catch(() => vigente && setDestacadas([]))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className="inicio">
      <section className="portada-inicio" aria-labelledby="titulo-inicio">
        <div className="portada-texto">
          <h1 id="titulo-inicio">Aterrizas en Ecuador. Lo demás lo encuentras aquí.</h1>
          <p>
            Entradas, tours y paquetes cerca de los {CIUDADES.length} aeropuertos con vuelos comerciales del país: de la
            Mitad del Mundo a las islas Galápagos. Elige dónde llegas y reserva en pocos pasos.
          </p>
          <div className="acciones">
            <Link to="/explorar" className="btn">
              Explorar atracciones
            </Link>
            <Link to="/mis-reservas" className="btn btn--suave">
              Ver mis reservas
            </Link>
          </div>
        </div>
        <div className="tejido-banda" aria-hidden="true" />
      </section>

      <section aria-labelledby="titulo-aeropuertos" className="bloque-inicio">
        <h2 id="titulo-aeropuertos">Elige tu aeropuerto</h2>
        <ul className="aeropuertos">
          {CIUDADES.map((c) => (
            <li key={c.id}>
              <Link
                to={`/explorar?ciudad=${c.id}`}
                className="aeropuerto"
                style={coloresCiudad(c.id) as CSSProperties}
                aria-label={`Ver atracciones cerca del aeropuerto de ${c.nombre} (${c.iata})`}
              >
                <span className="aeropuerto-iata">{c.iata}</span>
                <span className="aeropuerto-ciudad">{c.nombre}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-destacadas" className="bloque-inicio">
        <div className="encabezado-bloque">
          <h2 id="titulo-destacadas">Las más reservadas</h2>
          <Link to="/explorar" className="btn-texto">
            Ver todas
          </Link>
        </div>
        {cargando ? (
          <TarjetasCargando cantidad={3} />
        ) : destacadas.length === 0 ? (
          <p className="nota">Todavía no hay atracciones publicadas. Vuelve pronto.</p>
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
            <h3>Escoge fecha y entradas</h3>
            <p>Ves los cupos disponibles de cada día antes de reservar.</p>
          </li>
          <li>
            <h3>Reserva con tu cuenta</h3>
            <p>Tus reservas quedan guardadas en “Mis reservas”, donde también puedes cancelarlas.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
