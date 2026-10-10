import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { Atraccion } from '../../types';
import { ciudadDe, precioTexto, TIPOS_PRODUCTO } from '../../ciudades';
import Icono from '../../components/Icono';
import { EstadoError, MensajeError } from '../../components/Estados';
import ResumenOperador from '../../components/ResumenOperador';
import { ANCHO, fotoUrl } from '../../lib/imagen';

const POR_PAGINA = 10;

export default function AdminAtracciones() {
  const [filas, setFilas] = useState<Atraccion[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  // Lo que el operador escribe (se aplica tras una pausa para no consultar en cada letra)
  const [escrito, setEscrito] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const aplicada = useRef('');
  useEffect(() => {
    const espera = setTimeout(() => {
      const nueva = escrito.trim();
      if (nueva === aplicada.current) return;
      aplicada.current = nueva;
      setBusqueda(nueva);
      setPagina(1); // una búsqueda nueva siempre empieza en la primera página
    }, 300);
    return () => clearTimeout(espera);
  }, [escrito]);

  // GET /atracciones?limit=&offset=&q=
  const cargar = useCallback(() => {
    let vigente = true; // evita mostrar una respuesta vieja si el operador sigue escribiendo
    setCargando(true);
    setErrorCarga('');
    api
      .listar(POR_PAGINA, (pagina - 1) * POR_PAGINA, busqueda)
      .then((r) => {
        if (!vigente) return;
        setFilas(r.data);
        setTotal(r.meta.totalItems);
        setTotalPaginas(Math.max(r.meta.totalPages, 1));
      })
      .catch((e: Error) => vigente && setErrorCarga(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pagina, busqueda]);

  useEffect(cargar, [cargar]);

  // DELETE /atracciones/{id}
  const eliminar = async (a: Atraccion) => {
    if (!window.confirm(`¿Eliminar "${a.name}" del catálogo?`)) return;
    setError('');
    try {
      await api.eliminar(a.id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const plural = (n: number) => (n === 1 ? 'atracción' : 'atracciones');

  return (
    <section aria-labelledby="titulo-catalogo">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-catalogo">Catálogo de atracciones</h1>
          <p aria-live="polite">
            {cargando
              ? busqueda
                ? 'Buscando…'
                : 'Cargando…'
              : busqueda
                ? `${total} ${plural(total)} para “${busqueda}”`
                : `${total} ${total === 1 ? 'atracción registrada' : 'atracciones registradas'}`}
          </p>
        </div>
        <Link to="/admin/nueva" className="btn">
          <Icono nombre="mas" tamano={18} />
          Nueva atracción
        </Link>
      </header>

      <ResumenOperador />

      <div className="buscador-admin" role="search">
        <label htmlFor="buscar-catalogo" className="sr-only">
          Buscar atracción por nombre, categoría o dirección
        </label>
        <Icono nombre="buscar" />
        <input
          id="buscar-catalogo"
          type="search"
          autoComplete="off"
          maxLength={100}
          placeholder="Busca una atracción por nombre, categoría o dirección…"
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
        />
        {escrito && (
          <button type="button" className="btn-texto" onClick={() => setEscrito('')} aria-label="Borrar la búsqueda">
            Borrar
          </button>
        )}
      </div>

      {error && <MensajeError>{error}</MensajeError>}

      {errorCarga ? (
        <EstadoError mensaje={errorCarga} onReintentar={cargar} />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla" aria-busy={cargando}>
            <caption className="sr-only">
              Atracciones del catálogo{busqueda ? ` que coinciden con ${busqueda}` : ''}, página {pagina} de {totalPaginas}
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Aeropuerto</th>
                <th scope="col" className="num">Precio</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {cargando &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={5}>
                      <div className="fantasma fantasma--linea" style={{ margin: 0 }} />
                    </td>
                  </tr>
                ))}
              {!cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="sin-etiqueta">
                    {busqueda ? (
                      <>
                        Ninguna atracción coincide con “{busqueda}”. Revisa la ortografía o{' '}
                        <button type="button" className="btn-texto" onClick={() => setEscrito('')}>
                          borra la búsqueda
                        </button>
                        .
                      </>
                    ) : (
                      'Todavía no hay atracciones. Crea la primera con “Nueva atracción”.'
                    )}
                  </td>
                </tr>
              )}
              {!cargando &&
                filas.map((a) => {
                  const ciudad = ciudadDe(a);
                  return (
                    <tr key={a.id}>
                      <td data-etiqueta="Nombre" className="celda-principal">
                        <span className="celda-con-foto">
                          {a.photos[0] ? <img src={fotoUrl(a.photos[0].url, ANCHO.miniatura)} alt="" loading="lazy" /> : <span className="miniatura-vacia" aria-hidden="true" />}
                          {a.name}
                        </span>
                      </td>
                      <td data-etiqueta="Tipo">{TIPOS_PRODUCTO[a.product_type]}</td>
                      <td data-etiqueta="Aeropuerto">
                        {ciudad ? (
                          <>
                            <span className="codigo-iata">{ciudad.iata}</span> {ciudad.nombre}
                          </>
                        ) : (
                          'Sin ciudad'
                        )}
                      </td>
                      <td data-etiqueta="Precio" className="num">{precioTexto(a.price)}</td>
                      <td className="sin-etiqueta">
                        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                          <Link to={`/atraccion/${a.id}`} className="btn-texto" aria-label={`Ver ${a.name}`}>
                            Ver
                          </Link>
                          <Link to={`/admin/editar/${a.id}`} className="btn-texto" aria-label={`Editar ${a.name}`}>
                            <Icono nombre="editar" tamano={16} />
                            Editar
                          </Link>
                          <button type="button" className="btn-texto btn-texto--peligro" onClick={() => eliminar(a)} aria-label={`Eliminar ${a.name}`}>
                            <Icono nombre="borrar" tamano={16} />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <nav className="paginacion" aria-label="Paginación del catálogo">
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
    </section>
  );
}
