import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CIUDADES, normalizar } from '../ciudades';
import type { Atraccion } from '../types';
import Icono from './Icono';

/** Cada fila de la lista desplegable: un aeropuerto, una atracción o "ver todos los resultados" */
type Opcion =
  | { tipo: 'aeropuerto'; clave: string; id: number; nombre: string; iata: string }
  | { tipo: 'atraccion'; clave: string; atraccion: Atraccion }
  | { tipo: 'todas'; clave: string };

const MINIMO_LETRAS = 2; // para consultar atracciones al servidor
const ESPERA_MS = 250; // se espera a que el usuario deje de escribir
const SUGERENCIAS = 5;

/**
 * Buscador superior: busca aeropuertos (ciudad o código IATA) y atracciones (por nombre, descripción o categoría).
 * - Aeropuerto: abre el catálogo filtrado (?ciudad=ID), que usa POST /atracciones/search con "cities".
 * - Atracción: abre su detalle.
 * - "Ver todas": abre el catálogo con el texto (?q=playa), que usa POST /atracciones/search con "query".
 * Es un combobox accesible: flechas para moverse, Enter para elegir, Escape para cerrar.
 */
export default function BuscadorDestino() {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [atracciones, setAtracciones] = useState<Atraccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const idLista = useId();

  const limpio = texto.trim();
  const consulta = normalizar(limpio);

  // Sugerencias de atracciones: se consulta al servidor cuando el usuario hace una pausa al escribir
  useEffect(() => {
    if (limpio.length < MINIMO_LETRAS) {
      setAtracciones([]);
      setBuscando(false);
      return;
    }
    let vigente = true; // ignora respuestas viejas si el usuario siguió escribiendo
    setBuscando(true);
    const espera = setTimeout(() => {
      api
        .buscar([], 'most_popular', undefined, limpio, SUGERENCIAS)
        .then((r) => vigente && setAtracciones(r.data))
        .catch(() => vigente && setAtracciones([])) // si falla, quedan los aeropuertos
        .finally(() => vigente && setBuscando(false));
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [limpio]);

  const aeropuertos = CIUDADES.filter((c) => normalizar(`${c.nombre} ${c.iata}`).includes(consulta));
  const hayResultados = aeropuertos.length > 0 || atracciones.length > 0;
  const opciones: Opcion[] = [
    ...aeropuertos.map((c): Opcion => ({ tipo: 'aeropuerto', clave: `a${c.id}`, id: c.id, nombre: c.nombre, iata: c.iata })),
    ...atracciones.map((a): Opcion => ({ tipo: 'atraccion', clave: `t${a.id}`, atraccion: a })),
    ...(limpio && hayResultados ? [{ tipo: 'todas', clave: 'todas' } as Opcion] : []),
  ];
  // Si la lista se acorta mientras el usuario escribe, el índice activo no puede quedar fuera
  const indiceActivo = Math.min(activo, Math.max(opciones.length - 1, 0));
  const opcionActiva = abierto ? opciones[indiceActivo] : undefined;
  const idOpcion = (o: Opcion) => `${idLista}-${o.clave}`;

  const irAlCatalogo = (cambios: Record<string, string>) => {
    // Se conservan los filtros elegidos si ya estamos en el catálogo
    const params = new URLSearchParams(location.pathname === '/explorar' ? location.search : '');
    Object.entries(cambios).forEach(([clave, valor]) => params.set(clave, valor));
    navigate(`/explorar?${params.toString()}`);
    setTexto('');
    setAbierto(false);
  };

  const elegir = (o: Opcion) => {
    if (o.tipo === 'atraccion') {
      navigate(`/atraccion/${o.atraccion.id}`);
      setTexto('');
      setAbierto(false);
    } else if (o.tipo === 'aeropuerto') {
      irAlCatalogo({ ciudad: String(o.id) });
    } else {
      irAlCatalogo({ q: limpio });
    }
  };

  const alPresionarTecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo(Math.min(indiceActivo + 1, Math.max(opciones.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo(Math.max(indiceActivo - 1, 0));
    } else if (e.key === 'Enter') {
      if (opcionActiva) {
        e.preventDefault();
        elegir(opcionActiva);
      } else if (limpio) {
        // Nada coincide en la lista: el catálogo muestra el mensaje de "sin resultados" con sugerencias
        e.preventDefault();
        irAlCatalogo({ q: limpio });
      }
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div className="buscador" role="search">
      <label htmlFor={`${idLista}-input`} className="sr-only">
        Buscar atracción, aeropuerto o ciudad
      </label>
      <Icono nombre="buscar" />
      <input
        id={`${idLista}-input`}
        type="text"
        role="combobox"
        autoComplete="off"
        maxLength={100}
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={opcionActiva ? idOpcion(opcionActiva) : undefined}
        placeholder="Busca una atracción o aeropuerto…"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={alPresionarTecla}
      />
      {abierto && (
        <ul id={idLista} role="listbox" className="buscador-lista" aria-label="Resultados de la búsqueda">
          {opciones.map((o, i) => (
            <li
              key={o.clave}
              id={idOpcion(o)}
              role="option"
              aria-selected={i === indiceActivo}
              className={i === indiceActivo ? 'activa' : undefined}
              // onMouseDown (no onClick) para que se elija antes de que el input pierda el foco
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
              onMouseEnter={() => setActivo(i)}
            >
              {o.tipo === 'aeropuerto' && (
                <>
                  <span className="codigo-iata">{o.iata}</span>
                  {o.nombre}
                  <span className="sr-only"> (aeropuerto)</span>
                </>
              )}
              {o.tipo === 'atraccion' && (
                <span>
                  {o.atraccion.name}
                  <span className="sr-only"> (atracción)</span>
                </span>
              )}
              {o.tipo === 'todas' && <strong>Ver todas las atracciones con “{limpio}”</strong>}
            </li>
          ))}
          {buscando && (
            <li className="buscador-vacio" role="presentation">
              Buscando atracciones…
            </li>
          )}
          {!buscando && limpio.length >= MINIMO_LETRAS && !hayResultados && (
            <li className="buscador-vacio" role="presentation">
              Ninguna atracción ni aeropuerto coincide con “{limpio}”. Pulsa Enter para ver el catálogo.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
