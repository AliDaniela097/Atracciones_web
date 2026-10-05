import { Link, useLocation } from 'react-router-dom';
import { dinero, fechaLarga } from '../carrito';
import { LLAVE_COMPROBANTE, type Comprobante as DatosComprobante } from './Checkout';
import BotonCopiar from '../components/BotonCopiar';
import Icono from '../components/Icono';
import { EstadoVacio } from '../components/Estados';

function leerComprobante(estado: unknown): DatosComprobante | null {
  if (estado && typeof estado === 'object' && 'numero' in estado) return estado as DatosComprobante;
  try {
    return JSON.parse(sessionStorage.getItem(LLAVE_COMPROBANTE) ?? 'null');
  } catch {
    return null;
  }
}

export default function Comprobante() {
  const location = useLocation();
  const c = leerComprobante(location.state);

  if (!c) {
    return (
      <EstadoVacio titulo="No hay una compra reciente para mostrar">
        <p>Tus compras quedan guardadas en “Mis reservas”.</p>
        <Link to="/mis-reservas" className="btn">
          Ver mis reservas
        </Link>
      </EstadoVacio>
    );
  }

  return (
    <section className="angosto comprobante" aria-labelledby="titulo-comprobante">
      <header className="encabezado-pagina">
        <div>
          <p className="comprobante-ok">
            <Icono nombre="check" tamano={22} />
            Pago aprobado
          </p>
          <h1 id="titulo-comprobante">Compra confirmada</h1>
          <p>
            Comprobante <strong>{c.numero}</strong>, {new Date(c.fecha).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          <p>
            Titular: {c.titular} ({c.email})
          </p>
        </div>
      </header>

      {c.pendientes > 0 && (
        <p className="mensaje-error" role="alert">
          {c.pendientes === 1 ? 'Una atracción no se pudo comprar' : `${c.pendientes} atracciones no se pudieron comprar`} y{' '}
          {c.pendientes === 1 ? 'sigue' : 'siguen'} en tu <Link to="/carrito">carrito</Link>. No se cobró por ellas.
        </p>
      )}

      <div className="pase">
        <div className="pase-cuerpo">
          <ul className="resumen-lista">
            {c.items.map((it) => (
              <li key={it.codigo}>
                <div>
                  <strong>{it.nombre}</strong>
                  <p className="nota">
                    {fechaLarga(it.fecha)}
                    {it.hora ? `, ${it.hora}` : ''}. {it.cantidad} {it.cantidad === 1 ? 'entrada' : 'entradas'}
                  </p>
                  <div className="codigo-reserva">
                    <span>{it.codigo}</span>
                    <BotonCopiar texto={it.codigo} />
                  </div>
                </div>
                <span>{dinero(it.total)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pase-corte" aria-hidden="true" />
        <div className="pase-pie">
          <p className="resumen-total">
            Total pagado
            <strong>{dinero(c.total)}</strong>
          </p>
          <p className="nota">Tarjeta terminada en {c.tarjeta} (pago de prueba, sin cobro real).</p>
        </div>
      </div>

      <div className="acciones no-imprimir" style={{ marginTop: 20 }}>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Icono nombre="imprimir" tamano={18} />
          Imprimir o guardar en PDF
        </button>
        <Link to="/mis-reservas" className="btn btn--suave">
          Ver mis reservas
        </Link>
        <Link to="/explorar" className="btn-texto">
          Seguir explorando
        </Link>
      </div>
    </section>
  );
}
