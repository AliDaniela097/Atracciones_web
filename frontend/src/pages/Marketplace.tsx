import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Atraccion } from '../types';
import { CIUDADES } from '../ciudades';
import AtraccionCard from '../components/AtraccionCard';

export default function Marketplace() {
  const [ciudad, setCiudad] = useState<number | ''>('');
  const [atracciones, setAtracciones] = useState<Atraccion[]>([]);
  const [total, setTotal] = useState(0);
  const [siguiente, setSiguiente] = useState<string | undefined>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Cada vez que cambia la ciudad, se busca de nuevo (POST /atracciones/search)
  useEffect(() => {
    api
      .buscar(ciudad === '' ? [] : [ciudad])
      .then((r) => {
        setAtracciones(r.data);
        setTotal(r.metadata.total_results);
        setSiguiente(r.metadata.next_page);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [ciudad]);

  const verMas = async () => {
    if (!siguiente) return;
    try {
      const r = await api.buscar(ciudad === '' ? [] : [ciudad], siguiente);
      setAtracciones((prev) => [...prev, ...r.data]);
      setSiguiente(r.metadata.next_page);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section>
      <div className="hero">
        <h1>Atracciones cerca de los aeropuertos de Ecuador</h1>
        <p>Elige la ciudad a la que llegas y reserva tu entrada o tour.</p>
        <label>
          Ciudad / aeropuerto{' '}
          <select
            value={ciudad}
            onChange={(e) => {
              setCargando(true);
              setError('');
              setCiudad(e.target.value === '' ? '' : Number(e.target.value));
            }}
          >
            <option value="">Todas</option>
            {CIUDADES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.iata})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p>Cargando atracciones…</p>
      ) : atracciones.length === 0 ? (
        <p className="muted">No hay atracciones registradas para esta ciudad todavía.</p>
      ) : (
        <>
          <p className="muted">{total} atracción(es) encontradas</p>
          <div className="grid">
            {atracciones.map((a) => (
              <AtraccionCard key={a.id} a={a} />
            ))}
          </div>
          {siguiente && (
            <button className="btn secundario" onClick={verMas}>
              Ver más
            </button>
          )}
        </>
      )}
    </section>
  );
}