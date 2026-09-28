import { Link } from 'react-router-dom';
import type { Atraccion } from '../types';
import { formatoDuracion, nombreCiudad, TIPOS_PRODUCTO } from '../ciudades';

export default function AtraccionCard({ a }: { a: Atraccion }) {
  const foto = a.photos[0]?.url;
  return (
    <Link to={`/atraccion/${a.id}`} className="card">
      <div className="card-foto">
        {foto ? <img src={foto} alt={a.name} loading="lazy" /> : <span>Sin foto</span>}
      </div>
      <div className="card-cuerpo">
        <span className="etiqueta">{TIPOS_PRODUCTO[a.product_type]}</span>
        <h3>{a.name}</h3>
        <p className="muted">
          {a.locations[0] ? nombreCiudad(a.locations[0].city) : ''} · {formatoDuracion(a.duration)}
        </p>
        <p className="precio">
          ${a.price.total.toFixed(2)} <small>{a.price.currency} por persona</small>
        </p>
        {a.free_cancellation && <p className="ok">Cancelación gratuita</p>}
      </div>
    </Link>
  );
}