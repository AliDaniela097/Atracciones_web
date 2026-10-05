import type { ReactNode } from 'react';

/** Tarjetas "fantasma" mientras cargan los datos (el lector de pantalla oye "Cargando…") */
export function TarjetasCargando({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="grid" aria-busy="true">
      <p className="sr-only" role="status">Cargando atracciones…</p>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="card card--fantasma" aria-hidden="true">
          <div className="fantasma fantasma--media" />
          <div className="card-cuerpo">
            <div className="fantasma fantasma--linea" />
            <div className="fantasma fantasma--linea corta" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pantalla vacía: explica qué pasa y qué hacer */
export function EstadoVacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="estado">
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}

/** Error con opción de reintentar */
export function EstadoError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="estado estado--error" role="alert">
      <h2>No se pudo cargar la información</h2>
      <p>{mensaje}</p>
      {onReintentar && (
        <button type="button" className="btn btn--suave" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Mensaje de error corto dentro de formularios */
export function MensajeError({ children }: { children: ReactNode }) {
  return (
    <p className="mensaje-error" role="alert">
      {children}
    </p>
  );
}
