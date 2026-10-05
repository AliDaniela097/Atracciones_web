import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fechaMasDias } from '../api';
import { useAuth } from '../auth';
import type { Atraccion, Availability } from '../types';
import { ciudadDe, formatoDuracion, nombreIdioma, precioTexto, TIPOS_PRODUCTO } from '../ciudades';
import MediaAtraccion from './MediaAtraccion';

/**
 * Panel derecho: resumen comercial de la atracción seleccionada, con forma de pase de abordar.
 * Consulta los cupos de mañana con GET /atracciones/{id}/availability.
 */
export default function PanelAtraccion({ a }: { a: Atraccion | null }) {
  const { esOperador } = useAuth();
  const [disp, setDisp] = useState<Availability | null>(null);
  const [cargandoDisp, setCargandoDisp] = useState(false);
  const manana = fechaMasDias(1);

  useEffect(() => {
    if (!a) return;
    let vigente = true;
    setCargandoDisp(true);
    setDisp(null);
    api
      .disponibilidad(a.id, manana)
      .then((d) => vigente && setDisp(d))
      .catch(() => vigente && setDisp(null))
      .finally(() => vigente && setCargandoDisp(false));
    return () => {
      vigente = false;
    };
  }, [a, manana]);

  if (!a) {
    return (
      <div className="pase pase--vacio">
        <p>Elige una atracción para ver su precio, horarios y cupos.</p>
      </div>
    );
  }

  const ciudad = ciudadDe(a);

  return (
    <div className="pase">
      <div className="pase-media">
        <MediaAtraccion a={a} />
      </div>

      <div className="pase-cuerpo">
        <h2 className="pase-titulo">{a.name}</h2>
        <p className="pase-operador">
          {ciudad ? `${ciudad.nombre}, aeropuerto ${ciudad.iata}. ` : ''}Operado por {a.operator.name}.
        </p>

        <dl className="pase-datos">
          <div>
            <dt>Precio</dt>
            <dd>{precioTexto(a.price)}</dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{formatoDuracion(a.duration)}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{TIPOS_PRODUCTO[a.product_type]}</dd>
          </div>
          <div>
            <dt>Idiomas</dt>
            <dd>{a.supported_languages.map(nombreIdioma).join(', ') || 'No indicado'}</dd>
          </div>
        </dl>

        <p className={a.free_cancellation ? 'nota nota--ok' : 'nota'}>
          {a.free_cancellation ? 'Cancelación gratuita' : 'Esta atracción no permite cancelar'}
        </p>
      </div>

      <div className="pase-corte" aria-hidden="true" />

      <div className="pase-pie">
        <p className="pase-cupos" aria-live="polite">
          {cargandoDisp ? (
            <span className="fantasma fantasma--texto" aria-label="Consultando cupos" />
          ) : disp ? (
            <>
              <strong>{disp.available_spots}</strong> cupos para mañana
            </>
          ) : (
            'Cupos no disponibles por ahora'
          )}
        </p>
        <Link to={`/atraccion/${a.id}`} className="btn btn--bloque">
          {esOperador ? 'Ver detalle' : 'Comprar entradas'}
        </Link>
      </div>
    </div>
  );
}
