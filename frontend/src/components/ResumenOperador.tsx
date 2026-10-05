import { useEffect, useState } from 'react';
import { api } from '../api';
import { dinero } from '../carrito';

interface Datos {
  atracciones: number;
  aeropuertos: number;
  reservas: number;
  confirmadas: number;
  entradas: number;
  ingresos: number;
  muestra: number;
}

const MAXIMO = 100; // el máximo que permite la paginación del contrato

/**
 * Resumen del negocio para el operador. Usa los mismos endpoints paginados:
 * GET /atracciones?limit=100 y GET /atracciones/reservations?limit=100 (total en X-Total-Count).
 */
export default function ResumenOperador() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([api.listar(MAXIMO, 0), api.listarReservas(MAXIMO, 0)])
      .then(([cat, res]) => {
        if (!vigente) return;
        const confirmadas = res.data.filter((r) => r.status === 'CONFIRMED');
        setD({
          atracciones: cat.meta.totalItems,
          aeropuertos: new Set(cat.data.map((a) => a.locations[0]?.city).filter(Boolean)).size,
          reservas: res.total,
          confirmadas: confirmadas.length,
          entradas: confirmadas.reduce((s, r) => s + r.ticket_count, 0),
          ingresos: confirmadas.reduce((s, r) => s + r.total_price.total, 0),
          muestra: res.data.length,
        });
      })
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, []);

  if (error) return null;

  const items = d
    ? [
        { valor: String(d.atracciones), texto: `atracciones en ${d.aeropuertos} aeropuertos` },
        { valor: String(d.reservas), texto: 'reservas registradas' },
        { valor: String(d.entradas), texto: 'entradas confirmadas' },
        { valor: dinero(d.ingresos), texto: 'en ventas confirmadas' },
      ]
    : [];

  return (
    <section className="resumen-operador" aria-label="Resumen del negocio" aria-busy={!d}>
      {d
        ? items.map((i) => (
            <div key={i.texto} className="kpi">
              <p className="kpi-valor">{i.valor}</p>
              <p className="kpi-texto">{i.texto}</p>
            </div>
          ))
        : Array.from({ length: 4 }, (_, i) => <div key={i} className="kpi fantasma" />)}
      {d && d.reservas > d.muestra && (
        <p className="nota kpi-nota">Entradas y ventas calculadas sobre las {d.muestra} reservas más recientes.</p>
      )}
    </section>
  );
}
