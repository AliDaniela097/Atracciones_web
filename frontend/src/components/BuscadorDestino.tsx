import { useId, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CIUDADES, normalizar } from '../ciudades';
import Icono from './Icono';

/**
 * Buscador superior: busca un aeropuerto por ciudad o código IATA.
 * Al elegir uno, abre el catálogo filtrado (?ciudad=ID), que usa POST /atracciones/search con "cities".
 * Es un combobox accesible: flechas para moverse, Enter para elegir, Escape para cerrar.
 */
export default function BuscadorDestino() {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const idLista = useId();

  const consulta = normalizar(texto.trim());
  const opciones = CIUDADES.filter((c) => normalizar(`${c.nombre} ${c.iata}`).includes(consulta));
  const opcionActiva = abierto ? opciones[activo] : undefined;

  const elegir = (id: number) => {
    // Se conserva el orden elegido si ya estamos en el catálogo
    const params = new URLSearchParams(location.pathname === '/explorar' ? location.search : '');
    params.set('ciudad', String(id));
    navigate(`/explorar?${params.toString()}`);
    setTexto('');
    setAbierto(false);
  };

  const alPresionarTecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(i + 1, Math.max(opciones.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && opcionActiva) {
      e.preventDefault();
      elegir(opcionActiva.id);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div className="buscador" role="search">
      <label htmlFor={`${idLista}-input`} className="sr-only">
        Buscar aeropuerto o ciudad
      </label>
      <Icono nombre="buscar" />
      <input
        id={`${idLista}-input`}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={opcionActiva ? `${idLista}-${opcionActiva.id}` : undefined}
        placeholder="Busca tu aeropuerto: Cuenca, GYE…"
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
        <ul id={idLista} role="listbox" className="buscador-lista" aria-label="Aeropuertos">
          {opciones.map((c, i) => (
            <li
              key={c.id}
              id={`${idLista}-${c.id}`}
              role="option"
              aria-selected={i === activo}
              className={i === activo ? 'activa' : undefined}
              // onMouseDown (no onClick) para que se elija antes de que el input pierda el foco
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(c.id);
              }}
              onMouseEnter={() => setActivo(i)}
            >
              <span className="codigo-iata">{c.iata}</span>
              {c.nombre}
            </li>
          ))}
          {opciones.length === 0 && <li className="buscador-vacio">Ningún aeropuerto coincide con “{texto}”.</li>}
        </ul>
      )}
    </div>
  );
}
