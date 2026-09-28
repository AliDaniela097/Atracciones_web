import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { Atraccion } from '../../types';
import { nombreCiudad, TIPOS_PRODUCTO } from '../../ciudades';

const POR_PAGINA = 10;

export default function AdminAtracciones() {
  const [filas, setFilas] = useState<Atraccion[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [error, setError] = useState('');

  // GET /atracciones?limit=&offset=
  const cargar = useCallback(() => {
    api
      .listar(POR_PAGINA, (pagina - 1) * POR_PAGINA)
      .then((r) => {
        setFilas(r.data);
        setTotalPaginas(Math.max(r.meta.totalPages, 1));
      })
      .catch((e: Error) => setError(e.message));
  }, [pagina]);

  useEffect(cargar, [cargar]);

  const eliminar = async (a: Atraccion) => {
    if (!window.confirm(`¿Eliminar "${a.name}"?`)) return;
    try {
      await api.eliminar(a.id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section>
      <div className="titulo-admin">
        <h1>Administración de atracciones</h1>
        <div className="acciones">
          <Link to="/admin/reservas" className="btn secundario">Ver reservas</Link>
          <Link to="/admin/nueva" className="btn">+ Nueva atracción</Link>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <table className="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Ciudad</th>
            <th>Precio</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr><td colSpan={5} className="muted">Todavía no hay atracciones.</td></tr>
          )}
          {filas.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{TIPOS_PRODUCTO[a.product_type]}</td>
              <td>{a.locations[0] ? nombreCiudad(a.locations[0].city) : '—'}</td>
              <td>${a.price.total.toFixed(2)}</td>
              <td className="acciones">
                <Link to={`/atraccion/${a.id}`}>Ver</Link>
                <Link to={`/admin/editar/${a.id}`}>Editar</Link>
                <button className="link peligro" onClick={() => eliminar(a)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="paginacion">
        <button className="btn secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {totalPaginas}</span>
        <button className="btn secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </div>
    </section>
  );
}