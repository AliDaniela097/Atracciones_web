import { useState, type CSSProperties } from 'react';
import type { Atraccion } from '../types';
import { ciudadDe, coloresCiudad } from '../ciudades';
import { ANCHO, fotoUrl, type AnchoFoto } from '../lib/imagen';

/**
 * Imagen principal de la atracción (enfoque media-first).
 * Si no tiene foto, o la foto no carga, se muestra una portada con el código
 * del aeropuerto. Cada aeropuerto tiene sus propios colores, inspirados en los tejidos del Ecuador.
 */
export default function MediaAtraccion({ a, ancho = ANCHO.tarjeta }: { a: Atraccion; ancho?: AnchoFoto }) {
  const [fallo, setFallo] = useState(false);
  const foto = a.photos[0]?.url;
  const ciudad = ciudadDe(a);
  const iata = ciudad?.iata ?? 'EC';
  const colores = coloresCiudad(ciudad?.id) as CSSProperties;

  if (foto && !fallo) {
    return (
      <div className="media">
        <img src={fotoUrl(foto, ancho)} alt={`Foto de ${a.name}`} loading="lazy" onError={() => setFallo(true)} />
        <span className="media-codigo" aria-hidden="true">{iata}</span>
      </div>
    );
  }

  return (
    <div className="media media--arte" style={colores} role="img" aria-label={`${a.name}, cerca del aeropuerto ${iata}`}>
      <span className="media-iata" aria-hidden="true">{iata}</span>
      <span className="media-ciudad" aria-hidden="true">{ciudad?.nombre ?? 'Ecuador'}</span>
    </div>
  );
}
