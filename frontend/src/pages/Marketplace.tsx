import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Atraccion } from '../types';
import { CIUDADES, ciudadPorId, ORDENES } from '../ciudades';
import AtraccionCard from '../components/AtraccionCard';
import PanelAtraccion from '../components/PanelAtraccion';
import { EstadoError, EstadoVacio, TarjetasCargando } from '../components/Estados';

type Estado = 'cargando' | 'listo' | 'error';

export default function Marketplace() {
  // La ciudad y el orden viven en la URL (?ciudad=3&orden=price_asc): se pueden compartir y el botón "atrás" funciona
  const [params, setParams] = useSearchParams();
  const ciudadId = Number(params.get('ciudad')) || undefined;
  const ciudad = ciudadPorId(ciudadId);
  const orden = ORDENES.some((o) => o.valor === params.get('orden')) ? params.get('orden')! : 'most_popular';
  // Texto escrito en la lupa (?q=playa): se envía como "query" al POST /atracciones/search
  const texto = (params.get('q') ?? '').trim().slice(0, 100);

  const [atracciones, setAtracciones] = useState<Atraccion[]>([]);
  const [total, setTotal] = useState(0);
  const [siguiente, setSiguiente] = useState<string | undefined>();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [error, setError] = useState('');
  const [cargandoMas, setCargandoMas] = useState(false);
  const [seleccion, setSeleccion] = useState<Atraccion | null>(null);
  const [intento, setIntento] = useState(0);

  // POST /atracciones/search cada vez que cambia la ciudad, el orden o el texto buscado
  useEffect(() => {
    let vigente = true; // evita mostrar una respuesta vieja si el usuario cambia rápido de ciudad
    setEstado('cargando');
    setError('');
    api
      .buscar(ciudad ? [ciudad.id] : [], orden, undefined, texto)
      .then((r) => {
        if (!vigente) return;
        setAtracciones(r.data);
        setTotal(r.metadata.total_results);
        setSiguiente(r.metadata.next_page);
        setSeleccion(r.data[0] ?? null);
        setEstado('listo');
      })
      .catch((e: Error) => {
        if (!vigente) return;
        setError(e.message);
        setEstado('error');
      });
    return () => {
      vigente = false;
    };
  }, [ciudad, orden, texto, intento]);

  const cambiarParametro = (clave: string, valor?: string) => {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParams(nuevos);
  };

  // Paginación del contrato: token opaco next_page
  const verMas = async () => {
    if (!siguiente) return;
    setCargandoMas(true);
    try {
      const r = await api.buscar(ciudad ? [ciudad.id] : [], orden, siguiente, texto);
      setAtracciones((prev) => [...prev, ...r.data]);
      setSiguiente(r.metadata.next_page);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargandoMas(false);
    }
  };

  const lugar = ciudad ? `${ciudad.nombre} (${ciudad.iata})` : 'todo Ecuador';
  const busqueda = texto ? ` para “${texto}”` : '';

  return (
    <div className="explorar">
      <section className="explorar-principal" aria-labelledby="titulo-explorar">
        <header className="intro">
          <h1 id="titulo-explorar">¿A qué aeropuerto llegas?</h1>
          <p>
            Entradas, tours y paquetes cerca de los {CIUDADES.length} aeropuertos con vuelos comerciales del Ecuador.
          </p>
        </header>

        <div className="chips" role="group" aria-label="Filtrar por aeropuerto">
          <button type="button" className="chip" aria-pressed={!ciudad} onClick={() => cambiarParametro('ciudad')}>
            Todo Ecuador
          </button>
          {CIUDADES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={ciudad?.id === c.id}
              onClick={() => cambiarParametro('ciudad', String(c.id))}
            >
              <span className="codigo-iata">{c.iata}</span>
              {c.nombre}
            </button>
          ))}
        </div>

        {texto && (
          <div className="chips" role="group" aria-label="Búsqueda activa">
            <button
              type="button"
              className="chip"
              aria-label={`Quitar la búsqueda “${texto}”`}
              onClick={() => cambiarParametro('q')}
            >
              Búsqueda: “{texto}” ✕
            </button>
          </div>
        )}

        <div className="barra-resultados">
          <p aria-live="polite">
            {estado === 'cargando'
              ? 'Buscando atracciones…'
              : estado === 'listo'
                ? `${total} ${total === 1 ? 'atracción' : 'atracciones'}${busqueda} en ${lugar}`
                : ''}
          </p>
          <label className="campo-en-linea">
            Ordenar por
            <select value={orden} onChange={(e) => cambiarParametro('orden', e.target.value)}>
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </label>
        </div>

        {estado === 'cargando' && <TarjetasCargando />}

        {estado === 'error' && <EstadoError mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />}

        {estado === 'listo' && atracciones.length === 0 && (
          <EstadoVacio
            titulo={texto ? `No encontramos atracciones para “${texto}” en ${lugar}` : `Todavía no hay atracciones en ${lugar}`}
          >
            <p>
              {texto
                ? 'Revisa la ortografía o prueba con otra palabra, por ejemplo: playa, catedral o parque.'
                : 'Prueba con otro aeropuerto o mira todo el catálogo.'}
            </p>
            {texto && (
              <button type="button" className="btn btn--suave" onClick={() => cambiarParametro('q')}>
                Quitar la búsqueda
              </button>
            )}
            {!texto && ciudad && (
              <button type="button" className="btn btn--suave" onClick={() => cambiarParametro('ciudad')}>
                Ver todo Ecuador
              </button>
            )}
          </EstadoVacio>
        )}

        {estado === 'listo' && atracciones.length > 0 && (
          <>
            <div className="grid">
              {atracciones.map((a) => (
                <AtraccionCard key={a.id} a={a} seleccionada={seleccion?.id === a.id} onSeleccionar={setSeleccion} />
              ))}
            </div>
            {siguiente && (
              <div className="ver-mas">
                <button type="button" className="btn btn--suave" onClick={verMas} disabled={cargandoMas}>
                  {cargandoMas ? 'Cargando…' : 'Ver más atracciones'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <aside className="explorar-panel" aria-label="Resumen de la atracción seleccionada">
        {estado === 'cargando' && <div className="pase pase--cargando fantasma" aria-hidden="true" />}
        {estado === 'listo' && <PanelAtraccion a={seleccion} />}
      </aside>
    </div>
  );
}
