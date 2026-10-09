import { Link } from 'react-router-dom';
import { useCarrito, fechaLarga, dinero, MAX_ENTRADAS_POR_LINEA } from '../carrito';
import { ciudadPorId } from '../ciudades';
import Icono from '../components/Icono';
import { EstadoVacio } from '../components/Estados';
import { ANCHO, fotoUrl } from '../lib/imagen';

export default function Carrito() {
  const { lineas, total, cantidadTotal, cambiarCantidad, quitar } = useCarrito();

  if (lineas.length === 0) {
    return (
      <EstadoVacio titulo="Tu carrito está vacío">
        <p>Elige una atracción, escoge la fecha y agrégala aquí para pagar todo junto.</p>
        <Link to="/explorar" className="btn">
          Explorar atracciones
        </Link>
      </EstadoVacio>
    );
  }

  return (
    <section aria-labelledby="titulo-carrito">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-carrito">Tu carrito</h1>
          <p>
            {cantidadTotal} {cantidadTotal === 1 ? 'entrada' : 'entradas'} en {lineas.length}{' '}
            {lineas.length === 1 ? 'atracción' : 'atracciones'}
          </p>
        </div>
      </header>

      <div className="compra">
        <ul className="lineas" aria-label="Productos del carrito">
          {lineas.map((l) => {
            const ciudad = ciudadPorId(l.ciudadId);
            return (
              <li key={l.id} className="linea">
                <Link to={`/atraccion/${l.atraccionId}`} className="linea-media" aria-hidden="true" tabIndex={-1}>
                  {l.foto ? <img src={fotoUrl(l.foto, ANCHO.miniatura)} alt="" /> : <span className="codigo-iata">{ciudad?.iata ?? 'EC'}</span>}
                </Link>
                <div className="linea-info">
                  <h2 className="linea-titulo">
                    <Link to={`/atraccion/${l.atraccionId}`}>{l.nombre}</Link>
                  </h2>
                  <p className="nota">
                    {ciudad?.nombre ?? 'Ecuador'}, {fechaLarga(l.fecha)}
                    {l.hora ? `, ${l.hora}` : ''}
                  </p>
                  <p className="nota">{dinero(l.precioUnitario)} por persona</p>
                  {l.error && (
                    <p className="mensaje-error" role="alert">
                      {l.error}
                    </p>
                  )}
                </div>
                <div className="linea-acciones">
                  <div className="cantidad" role="group" aria-label={`Entradas para ${l.nombre}`}>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(l.id, l.cantidad - 1)}
                      disabled={l.cantidad <= 1}
                      aria-label="Quitar una entrada"
                    >
                      −
                    </button>
                    <span aria-live="polite">{l.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(l.id, l.cantidad + 1)}
                      disabled={l.cantidad >= MAX_ENTRADAS_POR_LINEA}
                      aria-label="Agregar una entrada"
                    >
                      +
                    </button>
                  </div>
                  <p className="linea-subtotal">{dinero(l.cantidad * l.precioUnitario)}</p>
                  <button type="button" className="btn-texto btn-texto--peligro" onClick={() => quitar(l.id)}>
                    <Icono nombre="borrar" tamano={16} />
                    Quitar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="pase resumen" aria-label="Resumen del pedido">
          <div className="pase-cuerpo">
            <h2>Resumen</h2>
            <dl className="resumen-filas">
              {lineas.map((l) => (
                <div key={l.id}>
                  <dt>
                    {l.nombre} × {l.cantidad}
                  </dt>
                  <dd>{dinero(l.cantidad * l.precioUnitario)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="pase-corte" aria-hidden="true" />
          <div className="pase-pie formulario">
            <p className="resumen-total">
              Total a pagar
              <strong>{dinero(total)}</strong>
            </p>
            <p className="nota">Precios en dólares (USD) por persona.</p>
            <Link to="/checkout" className="btn btn--bloque">
              <Icono nombre="candado" tamano={18} />
              Continuar al pago
            </Link>
            <Link to="/explorar" className="btn btn--suave btn--bloque">
              Seguir comprando
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
