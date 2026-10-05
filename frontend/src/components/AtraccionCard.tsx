import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Atraccion } from '../types';
import { ciudadDe, formatoDuracion, precioTexto, TIPOS_PRODUCTO } from '../ciudades';
import MediaAtraccion from './MediaAtraccion';
import Icono from './Icono';

interface Props {
  a: Atraccion;
  seleccionada?: boolean;
  /** En pantallas grandes, el clic muestra el resumen en el panel derecho en vez de abrir la página */
  onSeleccionar?: (a: Atraccion) => void;
}

const PANTALLA_CON_PANEL = '(min-width: 1200px)';

export default function AtraccionCard({ a, seleccionada = false, onSeleccionar }: Props) {
  const ciudad = ciudadDe(a);

  const alHacerClic = (e: MouseEvent) => {
    if (onSeleccionar && window.matchMedia(PANTALLA_CON_PANEL).matches) {
      e.preventDefault();
      onSeleccionar(a);
    }
  };

  return (
    <article className={seleccionada ? 'card card--activa' : 'card'}>
      <Link to={`/atraccion/${a.id}`} className="card-enlace" onClick={alHacerClic} aria-current={seleccionada || undefined}>
        <div className="card-media">
          <MediaAtraccion a={a} />
          <span className="pastilla pastilla--sobre">{TIPOS_PRODUCTO[a.product_type]}</span>
        </div>
        <div className="card-cuerpo">
          <h3 className="card-titulo">{a.name}</h3>
          <p className="card-lugar">
            <Icono nombre="pin" tamano={16} />
            {ciudad?.nombre ?? 'Ecuador'}
          </p>
          <div className="card-pie">
            <p className="card-precio">
              {precioTexto(a.price)}
              {a.price.total > 0 && <small> por persona</small>}
            </p>
            <p className="card-dato">
              <Icono nombre="reloj" tamano={16} />
              {formatoDuracion(a.duration)}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
